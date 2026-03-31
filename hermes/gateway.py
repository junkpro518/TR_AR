#!/usr/bin/env python3
"""
TR_AR Hermes HTTP Gateway
يغلّف hermes-agent CLI ويعرضه كـ HTTP API متوافق مع OpenAI streaming.

التدفق:
  POST /v1/chat/completions
    → يحدّث USER.md بسياق الجلسة (CEFR، مفردات، أخطاء)
    → يشغّل: python run_agent.py --query "<رسالة المستخدم>"
    → يستخلص النص بعد "FINAL RESPONSE:" من stdout
    → يبث النص كـ SSE (text/event-stream)
"""

import asyncio
import json
import os
import sys

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="Hermes Gateway")

HERMES_HOME = os.environ.get("HERMES_HOME", "/root/.hermes")
HERMES_DIR = "/hermes"
MAX_TURNS = int(os.environ.get("HERMES_MAX_TURNS", "8"))
STREAM_CHUNK = int(os.environ.get("HERMES_STREAM_CHUNK", "25"))
STREAM_DELAY = float(os.environ.get("HERMES_STREAM_DELAY", "0.012"))


def _update_user_context(messages: list[dict]) -> None:
    """
    يكتب system prompt الخاص بـ TR_AR (CEFR، مفردات، أخطاء، ملاحظات)
    إلى USER.md حتى يقرأه Hermes كجزء من ذاكرته.
    """
    system_content = next(
        (m["content"] for m in messages if m["role"] == "system"), ""
    )
    if not system_content:
        return
    path = os.path.join(HERMES_HOME, "USER.md")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write("# سياق الطالب الحالي\n\n")
            # أول 3000 حرف — يكفي لاستيعاب CEFR + مفردات + أخطاء + ملاحظات
            f.write(system_content[:3000])
            f.write("\n")
    except OSError:
        pass  # غير حرج — Hermes سيعمل بذاكرته القديمة


def _extract_final_response(lines: list[str]) -> str:
    """
    يستخلص النص بعد سطر 'FINAL RESPONSE:' من مخرجات hermes-agent.
    يُسقط banner التشغيل وبلوك CONVERSATION SUMMARY.
    """
    collecting = False
    result: list[str] = []
    for line in lines:
        if "FINAL RESPONSE:" in line:
            collecting = True
            after = line.split("FINAL RESPONSE:", 1)[-1]
            if after.strip():
                result.append(after)
            continue
        if collecting:
            result.append(line)
    return "".join(result).strip()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "hermes-gateway"}


@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> StreamingResponse | JSONResponse:
    body = await request.json()
    messages: list[dict] = body.get("messages", [])

    user_msg = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )
    if not user_msg:
        return JSONResponse({"error": "No user message"}, status_code=400)

    # حدّث ذاكرة Hermes بسياق TR_AR الحالي
    _update_user_context(messages)

    async def sse_stream():
        env = {
            **os.environ,
            "HERMES_HOME": HERMES_HOME,
            "PYTHONUNBUFFERED": "1",
        }

        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "run_agent.py",
            "--query", user_msg,
            "--max_turns", str(MAX_TURNS),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            cwd=HERMES_DIR,
            env=env,
        )

        # اجمع stdout كاملاً ثم استخلص الرد
        assert proc.stdout is not None
        raw_output = await proc.stdout.read()
        await proc.wait()

        lines = raw_output.decode(errors="replace").splitlines(keepends=True)
        text = _extract_final_response(lines)

        if not text:
            text = "[لم يتمكن Hermes من الرد — تحقق من OPENROUTER_API_KEY وسجلات الحاوية]"

        # بث النص على شكل SSE chunks (streaming feel للواجهة)
        for i in range(0, len(text), STREAM_CHUNK):
            chunk = text[i : i + STREAM_CHUNK]
            payload = json.dumps({
                "choices": [{"delta": {"content": chunk}, "finish_reason": None}]
            })
            yield f"data: {payload}\n\n"
            await asyncio.sleep(STREAM_DELAY)

        yield "data: [DONE]\n\n"

    return StreamingResponse(sse_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

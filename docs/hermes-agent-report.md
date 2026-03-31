# تقرير شامل: NousResearch/hermes-agent

> تاريخ الإنشاء: 2026-03-31  
> المصدر: https://github.com/NousResearch/hermes-agent  
> المُعِد: استكشاف آلي بواسطة وكلاء متوازيين

---

## 1. نظرة عامة على المشروع

| الحقل | القيمة |
|-------|--------|
| الاسم | hermes-agent |
| المنظمة | NousResearch |
| الوصف | "The agent that grows with you" — الوكيل الذي ينمو معك |
| النجوم | ⭐ 19,025 |
| الفروع | 2,304 |
| اللغة الأساسية | Python |
| الرخصة | MIT |
| الموقع الرسمي | https://hermes-agent.nousresearch.com |
| آخر تحديث | 2026-03-31 |
| Discord | https://discord.gg/NousResearch |
| Skills Hub | https://agentskills.io |

### الوصف التفصيلي

Hermes Agent هو إطار عمل وكيل AI يتعلم ذاتياً، مبني بواسطة Nous Research. يُعدّ "الوكيل الوحيد بحلقة تعلم مدمجة" — يخلق مهارات من التجربة ويحسّنها أثناء الاستخدام، ويبني نموذجاً متعمقاً للمستخدم عبر الجلسات.

### الموضوعات (Topics)

`ai` · `ai-agent` · `ai-agents` · `llm` · `anthropic` · `chatgpt` · `claude` · `claude-code` · `hermes` · `nous-research` · `openai` · `openclaw` · `mcp` · `agentskills`

---

## 2. الميزات الرئيسية

| الميزة | التفاصيل |
|--------|----------|
| واجهة طرفية حقيقية | TUI كاملة مع تحرير متعدد الأسطر، إكمال تلقائي للأوامر، تاريخ محادثات، بث مباشر لنتائج الأدوات |
| تعدد المنصات | Telegram, Discord, Slack, WhatsApp, Signal, CLI من عملية gateway واحدة |
| حلقة تعلم مغلقة | إنشاء مهارات تلقائي، تحسين ذاتي للمهارات، بحث FTS5 عبر الجلسات، نمذجة المستخدم عبر Honcho |
| جدولة تلقائية | جدولة cron مدمجة مع تسليم لأي منصة (تقارير يومية، نسخ احتياطية، مراجعات أسبوعية) |
| وكلاء فرعية متوازية | إطلاق subagents معزولة لمسارات عمل متوازية |
| تعدد بيئات التنفيذ | 6 backends: local, Docker, SSH, Daytona, Singularity, Modal |
| مرونة النماذج | أي نموذج: Nous Portal, OpenRouter (200+), OpenAI, Claude, GLM, Kimi — التبديل بأمر واحد |
| 40+ أداة مدمجة | نظام toolsets قابل للتخصيص |
| تكامل MCP | ربط أي MCP server لتوسيع القدرات |
| أبحاث RL | توليد trajectories للتدريب، بيئات Atropos RL |

---

## 3. التثبيت والاستخدام

### التثبيت

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc   # أو source ~/.zshrc
hermes             # ابدأ المحادثة
```

- يعمل على: Linux, macOS, WSL2
- لا يتطلب مكتبات مسبقة سوى git
- Windows الأصلي غير مدعوم (استخدم WSL2)

### أوامر CLI الرئيسية

```bash
hermes              # محادثة تفاعلية
hermes model        # اختيار مزود ونموذج LLM
hermes tools        # تكوين الأدوات المفعّلة
hermes config set   # ضبط قيم التكوين
hermes gateway      # تشغيل خادم المراسلة
hermes setup        # معالج الإعداد الكامل
hermes update       # تحديث للإصدار الأخير
hermes doctor       # تشخيص المشكلات
hermes claw migrate # الهجرة من OpenClaw
```

### أوامر slash داخل المحادثة

| الإجراء | الأمر |
|---------|-------|
| محادثة جديدة | `/new` أو `/reset` |
| تغيير النموذج | `/model [provider:model]` |
| ضبط الشخصية | `/personality [name]` |
| إعادة المحاولة / التراجع | `/retry`, `/undo` |
| ضغط السياق / استخدام التوكنز | `/compress`, `/usage`, `/insights` |
| تصفح المهارات | `/skills` أو `/<skill-name>` |
| إيقاف العمل الجاري | `/stop` |

---

## 4. المعمارية التقنية

### هيكل الطبقات (3 طبقات)

```
┌─────────────────────────────────────────────────────┐
│  CLI / Gateway Layer                                │
│  cli.py · gateway/ (Telegram, Discord, Slack, ...)  │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Agent Layer                                        │
│  run_agent.py · AIAgent · ContextCompressor         │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Tool Layer                                         │
│  tools/ · ToolRegistry · toolsets.py                │
└─────────────────────────────────────────────────────┘
```

### هيكل الملفات

```
hermes-agent/
├── agent/                  ← AIAgent + ContextCompressor + منطق الحلقة
├── tools/                  ← 40+ أداة + ToolRegistry singleton
├── gateway/                ← خادم المراسلة متعدد المنصات
├── skills/                 ← مهارات YAML قابلة للتحسين الذاتي
├── optional-skills/        ← مهارات اختيارية
├── environments/           ← backends التنفيذ (Docker, SSH, Modal...)
├── honcho_integration/     ← نمذجة المستخدم التراكمية
├── acp_adapter/            ← تكامل Agent Communication Protocol
├── acp_registry/           ← سجل ACP
├── cron/                   ← جدولة المهام المدمجة
├── hermes_cli/             ← نقطة دخول واجهة TUI
├── tinker-atropos/         ← submodule لتدريب RL
├── docs/                   ← التوثيق
├── tests/                  ← الاختبارات
├── scripts/                ← سكريبتات التثبيت والنشر
├── docker/                 ← إعدادات Docker
├── run_agent.py            ← AIAgent class + main()
├── cli.py                  ← واجهة TUI التفاعلية
├── hermes                  ← الـ executable الرئيسي
├── model_tools.py          ← اكتشاف الأدوات + بناء schemas
├── toolsets.py             ← تعريف مجموعات الأدوات
├── hermes_state.py         ← SQLite WAL + FTS5 session store
├── hermes_constants.py     ← الثوابت العامة
├── hermes_time.py          ← إدارة الوقت
├── batch_runner.py         ← توليد trajectories للتدريب
├── mcp_serve.py            ← خادم API متوافق مع OpenAI
├── pyproject.toml          ← تكوين المشروع
├── requirements.txt        ← المكتبات المطلوبة
└── RELEASE_v*.md           ← ملاحظات الإصدارات
```

---

## 5. حلقة الوكيل (Agent Loop)

```
1. تنظيف رسالة المستخدم (إزالة surrogates)
2. استعادة todo store من تاريخ المحادثة
3. بناء System Prompt:
   ├── هوية + platform hints
   ├── context files (AGENTS.md, .hermes.md)
   ├── فهرس المهارات
   ├── لقطة الذاكرة (MEMORY.md + USER.md)
   └── سياق Honcho (في التورن الأول)
4. فحص الضغط المسبق إذا تجاوز 50% من حد السياق
5. حلقة رئيسية (max 90 iteration):
   ├── فحص علامة الإيقاف
   ├── خصم من IterationBudget
   ├── تطبيق Anthropic prefix caching
   ├── استدعاء LLM (streaming دائماً)
   ├── إذا finish="stop" → إنهاء الرد
   └── إذا finish="tool_calls":
       ├── التحقق من أسماء الأدوات
       ├── _execute_tool_calls() [متوازي أو تسلسلي]
       ├── إضافة نتائج الأدوات للرسائل
       └── استمرار الحلقة
6. حفظ الجلسة في SQLite
7. تشغيل nudges للذاكرة والمهارات
```

### ضغط الميزانية (Budget Pressure)

| النسبة | الإجراء |
|--------|---------|
| 70% من الحد | حقن `[BUDGET CAUTION]` في آخر نتيجة أداة |
| 90% من الحد | حقن `[BUDGET WARNING: respond now]` |
| بعد الحلقة | تُحذف هذه الرسائل من التاريخ المُعاد تشغيله |

---

## 6. نظام الذاكرة (3 مستويات)

```
┌────────────────────────────────────────────────────────────────┐
│  المستوى 1: الذاكرة الدائمة                                   │
│  MEMORY.md (2200 حرف) · USER.md (1375 حرف)                    │
│  محمية بـ file lock · لقطة مجمّدة عند بدء الجلسة              │
├────────────────────────────────────────────────────────────────┤
│  المستوى 2: قاعدة الجلسات                                     │
│  SQLite WAL + FTS5 · بحث نصي كامل عبر جميع الجلسات            │
│  أداة session_search + تلخيص LLM                              │
├────────────────────────────────────────────────────────────────┤
│  المستوى 3: نمذجة المستخدم (Honcho)                           │
│  تعلم تراكمي لشخصية المستخدم · recall_mode قابل للتكوين       │
│  أوضاع: "tools" / "hybrid" / "auto"                           │
└────────────────────────────────────────────────────────────────┘
```

### لماذا اللقطة المجمّدة؟

لحماية Anthropic prefix cache — التعديلات على `MEMORY.md` تُكتب على القرص لكنها لا تُحدّث الـ system prompt الحالي، مما يحافظ على كفاءة التخزين المؤقت ويوفر ~75% من تكلفة الإدخال.

---

## 7. ضغط السياق (Context Compression)

**الخوارزمية:**

```
1. تقدير عدد التوكنز (4 chars/token heuristic)
2. إذا > 50% من حد السياق:
   a. حذف outputs الأدوات القديمة → "[Old tool output cleared]"
   b. حماية أول 3 رسائل + آخر N رسائل (بحسب ميزانية)
   c. استدعاء LLM رخيص لتلخيص الوسط:
      - الهدف / التقدم / القرارات / الملفات / الخطوات التالية
   d. حقن "[CONTEXT COMPACTION]" block
3. ضغط لاحق: تحديث الملخص السابق تراكمياً
```

---

## 8. نظام الأدوات

### آلية التسجيل

```python
# كل tools/*.py يسجّل نفسه عند الاستيراد:
registry.register(
    name="web_search",
    toolset="web",
    schema={...},              # OpenAI function schema
    handler=web_search_fn,     # الدالة المنفّذة
    check_fn=check_web_tools,  # هل البيئة مهيّأة؟
    requires_env=["OPENROUTER_API_KEY"],
    is_async=False,
    emoji="🔍",
)
```

### مسار التنفيذ

```
LLM response (tool_calls)
    ↓
AIAgent._execute_tool_calls()
    ↓ هل يمكن التوازي؟
    ├── Sequential: _execute_tool_calls_sequential()
    └── Concurrent: ThreadPoolExecutor (max 8)
         ↓
    AIAgent._invoke_tool()
         ├── أدوات داخلية (todo, memory, session_search, delegate_task)
         └── أدوات خارجية → registry.dispatch() → handler(args)
```

### شروط التوازي

التوازي مسموح فقط إذا:
- لا يوجد أداة `clarify` في الدفعة
- جميع الأدوات في قائمة `_PARALLEL_SAFE_TOOLS`
- أدوات الملفات تستهدف مسارات غير متداخلة

---

## 9. نظام Subagents (التفويض)

| الخاصية | القيمة |
|---------|--------|
| نوع الـ child | نسخة `AIAgent` مستقلة تماماً |
| ميزانية كل child | 50 iteration (مستقلة عن الأب) |
| أقصى عمق | 2 (parent → child → grandchild مرفوض) |
| أقصى توازي | 3 أطفال متزامنين |
| تاريخ المحادثة | لا يرث تاريخ الأب (يبدأ نظيفاً) |
| الأدوات المحجوبة | `delegate_task, clarify, memory, send_message, execute_code` |
| النتيجة | تُلخّص في رسالة أداة واحدة في سياق الأب |

---

## 10. الأمان (Security)

### الحماية من حقن البرومبت

الفحوصات التي تُطبَّق على ملفات السياق والذاكرة:
- `ignore previous instructions` وما يشابهها
- أحرف Unicode المخفية (U+200B–U+202E)
- تعليقات HTML مخفية
- أنماط الاستخراج مثل `curl $API_KEY`

عند اكتشاف أي منها: يُستبدل الملف بـ `[BLOCKED: ...]`

### الـ Safe stdio Wrapper

`_SafeWriter` يلتف حول `stdout`/`stderr` لالتقاط `OSError`/`ValueError` من الأنابيب المكسورة في بيئات headless daemon.

---

## 11. دعم النماذج

| المزود | النماذج |
|--------|---------|
| Nous Portal | نماذج Hermes |
| OpenRouter | 200+ نموذج |
| OpenAI | GPT-4, o1, o3... |
| Anthropic | Claude 3/4 (native SDK) |
| z.ai / GLM | نماذج GLM |
| Kimi / Moonshot | نماذج Kimi |
| MiniMax | نماذج MiniMax |
| أي endpoint | متوافق مع OpenAI API |

### 3 أوضاع API

1. `chat_completions` — OpenAI-compatible (افتراضي)
2. `codex_responses` — OpenAI Responses API
3. `anthropic_messages` — Anthropic SDK أصلي

### تحسينات Claude

- **Prefix caching**: يحقن `cache_control` على system prompt + آخر 3 رسائل → توفير ~75% من تكلفة الإدخال
- **Fine-grained streaming**: header `x-anthropic-beta: fine-grained-tool-streaming-2025-05-14` لمنع التوقف الصامت

---

## 12. Streaming والموثوقية

- **Streaming دائم** حتى بدون display consumers — لكشف التوقف الصامت (90 ثانية stale stream)
- **Read timeout**: 60 ثانية لمنع التعليق من مزودين يرسلون SSE pings بلا محتوى
- **Async bridging**: event loops مستمرة per-thread لتجنب أخطاء `"Event loop is closed"`
- **Fallback chains**: قائمة مرتبة من `{provider, model}` تُفعَّل عند rate limits أو ردود مشوّهة مع exponential backoff

---

## 13. منصات التنفيذ

| البيئة | الوصف |
|--------|-------|
| Local | تنفيذ محلي مباشر |
| Docker | حاوية معزولة |
| SSH | خادم بعيد |
| Daytona | بيئة تطوير سحابية |
| Singularity | HPC containers |
| Modal | serverless GPU/CPU |

---

## 14. منصات المراسلة

| المنصة | الميزات |
|--------|---------|
| Telegram | رسائل، صوت، ملفات، أزرار inline |
| Discord | رسائل، channels، بوت |
| Slack | رسائل، workspaces |
| WhatsApp | رسائل، مذكرات صوتية |
| Signal | رسائل مشفرة |
| SMS | رسائل نصية |
| Email | بريد إلكتروني |

---

## 15. نقاط الدخول

| الملف | الغرض |
|-------|-------|
| `hermes` | shell wrapper، يُثبَّت في PATH |
| `cli.py` | TUI تفاعلي مع prompt_toolkit |
| `run_agent.py` | `AIAgent` class + `main()` عبر fire |
| `gateway/` | خادم المراسلة متعدد المنصات |
| `mcp_serve.py` | خادم API متوافق مع OpenAI |
| `batch_runner.py` | توليد trajectories لتدريب RL |
| `hermes_state.py` | SQLite session store (مشترك بين الأوضاع) |

---

## 16. الهجرة من OpenClaw

```bash
hermes claw migrate              # هجرة تفاعلية
hermes claw migrate --dry-run    # معاينة فقط
hermes claw migrate --preset user-data   # بدون أسرار
hermes claw migrate --overwrite  # الكتابة فوق التعارضات
```

**ما يُنقل:** SOUL.md، الذاكرات، المهارات، قائمة الأوامر المسموحة، إعدادات المراسلة، مفاتيح API، أصول TTS، تعليمات مساحة العمل.

---

## 17. روابط التوثيق

| القسم | الرابط |
|-------|--------|
| البداية السريعة | hermes-agent.nousresearch.com/docs/getting-started/quickstart |
| استخدام CLI | hermes-agent.nousresearch.com/docs/user-guide/cli |
| التكوين | hermes-agent.nousresearch.com/docs/user-guide/configuration |
| خادم المراسلة | hermes-agent.nousresearch.com/docs/user-guide/messaging |
| الأمان | hermes-agent.nousresearch.com/docs/user-guide/security |
| الأدوات والـ Toolsets | hermes-agent.nousresearch.com/docs/user-guide/features/tools |
| نظام المهارات | hermes-agent.nousresearch.com/docs/user-guide/features/skills |
| الذاكرة | hermes-agent.nousresearch.com/docs/user-guide/features/memory |
| تكامل MCP | hermes-agent.nousresearch.com/docs/user-guide/features/mcp |
| جدولة Cron | hermes-agent.nousresearch.com/docs/user-guide/features/cron |
| المعمارية | hermes-agent.nousresearch.com/docs/developer-guide/architecture |
| المساهمة | hermes-agent.nousresearch.com/docs/developer-guide/contributing |
| مرجع CLI | hermes-agent.nousresearch.com/docs/reference/cli-commands |
| متغيرات البيئة | hermes-agent.nousresearch.com/docs/reference/environment-variables |

---

## 18. ما يميز هذا المشروع (الخلاصة)

1. **حلقة تعلم مغلقة حقيقية** — ينشئ مهارات بعد المهام المعقدة ويحسّنها تلقائياً
2. **ذاكرة دائمة بحث كامل** — FTS5 + LLM summarization عبر كل الجلسات
3. **مرونة النماذج الكاملة** — تبديل بأمر واحد دون تعديل الكود
4. **أمان متعدد الطبقات** — regex + Unicode detection لمنع حقن البرومبت
5. **كفاءة التوكنز** — prefix caching يوفر 75% من تكلفة الإدخال مع Claude
6. **قابلية التوسع** — من VPS بـ 5$ إلى GPU cluster، نفس الكود
7. **مجتمع نشط** — 19K نجمة، معيار agentskills.io المفتوح للمهارات

# Hermes Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** استبدال طبقة OpenRouter المباشرة في TR_AR بـ Hermes Agent كـ sidecar service، مع الاحتفاظ بكل وظائف المعلم التركي: SRS، الـ XP، Telegram، TTS، Supabase، والـ streaming.

**Architecture:** يعمل Hermes كخادم API متوافق مع OpenAI (`mcp_serve.py`) على port 8000 داخل Docker. يبني TR_AR الـ system prompt (CEFR + vocab + goals) ثم يرسله لـ Hermes، الذي يضيف ذاكرة دائمة + ضغط سياق + مهارات تلقائية + budget pressure، ثم يستدعي OpenRouter. TR_AR يستقبل الـ stream ويحفظ في Supabase كالمعتاد.

**Tech Stack:** Python 3.11 + hermes-agent + uv | Next.js 15 + TypeScript | Docker Compose | Supabase | OpenRouter

---

## خريطة الملفات

| الملف | النوع | الغرض |
|-------|-------|-------|
| `hermes/Dockerfile` | جديد | بناء صورة Docker لـ Hermes |
| `hermes/cli-config.yaml` | جديد | تكوين Hermes (model, toolset, memory limits) |
| `hermes/MEMORY.md` | جديد | الذاكرة الأولية للمعلم التركي |
| `hermes/USER.md` | جديد | ملف تعريف المستخدم الأولي |
| `hermes/.hermes.md` | جديد | سياق TR_AR المستمر لـ Hermes |
| `hermes/skills/turkish-teacher.md` | جديد | مهارة التدريس الرئيسية |
| `hermes/skills/grammar-feedback.md` | جديد | مهارة تحليل الأخطاء النحوية |
| `hermes/skills/vocab-review.md` | جديد | مهارة مراجعة المفردات SRS |
| `hermes/start.sh` | جديد | سكريبت تشغيل Hermes API server |
| `lib/hermes-client.ts` | جديد | TypeScript HTTP client لـ Hermes |
| `app/api/chat/route.ts` | تعديل | استدعاء Hermes بدلاً من OpenRouter مباشرةً |
| `lib/openrouter.ts` | تعديل | إضافة Hermes fallback + دعم endpoint مخصص |
| `docker-compose.prod.yml` | تعديل | إضافة خدمة hermes |
| `.env.example` | تعديل | إضافة `HERMES_API_URL` و `HERMES_API_KEY` |

---

## Task 1: إنشاء مجلد Hermes وملف Dockerfile

**Files:**
- Create: `hermes/Dockerfile`
- Create: `hermes/start.sh`

- [ ] **Step 1: إنشاء مجلد hermes**

```bash
mkdir -p /Users/mohammedaljohani/Documents/Proj/TR_AR/hermes/skills
mkdir -p /Users/mohammedaljohani/Documents/Proj/TR_AR/hermes/tools
```

- [ ] **Step 2: كتابة `hermes/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# تثبيت git و uv
RUN apt-get update && apt-get install -y git curl && \
    pip install uv && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# استنساخ Hermes
RUN git clone https://github.com/NousResearch/hermes-agent.git /hermes

WORKDIR /hermes

# تثبيت المكتبات
RUN uv pip install --system -e ".[all]" || \
    pip install -r requirements.txt

# نسخ ملفات التكوين الخاصة بـ TR_AR
COPY hermes/cli-config.yaml /hermes/cli-config.yaml
COPY hermes/MEMORY.md /hermes/MEMORY.md
COPY hermes/USER.md /hermes/USER.md
COPY hermes/.hermes.md /hermes/.hermes.md
COPY hermes/skills/ /hermes/skills/
COPY hermes/start.sh /hermes/start.sh

RUN chmod +x /hermes/start.sh

EXPOSE 8000

CMD ["/hermes/start.sh"]
```

- [ ] **Step 3: كتابة `hermes/start.sh`**

```bash
#!/bin/bash
set -e

cd /hermes

# تشغيل Hermes كخادم OpenAI-compatible API على port 8000
exec python mcp_serve.py \
  --host 0.0.0.0 \
  --port 8000 \
  --config /hermes/cli-config.yaml
```

- [ ] **Step 4: التحقق من وجود mcp_serve.py في Hermes**

```bash
# يُشغَّل بعد clone — للتأكد من وجود الملف
ls /hermes/mcp_serve.py 2>/dev/null && echo "OK" || echo "MISSING — check Hermes version"
```

- [ ] **Step 5: Commit**

```bash
git add hermes/Dockerfile hermes/start.sh
git commit -m "feat: add Hermes Agent Dockerfile and startup script"
```

---

## Task 2: ملفات تكوين Hermes

**Files:**
- Create: `hermes/cli-config.yaml`
- Create: `hermes/MEMORY.md`
- Create: `hermes/USER.md`
- Create: `hermes/.hermes.md`

- [ ] **Step 1: كتابة `hermes/cli-config.yaml`**

```yaml
# Hermes TR_AR Configuration
provider: openrouter
model: ${CHAT_MODEL:-google/gemini-2.0-flash-001}
base_url: https://openrouter.ai/api/v1
api_key: ${OPENROUTER_API_KEY}

# خادم الـ API
server:
  host: 0.0.0.0
  port: 8000

# الذاكرة
memory:
  memory_file: /hermes/MEMORY.md
  user_file: /hermes/USER.md
  max_memory_chars: 2200
  max_user_chars: 1375

# المهارات
skills:
  skills_dir: /hermes/skills
  auto_load: true

# السياق
context:
  max_iterations: 90
  compression_threshold: 0.5

# الأمان
security:
  scan_context_files: true
  prompt_injection_check: true

# Streaming
streaming:
  enabled: true
  stale_timeout: 90
  read_timeout: 60
```

- [ ] **Step 2: كتابة `hermes/MEMORY.md`**

```markdown
# ذاكرة المعلم التركي

## هويتي
أنا مُعلِّم لغة تركية لطالب عربي يتعلم التركية عبر تطبيق TR_AR.
أساعد الطالب على التعلم التدريجي من مستوى A1 إلى C2 وفق إطار CEFR.

## أسلوبي
- أتحدث بالعربية أولاً، ثم بالتركية (لا إنجليزي)
- أُصحح الأخطاء بلطف مع الشرح
- أستخدم Markdown لتنسيق الردود
- أُضمّن اختبارات `[QUIZ]` دورية لتعزيز التعلم

## ما تعلمته عن الطالب
(سيتم تحديثه تلقائياً بعد كل جلسة)
```

- [ ] **Step 3: كتابة `hermes/USER.md`**

```markdown
# ملف المتعلم

## المعلومات الأساسية
- يتعلم: التركية
- لغته الأم: العربية
- المستوى: يُحدَّد من السياق (A1 افتراضياً)

## التفضيلات
- يفضل الشرح بالعربية
- يحب التصحيح اللطيف
- يستخدم نظام SRS للمفردات

## ملاحظات المعلم
(سيتم تحديثه تلقائياً)
```

- [ ] **Step 4: كتابة `hermes/.hermes.md`**

```markdown
# TR_AR Context

أنت تعمل كمعلم التركية في تطبيق TR_AR.
كل رسالة نظام تحتوي على:
- مستوى CEFR الحالي للطالب
- قائمة المفردات المعروفة
- الأهداف التعليمية النشطة
- الأخطاء الشائعة الأخيرة

استخدم هذه المعلومات لتخصيص ردودك.
حافظ على ذاكرتك الداخلية لتتبع تقدم الطالب عبر الجلسات.
```

- [ ] **Step 5: Commit**

```bash
git add hermes/cli-config.yaml hermes/MEMORY.md hermes/USER.md hermes/.hermes.md
git commit -m "feat: add Hermes TR_AR configuration and memory files"
```

---

## Task 3: مهارة المعلم التركي الرئيسية

**Files:**
- Create: `hermes/skills/turkish-teacher.md`

- [ ] **Step 1: كتابة `hermes/skills/turkish-teacher.md`**

```markdown
---
name: turkish-teacher
description: مهارة تدريس اللغة التركية للناطقين بالعربية — تُفعَّل تلقائياً في كل محادثة
platforms: [api, cli]
conditions: always
---

# مهارة المعلم التركي

## الهوية والأسلوب

أنت مُعلِّم لغة تركية متخصص للناطقين بالعربية. اسمك غير مهم — دورك هو مساعدة الطالب على إتقان التركية.

**قواعد صارمة:**
- تحدث بالعربية أولاً دائماً + الكلمات التركية
- لا تستخدم الإنجليزية أبداً
- استخدم Markdown لتنسيق الردود (عناوين، قوائم، كود للكلمات التركية)
- ردودك بين 100-300 كلمة (لا أكثر)

## مستويات CEFR

ستجد في الـ system message مستوى الطالب. التزم به:

**A1:** جمل بسيطة جداً (5-7 كلمات). مفردات أساسية فقط. كرر الكلمات المهمة.
**A2:** جمل بسيطة. مفردات يومية شائعة. اشرح الكلمات الجديدة فوراً.
**B1:** محادثة طبيعية. امزج المألوف مع الجديد. موضوعات يومية متنوعة.
**B2:** تحدث بشكل طبيعي وسلس. تعابير اصطلاحية أحياناً. موضوعات مجردة.
**C1:** تحدث كالناطق الأصلي. أمثال وتراكيب معقدة. تحدّ الطالب.
**C2:** مستوى الناطق الأصلي الكامل. عامية ومفردات راقية بحرية.

## نظام الأخطاء والتصحيح

عند رؤية خطأ في رسالة الطالب:
1. رد على موضوع الرسالة أولاً (لا تبدأ بالتصحيح)
2. في نهاية ردك، صحّح بلطف:
   - `❌ كتبت: [الخطأ]`
   - `✅ الصحيح: [التصحيح]`
   - `💡 [شرح قصير بالعربية]`

مستويات التصحيح (من الـ system message):
- **gentle:** صحّح فقط الأخطاء الكبيرة
- **moderate:** صحّح الأخطاء الشائعة (افتراضي)
- **strict:** صحّح كل الأخطاء

## نظام الاختبارات [QUIZ]

أضف اختباراً اختيارياً بعد شرح قاعدة نحوية. صيغته:

```
[QUIZ]
السؤال: [سؤال بالعربية]
A: [خيار]
B: [خيار]
C: [خيار]
D: [خيار]
CORRECT: [A/B/C/D]
[/QUIZ]
```

**قواعد:**
- اختبار واحد كحد أقصى لكل رد
- في نهاية الرد فقط
- بعد الشرح، ليس قبله
- 3-4 خيارات فقط

## اقتراح الأهداف [GOAL]

عند رؤية ضعف متكرر، اقترح هدفاً:
```
[GOAL: إتقان تصريف الأفعال في زمن الماضي]
```
هذا يُضاف تلقائياً لقائمة أهداف الطالب في التطبيق.

## اقتراح تحسين الشخصية [SUGGEST_PROMPT]

إذا لاحظت أن أسلوب التدريس الحالي لا يناسب الطالب، اقترح تعديلاً:
```
[SUGGEST_PROMPT: أسلوب أكثر تفاعلاً مع أسئلة مفتوحة...]
```
سيُرسَل هذا للمراجعة عبر Telegram.

## المفردات الجديدة

عند تقديم كلمة جديدة، استخدم الصيغة:
```
**[الكلمة التركية]** — [المعنى بالعربية]
مثال: *[جملة مثال بالتركية]*
```

## ذاكرة الجلسة

- تذكر ما تعلمه الطالب في هذه الجلسة
- أشر إلى الأخطاء المتكررة بلطف
- احتفل بالتقدم: "ممتاز! في الجلسة الماضية واجهت صعوبة في هذه النقطة — الآن أحسنت!"
```

- [ ] **Step 2: التحقق من صياغة frontmatter**

```bash
# frontmatter يجب أن يبدأ بـ --- وينتهي بـ ---
head -5 hermes/skills/turkish-teacher.md
# Expected: ---\nname: turkish-teacher\n...
```

- [ ] **Step 3: Commit**

```bash
git add hermes/skills/turkish-teacher.md
git commit -m "feat: add Turkish teacher skill for Hermes agent"
```

---

## Task 4: مهارتا التغذية الراجعة ومراجعة المفردات

**Files:**
- Create: `hermes/skills/grammar-feedback.md`
- Create: `hermes/skills/vocab-review.md`

- [ ] **Step 1: كتابة `hermes/skills/grammar-feedback.md`**

```markdown
---
name: grammar-feedback
description: تحليل الأخطاء النحوية التركية وتصنيفها حسب taxonomy محددة
platforms: [api]
conditions: always
---

# مهارة تحليل الأخطاء النحوية

## نقاط القواعد المتتبعة

عند تحليل رسائل الطالب، صنّف الأخطاء في هذه الفئات:

| الفئة | المعنى بالعربية |
|-------|----------------|
| past_tense | الماضي |
| present_tense | المضارع |
| future_tense | المستقبل |
| tense_confusion | الخلط بين الأزمنة |
| word_order | ترتيب الكلمات |
| vowel_harmony | الانسجام الصوتي |
| case_suffix | لواحق الحالة |
| verb_conjugation | تصريف الأفعال |
| plural_form | صيغة الجمع |
| preposition | حروف الجر |
| pronoun | الضمائر |
| negation | النفي |
| question_formation | صياغة الأسئلة |
| other | أخرى |

## تقييم الـ XP

- لا أخطاء = 10 XP
- أخطاء بسيطة = 5 XP
- أخطاء كبيرة = 2 XP
```

- [ ] **Step 2: كتابة `hermes/skills/vocab-review.md`**

```markdown
---
name: vocab-review
description: مراجعة المفردات باستخدام نظام التكرار المتباعد SRS
platforms: [api, cli]
conditions: when_reviewing_vocab
---

# مهارة مراجعة المفردات (SRS)

## نظام SM-2

عند مراجعة بطاقة مفردات، اطرح الكلمة التركية واطلب الترجمة العربية.

**تقييم الإجابة (0-5):**
- 0 = نسيت تماماً
- 2 = صعب جداً
- 3 = صحيح مع تردد
- 4 = صحيح بسهولة
- 5 = سهل جداً

## أسلوب التقديم

```
📚 **مراجعة مفردات**

**الكلمة:** `[كلمة تركية]`
ما معناها بالعربية؟
```

بعد الإجابة:
```
✅ صحيح! المعنى: [الترجمة]
مثال: *[جملة بالتركية]*

⏳ موعد المراجعة القادمة: [X أيام]
```
```

- [ ] **Step 3: Commit**

```bash
git add hermes/skills/grammar-feedback.md hermes/skills/vocab-review.md
git commit -m "feat: add grammar feedback and vocab review skills for Hermes"
```

---

## Task 5: TypeScript Hermes Client

**Files:**
- Create: `lib/hermes-client.ts`

- [ ] **Step 1: كتابة `lib/hermes-client.ts`**

```typescript
/**
 * Hermes Agent HTTP Client
 * يستدعي Hermes API المتوافقة مع OpenAI بدلاً من OpenRouter مباشرةً.
 * Hermes يضيف: ذاكرة دائمة + ضغط سياق + مهارات + budget pressure
 */

const HERMES_BASE = process.env.HERMES_API_URL ?? 'http://localhost:8000'
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? 'tr-ar-internal'

export function buildHermesHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${HERMES_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * يبث رداً من Hermes Agent (OpenAI-compatible streaming)
 * يُستخدم بدلاً من streamChatCompletion في openrouter.ts
 */
export async function streamHermesCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model?: string,
): Promise<ReadableStream<string>> {
  const response = await fetch(`${HERMES_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHermesHeaders(),
    body: JSON.stringify({
      model: model ?? 'default',
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Hermes error ${response.status}: ${error}`)
  }

  if (!response.body) throw new Error('No response body from Hermes')

  const decoder = new TextDecoder()
  let buffer = ''

  // TransformStream — متوافق مع Cloudflare Workers
  const { readable, writable } = new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) controller.enqueue(content)
        } catch { /* skip malformed */ }
      }
    },
    flush(controller) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim()
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) controller.enqueue(content)
          } catch { /* skip */ }
        }
      }
    },
  })

  response.body.pipeTo(writable).catch(() => {})
  return readable
}

/**
 * فحص صحة اتصال Hermes
 */
export async function checkHermesHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${HERMES_BASE}/health`, {
      method: 'GET',
      headers: buildHermesHeaders(),
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hermes-client.ts
git commit -m "feat: add TypeScript Hermes API client"
```

---

## Task 6: تعديل `/api/chat/route.ts` لاستخدام Hermes

**Files:**
- Modify: `app/api/chat/route.ts` (السطور 95-212 — استبدال استدعاء OpenRouter)

هدف التعديل: استبدال `streamChatCompletion(apiKey, model, messages)` بـ `streamHermesCompletion(messages, model)` مع fallback لـ OpenRouter إذا كان Hermes غير متاح.

- [ ] **Step 1: إضافة import لـ hermes-client في route.ts**

في السطر 1-9 من `app/api/chat/route.ts`، أضف:
```typescript
import { streamHermesCompletion, checkHermesHealth } from '@/lib/hermes-client'
```

- [ ] **Step 2: استبدال منطق الـ streaming (السطور 203-212)**

ابحث عن هذا الكود في `app/api/chat/route.ts`:
```typescript
  // Stream response from OpenRouter
  let stream: ReadableStream<string>
  try {
    stream = await streamChatCompletion(apiKey, model, messages)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
```

استبدله بـ:
```typescript
  // Stream response — يحاول Hermes أولاً، fallback لـ OpenRouter
  let stream: ReadableStream<string>
  try {
    const useHermes = process.env.HERMES_API_URL && await checkHermesHealth()
    if (useHermes) {
      stream = await streamHermesCompletion(messages, model)
    } else {
      stream = await streamChatCompletion(apiKey, model, messages)
    }
  } catch (err) {
    // إذا فشل Hermes، جرب OpenRouter مباشرةً
    try {
      stream = await streamChatCompletion(apiKey, model, messages)
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
```

- [ ] **Step 3: التحقق من TypeScript**

```bash
cd /Users/mohammedaljohani/Documents/Proj/TR_AR
npx tsc --noEmit 2>&1 | head -20
# Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts lib/hermes-client.ts
git commit -m "feat: route chat through Hermes Agent with OpenRouter fallback"
```

---

## Task 7: إضافة Hermes لـ Docker Compose

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`

- [ ] **Step 1: تعديل `docker-compose.prod.yml`**

أضف خدمة `hermes` قبل `networks:`:

```yaml
  hermes:
    build:
      context: .
      dockerfile: hermes/Dockerfile
    image: tr-ar-hermes:latest
    container_name: tr-ar-hermes
    restart: unless-stopped

    env_file:
      - .env

    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - CHAT_MODEL=${CHAT_MODEL:-google/gemini-2.0-flash-001}
      - HERMES_API_KEY=${HERMES_API_KEY:-tr-ar-internal}

    volumes:
      - hermes_data:/hermes/data
      - hermes_memory:/hermes/memory

    networks:
      - proxy

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

    logging:
      options:
        max-size: "10m"
        max-file: "3"
```

وأضف في قسم `tr-ar` environment:
```yaml
      - HERMES_API_URL=http://hermes:8000
      - HERMES_API_KEY=${HERMES_API_KEY:-tr-ar-internal}
```

وأضف في قسم volumes (جديد):
```yaml
volumes:
  hermes_data:
  hermes_memory:
```

- [ ] **Step 2: تحديث `.env.example`**

أضف في نهاية الملف:
```bash
# Hermes Agent (sidecar AI service)
HERMES_API_URL=http://hermes:8000   # داخل Docker، أو http://localhost:8000 محلياً
HERMES_API_KEY=tr-ar-internal       # مفتاح داخلي للتوثيق بين الخدمتين
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.prod.yml .env.example
git commit -m "feat: add Hermes Agent as Docker sidecar service"
```

---

## Task 8: متغيرات البيئة المحلية للتطوير

**Files:**
- Modify: `.env.local` (غير محفوظ في git)

- [ ] **Step 1: إضافة متغيرات Hermes للتطوير المحلي**

```bash
# أضف هذه الأسطر لـ .env.local
cat >> /Users/mohammedaljohani/Documents/Proj/TR_AR/.env.local << 'EOF'

# Hermes Agent (للتطوير المحلي — شغّل Hermes على port 8000 أولاً)
HERMES_API_URL=http://localhost:8000
HERMES_API_KEY=tr-ar-internal
EOF
```

- [ ] **Step 2: تشغيل Hermes محلياً للاختبار (على جهاز آخر أو terminal منفصل)**

```bash
# في terminal منفصل:
cd /path/to/hermes-agent
OPENROUTER_API_KEY=your_key python mcp_serve.py --host 0.0.0.0 --port 8000
# Expected: "Hermes API server running on http://0.0.0.0:8000"
```

- [ ] **Step 3: اختبار الاتصال**

```bash
curl -s http://localhost:8000/health
# Expected: {"status": "ok"} أو {"status": "healthy"}
```

- [ ] **Step 4: اختبار streaming من Hermes**

```bash
curl -s -N http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer tr-ar-internal" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.0-flash-001",
    "messages": [
      {"role": "system", "content": "أنت معلم تركي. مستوى الطالب: A1"},
      {"role": "user", "content": "مرحباً، أريد تعلم التركية"}
    ],
    "stream": true
  }'
# Expected: SSE stream مع data: {"choices":[{"delta":{"content":"..."}}]}
```

---

## Task 9: اختبار التكامل الكامل

- [ ] **Step 1: بناء التطبيق للتحقق من الأخطاء**

```bash
cd /Users/mohammedaljohani/Documents/Proj/TR_AR
npm run build 2>&1 | tail -20
# Expected: ✓ Compiled successfully
```

- [ ] **Step 2: تشغيل التطبيق محلياً مع Hermes**

```bash
# Terminal 1: Hermes
OPENROUTER_API_KEY=... python /path/to/hermes/mcp_serve.py --port 8000

# Terminal 2: TR_AR
cd /Users/mohammedaljohani/Documents/Proj/TR_AR
npm run dev
```

- [ ] **Step 3: اختبار المحادثة عبر المتصفح**

افتح `http://localhost:3000/chat` وأرسل رسالة. التحقق من:
- [ ] الـ streaming يعمل (الرد يظهر تدريجياً)
- [ ] الرد بالعربية + التركية
- [ ] الرد محفوظ في Supabase (تحقق من جدول messages)
- [ ] لا أخطاء TypeScript في console

- [ ] **Step 4: اختبار Fallback — إيقاف Hermes**

```bash
# أوقف Hermes
kill $(lsof -ti:8000)
# أرسل رسالة من المتصفح
# Expected: الرد يأتي من OpenRouter مباشرةً (بدون مهارات Hermes)
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify Hermes integration with OpenRouter fallback"
```

---

## Task 10: بناء Docker وتجربة الإنتاج

**Files:**
- Modify: `deploy.sh` (إضافة بناء hermes)

- [ ] **Step 1: تعديل `deploy.sh` لبناء Hermes**

ابحث عن سطر `docker compose` في `deploy.sh` وتأكد من:
```bash
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

- [ ] **Step 2: اختبار بناء Docker محلياً**

```bash
cd /Users/mohammedaljohani/Documents/Proj/TR_AR
docker compose -f docker-compose.prod.yml build hermes 2>&1 | tail -30
# Expected: Successfully built <image_id>
```

- [ ] **Step 3: تشغيل Docker Compose محلياً**

```bash
docker compose -f docker-compose.prod.yml up hermes -d
docker logs tr-ar-hermes -f
# Expected: "Hermes API server running on http://0.0.0.0:8000"
```

- [ ] **Step 4: التحقق من الصحة داخل Docker**

```bash
docker exec tr-ar-hermes curl -s http://localhost:8000/health
# Expected: {"status": "ok"}
```

- [ ] **Step 5: Commit ونشر**

```bash
git add deploy.sh
git commit -m "feat: complete Hermes Agent integration — deploy ready"
git push origin main
```

---

## Task 11: تكامل Telegram مع Hermes Gateway (اختياري)

> هذا Task اختياري يضيف قدرة مراسلة Telegram عبر Hermes Gateway.
> بدونه: Telegram يعمل كما هو (notifications + approvals فقط).
> معه: يمكن التحدث مع المعلم مباشرةً عبر Telegram.

**Files:**
- Create: `hermes/gateway-config.yaml`

- [ ] **Step 1: كتابة `hermes/gateway-config.yaml`**

```yaml
# Hermes Gateway — Telegram Integration
gateway:
  enabled: true
  platforms:
    telegram:
      enabled: true
      token: ${TELEGRAM_BOT_TOKEN}
      chat_ids:
        - ${TELEGRAM_CHAT_ID}
      # نفس المعلم التركي
      toolset: tr_ar_chat
      system_prompt: |
        أنت معلم تركي للطالب. 
        المستخدم يتحدث معك عبر Telegram.
        استخدم مهارة turkish-teacher.
```

- [ ] **Step 2: إضافة gateway لـ docker-compose.prod.yml**

في خدمة `hermes`، عدّل CMD:
```yaml
    command: >
      bash -c "python mcp_serve.py --host 0.0.0.0 --port 8000 &
               python -m gateway.main --config /hermes/gateway-config.yaml"
```

- [ ] **Step 3: إضافة TELEGRAM_BOT_TOKEN لبيئة Hermes**

في `docker-compose.prod.yml` قسم hermes environment:
```yaml
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
```

- [ ] **Step 4: Commit**

```bash
git add hermes/gateway-config.yaml
git commit -m "feat: add optional Hermes Telegram gateway for direct chat"
```

---

## ملخص الملفات المتأثرة

| الملف | الحالة | الهدف |
|-------|--------|-------|
| `hermes/Dockerfile` | جديد | بناء Hermes service |
| `hermes/start.sh` | جديد | تشغيل mcp_serve.py |
| `hermes/cli-config.yaml` | جديد | تكوين Hermes |
| `hermes/MEMORY.md` | جديد | ذاكرة المعلم الأولية |
| `hermes/USER.md` | جديد | ملف المتعلم |
| `hermes/.hermes.md` | جديد | سياق TR_AR |
| `hermes/skills/turkish-teacher.md` | جديد | المهارة الرئيسية |
| `hermes/skills/grammar-feedback.md` | جديد | مهارة الأخطاء |
| `hermes/skills/vocab-review.md` | جديد | مهارة SRS |
| `lib/hermes-client.ts` | جديد | TypeScript client |
| `app/api/chat/route.ts` | تعديل | Hermes + fallback |
| `docker-compose.prod.yml` | تعديل | خدمة hermes |
| `.env.example` | تعديل | متغيرات Hermes |

---

## ما يبقى بدون تغيير

| الميزة | السبب |
|--------|-------|
| `/api/feedback` | TR_AR يحلل الأخطاء محلياً ← يحفظ في Supabase |
| `/api/tts` | Mistral TTS مستقل تماماً |
| `/api/session` | Supabase sessions ← XP + streak |
| `/api/vocab` | SRS منفصل تماماً |
| `/api/telegram` (approval flow) | webhook موجود ← لا يتغير |
| `/api/task`, `/api/lesson` | يستدعون OpenRouter مباشرةً |
| `lib/prompts.ts` | يبني system prompt → يُرسَل لـ Hermes |
| كل الـ frontend | لا تغيير في الـ UI |

---

## ما يكتسبه TR_AR بعد الدمج

| الميزة | التفاصيل |
|--------|----------|
| **ذاكرة حقيقية** | Hermes يتذكر الطالب عبر الجلسات بـ MEMORY.md + FTS5 |
| **ضغط سياق تلقائي** | عند تجاوز 50% من حد السياق → يلخص تلقائياً |
| **مهارات قابلة للتحسين** | turkish-teacher.md يتحسن مع الوقت |
| **budget pressure** | لا يُترك الـ context معلقاً عند الاقتراب من الحد |
| **Subagents** | المعلم يمكنه تفويض مهام معقدة |
| **موثوقية streaming** | timeout detection + stale stream detection |
| **Telegram مباشر** | التحدث مع المعلم عبر Telegram (Task 11) |

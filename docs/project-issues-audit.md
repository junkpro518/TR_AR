# وثيقة فحص بنية المشروع — TR_AR
**تاريخ الفحص:** 2026-04-01  
**المنهجية:** 5 وكلاء متوازيين يغطون: TypeScript، API Routes، الأمان، الواجهة الأمامية، الإعدادات والنشر

---

## ملخص تنفيذي

| الفئة | عدد المشاكل | حرجة | عالية | متوسطة | منخفضة |
|-------|------------|------|------|--------|--------|
| الأمان | 20 | 4 | 7 | 5 | 4 |
| API Routes | 15 | 1 | 2 | 9 | 3 |
| الواجهة الأمامية | 31 | 4 | 8 | 15 | 4 |
| TypeScript & الكود | 61 | 0 | 7 | 40 | 14 |
| الإعدادات والنشر | 19 | 1 | 3 | 11 | 4 |
| **المجموع** | **146** | **10** | **27** | **80** | **29** |

---

## القسم الأول: مشاكل الأمان 🔐

### [A-01] ❌ CRITICAL — Hermes Gateway بدون مصادقة
**الملف:** `hermes/gateway.py` (السطر 77–131)

**المشكلة:** نقطة `/v1/chat/completions` لا تتحقق من أي مفتاح API. أي طلب يصل منفذ 8000 يُنفَّذ مباشرة.

**سيناريو الهجوم:**
```
POST http://hermes:8000/v1/chat/completions
{"messages": [{"role": "user", "content": "أي رسالة"}]}
# → يستهلك OPENROUTER_API_KEY بدون إذن
```

**الحل:**
```python
@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path != "/health":
        auth = request.headers.get("Authorization", "")
        expected = f"Bearer {os.getenv('HERMES_API_KEY', 'tr-ar-internal')}"
        if auth != expected:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return await call_next(request)
```

---

### [A-02] ❌ CRITICAL — Telegram Webhook بدون التحقق من التوقيع
**الملف:** `app/api/telegram/route.ts` (السطر 8–27)

**المشكلة:** الـ webhook يقبل أي POST بدون التحقق من `X-Telegram-Bot-Api-Secret-Token`.

**سيناريو الهجوم:**
```bash
curl -X POST https://yourapp.com/api/telegram \
  -d '{"callback_query": {"data": "approve_<proposal-id>"}}'
# → يوافق على اقتراح إعدادات بدون إذن
```

**الحل:**
```typescript
const secretToken = request.headers.get('x-telegram-bot-api-secret-token')
const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
if (!secretToken || secretToken !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
ثم تسجيل `TELEGRAM_WEBHOOK_SECRET` عند إعداد الـ webhook مع Telegram.

---

### [A-03] ❌ CRITICAL — Supabase RLS بسياسة `allow_all`
**الملفات:** `supabase/migrations/003_settings_proposals.sql:20,53`، `004_session_summaries.sql:29`

**المشكلة:** جداول `settings`، `pending_proposals`، `session_summaries` تستخدم `USING (true)` — أي مستخدم يملك الـ anon key يقدر يقرأ/يكتب/يحذف.

**الحل (للتطبيق ذو المستخدم الواحد):** إبقاء `allow_all` لكن توثيقه بوضوح.  
**الحل (للمستقبل متعدد المستخدمين):**
```sql
CREATE POLICY "service_role_only" ON settings
  FOR ALL USING (auth.role() = 'service_role');
```

---

### [A-04] ❌ CRITICAL — Endpoint الإدارة بدون مصادقة
**الملف:** `app/api/admin/clear-data/route.ts`

**المشكلة:** أي شخص يقدر يحذف كل البيانات بطلب POST بسيط.

**الحل:**
```typescript
const secret = request.headers.get('x-admin-secret')
if (!secret || secret !== process.env.ADMIN_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

### [A-05] ⚠️ HIGH — Cron Secret عرضة لـ Timing Attack
**الملف:** `app/api/cron/daily-reminder/route.ts` (السطر 11)

**المشكلة:** `secret !== process.env.CRON_SECRET` تتيح تخمين السر حرفاً بحرف.  
بالإضافة: السر `tr_ar_cron_2024` ضعيف جداً.

**الحل:**
```typescript
import crypto from 'crypto'
const isValid = crypto.timingSafeEqual(
  Buffer.from(secret ?? ''),
  Buffer.from(process.env.CRON_SECRET ?? '')
)
if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```
وتغيير السر إلى قيمة عشوائية قوية (64+ حرف).

---

### [A-06] ⚠️ HIGH — Prompt Injection عبر رسائل المستخدم
**الملف:** `app/api/chat/route.ts` (السطر 154–187)

**المشكلة:** رسائل المستخدم تُضمَّن في system prompt مباشرة بدون تنظيف. المستخدم قادر يرسل `[GOAL: ...]` أو `[SUGGEST_PROMPT: ...]` في رسالته.

**الحل:** فلترة الـ markers من رسائل المستخدم قبل المعالجة:
```typescript
const sanitizedMessage = message
  .replace(/\[GOAL:[^\]]*\]/g, '')
  .replace(/\[SUGGEST_PROMPT:[^\]]*\]/g, '')
  .replace(/\[QUIZ\][\s\S]*?\[\/QUIZ\]/g, '')
```

---

### [A-07] ⚠️ HIGH — Rate Limiter معطّل على Cloudflare Workers
**الملف:** `middleware.ts` (السطر 3–26)

**المشكلة:** الـ `Map` في الذاكرة يُعاد ضبطه مع كل طلب على Cloudflare Workers (stateless).

**الحل:**
1. استخدام Cloudflare Rate Limiting Rules في dashboard
2. أو: نقل التحقق إلى Redis / Durable Objects
3. على الأقل: توثيق أن Rate Limiting لا يعمل على Cloudflare

---

### [A-08] ⚠️ HIGH — Admin Endpoint بدون Rate Limiting
**الملف:** `app/api/admin/clear-data/route.ts`، `middleware.ts`

**المشكلة:** `/api/admin/clear-data`، `/api/settings/telegram-proposal`، `/api/cron/daily-reminder` غير محمية بحد الطلبات.

**الحل:** إضافة المسارات الحساسة إلى middleware:
```typescript
'/api/admin/clear-data': { max: 5, windowMs: 60 * 60 * 1000 },
'/api/cron/daily-reminder': { max: 1, windowMs: 60 * 60 * 1000 },
'/api/settings/telegram-proposal': { max: 10, windowMs: 60 * 60 * 1000 },
```

---

### [A-09] ⚠️ HIGH — بيانات DB تُكشف في رسائل الأخطاء
**الملفات:** `app/api/session/route.ts:19`، `app/api/feedback/route.ts:84`، `app/api/vocab/route.ts:52`

**المشكلة:** `{ error: error.message }` يكشف أسماء الجداول، المفاتيح الأجنبية، وبنية DB.

**الحل:**
```typescript
if (error) {
  console.error('[DB Error]', error) // log only server-side
  return NextResponse.json({ error: 'Database operation failed' }, { status: 500 })
}
```

---

### [A-10] ⚠️ HIGH — غياب Security Headers
**الملف:** `next.config.ts`

**المشكلة:** لا يوجد CSP، HSTS، X-Frame-Options، X-Content-Type-Options.

**الحل:**
```typescript
// next.config.ts
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  }]
}
```

---

## القسم الثاني: مشاكل API Routes 🔌

### [B-01] ❌ CRITICAL — لا توجد Input Validation
**الملفات:** جميع الـ 29 route

**المشكلة:** استخدام `as Type` بدون أي تحقق في runtime. لا Zod، لا Yup، لا manual checks.

**الحل:** اعتماد Zod:
```typescript
import { z } from 'zod'
const ChatSchema = z.object({
  message: z.string().min(1).max(5000),
  language: z.literal('turkish'),
  session_id: z.string().uuid(),
  cefr_level: z.enum(['A1','A2','B1','B2','C1','C2']),
})
const body = ChatSchema.parse(await request.json())
```

---

### [B-02] ⚠️ HIGH — Race Conditions في تحديث XP
**الملفات:** `app/api/feedback/route.ts:65-79`، `app/api/task/route.ts:162-174`

**المشكلة:** قراءة XP ثم الكتابة في استعلامين منفصلين — إذا جاء طلبان معاً تضيع نقاط.

```typescript
// المشكلة:
const { data: sess } = await supabase.from('sessions').select('total_xp')
await supabase.from('sessions').update({ total_xp: sess.total_xp + earned })
// الحل — atomic update:
await supabase.rpc('increment_xp', { session_id, amount: earned })
```

دالة SQL:
```sql
CREATE OR REPLACE FUNCTION increment_xp(session_id UUID, amount INT)
RETURNS void AS $$
  UPDATE sessions SET total_xp = total_xp + amount WHERE id = session_id;
$$ LANGUAGE sql;
```

---

### [B-03] ⚠️ HIGH — غياب Transaction Handling في كتابات متعددة
**الملفات:** `app/api/feedback/route.ts:36-62`، `app/api/chat/route.ts:189-202`، `app/api/settings/telegram-proposal/route.ts:37-72`

**المشكلة:** 3 جداول تُكتب بدون transaction — إذا فشل الثاني، الأول يبقى كـ orphan record.

**الحل:** استخدام Supabase RPC للعمليات الحرجة متعددة الجداول.

---

### [B-04] ⚠️ MEDIUM — تنسيق أخطاء API غير موحّد
**المشكلة:** بعض الـ routes ترجع `{ error: "" }`، أخرى `{ ok: false }`، أخرى status code فقط. بعض الأخطاء بالعربي وبعضها بالإنجليزي.

**الحل:** إنشاء helper موحّد:
```typescript
// lib/api-response.ts
export const ApiError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

export const ApiSuccess = (data: unknown, status = 200) =>
  NextResponse.json(data, { status })
```

---

### [B-05] ⚠️ MEDIUM — `/api/chat/route.ts` ضخم جداً (336 سطر)
**المشكلة:** handler واحد يقوم بـ: web search + بناء system prompt + streaming + حفظ في DB + استخراج markers + background tasks.

**الحل:** استخراج إلى lib/:
```
lib/chat/
  ├── web-search.ts       (runWebSearchIfNeeded)
  ├── context-builder.ts  (loadChatContext)
  ├── response-parser.ts  (extractMarkers, cleanResponse)
  └── background-tasks.ts (scheduleGoalAnalysis, scheduleSessionSummary)
```

---

### [B-06] ⚠️ MEDIUM — N+1 Query في `/api/history`
**الملف:** `app/api/history/route.ts:42-56`

**المشكلة:** تجلب الجلسات ثم تعدّ الرسائل لكل جلسة في query منفصل.

**الحل:**
```typescript
// استخدام JOIN بدلاً من N queries
const { data } = await supabase
  .from('sessions')
  .select('*, messages(count)')
  .eq('language', language)
  .order('created_at', { ascending: false })
  .limit(limit)
```

---

### [B-07] ⚠️ MEDIUM — حجم الطلب غير محدود
**المشكلة:** لا `Content-Length` check — رسائل ضخمة تستهلك الذاكرة.

**الحل:**
```typescript
const contentLength = parseInt(request.headers.get('content-length') ?? '0')
if (contentLength > 100_000) {
  return ApiError('Request too large', 413)
}
```

---

## القسم الثالث: مشاكل الواجهة الأمامية 🖥️

### [C-01] ❌ CRITICAL — `app/chat/page.tsx` ضخمة (472 سطر، 12 state variable)
**المشكلة:** صفحة واحدة تدير: session lifecycle + streaming chat + feedback + SRS vocab + TTS + AbortController + localStorage + sidebar state.

**الحل:** تقسيم إلى hooks ومكونات:
```
hooks/
  ├── useChat.ts          (streaming, messages)
  ├── useChatSession.ts   (session init, localStorage)
  └── useFeedback.ts      (feedback API)
components/chat/
  ├── ChatMessages.tsx
  ├── ChatHeader.tsx
  └── ChatSidebar.tsx
```

---

### [C-02] ❌ CRITICAL — localStorage بدون abstraction (SSR issues)
**الملف:** `app/chat/page.tsx` (السطر 55، 73، 75، 224، 225)

**المشكلة:** وصول مباشر لـ `localStorage` و `window.history` داخل component — خطر في بيئة SSR.

**الحل:**
```typescript
// hooks/useSessionStorage.ts
export function useSessionStorage(key: string) {
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => { setValue(localStorage.getItem(key)) }, [key])
  const set = useCallback((v: string) => {
    localStorage.setItem(key, v)
    setValue(v)
  }, [key])
  return [value, set] as const
}
```

---

### [C-03] ❌ CRITICAL — useEffect بدون dependencies صحيحة
**الملف:** `app/chat/page.tsx:52`، `app/lessons/page.tsx:46`، `app/review/page.tsx:39`

**المشكلة:** دوال تُستخدم داخل `useEffect` غير مُدرجة في dependency array — stale closures.

**الحل:**
```typescript
// Wrap async functions in useCallback
const loadDueCards = useCallback(async () => { ... }, [language])
useEffect(() => { loadDueCards() }, [loadDueCards])
```

---

### [C-04] ❌ CRITICAL — غياب Error Boundaries
**المشكلة:** أي استثناء في أي component يُسقط الصفحة كاملة.

**الحل:**
```typescript
// app/error.tsx (Next.js built-in)
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card text-center p-8">
      <p>حدث خطأ غير متوقع</p>
      <button className="btn-gold mt-4" onClick={reset}>إعادة المحاولة</button>
    </div>
  )
}
```

---

### [C-05] ⚠️ HIGH — غياب حالات الخطأ في العمليات الـ async
**المشكلة:** fetch calls تفشل بصمت — لا UI يُعلم المستخدم.

**أمثلة:**
- `app/chat/page.tsx:172` — feedback fetch: `catch(() => {})`
- `app/tasks/page.tsx:38` — task loading: لا error state
- `app/history/page.tsx:91` — history loading: `catch(() => setLoading(false))` بدون رسالة

**الحل:** لكل عملية async:
```typescript
try {
  const data = await fetchSomething()
  setData(data)
} catch (err) {
  setError('فشل تحميل البيانات. حاول مجدداً.')
}
// + إظهار <ErrorCard message={error} onRetry={reload} /> في الـ JSX
```

---

### [C-06] ⚠️ HIGH — onMouseEnter/onMouseLeave لا يعمل على الجوال
**الملفات:** `app/review/page.tsx:107-108`، `app/goals/page.tsx:199-200`، `components/BottomNav.tsx:208-217`

**المشكلة:** تغيير الـ styles عبر JS events لا يعمل على touch devices.

**الحل:** استبدال بـ Tailwind `hover:` classes:
```tsx
// بدلاً من:
onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
// استخدم:
className="hover:text-[var(--gold)] transition-colors"
```

---

### [C-07] ⚠️ HIGH — غياب Accessibility (aria-labels، keyboard navigation)
**المشكلة:** أزرار بدون aria-label، عناصر تفاعلية لا تستجيب لـ Enter key، لا focus management.

**الحل:**
```tsx
// أزرار:
<button aria-label="بدء محادثة جديدة" onClick={startNew}>...</button>

// عناصر تفاعلية:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={e => e.key === 'Enter' && handleClick()}
>
```

---

### [C-08] ⚠️ MEDIUM — تضارب أساليب Styling
**المشكلة:** مزيج من inline styles، Tailwind classes، CSS variables — ألوان مُكوَّدة مباشرة في بعض الأماكن:
- `app/tasks/page.tsx:123`: `color: '#0D0B08'`
- `app/review/page.tsx:209`: `color: '#0D0B08'`

**الحل:** الالتزام بـ CSS variables حصراً:
```tsx
// بدلاً من: color: '#0D0B08'
className="text-[var(--bg-base)]"
// أو في globals.css: .text-bg-base { color: var(--bg-base); }
```

---

### [C-09] ⚠️ MEDIUM — State زائد يمكن اشتقاقه
**الملف:** `app/chat/page.tsx` (12 state variable)، `app/lessons/page.tsx` (9 state variables)، `app/review/page.tsx` (5 state variables)

**الحل:** استخدام `useReducer` للـ state machine المعقدة:
```typescript
const [state, dispatch] = useReducer(reviewReducer, {
  cards: [],
  index: 0,
  phase: 'loading' as ReviewPhase,
  reviewed: 0,
})
```

---

## القسم الرابع: مشاكل TypeScript وجودة الكود 🔷

### [D-01] ⚠️ HIGH — Non-null Assertions بدون فحص runtime
**الملف:** `lib/goal-analyzer.ts:10-11`

```typescript
// مشكلة:
process.env.OPENROUTER_API_KEY!
process.env.ANALYSIS_MODEL!

// حل:
const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required')
```

---

### [D-02] ⚠️ HIGH — Silent catch blocks في أماكن حرجة
**الملفات:** `lib/openrouter.ts:87,99`، `lib/hermes-client.ts:61,72`، `app/api/chat/route.ts:242,258,273,294,324`

**المشكلة:** `.catch(() => {})` يخفي الأخطاء تماماً — debugging مستحيل.

**الحل:**
```typescript
.catch(e => console.warn('[openrouter] stream parse error:', e))
// أو للـ background tasks:
.catch(e => console.error('[background] goal analysis failed:', e))
```

---

### [D-03] ⚠️ HIGH — قيم مُكوَّدة يجب أن تكون constants أو env vars
**المشكلة:** `'turkish'` مكرر في 8+ ملفات، URLs مُكوَّدة في 4 ملفات.

**الحل:** ملف constants مركزي:
```typescript
// lib/constants.ts
export const DEFAULT_LANGUAGE = 'turkish' as const
export const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
export const SERPER_API_BASE = 'https://google.serper.dev'
export const MISTRAL_API_BASE = 'https://api.mistral.ai/v1'
export const MAX_SEARCH_RESULTS = 3
export const MAX_CONTEXT_MESSAGES = 20
export const DEFAULT_ANALYSIS_MODEL = 'meta-llama/llama-3.1-8b-instruct'
```

---

### [D-04] ⚠️ MEDIUM — TransformStream boilerplate مكرر
**الملفات:** `lib/openrouter.ts:74-103`، `lib/hermes-client.ts:48-76`

**المشكلة:** نفس منطق SSE parsing مكرر في ملفين.

**الحل:**
```typescript
// lib/stream-utils.ts
export function createSSETransformer() {
  let buffer = ''
  return new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += new TextDecoder().decode(chunk)
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) controller.enqueue(content)
        } catch { /* skip malformed */ }
      }
    },
    flush(controller) {
      if (buffer.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(buffer.slice(6))
          const content = parsed.choices?.[0]?.delta?.content
          if (content) controller.enqueue(content)
        } catch { /* skip */ }
      }
    }
  })
}
```

---

### [D-05] ⚠️ MEDIUM — URLs مُكوَّدة مكررة في lib/ غير openrouter.ts
**الملفات:** `lib/session-summarizer.ts:71`، `lib/goal-analyzer.ts:62`

**المشكلة:** `'https://openrouter.ai/api/v1/chat/completions'` مكرر بدلاً من استخدام `OPENROUTER_BASE` من openrouter.ts.

**الحل:** استيراد الثابت من ملف مركزي بدلاً من التكرار.

---

### [D-06] ⚠️ MEDIUM — `buildSystemPromptFromContext()` — Dead Code محتمل
**الملف:** `lib/prompts.ts:247-368`

**المشكلة:** دالة مُصدَّرة غير مستخدمة في أي مكان في codebase.

**الحل:** حذفها أو توثيق سبب وجودها.

---

### [D-07] ⚠️ MEDIUM — SRP Violations — دوال تفعل أشياء كثيرة
**الملف:** `app/api/chat/route.ts`، `lib/session-summarizer.ts`

**المشكلة:** `POST()` handler يفعل 8 أشياء مختلفة. `summarizeSession()` يفعل 5 أشياء.

**الحل:** استخراج كل مسؤولية لدالة منفصلة مع اسم واضح.

---

## القسم الخامس: مشاكل الإعدادات والنشر ⚙️

### [E-01] ❌ CRITICAL — Hermes: تاريخ المحادثة يضيع تماماً
**الملف:** `hermes/gateway.py:98-107`

**المشكلة:** `run_agent.py --query "آخر رسالة فقط"` — كل المحادثة السابقة تُتجاهل. كل رسالة تُعامل كأول رسالة.

**الحل:** تمرير كامل المحادثة عبر stdin أو ملف مؤقت:
```python
messages_json = json.dumps(messages, ensure_ascii=False)
proc = await asyncio.create_subprocess_exec(
    sys.executable, "run_agent.py",
    "--query", user_msg,
    "--context", messages_json,  # إضافة context flag
    ...
)
```

---

### [E-02] ⚠️ HIGH — Hermes: ليس streaming حقيقي
**الملف:** `hermes/gateway.py:109-129`

**المشكلة:** `await proc.stdout.read()` يبافر كل الرد قبل إرساله — المستخدم ينتظر بدون أي استجابة حتى ينتهي Hermes.

**الحل:** pipe مباشر من subprocess stdout:
```python
async def sse_stream():
    async for line in proc.stdout:
        decoded = line.decode('utf-8', errors='replace').strip()
        if decoded:
            yield f"data: {json.dumps({'choices': [{'delta': {'content': decoded}}]})}\n\n"
    yield "data: [DONE]\n\n"
```

---

### [E-03] ⚠️ HIGH — Rate Limiter لا يعمل على Cloudflare Workers
*(تفصيل في [A-07])*

---

### [E-04] ⚠️ MEDIUM — Hermes: Prompt مكرر مع lib/prompts.ts
**الملفات:** `hermes/skills/turkish-teacher.md`، `lib/prompts.ts`

**المشكلة:** تعليمات CEFR وقواعد التصحيح موجودة في كلا الملفين — أي تعديل في واحد لا ينعكس على الآخر.

**الحل:** مصدر واحد للحقيقة — إما أن يُعتمد `lib/prompts.ts` فقط ويُرسَل كـ system message، أو يُعتمد `turkish-teacher.md` فقط ويُزال التكرار من `lib/prompts.ts`.

---

### [E-05] ⚠️ MEDIUM — Hermes Dockerfile يستنسخ من GitHub بدون تثبيت إصدار
**الملف:** `hermes/Dockerfile:10`

**المشكلة:**
```dockerfile
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /hermes
# يأخذ دائماً latest main → قد يكسر التوافق
```

**الحل:**
```dockerfile
RUN git clone --depth 1 --branch v1.2.3 \
  https://github.com/NousResearch/hermes-agent.git /hermes
```

---

### [E-06] ⚠️ MEDIUM — متغيرات بيئة مفقودة من `.env.example`
**المشكلة:** `SERPER_API_KEY`، `HERMES_API_KEY`، `HERMES_API_URL` مستخدمة في الكود لكن غير موثقة.

**الحل:** إضافة إلى `.env.example`:
```env
SERPER_API_KEY=            # مطلوب للبحث على الويب
HERMES_API_URL=http://localhost:8000
HERMES_API_KEY=tr-ar-internal
ADMIN_SECRET=              # للـ admin endpoints
```

---

### [E-07] ⚠️ MEDIUM — لا يوجد connection pooling لـ Supabase
**الملف:** `lib/supabase-server.ts`

**المشكلة:** كل API route تنشئ Supabase client جديد = اتصال PostgreSQL جديد. تجاوز `max_connections` ينتج 500 errors.

**الحل:**
```typescript
// lib/supabase-server.ts
let _client: SupabaseClient | null = null

export function createServerClient() {
  if (!_client) {
    _client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _client
}
```

---

### [E-08] ⚠️ MEDIUM — Hermes يعمل كـ root في Docker
**الملف:** `hermes/Dockerfile` (لا يوجد `USER` directive)

**الحل:**
```dockerfile
RUN useradd -m -u 1001 hermes
USER hermes
```

---

### [E-09] ⚠️ MEDIUM — CI/CD بدون tests أو type checking
**الملف:** `.github/workflows/deploy.yml`

**المشكلة:** النشر مباشر بدون `tsc`، `eslint`، أو `vitest`.

**الحل:**
```yaml
- name: Type check
  run: npx tsc --noEmit

- name: Lint
  run: npm run lint

- name: Test
  run: npm run test:run

- name: Build
  run: npm run build
```

---

### [E-10] ⚠️ MEDIUM — `api_logs` تنمو بلا حدود
**الملف:** `supabase/migrations/002_phase2.sql:40-50`

**المشكلة:** لا retention policy — الجدول يكبر إلى الأبد.

**الحل:**
```sql
-- حذف السجلات الأقدم من 90 يوم تلقائياً
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void AS $$
  DELETE FROM api_logs WHERE created_at < NOW() - INTERVAL '90 days';
$$ LANGUAGE sql;
```

---

## أولوية الإصلاح

### 🔴 فوري (يمنع الهجوم أو يكسر الوظيفة الأساسية)
| الكود | المشكلة | الجهد |
|-------|---------|------|
| A-01 | Hermes بدون auth | ساعة |
| A-02 | Telegram webhook بدون توقيع | ساعة |
| A-04 | Admin endpoint بدون auth | 30 دقيقة |
| E-01 | Hermes يفقد تاريخ المحادثة | يوم |
| B-01 | لا input validation | 3 أيام |

### 🟠 الأسبوع الأول (أمان ووظائف مهمة)
| الكود | المشكلة | الجهد |
|-------|---------|------|
| A-05 | Cron timing attack | ساعة |
| A-10 | Security headers | ساعة |
| A-07 | Rate limiter معطّل على CF | يومان |
| B-02 | Race conditions في XP | يوم |
| B-03 | Missing transactions | يومان |
| E-02 | Hermes fake streaming | يوم |

### 🟡 الأسبوعان التاليان (جودة وصيانة)
| الكود | المشكلة | الجهد |
|-------|---------|------|
| C-01 | تقسيم chat/page.tsx | 3 أيام |
| C-04 | Error boundaries | نصف يوم |
| C-02 | localStorage abstraction | يوم |
| D-03 | مركزة الثوابت | نصف يوم |
| D-04 | توحيد SSE parser | نصف يوم |
| E-07 | Supabase connection pool | ساعة |
| E-09 | CI/CD tests | ساعتان |

### 🟢 تدريجي (تحسينات جودة)
- A-06: Prompt injection hardening
- B-04: توحيد error format
- B-05: تقسيم chat route
- C-05–C-09: Frontend improvements
- D-01–D-07: TypeScript cleanup
- E-04–E-06: Hermes/config improvements

---

## ملاحظات ختامية

المشروع **بُني بشكل جيد** وله معمارية واضحة، لكن هناك ثغرات أمنية حرجة يجب معالجتها قبل الاستخدام العلني. المشاكل الأكثر إلحاحاً هي:

1. **Hermes gateway** بدون أي مصادقة
2. **Telegram webhook** يقبل أوامر من أي مصدر
3. **Admin endpoint** بدون حماية
4. **Hermes** يفقد كامل سياق المحادثة

معالجة الـ 5 مشاكل الحرجة الأولى تُحوّل المشروع من "خطر أمني" إلى "جاهز للإنتاج".

---

## القسم السادس: فحص بنية Hermes بالتفصيل 🐍

> فحص منهجي عميق بـ 3 وكلاء متخصصين: كود gateway.py سطراً بسطر، ملفات Skills والذاكرة والإعدادات، وثغرات التكامل مع TR_AR.

### ملخص نتائج Hermes

| الفئة | عدد المشاكل | حرجة | عالية | متوسطة | منخفضة |
|-------|------------|------|------|--------|--------|
| gateway.py كود | 17 | 3 | 4 | 7 | 3 |
| Skills & Memory & Config | 20 | 1 | 4 | 9 | 6 |
| Integration gaps مع TR_AR | 18 | 0 | 2 | 8 | 8 |
| **المجموع** | **55** | **4** | **10** | **24** | **17** |

---

### [H-01] ❌ CRITICAL — لا مصادقة على Gateway (تفصيل كودي)
**الملف:** `hermes/gateway.py:78`

الـ endpoint يقرأ فقط `body = await request.json()` ويتجاهل الـ headers كلياً. الكلايمت في `lib/hermes-client.ts:12` يرسل `Authorization: Bearer tr-ar-internal` لكن gateway.py لا يستورد ولا يقرأ هذا الـ header.

**الحل الكودي:**
```python
@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path != "/health":
        auth = request.headers.get("Authorization", "")
        expected = f"Bearer {os.getenv('HERMES_API_KEY', 'tr-ar-internal')}"
        if auth != expected:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return await call_next(request)
```

---

### [H-02] ❌ CRITICAL — Subprocess Injection Risk
**الملف:** `hermes/gateway.py:101`

```python
proc = await asyncio.create_subprocess_exec(
    sys.executable, "run_agent.py",
    "--query", user_msg,  # ← مدخل المستخدم مباشرة بدون تنظيف
    ...
)
```

رغم أن `create_subprocess_exec` لا يستدعي shell، إذا استخدم `run_agent.py` أي `eval` أو shell expansion على الـ argument، يصبح RCE ممكناً.

**الحل:** تمرير المدخل عبر stdin:
```python
proc = await asyncio.create_subprocess_exec(
    sys.executable, "run_agent.py",
    stdin=asyncio.subprocess.PIPE,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
    cwd=HERMES_DIR, env=env,
)
stdin_data = json.dumps({"query": user_msg}).encode('utf-8')
stdout, stderr = await proc.communicate(input=stdin_data)
```

---

### [H-03] ❌ CRITICAL — Full Buffer قبل Streaming (تفصيل)
**الملف:** `hermes/gateway.py:111`

```python
raw_output = await proc.stdout.read()  # ← يبلوك حتى ينتهي subprocess كامل
await proc.wait()
# ثم يبدأ الـ streaming الوهمي
for i in range(0, len(text), STREAM_CHUNK):
    yield f"data: {payload}\n\n"
    await asyncio.sleep(STREAM_DELAY)
```

المستخدم ينتظر دقائق بدون أي بايت يصله. إذا تجاوز وقت hermes-agent الـ 30-60 ثانية (FastAPI timeout)، الطلب يموت.

**الحل:** قراءة stdout بشكل incremental (أنظر الحل المفصل في H-05).

---

### [H-04] ❌ CRITICAL — Docker COPY يفترض CWD محدد
**الملف:** `hermes/Dockerfile:22-28`

```dockerfile
COPY hermes/cli-config.yaml /root/.hermes/cli-config.yaml
COPY hermes/skills/ /root/.hermes/skills/
```

يعمل فقط إذا تم `docker build .` من جذر المشروع. إذا نُفِّذ من داخل `hermes/`، الـ build يفشل.

**الحل:**
```dockerfile
# استخدام WORKDIR ومسارات نسبية للـ hermes فقط
COPY . /build-context/
RUN cp /build-context/cli-config.yaml /root/.hermes/cli-config.yaml
```

---

### [H-05] ⚠️ HIGH — لا timeout على subprocess
**الملف:** `hermes/gateway.py:98-115`

إذا تجمّد `hermes-agent` (timeout من OpenRouter، loop لا نهائي)، العملية تبقى حية إلى الأبد. مع 10 طلبات متزامنة = 10 zombie processes = OOM.

**الحل:**
```python
try:
    raw_output = await asyncio.wait_for(
        proc.stdout.read(),
        timeout=60.0  # 60 ثانية max
    )
except asyncio.TimeoutError:
    proc.kill()
    await proc.wait()
    text = "[Timeout: hermes-agent لم يرد في 60 ثانية]"
```

---

### [H-06] ⚠️ HIGH — لا حد للطلبات المتزامنة
**الملف:** `hermes/gateway.py:78`

كل طلب يُولّد subprocess جديد بدون semaphore. 50 طلب متزامن = 50 subprocess = OOM فوري.

**الحل:**
```python
_semaphore = asyncio.Semaphore(int(os.getenv("HERMES_MAX_CONCURRENT", "2")))

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    if _semaphore._value == 0:
        return JSONResponse({"error": "Server busy"}, status_code=429)
    async with _semaphore:
        # ... باقي المنطق
```

---

### [H-07] ⚠️ HIGH — تاريخ المحادثة يضيع (تفصيل كودي)
**الملف:** `hermes/gateway.py:82-84`

```python
user_msg = next(
    (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
)
# كل ما عدا آخر رسالة = يختفي تماماً
```

TR_AR يبني `messages` array كاملة (السطر 176-187 من chat/route.ts) تتضمن system prompt + 20 رسالة سابقة، لكن gateway.py يستخلص آخر رسالة فقط.

**الحل:** تمرير المحادثة الكاملة لـ hermes-agent، أو على الأقل دمج الـ context في الـ query:
```python
# بديل مؤقت: دمج آخر رسالتين في الـ query
recent = [m["content"] for m in messages[-3:] if m["role"] in ("user", "assistant")]
context_query = "\n".join(recent)
```

---

### [H-08] ⚠️ HIGH — stderr معطّل تماماً
**الملف:** `hermes/gateway.py:104`

```python
stderr=asyncio.subprocess.DEVNULL,  # ← كل الأخطاء تذهب للفراغ
```

إذا فشل `run_agent.py` بـ ImportError أو KeyError، لا يوجد أي أثر في اللوغ. Debugging مستحيل.

**الحل:**
```python
stderr=asyncio.subprocess.PIPE,
# ثم بعد wait():
if proc.returncode != 0:
    stderr_out = (await proc.stderr.read()).decode(errors='replace')
    print(f"[hermes-error] exit={proc.returncode}: {stderr_out[:500]}", file=sys.stderr)
```

---

### [H-09] ⚠️ HIGH — نظام الذاكرة أحادي الاتجاه
**الملف:** `hermes/MEMORY.md:14`، `hermes/gateway.py:32-50`

MEMORY.md تقول "سيتم تحديثه تلقائياً بعد كل جلسة" لكن لا يوجد آلية لذلك. gateway.py يكتب إلى USER.md قبل كل طلب فقط (overwrite)، لكن Hermes لا يكتب أي شيء يبقى بعد انتهاء الطلب. كل الذاكرة في الـ subprocess تضيع.

**الحل:** إضافة endpoint `POST /v1/memory/update` يستقبل ملخص الجلسة من hermes-agent ويحفظه في USER.md أو SQLite.

---

### [H-10] ⚠️ HIGH — Vocab-Review Skill بلا SRS حقيقي
**الملف:** `hermes/skills/vocab-review.md`

Skill يصف خوارزمية SM-2 كاملة لكن:
- لا قاعدة بيانات vocab في Hermes
- لا تكامل مع `vocab_cards` table في Supabase
- `/hermes/tools/` فارغة تماماً (`.gitkeep` فقط)

Skill يعد المستخدم بمراجعة ذكية لكنها لا تعمل فعلياً.

**الحل:** إما حذف الـ skill حتى يتم تطبيقه فعلياً، أو ربطه بـ TR_AR API:
```python
# في gateway.py: إرسال vocab list من request body إلى الـ skill
vocab_context = body.get("known_vocab", [])
# حفظها في USER.md مع السياق
```

---

### [H-11] ⚠️ MEDIUM — USER.md يُقطع عند 3000 حرف
**الملف:** `hermes/gateway.py:47`

```python
f.write(system_content[:3000])  # قد يقطع النص في منتصف كلمة عربية
```

system prompt الكامل قد يكون 4000-5000 حرف لطالب في مستوى B2 مع تاريخ أخطاء طويل.

**الحل:**
```python
MAX_CONTEXT = int(os.getenv("HERMES_MAX_CONTEXT_LEN", "8000"))
content = system_content[:MAX_CONTEXT]
# قطع عند آخر سطر جديد لتجنب كسر الكلمات العربية
if len(system_content) > MAX_CONTEXT:
    last_nl = content.rfind('\n')
    if last_nl > MAX_CONTEXT * 0.8:
        content = content[:last_nl]
f.write(content)
```

---

### [H-12] ⚠️ MEDIUM — Health Endpoint لا يفحص شيئاً فعلياً
**الملف:** `hermes/gateway.py:72-74`

```python
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "hermes-gateway"}
# ← لا يتحقق من HERMES_HOME، لا run_agent.py، لا OPENROUTER_API_KEY
```

Docker يعتقد أن الـ container صحيح حتى لو كان `run_agent.py` مفقوداً أو OPENROUTER_API_KEY فارغاً.

**الحل:** فحص حقيقي:
```python
@app.get("/health")
async def health():
    issues = []
    if not os.path.exists(os.path.join(HERMES_DIR, "run_agent.py")):
        issues.append("run_agent.py not found")
    if not os.getenv("OPENROUTER_API_KEY"):
        issues.append("OPENROUTER_API_KEY not set")
    if not os.path.isdir(HERMES_HOME):
        issues.append(f"HERMES_HOME {HERMES_HOME} not accessible")
    status = "ok" if not issues else "degraded"
    return JSONResponse({"status": status, "issues": issues},
                        status_code=200 if not issues else 503)
```

---

### [H-13] ⚠️ MEDIUM — نسبة ضغط السياق عدوانية جداً
**الملف:** `hermes/cli-config.yaml:31-36`

```yaml
compression:
  enabled: true
  threshold: 0.50   # يضغط عند 50% من budget
  target_ratio: 0.20 # يضغط إلى 20% من الحجم الأصلي
```

لتعليم اللغات، الـ context يحتوي شرح نحوي وأمثلة دقيقة. ضغط 80% يُفقد هذه التفاصيل.

**الحل:** رفع النسبة أو تعطيل الضغط مؤقتاً:
```yaml
compression:
  enabled: false  # حتى يُختبر تأثيره على جودة التدريس
```

---

### [H-14] ⚠️ MEDIUM — Grammar-Feedback Skill بدون أدوات تنفيذية
**الملف:** `hermes/skills/grammar-feedback.md`، `hermes/tools/.gitkeep`

Skill يعرّف 16 فئة نحوية (past_tense، vowel_harmony، إلخ) لكن لا يوجد أي أداة تستخلص هذه الفئات تلقائياً. `/hermes/tools/` فارغ.

الـ skill موجود كتوثيق فقط، لا كتنفيذ فعلي.

---

### [H-15] ⚠️ MEDIUM — ضغط السياق يستخدم نفس نموذج الـ Chat
**الملف:** `hermes/cli-config.yaml:36`

```yaml
summary_model: "google/gemini-2.0-flash-001"  # نفس نموذج المحادثة
```

استخدام نموذج أرخص للضغط (مثل `meta-llama/llama-3.1-8b-instruct`) يوفر التكلفة.

---

### [H-16] ⚠️ MEDIUM — Hermes Response Failure لا يُفعّل Fallback
**الملف:** `hermes/gateway.py:117-118`، `app/api/chat/route.ts:213-222`

إذا فشل hermes-agent في إنتاج رد، gateway يُرجع HTTP 200 مع رسالة خطأ عربية:
```python
text = "[لم يتمكن Hermes من الرد — تحقق من OPENROUTER_API_KEY...]"
```

TR_AR يرى HTTP 200 فيعتبره نجاحاً ولا يُفعّل الـ fallback إلى OpenRouter. الرسالة العربية تصل للمستخدم كأنها رد طبيعي.

**الحل:** إرجاع HTTP 502 عند فشل hermes-agent:
```python
if not text:
    # بدلاً من: text = "[رسالة خطأ]"
    return JSONResponse({"error": "Agent failed"}, status_code=502)
    # → هذا سيُفعّل catch block في route.ts ويستخدم OpenRouter
```

---

### [H-17] ⚠️ MEDIUM — timeout الـ Health Check غير متوافق (3s vs 10s)
**الملف:** `lib/hermes-client.ts:90`، `docker-compose.prod.yml:74`

```typescript
// TR_AR ينتظر 3 ثوانٍ
signal: AbortSignal.timeout(3000)
```
```yaml
# Docker ينتظر 10 ثوانٍ
timeout: 10s
```

إذا كان Hermes بطيئاً (6 ثوانٍ للاستجابة)، TR_AR يعتبره ميتاً ويتحول لـ OpenRouter، بينما Docker يعتبره حياً.

**الحل:** مواءمة القيمتين:
```typescript
signal: AbortSignal.timeout(10000)  // 10 ثوانٍ مثل Docker
```

---

### [H-18] ⚠️ MEDIUM — `finish_reason` لا يُعيَّن في الـ chunk الأخير
**الملف:** `hermes/gateway.py:123-126`

كل الـ chunks تُرسَل بـ `"finish_reason": null`. الـ OpenAI spec يتطلب `"finish_reason": "stop"` في آخر chunk.

**الحل:**
```python
for i in range(0, len(text), STREAM_CHUNK):
    chunk = text[i: i + STREAM_CHUNK]
    is_last = (i + STREAM_CHUNK >= len(text))
    payload = json.dumps({
        "choices": [{"delta": {"content": chunk},
                     "finish_reason": "stop" if is_last else None}]
    })
    yield f"data: {payload}\n\n"
```

---

### [H-19] ⚠️ MEDIUM — start.sh يتجاهل أخطاء النسخ بصمت
**الملف:** `hermes/start.sh:8`

```bash
cp "$HERMES_HOME/cli-config.yaml" "$HERMES_HOME/config.yaml" 2>/dev/null || true
```

إذا فشل النسخ، يستمر الـ script بدون config.yaml. Hermes يبدأ بإعدادات افتراضية غير صحيحة بدون أي تحذير.

**الحل:**
```bash
cp "$HERMES_HOME/cli-config.yaml" "$HERMES_HOME/config.yaml" || {
    echo "WARNING: config.yaml not found, using internal defaults"
}
# أو للفشل الصريح:
# cp ... || { echo "ERROR: config copy failed"; exit 1; }
```

---

### [H-20] ⚠️ MEDIUM — start.sh لا يتحقق من OPENROUTER_API_KEY
**الملف:** `hermes/start.sh`

Hermes يبدأ بنجاح حتى لو كان `OPENROUTER_API_KEY` غير موجود. الخطأ يظهر فقط عند أول طلب حقيقي (بعد 90 ثانية من healthcheck start-period).

**الحل:**
```bash
#!/bin/bash
set -e
test -n "$OPENROUTER_API_KEY" || { echo "ERROR: OPENROUTER_API_KEY is required"; exit 1; }
```

---

### [H-21] ⚠️ LOW — HERMES_HOME يفترض `/root/.hermes`
**الملف:** `hermes/gateway.py:25`

```python
HERMES_HOME = os.environ.get("HERMES_HOME", "/root/.hermes")
```

إذا تغيّر الـ Docker user إلى non-root (وهو ممارسة أمنية مطلوبة)، هذا المسار غير قابل للوصول.

**الحل:** `HERMES_HOME` يجب أن يكون متغيراً إلزامياً أو يُحسب من `$HOME`:
```python
HERMES_HOME = os.environ.get("HERMES_HOME") or os.path.join(os.path.expanduser("~"), ".hermes")
```

---

### [H-22] ⚠️ LOW — Python dependencies غير مُثبَّتة الإصدار
**الملف:** `hermes/Dockerfile:15,20`

```dockerfile
RUN pip install --no-cache-dir -e ".[all]" || pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir fastapi "uvicorn[standard]"
```

build في أوقات مختلفة = إصدارات مختلفة = سلوك غير متوقع.

**الحل:**
```dockerfile
RUN pip install --no-cache-dir fastapi==0.115.0 "uvicorn[standard]==0.32.0"
```

---

### [H-23] ⚠️ LOW — متغيرات Hermes غير موثقة في `.env.example`
**المشكلة:** المتغيرات التالية تُستخدم لكن غير موثقة:

```env
# يجب إضافتها لـ .env.example:
HERMES_HOME=/root/.hermes           # مجلد الذاكرة
HERMES_MAX_TURNS=8                  # حد أدوار المحادثة
HERMES_MAX_CONCURRENT=2             # حد الطلبات المتزامنة
HERMES_STREAM_CHUNK=25              # حجم كل chunk بالأحرف
HERMES_STREAM_DELAY=0.012           # تأخير بين الـ chunks (ثوانٍ)
HERMES_MAX_CONTEXT_LEN=8000         # حد طول السياق في USER.md
```

---

### أولوية إصلاح مشاكل Hermes

| الأولوية | الكود | المشكلة | الجهد |
|---------|-------|---------|------|
| 🔴 فوري | H-01 | لا authentication | ساعة |
| 🔴 فوري | H-16 | Agent failure لا يُفعّل fallback | ساعة |
| 🔴 فوري | H-06 | لا حد للطلبات المتزامنة | ساعة |
| 🔴 فوري | H-05 | لا timeout على subprocess | ساعة |
| 🟠 قريب | H-07 | تاريخ المحادثة يضيع | يوم |
| 🟠 قريب | H-08 | stderr معطّل | 30 دقيقة |
| 🟠 قريب | H-09 | الذاكرة أحادية الاتجاه | أسبوع |
| 🟠 قريب | H-03 | Full buffer قبل streaming | يومان |
| 🟠 قريب | H-12 | Health endpoint وهمي | ساعة |
| 🟡 تدريجي | H-11 | USER.md يُقطع عند 3000 | 30 دقيقة |
| 🟡 تدريجي | H-13 | ضغط سياق عدواني | 30 دقيقة |
| 🟡 تدريجي | H-17 | timeout mismatch | 5 دقائق |
| 🟡 تدريجي | H-18 | finish_reason مفقود | 15 دقيقة |
| 🟢 مستقبلي | H-10 | Vocab-Review بلا SRS | أسابيع |
| 🟢 مستقبلي | H-14 | Grammar-Feedback بلا أدوات | أسابيع |

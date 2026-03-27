# TR_AR — مُعلِّم اللغة التركية

## المشروع
تطبيق شخصي لتعلم اللغة التركية باستخدام الذكاء الاصطناعي.

## Stack
- Next.js 15 App Router + TypeScript
- Supabase (PostgreSQL) — Project ID: cwbbeycqqepwoqsnpnqk
- OpenRouter API (chat + analysis models)
- Telegram Bot (notifications + approval workflow)

## الصفحات
| المسار | الوظيفة |
|--------|---------|
| `/` | الصفحة الرئيسية |
| `/chat` | المحادثة مع المعلم |
| `/review` | مراجعة SRS يومية |
| `/tasks` | مهام تواصلية |
| `/lessons` | دروس منظمة |
| `/dashboard` | التقدم والإحصائيات |
| `/goals` | أهداف التعلم |
| `/history` | سجل المحادثات |
| `/vocab-tracker` | مخزن المفردات |
| `/settings` | إعدادات المعلم |
| `/quick-ask` | سؤال سريع (لا يُحفظ) |

## API Routes
| Route | الوظيفة |
|-------|---------|
| `/api/chat` | POST — محادثة مع AI (streaming) |
| `/api/feedback` | POST — تحليل لغوي |
| `/api/session` | GET/POST — الجلسة |
| `/api/vocab` | GET/POST/PATCH — SRS |
| `/api/history` | GET — سجل |
| `/api/weakness` | GET — نقاط الضعف |
| `/api/settings` | GET/POST — الإعدادات |
| `/api/telegram` | POST — webhook |
| `/api/tts` | POST — Voxtral TTS |
| `/api/quick-ask` | POST — سؤال سريع |
| `/api/cron/daily-reminder` | GET — تنبيه يومي |

## المتغيرات البيئية المطلوبة
```
OPENROUTER_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://cwbbeycqqepwoqsnpnqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CHAT_MODEL=google/gemini-2.0-flash-001
ANALYSIS_MODEL=meta-llama/llama-3.1-8b-instruct
TELEGRAM_BOT_TOKEN=  # @BotFather
TELEGRAM_CHAT_ID=    # chat id
MISTRAL_API_KEY=     # للـ Voxtral TTS
CRON_SECRET=tr_ar_cron_2024
```

## التصميم
الثيم الذهبي الداكن — CSS vars في `app/globals.css`:
- `--gold: #C9952A`, `--bg-base: #0D0B08`, `--text-primary: #EDE8DF`
- Classes: `.btn-gold`, `.btn-ghost`, `.card`, `.input-field`, `.badge-gold`

## قواعد البيانات
```sql
sessions, messages, vocab_cards, feedback_log,
goals, tasks, task_attempts, achievements, api_logs,
settings, pending_proposals
```

## ملاحظات مهمة
- التطبيق للتركية فقط (language = 'turkish' دائماً)
- المعلم يتحدث بالعربي + التركي، لا إنجليزي
- المحادثة تُرسَل مع كامل سياق التاريخ (كل الجلسات)
- الردود بتنسيق Markdown

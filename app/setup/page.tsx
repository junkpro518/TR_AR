'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FieldConfig {
  key: string
  label: string
  placeholder: string
  hint: string
  link?: { url: string; text: string }
  type?: 'password' | 'text'
}

const FIELDS: FieldConfig[] = [
  {
    key: 'OPENROUTER_API_KEY',
    label: 'OpenRouter API Key',
    placeholder: 'sk-or-v1-...',
    hint: 'مفتاح الوصول لنماذج الذكاء الاصطناعي (GPT, Gemini, Claude...)',
    link: { url: 'https://openrouter.ai/keys', text: 'احصل على مفتاح' },
    type: 'password',
  },
  {
    key: 'CHAT_MODEL',
    label: 'نموذج المحادثة',
    placeholder: 'google/gemini-2.0-flash-001',
    hint: 'النموذج المستخدم للمحادثة الرئيسية مع المعلم',
    type: 'text',
  },
  {
    key: 'ANALYSIS_MODEL',
    label: 'نموذج التحليل',
    placeholder: 'meta-llama/llama-3.1-8b-instruct',
    hint: 'نموذج خفيف للتحليل السريع (تغذية راجعة، أهداف...)',
    type: 'text',
  },
  {
    key: 'TELEGRAM_BOT_TOKEN',
    label: 'Telegram Bot Token',
    placeholder: '123456789:ABCdef...',
    hint: 'توكن البوت من @BotFather على تيليجرام',
    link: { url: 'https://t.me/BotFather', text: 'أنشئ بوتاً' },
    type: 'password',
  },
  {
    key: 'TELEGRAM_CHAT_ID',
    label: 'Telegram Chat ID',
    placeholder: '123456789',
    hint: 'رقم محادثتك — أرسل /start للبوت ثم زر @userinfobot',
    link: { url: 'https://t.me/userinfobot', text: 'احصل على Chat ID' },
    type: 'text',
  },
  {
    key: 'MISTRAL_API_KEY',
    label: 'Mistral API Key (Voxtral TTS)',
    placeholder: 'sk-...',
    hint: 'لتفعيل نظام Text-to-Speech المتقدم Voxtral — اختياري',
    link: { url: 'https://console.mistral.ai/', text: 'احصل على مفتاح' },
    type: 'password',
  },
]

export default function SetupPage() {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const [masked, setMasked] = useState<Record<string, string>>({})
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [telegramResult, setTelegramResult] = useState<string | null>(null)
  const [registeringWebhook, setRegisteringWebhook] = useState(false)
  const [webhookResult, setWebhookResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        setMasked(data.masked ?? {})
        setEnvStatus(data.envStatus ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    // Refresh masked values
    const data = await fetch('/api/setup').then(r => r.json())
    setMasked(data.masked ?? {})
    setEnvStatus(data.envStatus ?? {})
    setValues({})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testTelegram() {
    setTestingTelegram(true)
    setTelegramResult(null)
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setTelegramResult('✅ تم إرسال رسالة تجريبية بنجاح!')
      } else {
        setTelegramResult('❌ ' + (data.error ?? data.telegram_response?.description ?? 'خطأ غير معروف'))
      }
    } catch {
      setTelegramResult('❌ فشل الاتصال بالخادم')
    }
    setTestingTelegram(false)
  }

  async function registerWebhook() {
    setRegisteringWebhook(true)
    setWebhookResult(null)
    try {
      const res = await fetch('/api/telegram/register-webhook', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setWebhookResult('✅ تم تسجيل Webhook: ' + data.webhook_url)
      } else {
        setWebhookResult('❌ ' + (data.error ?? data.telegram_response?.description ?? 'خطأ'))
      }
    } catch {
      setWebhookResult('❌ فشل الاتصال')
    }
    setRegisteringWebhook(false)
  }

  const isSaved = (key: string) => !!masked[key] || envStatus[key]

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => router.back()} style={{ color: 'var(--text-muted)', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer' }}>→</button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            إعداد المفاتيح والتوكنات
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            تُحفظ بأمان في قاعدة البيانات
          </p>
        </div>
        <Link href="/settings" className="mr-auto text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          → الإعدادات
        </Link>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Status overview */}
        <div className="card p-4">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            حالة الإعداد
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: isSaved(f.key) ? 'var(--green)' : 'var(--red)' }}
                />
                <span className="text-xs truncate" style={{ color: isSaved(f.key) ? 'var(--green)' : 'var(--text-muted)' }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="card p-5 space-y-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
            المفاتيح والتوكنات
          </h2>

          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>جاري التحميل…</p>
          ) : (
            FIELDS.map(field => (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2">
                    {isSaved(field.key) && (
                      <span className="text-xs" style={{ color: 'var(--green)' }}>✓ محفوظ</span>
                    )}
                    {field.link && (
                      <a
                        href={field.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs"
                        style={{ color: 'var(--gold-light)', textDecoration: 'none' }}
                      >
                        {field.link.text} ↗
                      </a>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={field.type === 'password' && !showValues[field.key] ? 'password' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={e => setValues(p => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={masked[field.key] || field.placeholder}
                    className="input-field w-full rounded-xl px-4 py-2.5 text-sm"
                    dir="ltr"
                    style={{ paddingRight: field.type === 'password' ? '3rem' : undefined }}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowValues(p => ({ ...p, [field.key]: !p[field.key] }))}
                      className="absolute"
                      style={{
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {showValues[field.key] ? '🙈' : '👁'}
                    </button>
                  )}
                </div>

                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{field.hint}</p>
              </div>
            ))
          )}

          <button
            onClick={handleSave}
            disabled={saving || Object.keys(values).length === 0}
            className="btn-gold w-full py-3 rounded-xl text-sm font-semibold"
          >
            {saved ? '✓ تم الحفظ بنجاح' : saving ? 'جاري الحفظ...' : 'حفظ المفاتيح'}
          </button>
        </div>

        {/* Test Telegram */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            اختبار تيليجرام
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            بعد حفظ التوكن والـ Chat ID، اضغط لإرسال رسالة تجريبية للتأكد من الإعداد.
          </p>
          <button
            onClick={testTelegram}
            disabled={testingTelegram}
            className="btn-ghost w-full py-2.5 rounded-xl text-sm"
          >
            {testingTelegram ? 'جاري الاختبار...' : '📨 إرسال رسالة تجريبية'}
          </button>
          {telegramResult && (
            <p className="text-xs mt-2 text-center" style={{
              color: telegramResult.startsWith('✅') ? 'var(--green)' : 'var(--red)'
            }}>
              {telegramResult}
            </p>
          )}
          <button onClick={registerWebhook} disabled={registeringWebhook} className="btn-ghost w-full py-2.5 rounded-xl text-sm mt-2">
            {registeringWebhook ? 'جاري التسجيل...' : '🔗 تسجيل Webhook'}
          </button>
          {webhookResult && (
            <p className="text-xs mt-2 text-center" style={{ color: webhookResult.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>
              {webhookResult}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="p-4 rounded-xl" style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-gold)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--gold-light)' }}>
            🔒 <strong>الأمان:</strong> تُحفظ المفاتيح في قاعدة بيانات Supabase الخاصة بك. القيم المدخلة هنا تتقدم على ما في ملف <code>.env.local</code>.
          </p>
        </div>

      </div>
    </div>
  )
}

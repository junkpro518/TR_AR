import { NextResponse } from 'next/server'
import { getSecret } from '@/lib/secrets-loader'

// POST /api/telegram/register-webhook
// يسجّل عنوان webhook مع Telegram حتى تصل ردود الأزرار للتطبيق
export async function POST() {
  const BOT_TOKEN = await getSecret('TELEGRAM_BOT_TOKEN')
  // Try secrets DB first, then env var
  const APP_URL = (await getSecret('APP_URL')) || process.env.NEXT_PUBLIC_APP_URL

  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN غير مضبوط' }, { status: 400 })
  }
  if (!APP_URL) {
    return NextResponse.json({ ok: false, error: 'رابط التطبيق (APP_URL) غير مضبوط — أضفه في صفحة الإعداد' }, { status: 400 })
  }
  if (!APP_URL.startsWith('https://')) {
    return NextResponse.json({ ok: false, error: 'رابط التطبيق يجب أن يبدأ بـ https:// — Telegram يتطلب HTTPS' }, { status: 400 })
  }

  const webhookUrl = `${APP_URL}/api/telegram`

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      }
    )
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, webhook_url: webhookUrl, telegram_response: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

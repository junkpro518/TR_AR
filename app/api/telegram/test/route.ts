import { NextResponse } from 'next/server'
import { getSecret } from '@/lib/secrets-loader'

// POST /api/telegram/test — اختبار مباشر بدون شرط
export async function POST() {
  const BOT_TOKEN = await getSecret('TELEGRAM_BOT_TOKEN')
  const CHAT_ID = await getSecret('TELEGRAM_CHAT_ID')

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({
      ok: false,
      error: 'TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير مضبوط'
    }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: '✅ اختبار ناجح من مُعلِّم اللغة التركية!\n\n🇹🇷 مرحباً — البوت يعمل بشكل صحيح.'
      }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, telegram_response: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

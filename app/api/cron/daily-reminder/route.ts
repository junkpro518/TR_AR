import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { sendTelegramMessage } from '@/lib/telegram'

// GET /api/cron/daily-reminder?secret=<CRON_SECRET>
//
// Called by Vercel Cron (vercel.json) or any external cron service at 20:00 daily.
// Sends a Telegram reminder if the user has had no activity today.
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Check for any session activity today
  const today = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"

  const { data: todaySessions } = await supabase
    .from('sessions')
    .select('id, last_activity_date')
    .gte('last_activity_date', today)
    .limit(1)

  if (!todaySessions || todaySessions.length === 0) {
    // No activity today — send reminder
    await sendTelegramMessage(
      `⏰ <b>تذكير يومي</b>\n\nلم تتدرب على التركية اليوم بعد! 🇹🇷\n\nالاتساق هو مفتاح إتقان اللغة. حتى 10 دقائق يومياً تُحدث فارقاً كبيراً.\n\n<a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/chat?language=turkish">ابدأ الآن ←</a>`
    )
    return NextResponse.json({ sent: true, message: 'Reminder sent' })
  }

  return NextResponse.json({ sent: false, message: 'User already studied today' })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language } from '@/lib/types'

// GET /api/history?language=turkish&session_id=xxx&limit=50
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  const session_id = request.nextUrl.searchParams.get('session_id')
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '50'), 100)

  if (!language && !session_id) {
    return NextResponse.json({ error: 'language or session_id required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // If session_id given, fetch messages for that session
  if (session_id) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, xp_earned, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // Otherwise, fetch recent sessions with message count
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, language, cefr_level, total_xp, streak_days, last_activity_date, created_at')
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get message counts per session
  const sessionIds = (sessions ?? []).map(s => s.id)
  const { data: counts } = await supabase
    .from('messages')
    .select('session_id')
    .in('session_id', sessionIds)

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.session_id] = (countMap[row.session_id] ?? 0) + 1
  }

  const result = (sessions ?? []).map(s => ({
    ...s,
    message_count: countMap[s.id] ?? 0,
  }))

  return NextResponse.json(result)
}

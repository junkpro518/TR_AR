import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language, CEFRLevel } from '@/lib/types'

// GET /api/session?language=turkish  OR  GET /api/session?id=<session_id>
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const supabase = createServerClient()

  // Fetch a specific session by ID (used by "resume conversation")
  if (id) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Session not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  }

  const language = request.nextUrl.searchParams.get('language') as Language
  if (!language || language !== 'turkish') {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
  }

  // Get or create the active session for this language
  const { data: existing, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (existing) {
    // Update streak
    const today = new Date().toISOString().split('T')[0]
    const lastActivity = existing.last_activity_date

    let streakDays = existing.streak_days
    if (lastActivity !== today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (lastActivity === yesterdayStr) {
        streakDays += 1
      } else {
        streakDays = 1 // Reset streak — gap > 1 day
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ streak_days: streakDays, last_activity_date: today })
        .eq('id', existing.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ...existing, streak_days: streakDays })
  }

  // Create new session
  const { data: newSession, error: createError } = await supabase
    .from('sessions')
    .insert({
      language,
      cefr_level: 'A1' as CEFRLevel,
      total_xp: 0,
      streak_days: 1,
      last_activity_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  return NextResponse.json(newSession, { status: 201 })
}

// POST /api/session — always creates a NEW session
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const language = (body.language ?? 'turkish') as Language

  const supabase = createServerClient()
  const { data: newSession, error } = await supabase
    .from('sessions')
    .insert({
      language,
      cefr_level: 'A1' as CEFRLevel,
      total_xp: 0,
      streak_days: 1,
      last_activity_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(newSession, { status: 201 })
}

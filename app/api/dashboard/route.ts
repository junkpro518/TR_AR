import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language } from '@/lib/types'

// GET /api/dashboard?language=turkish
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language

  if (!language) {
    return NextResponse.json({ error: 'language required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Fetch all in parallel
  const [sessionRes, vocabRes, grammarRes, achievementsRes, dueTodayRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, cefr_level, total_xp, streak_days, last_activity_date, created_at')
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('vocab_cards')
      .select('id, ease_factor, repetitions, created_at')
      .eq('language', language),

    supabase
      .from('feedback_log')
      .select('grammar_point')
      .not('grammar_point', 'is', null)
      .eq('type', 'correction'),

    supabase
      .from('achievements')
      .select('*')
      .order('earned_at', { ascending: false }),

    supabase
      .from('vocab_cards')
      .select('id')
      .eq('language', language)
      .lte('next_review_at', new Date().toISOString().split('T')[0]),
  ])

  const session = sessionRes.data
  const vocab = vocabRes.data ?? []
  const grammarRows = grammarRes.data ?? []
  const achievements = achievementsRes.data ?? []
  const dueCount = dueTodayRes.data?.length ?? 0

  // Grammar point frequency
  const grammarCounts: Record<string, number> = {}
  for (const row of grammarRows) {
    if (row.grammar_point) {
      grammarCounts[row.grammar_point] = (grammarCounts[row.grammar_point] ?? 0) + 1
    }
  }
  const topGrammarErrors = Object.entries(grammarCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([point, count]) => ({ point, count }))

  // Vocab stats
  const totalVocab = vocab.length
  const masteredVocab = vocab.filter(v => v.repetitions >= 3 && v.ease_factor >= 2.0).length
  const weakVocab = vocab.filter(v => v.ease_factor < 1.8).length

  return NextResponse.json({
    session,
    vocab_stats: { total: totalVocab, mastered: masteredVocab, weak: weakVocab, due_today: dueCount },
    top_grammar_errors: topGrammarErrors,
    achievements,
  })
}

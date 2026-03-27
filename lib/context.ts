/**
 * Tiered Context Builder
 *
 * Replaces the monolithic system prompt with a lean, tiered approach:
 *   Tier 1 (~50 tokens)  — static: level + language
 *   Tier 2 (~200 tokens) — dynamic: last 5 errors, 20 weakest vocab, active goal, last topic
 *   Tier 3 (future)      — semantic: RAG via pgvector (placeholder)
 *
 * Total budget: ~250 tokens vs the previous ~2500 token monolith.
 */

import type { TieredContext, GrammarPoint } from './types'
import { createClient } from '@supabase/supabase-js'

interface BuildContextParams {
  session_id: string
  supabaseUrl: string
  supabaseKey: string
}

export async function buildTieredContext(
  params: BuildContextParams
): Promise<TieredContext | null> {
  const { session_id, supabaseUrl, supabaseKey } = params
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Fetch session (Tier 1 + some Tier 2 fields)
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('language, cefr_level, last_topic, common_errors')
    .eq('id', session_id)
    .single()

  if (sessionError || !session) return null

  // Tier 2a: recent grammar errors from feedback_log (last 5 distinct patterns)
  const { data: errorRows } = await supabase
    .from('feedback_log')
    .select('original, grammar_point')
    .eq('type', 'correction')
    .not('grammar_point', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  const seen = new Set<string>()
  const recentErrors: Array<{ pattern: string; grammar_point: GrammarPoint }> = []
  for (const row of errorRows ?? []) {
    const key = row.grammar_point as GrammarPoint
    if (!seen.has(key) && row.original) {
      seen.add(key)
      recentErrors.push({ pattern: row.original, grammar_point: key })
      if (recentErrors.length >= 5) break
    }
  }

  // Tier 2b: weakest vocab (ease_factor < 2.0, up to 20 words)
  const { data: vocabRows } = await supabase
    .from('vocab_cards')
    .select('word')
    .eq('language', session.language)
    .lt('ease_factor', 2.0)
    .order('ease_factor', { ascending: true })
    .limit(20)

  const weakVocab = (vocabRows ?? []).map((r) => r.word)

  // Tier 2c: active goal (first incomplete goal)
  const { data: goalRows } = await supabase
    .from('goals')
    .select('title')
    .eq('language', session.language)
    .eq('completed', false)
    .order('created_at', { ascending: true })
    .limit(1)

  const currentGoal = goalRows?.[0]?.title ?? null

  return {
    level: session.cefr_level,
    language: session.language,
    recentErrors,
    weakVocab,
    currentGoal,
    lastTopic: session.last_topic,
  }
}

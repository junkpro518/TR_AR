import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { analyzeFeedback } from '@/lib/openrouter'
import type { Language } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message, language, message_id } = body as {
    message: string
    language: Language
    message_id: string
  }

  if (!message || !language || !message_id) {
    return NextResponse.json({ error: 'message, language, message_id required' }, { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY!
  const model = process.env.ANALYSIS_MODEL!

  // Analyze with lightweight model — never crash the chat if this fails
  let feedback
  try {
    feedback = await analyzeFeedback(apiKey, model, message, language)
  } catch {
    return NextResponse.json({ items: [], new_vocab: [], xp_earned: 2 })
  }

  const supabase = createServerClient()

  // Save feedback items to DB
  if (feedback.items.length > 0) {
    await supabase.from('feedback_log').insert(
      feedback.items.map(item => ({
        message_id,
        type: item.type,
        original: item.original ?? null,
        correction: item.correction ?? null,
        explanation: item.explanation,
      }))
    )
  }

  // Add new vocab to SRS
  if (feedback.new_vocab.length > 0) {
    await supabase
      .from('vocab_cards')
      .upsert(
        feedback.new_vocab.map(v => ({
          language,
          word: v.word.toLowerCase().trim(),
          translation: v.translation,
          example: v.example,
        })),
        { onConflict: 'language,word', ignoreDuplicates: true }
      )
  }

  // Update session XP
  if (feedback.xp_earned > 0) {
    const { data: currentSession } = await supabase
      .from('sessions')
      .select('id, total_xp')
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (currentSession) {
      await supabase
        .from('sessions')
        .update({ total_xp: currentSession.total_xp + feedback.xp_earned })
        .eq('id', currentSession.id)
    }
  }

  return NextResponse.json(feedback)
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language } from '@/lib/types'

// GET /api/vocab?language=turkish&known=true
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  const knownOnly = request.nextUrl.searchParams.get('known') === 'true'

  if (!language) {
    return NextResponse.json({ error: 'Language required' }, { status: 400 })
  }

  const supabase = createServerClient()
  let query = supabase.from('vocab_cards').select('*').eq('language', language)

  if (knownOnly) {
    // Known vocab: cards reviewed at least once
    query = query.gt('repetitions', 0)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// PATCH /api/vocab — update card after SRS review
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ease_factor, interval, repetitions, next_review_at } = body as {
    id: string
    ease_factor: number
    interval: number
    repetitions: number
    next_review_at: string
  }

  if (!id || typeof ease_factor !== 'number' || typeof interval !== 'number' || typeof repetitions !== 'number' || !next_review_at) {
    return NextResponse.json({ error: 'id, ease_factor, interval, repetitions, next_review_at required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vocab_cards')
    .update({ ease_factor, interval, repetitions, next_review_at })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// POST /api/vocab — add new vocab cards (idempotent)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { language, cards } = body as {
    language: Language
    cards: Array<{ word: string; translation: string; example: string }>
  }

  if (!language || !cards?.length) {
    return NextResponse.json({ error: 'language and cards required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('vocab_cards')
    .upsert(
      cards.map(card => ({
        language,
        word: card.word.toLowerCase().trim(),
        translation: card.translation,
        example: card.example,
      })),
      { onConflict: 'language,word', ignoreDuplicates: true }
    )
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [], { status: 201 })
}

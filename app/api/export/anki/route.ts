import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language } from '@/lib/types'

// GET /api/export/anki?language=turkish
// Returns tab-separated Anki import file: word\ttranslation\texample
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  if (!language) return NextResponse.json({ error: 'language required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vocab_cards')
    .select('word, translation, example')
    .eq('language', language)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cards = data ?? []
  if (cards.length === 0) {
    return NextResponse.json({ error: 'No vocabulary cards found' }, { status: 404 })
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\t/g, ' ')
      .replace(/\n/g, ' ')
  }

  // Anki tab-separated format: front\tback\ttags
  // front = word, back = translation + example
  const lines = cards.map(card => {
    const front = escapeHtml(card.word)
    const back = card.example
      ? `${escapeHtml(card.translation)}<br><br><i>${escapeHtml(card.example)}</i>`
      : escapeHtml(card.translation)
    return `${front}\t${back}\t${language}`
  })

  const content = lines.join('\n')

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="vocab-${language}-${new Date().toISOString().split('T')[0]}.txt"`,
    },
  })
}

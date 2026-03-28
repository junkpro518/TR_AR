import { NextRequest, NextResponse } from 'next/server'
import { getSecret } from '@/lib/secrets-loader'

// POST /api/search — يبحث عبر Serper (Google)
export async function POST(request: NextRequest) {
  const { query } = await request.json() as { query: string }
  if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const SERPER_API_KEY = await getSecret('SERPER_API_KEY')
  if (!SERPER_API_KEY) return NextResponse.json({ error: 'SERPER_API_KEY not configured' }, { status: 500 })

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5, gl: 'tr', hl: 'tr' }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Search failed' }, { status: 500 })

    const data = await res.json()

    // استخرج أهم النتائج
    const results = (data.organic ?? []).slice(0, 4).map((r: { title: string; snippet: string; link: string }) => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link,
    }))

    // إذا كان هناك answerBox، أضفه
    const answer = data.answerBox?.answer ?? data.answerBox?.snippet ?? null

    return NextResponse.json({ results, answer, query })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

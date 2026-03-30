import { NextRequest, NextResponse } from 'next/server'
import { generateVoxtralAudio } from '@/lib/tts'

export async function POST(request: NextRequest) {
  try {
    const { text, language = 'tr' } = await request.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const audioBuffer = await generateVoxtralAudio(text, language as 'tr' | 'ar')

    if (!audioBuffer) {
      return NextResponse.json({ fallback: true }, { status: 503 })
    }

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })
  } catch {
    return NextResponse.json({ fallback: true }, { status: 503 })
  }
}

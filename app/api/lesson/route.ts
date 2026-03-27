import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { streamChatCompletion } from '@/lib/openrouter'
import type { Language, CEFRLevel } from '@/lib/types'

// POST /api/lesson — generate a structured lesson
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { language, cefr_level, topic, session_id } = body as {
    language: Language
    cefr_level: CEFRLevel
    topic?: string
    session_id: string
  }

  if (!language || !cefr_level || !session_id) {
    return NextResponse.json({ error: 'language, cefr_level, session_id required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Get active goal for topic suggestion
  const { data: goalRow } = await supabase
    .from('goals')
    .select('title')
    .eq('language', language)
    .eq('completed', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const lessonTopic = topic ?? goalRow?.title ?? 'everyday conversation'

  const apiKey = process.env.OPENROUTER_API_KEY!
  const model = process.env.CHAT_MODEL!

  const prompt = `You are a ${language === 'turkish' ? 'Turkish' : 'English'} language teacher.
Create a short structured lesson for a ${cefr_level} student on the topic: "${lessonTopic}".

Return ONLY valid JSON in this exact format:
{
  "title": "<lesson title>",
  "grammar_point": "<one grammar focus>",
  "explanation": "<clear explanation in 2-3 sentences>",
  "examples": [
    {"target": "<example in target language>", "translation": "<Arabic translation>"},
    {"target": "<example in target language>", "translation": "<Arabic translation>"},
    {"target": "<example in target language>", "translation": "<Arabic translation>"}
  ],
  "exercises": [
    {"question": "<fill-in-the-blank or translate>", "answer": "<correct answer>", "hint": "<optional hint>"},
    {"question": "<question>", "answer": "<answer>", "hint": ""},
    {"question": "<question>", "answer": "<answer>", "hint": ""},
    {"question": "<question>", "answer": "<answer>", "hint": ""},
    {"question": "<question>", "answer": "<answer>", "hint": ""}
  ],
  "vocab": [
    {"word": "<word>", "translation": "<Arabic>", "example": "<usage example>"},
    {"word": "<word>", "translation": "<Arabic>", "example": "<usage example>"},
    {"word": "<word>", "translation": "<Arabic>", "example": "<usage example>"}
  ]
}`

  const messages = [{ role: 'user' as const, content: prompt }]
  let raw = ''

  try {
    const stream = await streamChatCompletion(apiKey, model, messages)
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      raw += value
    }

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in response')

    const lesson = JSON.parse(match[0])
    return NextResponse.json(lesson)
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate lesson', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

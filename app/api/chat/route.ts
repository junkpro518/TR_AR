import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { streamChatCompletion } from '@/lib/openrouter'
import { buildSystemPrompt } from '@/lib/prompts'
import type { ChatRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body: ChatRequest = await request.json()
  const { message, language, session_id, cefr_level, known_vocab, goals, recent_errors, last_topic } = body

  if (!message || !language || !session_id) {
    return new Response(JSON.stringify({ error: 'message, language, session_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.CHAT_MODEL
  if (!apiKey || !model) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createServerClient()

  // Build system prompt with student context
  const systemPrompt = buildSystemPrompt({
    language,
    cefr_level,
    known_vocab,
    goals,
    recent_errors,
    last_topic,
  })

  // Fetch recent messages for context (last 20)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const contextMessages = (recentMessages ?? []).reverse()

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...contextMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user' as const, content: message },
  ]

  // Save user message first
  const { data: savedUserMsg, error: insertError } = await supabase
    .from('messages')
    .insert({ session_id, role: 'user', content: message, xp_earned: 0 })
    .select('id')
    .single()

  if (insertError || !savedUserMsg) {
    return new Response(
      JSON.stringify({ error: 'Failed to save message. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const userMessageId = savedUserMsg.id

  // Stream response from OpenRouter
  let stream: ReadableStream<string>
  try {
    stream = await streamChatCompletion(apiKey, model, messages)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Collect full response to save to DB while streaming to client
  let fullResponse = ''
  const encoder = new TextEncoder()

  const clientStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullResponse += value
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: value })}\n\n`))
        }
      } catch (err) {
        controller.error(err)
        return
      } finally {
        reader.releaseLock()
        try {
          const { data: savedAssistantMsg } = await supabase
            .from('messages')
            .insert({ session_id, role: 'assistant', content: fullResponse, xp_earned: 0 })
            .select('id')
            .single()
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, user_message_id: userMessageId, assistant_message_id: savedAssistantMsg?.id ?? null })}\n\n`
            )
          )
        } finally {
          controller.close()
        }
      }
    },
  })

  return new Response(clientStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

import { NextRequest } from 'next/server'
import { streamChatCompletion } from '@/lib/openrouter'

const QUICK_ASK_SYSTEM_PROMPT = `أنت مساعد لغوي للغة التركية. تجيب على أسئلة سريعة عن:
- معنى الكلمات والجمل التركية
- قواعد النحو التركي
- الفروق بين التعابير
- كيفية قول شيء معين بالتركية

أجب بالعربية مع التركية. كن موجزاً ومفيداً. لا تبدأ محادثة تعليمية - فقط أجب على السؤال مباشرة.`

interface QuickAskMessage {
  role: 'user' | 'assistant'
  content: string
}

interface QuickAskRequest {
  message: string
  history?: QuickAskMessage[]
}

// POST /api/quick-ask
// Ephemeral chat — streams a response WITHOUT saving anything to Supabase.
// No session, no XP, no feedback analysis.
export async function POST(request: NextRequest) {
  let body: QuickAskRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { message, history = [] } = body

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.CHAT_MODEL
  if (!apiKey || !model) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages = [
    { role: 'system' as const, content: QUICK_ASK_SYSTEM_PROMPT },
    ...history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ]

  let stream: ReadableStream<string>
  try {
    stream = await streamChatCompletion(apiKey, model, messages)
  } catch {
    return new Response(JSON.stringify({ error: 'AI service unavailable. Please try again.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const clientStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: value })}\n\n`))
        }
      } catch (err) {
        controller.error(err)
        return
      } finally {
        reader.releaseLock()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(clientStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

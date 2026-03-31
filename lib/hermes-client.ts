/**
 * Hermes Agent HTTP Client
 * يستدعي Hermes API المتوافقة مع OpenAI بدلاً من OpenRouter مباشرةً.
 * Hermes يضيف: ذاكرة دائمة + ضغط سياق + مهارات + budget pressure
 */

const HERMES_BASE = process.env.HERMES_API_URL ?? 'http://localhost:8000'
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? 'tr-ar-internal'

export function buildHermesHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${HERMES_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * يبث رداً من Hermes Agent (OpenAI-compatible streaming)
 * يُستخدم بدلاً من streamChatCompletion في openrouter.ts
 */
export async function streamHermesCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model?: string,
): Promise<ReadableStream<string>> {
  const response = await fetch(`${HERMES_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHermesHeaders(),
    body: JSON.stringify({
      model: model ?? 'default',
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Hermes error ${response.status}: ${error}`)
  }

  if (!response.body) throw new Error('No response body from Hermes')

  const decoder = new TextDecoder()
  let buffer = ''

  // TransformStream — متوافق مع Cloudflare Workers
  const { readable, writable } = new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) controller.enqueue(content)
        } catch { /* skip malformed */ }
      }
    },
    flush(controller) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim()
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) controller.enqueue(content)
          } catch { /* skip */ }
        }
      }
    },
  })

  response.body.pipeTo(writable).catch(() => {})
  return readable
}

/**
 * فحص صحة اتصال Hermes — يُستخدم قبل كل استدعاء للـ fallback
 */
export async function checkHermesHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${HERMES_BASE}/health`, {
      method: 'GET',
      headers: buildHermesHeaders(),
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

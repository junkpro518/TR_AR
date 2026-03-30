const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    'X-Title': 'TR-AR Language Teacher',
  }
}

export function buildChatBody(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
) {
  return {
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  }
}

export function buildAnalysisBody(model: string, userMessage: string, language: string) {
  return {
    model,
    messages: [
      {
        role: 'system' as const,
        content: `You are a ${language} language analyst. Return ONLY valid JSON matching this schema:
{
  "items": [{"type": "correct"|"correction"|"suggestion"|"new_vocab", "original": string|null, "correction": string|null, "explanation": string}],
  "new_vocab": [{"word": string, "translation": string, "example": string}],
  "xp_earned": number
}
xp_earned: 10 for no errors, 5 for minor errors, 2 for major errors.`,
      },
      {
        role: 'user' as const,
        content: `Analyze this ${language} message: "${userMessage}"`,
      },
    ],
    stream: false,
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 500,
  }
}

export async function streamChatCompletion(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<string>> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildChatBody(model, messages)),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${error}`)
  }

  if (!response.body) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  // Use TransformStream + pipeTo — the CF Workers-compatible streaming pattern.
  // A pull-based ReadableStream stalls in CF Workers when pull enqueues nothing.
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
      // Handle any remaining data in buffer on stream end
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

export async function analyzeFeedback(
  apiKey: string,
  model: string,
  userMessage: string,
  language: string
): Promise<import('./types').FeedbackResponse> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildAnalysisBody(model, userMessage, language)),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter feedback error ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  try {
    return JSON.parse(content)
  } catch {
    // Graceful fallback — don't crash the chat
    return { items: [], new_vocab: [], xp_earned: 2 }
  }
}

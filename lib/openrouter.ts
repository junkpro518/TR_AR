const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Language Teacher App',
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

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          controller.close()
          return
        }
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) controller.enqueue(content)
        } catch {
          // skip malformed chunks
        }
      }
    },
  })
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

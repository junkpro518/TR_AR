import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { streamChatCompletion } from '@/lib/openrouter'
import { buildSystemPrompt } from '@/lib/prompts'
import { getWeaknessReport } from '@/lib/weakness-analyzer'
import { analyzeAndUpdateGoals } from '@/lib/goal-analyzer'
import { loadAppSettings } from '@/lib/settings-loader'
import { getSecret } from '@/lib/secrets-loader'
import type { ChatRequest } from '@/lib/types'

async function runWebSearchIfNeeded(
  message: string,
  webSearchEnabled: boolean,
): Promise<{ searchResults: string; searchQuery: string | null }> {
  if (!webSearchEnabled) return { searchResults: '', searchQuery: null }

  const SERPER_KEY = await getSecret('SERPER_API_KEY')
  if (!SERPER_KEY) return { searchResults: '', searchQuery: null }

  const OPENROUTER_API_KEY = await getSecret('OPENROUTER_API_KEY')
  const ANALYSIS_MODEL = await getSecret('ANALYSIS_MODEL') || process.env.ANALYSIS_MODEL || 'meta-llama/llama-3.1-8b-instruct'

  if (!OPENROUTER_API_KEY) return { searchResults: '', searchQuery: null }

  try {
    const checkRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [{
          role: 'user',
          content: `هل هذا السؤال يحتاج بحثاً في الإنترنت لإجابة دقيقة (مثلاً: معلومة حديثة، حدث، شخص، مكان، إحصاء)؟
سؤال: "${message}"
إذا نعم، اكتب فقط: SEARCH: [استعلام البحث بالإنجليزية]
إذا لا، اكتب فقط: NO`,
        }],
        max_tokens: 50,
        temperature: 0,
      }),
    })

    if (!checkRes.ok) return { searchResults: '', searchQuery: null }
    const checkData = await checkRes.json()
    const checkText = checkData.choices?.[0]?.message?.content?.trim() ?? 'NO'

    if (!checkText.startsWith('SEARCH:')) return { searchResults: '', searchQuery: null }

    const query = checkText.replace('SEARCH:', '').trim()

    // ابحث
    const searchRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 3, gl: 'tr', hl: 'ar' }),
    })

    if (!searchRes.ok) return { searchResults: '', searchQuery: query }

    const searchData = await searchRes.json()
    const snippets = (searchData.organic ?? []).slice(0, 3).map((r: { title: string; snippet: string }) =>
      `- ${r.title}: ${r.snippet}`
    ).join('\n')

    const answer = searchData.answerBox?.answer ?? searchData.answerBox?.snippet ?? ''
    const combined = answer ? `${answer}\n\n${snippets}` : snippets

    return {
      searchResults: combined ? `\n\n[نتائج بحث الإنترنت عن "${query}"]:\n${combined}\n[نهاية نتائج البحث]\n` : '',
      searchQuery: query,
    }
  } catch {
    return { searchResults: '', searchQuery: null }
  }
}

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

  // Task 3: Fetch cross-session context — aggregate errors from last 10 sessions
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('common_errors, last_topic, total_xp, cefr_level')
    .eq('language', 'turkish')
    .order('created_at', { ascending: false })
    .limit(10)

  const allSessionErrors: string[] = allSessions
    ? [...new Set(allSessions.flatMap((s: { common_errors?: string[] }) => s.common_errors ?? []))].slice(0, 10)
    : []

  // Load settings and weakness report in parallel (both non-critical)
  const [appSettings, weaknessReport] = await Promise.all([
    loadAppSettings().catch(() => null),
    getWeaknessReport().catch(() => null),
  ])

  // بحث إنترنت إذا مفعّل
  const { searchResults, searchQuery } = await runWebSearchIfNeeded(
    message,
    appSettings?.user?.web_search_enabled ?? false,
  )

  // Use cefr_override if set in user settings
  const effectiveCefrLevel = appSettings?.user.cefr_override
    ? (appSettings.user.cefr_override as typeof cefr_level)
    : cefr_level

  // Build system prompt with student context (current + cross-session errors + weakness data + settings)
  const systemPrompt = buildSystemPrompt({
    language,
    cefr_level: effectiveCefrLevel,
    known_vocab,
    goals,
    recent_errors,
    last_topic,
    all_session_errors: allSessionErrors,
    weakness_report: weaknessReport ?? undefined,
    teacher_config: appSettings?.teacher,
    preferred_topics: appSettings?.user.preferred_topics,
  })

  // أضف نتائج البحث للـ system prompt إذا وجدت
  const finalSystemPrompt = searchResults
    ? systemPrompt + '\n\n' + searchResults
    : systemPrompt

  // Fetch recent messages for context (last 20)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const contextMessages = (recentMessages ?? []).reverse()

  const messages = [
    { role: 'system' as const, content: finalSystemPrompt },
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
          // استخرج GOAL marker إذا وجد
          const goalMatch = fullResponse.match(/\[GOAL:\s*([\s\S]+?)\]/)
          let cleanResponse = fullResponse

          if (goalMatch) {
            const goalTitle = goalMatch[1].trim()
            cleanResponse = fullResponse.replace(goalMatch[0], '').trim()

            // أضف الهدف للقاعدة بشكل مستقل
            Promise.resolve(
              supabase.from('goals').insert({
                language: language,
                title: goalTitle,
                is_auto: true,
                progress: 0,
                completed: false,
              })
            ).catch(() => {}) // fire-and-forget
          }

          // احذف QUIZ blocks من النص المحفوظ (الـ UI يُعيد بناءها)
          // لكن أبقِها في cleanResponse الذي يُرسَل للـ client
          // فقط في الرسالة المحفوظة في DB، احذف الـ quiz
          const dbResponse = cleanResponse.replace(/\[QUIZ\][\s\S]*?\[\/QUIZ\]/gi, '').trim()

          const messageToSave = searchQuery
            ? `[WEB_SEARCH]\n${dbResponse}`
            : dbResponse

          const { data: savedAssistantMsg } = await supabase
            .from('messages')
            .insert({ session_id, role: 'assistant', content: messageToSave, xp_earned: 0 })
            .select('id')
            .single()
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, user_message_id: userMessageId, assistant_message_id: savedAssistantMsg?.id ?? null })}\n\n`
            )
          )
          // Task 1: Fire-and-forget — analyze conversation and auto-add/update goals
          analyzeAndUpdateGoals(supabase, session_id, message, dbResponse, cefr_level).catch(() => {})
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

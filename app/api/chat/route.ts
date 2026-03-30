import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { streamChatCompletion } from '@/lib/openrouter'
import { buildSystemPrompt } from '@/lib/prompts'
import { getWeaknessReport } from '@/lib/weakness-analyzer'
import { analyzeAndUpdateGoals } from '@/lib/goal-analyzer'
import { loadAppSettings } from '@/lib/settings-loader'
import { getSecret } from '@/lib/secrets-loader'
import type { ChatRequest } from '@/lib/types'
import type { SessionSummary } from '@/lib/session-summarizer'

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
  const body: ChatRequest & { web_search_override?: boolean } = await request.json()
  const { message, language, session_id, cefr_level, known_vocab, goals, recent_errors, last_topic, web_search_override } = body

  if (!message || !language || !session_id) {
    return new Response(JSON.stringify({ error: 'message, language, session_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = await getSecret('OPENROUTER_API_KEY')
  const model = await getSecret('CHAT_MODEL') || process.env.CHAT_MODEL
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

  // Load settings, weakness report, and session summaries in parallel (all non-critical)
  const [appSettings, weaknessReport, sessionSummaries] = await Promise.all([
    loadAppSettings().catch(() => null),
    getWeaknessReport().catch(() => null),
    Promise.resolve(
      supabase
        .from('session_summaries')
        .select('id, session_id, summary_ar, topics_covered, vocab_introduced, errors_made, milestones, message_count, created_at')
        .eq('language', 'turkish')
        .order('created_at', { ascending: false })
        .limit(8)
    ).then(r => (r.data ?? []) as SessionSummary[]).catch(() => [] as SessionSummary[]),
  ])

  // بحث إنترنت إذا مفعّل (من الإعدادات أو من override في الطلب)
  const webSearchActive = (appSettings?.user?.web_search_enabled ?? false) || (web_search_override === true)
  const { searchResults, searchQuery } = await runWebSearchIfNeeded(
    message,
    webSearchActive,
  )

  // Use cefr_override if set in user settings
  const effectiveCefrLevel = appSettings?.user.cefr_override
    ? (appSettings.user.cefr_override as typeof cefr_level)
    : cefr_level

  // Build system prompt with student context (current + cross-session errors + weakness data + settings + memory)
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
    session_summaries: sessionSummaries,
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

          // استخرج SUGGEST_PROMPT marker إذا وجد (اقتراح تعديل على System Prompt)
          const suggestPromptMatch = cleanResponse.match(/\[SUGGEST_PROMPT:\s*([\s\S]+?)\]/)
          if (suggestPromptMatch) {
            const suggestion = suggestPromptMatch[1].trim()
            cleanResponse = cleanResponse.replace(suggestPromptMatch[0], '').trim()
            // أرسل الاقتراح إلى Telegram للموافقة (fire-and-forget)
            Promise.resolve(
              fetch(new URL('/api/settings/telegram-proposal', request.url).href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  key: 'system_prompt_base',
                  proposed_value: suggestion,
                  change_description: `💡 اقتراح من المعلم لتعديل الـ System Prompt:\n\n"${suggestion.slice(0, 200)}${suggestion.length > 200 ? '...' : ''}"`,
                }),
              })
            ).catch(() => {})
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
          controller.close() // close stream immediately so client knows we're done
          // Task 1: Fire-and-forget — analyze conversation and auto-add/update goals
          analyzeAndUpdateGoals(supabase, session_id, message, dbResponse, cefr_level).catch(() => {})

          // Fire-and-forget: summarize previous sessions
          Promise.resolve((async () => {
            try {
              const { data: prevSessions } = await supabase
                .from('sessions')
                .select('id')
                .eq('language', 'turkish')
                .neq('id', session_id)
                .order('created_at', { ascending: false })
                .limit(5)
              if (!prevSessions || prevSessions.length === 0) return
              const prevIds = prevSessions.map((s: { id: string }) => s.id)
              const { data: existing } = await supabase
                .from('session_summaries')
                .select('session_id')
                .in('session_id', prevIds)
              const summarizedIds = new Set((existing ?? []).map((s: { session_id: string }) => s.session_id))
              const needsSummary = prevIds.find((id: string) => !summarizedIds.has(id))
              if (!needsSummary) return
              const { summarizeSession } = await import('@/lib/session-summarizer')
              const apiKey = await getSecret('OPENROUTER_API_KEY')
              const model = await getSecret('ANALYSIS_MODEL') || 'meta-llama/llama-3.1-8b-instruct'
              if (!apiKey) return
              await summarizeSession(supabase, needsSummary, apiKey, model)
            } catch { /* silent */ }
          })()).catch(() => {})
        } catch { /* silent — background tasks failed */ }
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

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSecret } from '@/lib/secrets-loader'
import type { Language, CEFRLevel, TaskFeedback } from '@/lib/types'

// GET /api/task?language=turkish&cefr_level=A1
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  const cefr_level = request.nextUrl.searchParams.get('cefr_level') as CEFRLevel

  if (!language || !cefr_level) {
    return NextResponse.json({ error: 'language and cefr_level required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('language', language)
    .eq('cefr_level', cefr_level)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/task — evaluate a task attempt
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { task_id, session_id, user_text } = body as {
    task_id: string
    session_id: string
    user_text: string
  }

  if (!task_id || !user_text?.trim()) {
    return NextResponse.json({ error: 'task_id and user_text required' }, { status: 400 })
  }

  const supabase = createServerClient()

  let effectiveSessionId = session_id

  if (!effectiveSessionId) {
    // Get or create latest session
    const { data: latestSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('language', 'turkish')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestSession) {
      effectiveSessionId = latestSession.id
    } else {
      // Create a new session
      const { data: newSession } = await supabase
        .from('sessions')
        .insert({ language: 'turkish', cefr_level: 'A1', total_xp: 0, streak_days: 1, last_activity_date: new Date().toISOString().split('T')[0] })
        .select('id')
        .single()
      effectiveSessionId = newSession?.id ?? ''
    }
  }

  if (!effectiveSessionId) {
    return NextResponse.json({ error: 'Failed to resolve session_id' }, { status: 500 })
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', task_id)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const apiKey = await getSecret('OPENROUTER_API_KEY')
  const model = await getSecret('ANALYSIS_MODEL') || process.env.ANALYSIS_MODEL
  if (!apiKey || !model) {
    return NextResponse.json({ error: 'API key or model not configured' }, { status: 500 })
  }

  const evalPrompt = `You are evaluating a language learning task attempt. Return ONLY valid JSON.

Task: "${task.title}"
Scenario: "${task.scenario}"
Target grammar: ${task.target_grammar}
Target vocabulary: ${(task.target_vocab as string[]).join(', ')}
Rubric: vocabulary_usage ${task.rubric_json.vocabulary_usage}%, grammar_accuracy ${task.rubric_json.grammar_accuracy}%, fluency ${task.rubric_json.fluency}%

Student's response:
"${user_text}"

Return JSON:
{
  "vocabulary_score": <0-100>,
  "grammar_score": <0-100>,
  "fluency_score": <0-100>,
  "overall_score": <0-100 weighted average>,
  "strengths": ["..."],
  "improvements": ["..."],
  "corrected_text": "<corrected version if needed, else empty string>"
}`

  let feedbackJson: TaskFeedback = {
    vocabulary_score: 50,
    grammar_score: 50,
    fluency_score: 50,
    overall_score: 50,
    strengths: [],
    improvements: [],
  }

  try {
    // استخدم non-streaming للتقييم — أبسط وأكثر موثوقية على Cloudflare Workers
    const evalRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://tr-ar.junkpro518.workers.dev',
        'X-Title': 'TR-AR Language Teacher',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: evalPrompt }],
        stream: false,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 600,
      }),
    })
    if (evalRes.ok) {
      const evalData = await evalRes.json()
      const raw = evalData.choices?.[0]?.message?.content ?? ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) feedbackJson = JSON.parse(match[0])
    }
  } catch {
    // fallback scores already set
  }

  const xp_earned = Math.round((feedbackJson.overall_score / 100) * task.xp_reward)

  // complete_task_attempt: حفظ النتيجة + تحديث XP في transaction واحد
  // يمنع الحالة التي يُحفظ فيها task_attempt دون تحديث XP عند الفشل الجزئي
  const { error: rpcError } = await supabase.rpc('complete_task_attempt', {
    p_task_id: task_id,
    p_session_id: effectiveSessionId,
    p_user_text: user_text,
    p_score: feedbackJson.overall_score,
    p_feedback_json: feedbackJson,
    p_completed: feedbackJson.overall_score >= 60,
    p_xp_earned: xp_earned,
  })

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  return NextResponse.json({ feedback: feedbackJson, xp_earned })
}

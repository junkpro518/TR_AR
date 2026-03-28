import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { streamChatCompletion } from '@/lib/openrouter'
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
    return NextResponse.json({ error: 'task_id and user_text required' }, { status: 400 })
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
    const messages = [{ role: 'user' as const, content: evalPrompt }]
    let raw = ''
    const stream = await streamChatCompletion(apiKey, model, messages)
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      raw += value
    }
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) feedbackJson = JSON.parse(match[0])
  } catch {
    // fallback scores already set
  }

  const xp_earned = Math.round((feedbackJson.overall_score / 100) * task.xp_reward)

  const { error: insertError } = await supabase.from('task_attempts').insert({
    task_id,
    session_id: effectiveSessionId,
    score: feedbackJson.overall_score,
    feedback_json: feedbackJson,
    completed: feedbackJson.overall_score >= 60,
    xp_earned,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Add XP to session
  if (xp_earned > 0) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('id, total_xp')
      .eq('id', effectiveSessionId)
      .single()
    if (sess) {
      await supabase
        .from('sessions')
        .update({ total_xp: sess.total_xp + xp_earned })
        .eq('id', sess.id)
    }
  }

  return NextResponse.json({ feedback: feedbackJson, xp_earned })
}

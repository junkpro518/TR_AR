import type { SupabaseClient } from '@supabase/supabase-js'

export async function analyzeAndUpdateGoals(
  supabase: SupabaseClient,
  session_id: string,
  userMessage: string,
  assistantResponse: string,
  cefrLevel: string
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY!
  const model = process.env.ANALYSIS_MODEL!

  // Fetch existing goals
  const { data: existingGoals } = await supabase
    .from('goals')
    .select('title, progress, completed')
    .eq('language', 'turkish')
    .eq('completed', false)
    .limit(5)

  const existingGoalTitles = (existingGoals ?? []).map(g => g.title).join('، ')

  // Check recent feedback_log for recurring errors
  const { data: recentErrors } = await supabase
    .from('feedback_log')
    .select('grammar_point, correction')
    .order('created_at', { ascending: false })
    .limit(20)

  const errorPatterns = recentErrors?.reduce((acc: Record<string, number>, e) => {
    if (e.grammar_point) acc[e.grammar_point] = (acc[e.grammar_point] ?? 0) + 1
    return acc
  }, {}) ?? {}

  const topErrors = Object.entries(errorPatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k} (${v} مرة)`)
    .join('، ')

  const analysisPrompt = `أنت محلل تعليمي. بناءً على المحادثة التالية، اقترح هدفاً تعليمياً واحداً للطالب في اللغة التركية.

مستوى الطالب: ${cefrLevel}
الأخطاء المتكررة: ${topErrors || 'لا توجد'}
الأهداف الموجودة: ${existingGoalTitles || 'لا توجد'}

المحادثة:
الطالب: ${userMessage}
المعلم: ${assistantResponse}

أجب بـ JSON فقط، بدون أي نص آخر:
{
  "should_add_goal": true/false,
  "goal_title": "عنوان الهدف التعليمي بالعربية",
  "goal_type": "grammar|vocabulary|conversation|pronunciation",
  "reason": "سبب مختصر"
}

لا تضف هدفاً إذا كان موجوداً مسبقاً أو إذا لم يكن هناك ما يستوجب إضافته.`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tr-ar.vercel.app',
        'X-Title': 'TR-AR Language Tutor',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (!response.ok) return

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const analysis = JSON.parse(jsonMatch[0])

    if (analysis.should_add_goal && analysis.goal_title) {
      // Check if similar goal already exists
      const { data: existing } = await supabase
        .from('goals')
        .select('id')
        .eq('language', 'turkish')
        .ilike('title', `%${analysis.goal_title.slice(0, 15)}%`)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('goals').insert({
          language: 'turkish',
          title: analysis.goal_title,
          is_auto: true,
          progress: 0,
          completed: false,
        })
      }
    }
  } catch {
    // Silent fail — this is non-critical
  }
}

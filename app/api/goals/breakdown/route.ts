import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSecret } from '@/lib/secrets-loader'

interface Milestone {
  step: number
  title: string
  description: string
  estimated_days: number
}

// POST /api/goals/breakdown — يستدعي AI لتقسيم الهدف لمراحل
export async function POST(request: NextRequest) {
  const { goal_id, title, language } = await request.json() as {
    goal_id: string
    title: string
    language: string
  }

  if (!goal_id || !title) {
    return NextResponse.json({ error: 'goal_id and title required' }, { status: 400 })
  }

  const OPENROUTER_API_KEY = await getSecret('OPENROUTER_API_KEY')
  const ANALYSIS_MODEL = await getSecret('ANALYSIS_MODEL') || process.env.ANALYSIS_MODEL || 'meta-llama/llama-3.1-8b-instruct'

  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })
  }

  const prompt = `أنت معلم لغة تركية خبير. الطالب أضاف هدف تعلم جديد: "${title}"

قسّم هذا الهدف إلى 4-6 مراحل تعلم متدرجة. كل مرحلة يجب أن تحتوي على:
- step: رقم المرحلة (1, 2, 3...)
- title: عنوان المرحلة بالعربية (جملة قصيرة)
- description: شرح ما يتعلمه الطالب في هذه المرحلة بالعربية (2-3 جمل)
- estimated_days: عدد الأيام المقدرة للإتمام (رقم)

المراحل يجب أن تكون من الأبسط للأصعب. ابدأ بالأساسيات وانتهِ بالإتقان.

رد بـ JSON فقط، لا نص إضافي:
{"milestones": [...]}
`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'AI call failed' }, { status: 500 })
    }

    const aiData = await res.json()
    const rawContent = aiData.choices?.[0]?.message?.content ?? ''

    // استخرج JSON من الرد
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { milestones: Milestone[] }
    const milestones = parsed.milestones ?? []

    // احفظ في DB
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('goals')
      .update({ milestones })
      .eq('id', goal_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ milestones, goal: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

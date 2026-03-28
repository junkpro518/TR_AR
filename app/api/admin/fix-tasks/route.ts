import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSecret } from '@/lib/secrets-loader'

// GET /api/admin/fix-tasks
// يُترجم وصف المهام (scenario) إلى العربية ويحدّث DB — استدعِها مرة واحدة فقط
export async function GET(request: NextRequest) {
  // حماية بسيطة — يجب تمرير secret صحيح
  const secret = request.nextUrl.searchParams.get('secret')
  if (!secret || secret !== (process.env.CRON_SECRET ?? 'tr_ar_cron_2024')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServerClient()
  const OPENROUTER_API_KEY = await getSecret('OPENROUTER_API_KEY')
  const ANALYSIS_MODEL = (await getSecret('ANALYSIS_MODEL')) || process.env.ANALYSIS_MODEL || 'meta-llama/llama-3.1-8b-instruct'

  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 })
  }

  const { data: tasks, error } = await supabase.from('tasks').select('id, title, scenario, type, cefr_level')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tasks?.length) return NextResponse.json({ message: 'No tasks found' })

  const results: { id: string; title: string; updated: boolean; error?: string }[] = []

  for (const task of tasks) {
    // تحقق إذا الوصف بالفعل بالعربي (يحتوي على حروف عربية)
    const hasArabic = /[\u0600-\u06FF]/.test(task.scenario ?? '')
    if (hasArabic) {
      results.push({ id: task.id, title: task.title, updated: false })
      continue
    }

    try {
      const prompt = `ترجم وصف مهمة تعلم اللغة التركية التالية إلى العربية الفصحى البسيطة. الوصف يشرح للطالب ما يجب فعله في هذه المهمة. رد بالوصف المترجم فقط، بدون أي نص إضافي.

الوصف الأصلي: "${task.scenario}"`

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: ANALYSIS_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 300,
        }),
      })

      if (!res.ok) {
        results.push({ id: task.id, title: task.title, updated: false, error: 'AI call failed' })
        continue
      }

      const aiData = await res.json()
      const arabicScenario = aiData.choices?.[0]?.message?.content?.trim() ?? ''

      if (!arabicScenario) {
        results.push({ id: task.id, title: task.title, updated: false, error: 'Empty AI response' })
        continue
      }

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ scenario: arabicScenario })
        .eq('id', task.id)

      results.push({ id: task.id, title: task.title, updated: !updateError, error: updateError?.message })
    } catch (err) {
      results.push({ id: task.id, title: task.title, updated: false, error: String(err) })
    }
  }

  const updated = results.filter(r => r.updated).length
  return NextResponse.json({ total: tasks.length, updated, skipped: tasks.length - updated - results.filter(r => r.error).length, results })
}

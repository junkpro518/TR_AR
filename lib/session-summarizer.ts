import type { SupabaseClient } from '@supabase/supabase-js'

export interface SessionSummary {
  id: string
  session_id: string
  language: string
  summary_ar: string
  topics_covered: string[]
  vocab_introduced: string[]
  errors_made: string[]
  milestones: string[]
  message_count: number
  created_at: string
}

export async function summarizeSession(
  supabase: SupabaseClient,
  session_id: string,
  apiKey: string,
  analysisModel: string,
): Promise<SessionSummary | null> {
  try {
    // Check if already summarized
    const { data: existing } = await supabase
      .from('session_summaries')
      .select('id')
      .eq('session_id', session_id)
      .single()

    if (existing) return null

    // Fetch last 60 messages from that session
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(60)

    if (!messages || messages.length < 3) return null

    // Build transcript
    const transcript = messages
      .map((m: { role: string; content: string }) => {
        const label = m.role === 'user' ? 'الطالب' : 'المعلم'
        return `${label}: ${m.content.slice(0, 300)}`
      })
      .join('\n')

    const prompt = `أنت مساعد تعليمي. اقرأ محادثة تعليم اللغة التركية التالية وأنتج ملخصاً منظماً بالعربية.

المحادثة:
${transcript}

أجب بـ JSON صحيح فقط، بدون أي نص آخر:
{
  "summary_ar": "ملخص موجز للجلسة بالعربية (2-3 جمل، 80-120 كلمة)",
  "topics_covered": ["موضوع 1", "موضوع 2"],
  "vocab_introduced": ["كلمة1/ترجمة", "كلمة2/ترجمة"],
  "errors_made": ["نوع الخطأ 1", "نوع الخطأ 2"],
  "milestones": ["إنجاز 1 إن وجد"]
}

القواعد:
- summary_ar: ركّز على ما تعلمه الطالب فعلاً، لا على محتوى الدرس
- topics_covered: موضوعات المحادثة الرئيسية (حد أقصى 5)
- vocab_introduced: الكلمات التركية الجديدة التي شُرحت (حد أقصى 8، صيغة: كلمة/ترجمة)
- errors_made: أنواع الأخطاء النحوية (حد أقصى 5)
- milestones: إنجازات واضحة (كويز صحيح، وصول مستوى جديد) — مصفوفة فارغة إن لم يوجد`

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tr-ar.pages.dev',
      },
      body: JSON.stringify({
        model: analysisModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.2,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''

    // Parse JSON — strip any markdown fences if present
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    let result: {
      summary_ar: string
      topics_covered: string[]
      vocab_introduced: string[]
      errors_made: string[]
      milestones: string[]
    }

    try {
      result = JSON.parse(jsonStr)
    } catch {
      return null
    }

    if (!result.summary_ar) return null

    const { data: upserted, error } = await supabase
      .from('session_summaries')
      .upsert(
        {
          session_id,
          language: 'turkish',
          summary_ar: result.summary_ar,
          topics_covered: result.topics_covered ?? [],
          vocab_introduced: result.vocab_introduced ?? [],
          errors_made: result.errors_made ?? [],
          milestones: result.milestones ?? [],
          message_count: messages.length,
        },
        { onConflict: 'session_id', ignoreDuplicates: true },
      )
      .select()
      .single()

    if (error || !upserted) return null

    return upserted as SessionSummary
  } catch {
    return null
  }
}

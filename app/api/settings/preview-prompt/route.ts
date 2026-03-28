import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { buildSystemPrompt } from '@/lib/prompts'
import type { CEFRLevel } from '@/lib/types'

// GET /api/settings/preview-prompt
// يُعيد System Prompt الكامل المُستخدَم حالياً مع الإعدادات الحالية
export async function GET() {
  const supabase = createServerClient()

  // تحميل الإعدادات الحالية
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'response_style', 'correction_strictness', 'vocab_rate',
      'focus_areas', 'custom_instructions', 'teaching_language_mix',
      'quiz_frequency', 'system_prompt_base',
    ])

  const map: Record<string, unknown> = {}
  for (const row of rows ?? []) {
    map[row.key] = row.value
  }

  // تحميل آخر جلسة للحصول على مستوى CEFR
  const { data: lastSession } = await supabase
    .from('sessions')
    .select('cefr_level')
    .eq('language', 'turkish')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const prompt = buildSystemPrompt({
    language: 'turkish',
    cefr_level: (lastSession?.cefr_level as CEFRLevel) ?? 'A1',
    known_vocab: ['merhaba', 'teşekkür ederim', 'evet', 'hayır'],
    goals: ['إتقان المحادثة اليومية'],
    recent_errors: [],
    last_topic: null,
    teacher_config: {
      response_style: (map['response_style'] as 'casual' | 'formal') ?? 'casual',
      correction_strictness: (map['correction_strictness'] as 'gentle' | 'moderate' | 'strict') ?? 'moderate',
      vocab_intro_rate: (map['vocab_rate'] as 'slow' | 'medium' | 'fast') ?? 'medium',
      focus_areas: (map['focus_areas'] as string[]) ?? ['conversation'],
      custom_instructions: (map['custom_instructions'] as string) ?? '',
      teaching_language_mix: (map['teaching_language_mix'] as 'arabic_heavy' | 'balanced' | 'turkish_heavy') ?? 'balanced',
      quiz_frequency: (map['quiz_frequency'] as 'never' | 'sometimes' | 'often') ?? 'sometimes',
    },
    system_prompt_base: (map['system_prompt_base'] as string) || undefined,
  })

  return NextResponse.json({ prompt })
}

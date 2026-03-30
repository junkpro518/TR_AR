import { createServerClient } from './supabase-server'

export interface WeaknessReport {
  topWeaknesses: Array<{
    grammar_point: string
    count: number
    examples: string[]
    arabic_name: string
  }>
  weakVocab: string[]
  overallAccuracy: number
  recommendations: string[]
}

const GRAMMAR_ARABIC_NAMES: Record<string, string> = {
  past_tense: 'الماضي',
  present_tense: 'المضارع',
  future_tense: 'المستقبل',
  tense_confusion: 'الخلط بين الأزمنة',
  word_order: 'ترتيب الكلمات',
  vowel_harmony: 'الانسجام الصوتي',
  case_suffix: 'لواحق الحالة',
  verb_conjugation: 'تصريف الأفعال',
  plural_form: 'صيغة الجمع',
  preposition: 'حروف الجر',
  article: 'أداة التعريف',
  pronoun: 'الضمائر',
  adjective_agreement: 'مطابقة الصفة',
  negation: 'النفي',
  question_formation: 'صياغة السؤال',
  other: 'أخرى',
}

export async function getWeaknessReport(): Promise<WeaknessReport> {
  const supabase = createServerClient()

  // Get feedback log with grammar points
  const { data: feedbackLog } = await supabase
    .from('feedback_log')
    .select('grammar_point, original, correction')
    .not('grammar_point', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const grammarCounts: Record<string, { count: number; examples: string[] }> = {}
  for (const item of feedbackLog ?? []) {
    if (!item.grammar_point) continue
    if (!grammarCounts[item.grammar_point]) {
      grammarCounts[item.grammar_point] = { count: 0, examples: [] }
    }
    grammarCounts[item.grammar_point].count++
    if (grammarCounts[item.grammar_point].examples.length < 2 && item.original) {
      grammarCounts[item.grammar_point].examples.push(item.original)
    }
  }

  const topWeaknesses = Object.entries(grammarCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([key, val]) => ({
      grammar_point: key,
      count: val.count,
      examples: val.examples,
      arabic_name: GRAMMAR_ARABIC_NAMES[key] ?? key,
    }))

  // Get weak vocab (SRS cards with low ease_factor)
  const { data: weakVocabCards } = await supabase
    .from('vocab_cards')
    .select('word')
    .lt('ease_factor', 2.0)
    .eq('language', 'turkish')
    .limit(10)

  const weakVocab = (weakVocabCards ?? []).map(c => c.word)

  // Overall accuracy from total corrections vs correct items
  const { data: allFeedback } = await supabase
    .from('feedback_log')
    .select('type')
    .limit(200)

  // Calculate accuracy only from evaluable items (correct/correction), ignoring suggestions and new_vocab
  const evaluableItems = allFeedback?.filter(f => f.type === 'correct' || f.type === 'correction') ?? []
  const correctItems = evaluableItems.filter(f => f.type === 'correct').length
  const overallAccuracy = evaluableItems.length > 0 ? Math.round((correctItems / evaluableItems.length) * 100) : 0

  const recommendations: string[] = []
  if (topWeaknesses.length > 0) {
    recommendations.push(`ركّز على: ${topWeaknesses[0].arabic_name}`)
  }
  if (weakVocab.length > 3) {
    recommendations.push(`راجع هذه الكلمات: ${weakVocab.slice(0, 3).join('، ')}`)
  }

  return { topWeaknesses, weakVocab, overallAccuracy, recommendations }
}

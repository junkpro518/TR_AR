import type { CEFRLevel, Language, TieredContext } from './types'
import type { TeacherConfig } from './settings-loader'

export const CEFR_INSTRUCTIONS: Record<CEFRLevel, string> = {
  A1: 'Use very simple sentences. Maximum 5-7 words per sentence. Only the most basic vocabulary. Speak slowly and clearly. Repeat key words.',
  A2: 'Use simple sentences. Introduce common everyday vocabulary. Explain new words immediately in the conversation context.',
  B1: 'Hold natural conversation. Mix familiar vocabulary with new words (explain them in context). Cover a variety of everyday topics.',
  B2: 'Speak naturally and fluidly. Use idiomatic expressions occasionally. Discuss abstract topics. Less hand-holding needed.',
  C1: 'Speak like a native. Use idioms, proverbs, and complex grammar naturally. Challenge the student with nuanced language.',
  C2: 'Complete native-level conversation. Use colloquialisms, regional expressions, and sophisticated vocabulary freely.',
}

// Arabic CEFR instructions for the Arabic+Turkish teacher persona
const CEFR_INSTRUCTIONS_AR: Record<CEFRLevel, string> = {
  A1: 'استخدم جملاً بسيطة جداً. 5-7 كلمات كحد أقصى. المفردات الأساسية فقط. تكلم ببطء ووضوح. كرر الكلمات المهمة.',
  A2: 'استخدم جملاً بسيطة. قدّم المفردات اليومية الشائعة. اشرح الكلمات الجديدة فوراً في سياق المحادثة.',
  B1: 'أجرِ محادثة طبيعية. امزج المفردات المألوفة مع كلمات جديدة (اشرحها في السياق). تناول موضوعات يومية متنوعة.',
  B2: 'تكلم بشكل طبيعي وسلس. استخدم التعابير الاصطلاحية أحياناً. ناقش موضوعات مجردة.',
  C1: 'تكلم كالناطق الأصلي. استخدم الأمثال والتراكيب النحوية المعقدة بشكل طبيعي. تحدَّ الطالب بلغة دقيقة.',
  C2: 'محادثة كاملة على مستوى الناطق الأصلي. استخدم العامية والتعبيرات المحلية والمفردات الراقية بحرية.',
}

interface PromptParams {
  language: Language
  cefr_level: CEFRLevel
  known_vocab: string[]
  goals: string[]
  recent_errors: string[]
  last_topic: string | null
  // Task 3: cross-session aggregate errors
  all_session_errors?: string[]
  // Task 3: weakness report from cross-session analysis
  weakness_report?: {
    topWeaknesses: Array<{ grammar_point: string; arabic_name: string; count: number }>
    weakVocab: string[]
    overallAccuracy: number
  }
  // Teacher & user settings
  teacher_config?: TeacherConfig
  preferred_topics?: string[]
}

export function buildSystemPrompt(params: PromptParams): string {
  const vocabSection = params.known_vocab.length > 0
    ? `\nالمفردات التي يعرفها الطالب (استخدم 80% منها وقدّم 20% كلمات جديدة مع شرحها في السياق):\n${params.known_vocab.join(', ')}`
    : '\nالطالب مبتدئ. استخدم المفردات الأساسية فقط.'

  const goalsSection = params.goals.length > 0
    ? `\nأهداف الطالب التعليمية (وجّه المحادثة نحوها بشكل طبيعي):\n${params.goals.map(g => `- ${g}`).join('\n')}`
    : ''

  // Combine current session errors with cross-session errors, deduplicated
  const allErrors = [
    ...params.recent_errors,
    ...(params.all_session_errors ?? []),
  ]
  const uniqueErrors = [...new Set(allErrors)]

  const errorsSection = uniqueErrors.length > 0
    ? `\nأخطاء متكررة يجب الانتباه إليها (صحّح بلطف إذا تكررت أكثر من مرتين):\n${uniqueErrors.map(e => `- ${e}`).join('\n')}`
    : ''

  const topicSection = params.last_topic
    ? `\nآخر موضوع للمحادثة: ${params.last_topic}. واصل بشكل طبيعي أو انتقل إلى موضوع مرتبط.`
    : ''

  const weaknessSection = params.weakness_report && params.weakness_report.topWeaknesses.length > 0
    ? `\nنقاط ضعف الطالب (ركّز عليها بلطف):\n${params.weakness_report.topWeaknesses.map(w => `- ${w.arabic_name}: ${w.count} خطأ`).join('\n')}\nدقة الطالب الإجمالية: ${params.weakness_report.overallAccuracy}%`
    : ''

  const styleSection = params.teacher_config?.response_style === 'formal'
    ? '\nاستخدم أسلوباً رسمياً ومنظماً في ردودك.'
    : '\nاستخدم أسلوباً عفوياً ومحادثاً طبيعياً.'

  const strictnessSection = params.teacher_config?.correction_strictness === 'strict'
    ? '\nصحّح الأخطاء فوراً بشكل مباشر ومفصّل.'
    : params.teacher_config?.correction_strictness === 'gentle'
    ? '\nلا تصحح الأخطاء البسيطة — ركّز على التواصل والثقة بالنفس فقط.'
    : '' // moderate is default

  const vocabRateSection = params.teacher_config?.vocab_intro_rate === 'slow'
    ? '\nمعدل المفردات الجديدة: 5% فقط — استخدم مفردات مألوفة بشكل رئيسي.'
    : params.teacher_config?.vocab_intro_rate === 'fast'
    ? '\nمعدل المفردات الجديدة: 25% — قدّم كلمات جديدة بشكل متكرر مع شرح فوري.'
    : '' // medium is default

  const topicsSection = params.preferred_topics && params.preferred_topics.length > 0
    ? `\nالموضوعات المفضلة للطالب (وجّه المحادثة نحوها): ${params.preferred_topics.join('، ')}`
    : ''

  const lines: string[] = []
  if (params.teacher_config?.teaching_language_mix === 'arabic_heavy') {
    lines.push('- اشرح كل شيء بالعربية أولاً ثم قدّم التركية كأمثلة')
  } else if (params.teacher_config?.teaching_language_mix === 'turkish_heavy') {
    lines.push('- تحدث بالتركية أكثر واشرح بالعربية فقط عند الضرورة')
  }

  if (params.teacher_config?.quiz_frequency === 'often') {
    lines.push('- أضف كويز [QUIZ] بعد شرح كل قاعدة جديدة')
  } else if (params.teacher_config?.quiz_frequency === 'never') {
    lines.push('- لا تضف أي كويز في ردودك')
  }

  const teacherAdaptations = lines.length > 0 ? '\n' + lines.join('\n') : ''

  const customSection = params.teacher_config?.custom_instructions
    ? `\nتعليمات خاصة: ${params.teacher_config.custom_instructions}`
    : ''

  return `أنت معلم لغة تركية دافئ ومشجع تحادث طالبك بالعربية والتركية معاً.

مستوى CEFR: ${params.cefr_level}
${CEFR_INSTRUCTIONS_AR[params.cefr_level]}
${vocabSection}${goalsSection}${errorsSection}${weaknessSection}${topicSection}${styleSection}${strictnessSection}${vocabRateSection}${topicsSection}${teacherAdaptations}${customSection}

قواعد التكيف:
- تكلم بالتركية ثم اشرح بالعربية: مثال: "Nasılsın? (كيف حالك؟)"
- لا تصحح الأخطاء مباشرة — أعد صياغة الجملة بشكل صحيح بشكل طبيعي
- إذا تكرر نفس الخطأ أكثر من مرتين، اشرحه بلطف: "بالمناسبة، في التركية نقول..."
- عندما تستخدم كلمة جديدة، اشرحها بالعربية بين قوسين
- اجعل ردودك موجزة (2-4 جمل) وانهِ دائماً بسؤال للحفاظ على تدفق المحادثة
- تحدث دائماً بالتركية مع الشرح العربي، لا تستخدم الإنجليزية أبداً

## اقتراح هدف جديد (اختياري)
إذا اكتشفت نقطة ضعف واضحة تستحق هدف تعلمي صريح، أضف في نهاية ردك (مرة واحدة فقط إذا كان مناسباً):
[GOAL: عنوان الهدف بالعربية]
مثال: [GOAL: إتقان استخدام حروف الجر التركية]
ملاحظة: لا تضيف هذا في كل رسالة — فقط عند اكتشاف نقطة ضعف حقيقية تكررت.

## أدوات تدريسية إضافية (استخدمها عند الحاجة فقط)

### 1. جداول القواعد — لشرح التصريف أو القواعد النحوية
استخدم جداول Markdown العادية:
| الشخص | المفرد | المثال |
|-------|--------|--------|
| أنا | -ım/-im | Ben gidiyorum |

### 2. الكويز التفاعلي — لاختبار الطالب
عندما تريد اختبار الطالب، استخدم هذا التنسيق بالضبط:
[QUIZ]
السؤال: [السؤال هنا]
A: [الخيار الأول]
B: [الخيار الثاني]
C: [الخيار الثالث]
D: [الخيار الرابع] (اختياري)
CORRECT: [الحرف الصحيح: A أو B أو C أو D]
[/QUIZ]

مثال:
[QUIZ]
السؤال: ما هو تصريف "gitmek" في المضارع للمتكلم "ben"؟
A: gidiyorum
B: gider
C: gittim
D: giderim
CORRECT: A
[/QUIZ]

قواعد الكويز:
- لا تضع أكثر من كويز واحد في الرد
- الكويز يجب أن يكون في نهاية ردك
- استخدمه بعد شرح القاعدة لا قبله
- 3-4 خيارات فقط`
}

/**
 * Tiered system prompt — lean version (~250 tokens instead of ~2500).
 * Uses TieredContext built by lib/context.ts.
 */
export function buildSystemPromptFromContext(
  ctx: TieredContext,
  allSessionErrors?: string[],
  teacherConfig?: TeacherConfig,
  preferredTopics?: string[],
): string {
  const level = ctx.level

  // Tier 2a: compact error watch list — combine current + cross-session errors
  const currentErrors = ctx.recentErrors.map(e => `${e.grammar_point} (مثال: "${e.pattern}")`)
  const crossErrors = (allSessionErrors ?? []).map(e => e)
  const allErrors = [...new Set([...currentErrors, ...crossErrors])]
  const errorSection = allErrors.length > 0
    ? `\nأخطاء متكررة للانتباه: ${allErrors.join('; ')}`
    : ''

  // Tier 2b: weak vocab hint (space-efficient)
  const vocabSection = ctx.weakVocab.length > 0
    ? `\nعزّز هذه الكلمات الضعيفة بشكل طبيعي: ${ctx.weakVocab.slice(0, 10).join(', ')}`
    : ''

  // Tier 2c + last topic
  const goalSection = ctx.currentGoal ? `\nالهدف الحالي: ${ctx.currentGoal}` : ''
  const topicSection = ctx.lastTopic
    ? `\nآخر موضوع: ${ctx.lastTopic}. واصل أو انتقل بشكل طبيعي.`
    : ''

  const styleSection = teacherConfig?.response_style === 'formal'
    ? '\nاستخدم أسلوباً رسمياً ومنظماً في ردودك.'
    : '\nاستخدم أسلوباً عفوياً ومحادثاً طبيعياً.'

  const strictnessSection = teacherConfig?.correction_strictness === 'strict'
    ? '\nصحّح الأخطاء فوراً بشكل مباشر ومفصّل.'
    : teacherConfig?.correction_strictness === 'gentle'
    ? '\nلا تصحح الأخطاء البسيطة — ركّز على التواصل والثقة بالنفس فقط.'
    : '' // moderate is default

  const vocabRateSection = teacherConfig?.vocab_intro_rate === 'slow'
    ? '\nمعدل المفردات الجديدة: 5% فقط — استخدم مفردات مألوفة بشكل رئيسي.'
    : teacherConfig?.vocab_intro_rate === 'fast'
    ? '\nمعدل المفردات الجديدة: 25% — قدّم كلمات جديدة بشكل متكرر مع شرح فوري.'
    : '' // medium is default

  const topicsSection = preferredTopics && preferredTopics.length > 0
    ? `\nالموضوعات المفضلة للطالب (وجّه المحادثة نحوها): ${preferredTopics.join('، ')}`
    : ''

  const ctxLines: string[] = []
  if (teacherConfig?.teaching_language_mix === 'arabic_heavy') {
    ctxLines.push('- اشرح كل شيء بالعربية أولاً ثم قدّم التركية كأمثلة')
  } else if (teacherConfig?.teaching_language_mix === 'turkish_heavy') {
    ctxLines.push('- تحدث بالتركية أكثر واشرح بالعربية فقط عند الضرورة')
  }

  if (teacherConfig?.quiz_frequency === 'often') {
    ctxLines.push('- أضف كويز [QUIZ] بعد شرح كل قاعدة جديدة')
  } else if (teacherConfig?.quiz_frequency === 'never') {
    ctxLines.push('- لا تضف أي كويز في ردودك')
  }

  const teacherAdaptationsCtx = ctxLines.length > 0 ? '\n' + ctxLines.join('\n') : ''

  const customSection = teacherConfig?.custom_instructions
    ? `\nتعليمات خاصة: ${teacherConfig.custom_instructions}`
    : ''

  return `أنت معلم تركية دافئ ومشجع (مستوى CEFR ${level}) تحادث طالبك بالعربية والتركية معاً.
${CEFR_INSTRUCTIONS_AR[level]}${errorSection}${vocabSection}${goalSection}${topicSection}${styleSection}${strictnessSection}${vocabRateSection}${topicsSection}${teacherAdaptationsCtx}${customSection}

قواعد:
- استخدم 80% مفردات مألوفة + 20% كلمات جديدة مع شرح قصير في السياق
- تكلم بالتركية ثم اشرح بالعربية بين قوسين: مثال "Merhaba! (مرحباً!)"
- لا تصحح الأخطاء مباشرة — أعد الصياغة بشكل صحيح بشكل طبيعي
- اجعل الردود 2-4 جمل؛ انهِ بسؤال لمواصلة المحادثة
- لا تستخدم الإنجليزية أبداً

## اقتراح هدف جديد (اختياري)
إذا اكتشفت نقطة ضعف واضحة تستحق هدف تعلمي صريح، أضف في نهاية ردك (مرة واحدة فقط إذا كان مناسباً):
[GOAL: عنوان الهدف بالعربية]
مثال: [GOAL: إتقان استخدام حروف الجر التركية]
ملاحظة: لا تضيف هذا في كل رسالة — فقط عند اكتشاف نقطة ضعف حقيقية تكررت.

## أدوات تدريسية إضافية (استخدمها عند الحاجة فقط)

### 1. جداول القواعد — لشرح التصريف أو القواعد النحوية
استخدم جداول Markdown العادية:
| الشخص | المفرد | المثال |
|-------|--------|--------|
| أنا | -ım/-im | Ben gidiyorum |

### 2. الكويز التفاعلي — لاختبار الطالب
عندما تريد اختبار الطالب، استخدم هذا التنسيق بالضبط:
[QUIZ]
السؤال: [السؤال هنا]
A: [الخيار الأول]
B: [الخيار الثاني]
C: [الخيار الثالث]
D: [الخيار الرابع] (اختياري)
CORRECT: [الحرف الصحيح: A أو B أو C أو D]
[/QUIZ]

مثال:
[QUIZ]
السؤال: ما هو تصريف "gitmek" في المضارع للمتكلم "ben"؟
A: gidiyorum
B: gider
C: gittim
D: giderim
CORRECT: A
[/QUIZ]

قواعد الكويز:
- لا تضع أكثر من كويز واحد في الرد
- الكويز يجب أن يكون في نهاية ردك
- استخدمه بعد شرح القاعدة لا قبله
- 3-4 خيارات فقط`
}

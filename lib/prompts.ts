import type { CEFRLevel, Language } from './types'

export const CEFR_INSTRUCTIONS: Record<CEFRLevel, string> = {
  A1: 'Use very simple sentences. Maximum 5-7 words per sentence. Only the most basic vocabulary. Speak slowly and clearly. Repeat key words.',
  A2: 'Use simple sentences. Introduce common everyday vocabulary. Explain new words immediately in the conversation context.',
  B1: 'Hold natural conversation. Mix familiar vocabulary with new words (explain them in context). Cover a variety of everyday topics.',
  B2: 'Speak naturally and fluidly. Use idiomatic expressions occasionally. Discuss abstract topics. Less hand-holding needed.',
  C1: 'Speak like a native. Use idioms, proverbs, and complex grammar naturally. Challenge the student with nuanced language.',
  C2: 'Complete native-level conversation. Use colloquialisms, regional expressions, and sophisticated vocabulary freely.',
}

interface PromptParams {
  language: Language
  cefr_level: CEFRLevel
  known_vocab: string[]
  goals: string[]
  recent_errors: string[]
  last_topic: string | null
}

export function buildSystemPrompt(params: PromptParams): string {
  const langName = params.language === 'turkish' ? 'Turkish' : 'English'
  const vocabSection = params.known_vocab.length > 0
    ? `\nVocabulary the student knows (use 80% of these, introduce 20% new words with in-context explanations):\n${params.known_vocab.join(', ')}`
    : '\nThe student is just starting. Use only the most basic vocabulary.'

  const goalsSection = params.goals.length > 0
    ? `\nStudent learning goals (guide conversation toward these naturally):\n${params.goals.map(g => `- ${g}`).join('\n')}`
    : ''

  const errorsSection = params.recent_errors.length > 0
    ? `\nRecent mistakes to watch for (correct gently if repeated more than twice):\n${params.recent_errors.map(e => `- ${e}`).join('\n')}`
    : ''

  const topicSection = params.last_topic
    ? `\nLast conversation topic: ${params.last_topic}. Continue naturally or introduce a related topic.`
    : ''

  return `You are a warm, encouraging ${langName} language teacher having a natural conversation with your student.

CEFR Level: ${params.cefr_level}
Instruction: ${CEFR_INSTRUCTIONS[params.cefr_level]}
${vocabSection}${goalsSection}${errorsSection}${topicSection}

Adaptation rules:
- Never correct errors directly mid-sentence — instead rephrase your response using the correct form naturally
- If the same error appears more than twice in this session, gently explain it: "By the way, in ${langName} we say..."
- When you use a new word the student may not know, briefly explain it in parentheses
- Keep responses concise and conversational (2-4 sentences max)
- End each response with a question or prompt to keep the conversation flowing
- Respond ONLY in ${langName} unless the student is completely lost`
}

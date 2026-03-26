export type Language = 'turkish' | 'english'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  session_id: string
  role: MessageRole
  content: string
  xp_earned: number
  created_at: string
}

export interface Session {
  id: string
  language: Language
  cefr_level: CEFRLevel
  total_xp: number
  streak_days: number
  last_activity_date: string | null
  common_errors: string[]
  last_topic: string | null
  created_at: string
}

export interface VocabCard {
  id: string
  language: Language
  word: string
  translation: string
  example: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review_at: string
}

export interface FeedbackItem {
  type: 'correct' | 'correction' | 'suggestion' | 'new_vocab'
  original?: string
  correction?: string
  explanation: string
}

export interface FeedbackResponse {
  items: FeedbackItem[]
  new_vocab: Array<{ word: string; translation: string; example: string }>
  xp_earned: number
}

export interface ChatRequest {
  message: string
  language: Language
  session_id: string
  cefr_level: CEFRLevel
  known_vocab: string[]
  goals: string[]
  recent_errors: string[]
  last_topic: string | null
}

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

export type GrammarPoint =
  | 'past_tense'
  | 'present_tense'
  | 'future_tense'
  | 'tense_confusion'
  | 'word_order'
  | 'vowel_harmony'
  | 'case_suffix'
  | 'verb_conjugation'
  | 'plural_form'
  | 'preposition'
  | 'article'
  | 'pronoun'
  | 'adjective_agreement'
  | 'negation'
  | 'question_formation'
  | 'other'

export interface FeedbackItem {
  type: 'correct' | 'correction' | 'suggestion' | 'new_vocab'
  original?: string
  correction?: string
  explanation: string
  grammar_point?: GrammarPoint
}

export interface FeedbackResponse {
  items: FeedbackItem[]
  new_vocab: Array<{ word: string; translation: string; example: string }>
  xp_earned: number
}

// ── Phase 2: Tasks ────────────────────────────────────────────────────────────

export type TaskType = 'role_play' | 'describe' | 'story' | 'debate' | 'daily_scenario'

export interface TaskRubric {
  vocabulary_usage: number  // percentage weight (0-100)
  grammar_accuracy: number
  fluency: number
}

export interface Task {
  id: string
  language: Language
  cefr_level: CEFRLevel
  type: TaskType
  title: string
  scenario: string
  target_vocab: string[]
  target_grammar: string
  rubric_json: TaskRubric
  xp_reward: number
  created_at: string
}

export interface TaskFeedback {
  vocabulary_score: number
  grammar_score: number
  fluency_score: number
  overall_score: number
  strengths: string[]
  improvements: string[]
  corrected_text?: string
}

export interface TaskAttempt {
  id: string
  task_id: string
  session_id: string
  score: number | null
  feedback_json: TaskFeedback | null
  completed: boolean
  xp_earned: number
  created_at: string
}

// ── Phase 2: Tiered Context ───────────────────────────────────────────────────

export interface TieredContext {
  // Tier 1: static (~50 tokens)
  level: CEFRLevel
  language: Language
  // Tier 2: dynamic (~200 tokens)
  recentErrors: Array<{ pattern: string; grammar_point: GrammarPoint }>
  weakVocab: string[]
  currentGoal: string | null
  lastTopic: string | null
  // Tier 3: future RAG placeholder
  semanticContext?: string
}

// ── Phase 2: Observability ────────────────────────────────────────────────────

export interface ApiLogEntry {
  event: string
  model?: string
  tokens_used?: number
  latency_ms?: number
  success?: boolean
  error_message?: string
}

// ─────────────────────────────────────────────────────────────────────────────

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

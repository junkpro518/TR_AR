import { createServerClient } from './supabase-server'

export interface TeacherConfig {
  response_style: 'casual' | 'formal'
  correction_strictness: 'gentle' | 'moderate' | 'strict'
  vocab_intro_rate: 'slow' | 'medium' | 'fast'
  focus_areas: string[]
  custom_instructions: string
  teaching_language_mix?: 'arabic_heavy' | 'balanced' | 'turkish_heavy'
  quiz_frequency?: 'never' | 'sometimes' | 'often'
}

export interface UserConfig {
  cefr_override: string | null
  daily_goal_minutes: number
  preferred_topics: string[]
  telegram_enabled: boolean
  web_search_enabled: boolean
}

export interface AppSettings {
  teacher: TeacherConfig
  user: UserConfig
}

const DEFAULT_TEACHER: TeacherConfig = {
  response_style: 'casual',
  correction_strictness: 'moderate',
  vocab_intro_rate: 'medium',
  focus_areas: ['grammar', 'vocabulary'],
  custom_instructions: '',
}

const DEFAULT_USER: UserConfig = {
  cefr_override: null,
  daily_goal_minutes: 30,
  preferred_topics: [],
  telegram_enabled: false,
  web_search_enabled: false,
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['user', 'teacher'])

    const map: Record<string, unknown> = {}
    for (const row of data ?? []) {
      map[row.key] = row.value
    }

    return {
      teacher: { ...DEFAULT_TEACHER, ...(map['teacher'] as Partial<TeacherConfig> ?? {}) },
      user: { ...DEFAULT_USER, ...(map['user'] as Partial<UserConfig> ?? {}) },
    }
  } catch {
    return { teacher: DEFAULT_TEACHER, user: DEFAULT_USER }
  }
}

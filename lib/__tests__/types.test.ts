import { describe, it, expect } from 'vitest'
import type { Language, CEFRLevel, Message, Session, VocabCard, FeedbackItem } from '../types'

describe('Types', () => {
  it('Language type accepts valid values', () => {
    const lang: Language = 'turkish'
    expect(['turkish', 'english']).toContain(lang)
  })

  it('CEFRLevel type accepts valid values', () => {
    const level: CEFRLevel = 'A1'
    expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(level)
  })

  it('Message has required fields', () => {
    const msg: Message = {
      id: '1',
      session_id: 'sess1',
      role: 'assistant',
      content: 'Merhaba!',
      xp_earned: 0,
      created_at: new Date().toISOString(),
    }
    expect(msg.role).toBe('assistant')
  })
})

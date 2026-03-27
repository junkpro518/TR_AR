import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, CEFR_INSTRUCTIONS } from '../prompts'
import type { Language, CEFRLevel } from '../types'

describe('buildSystemPrompt', () => {
  it('includes the language name', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: [],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain('Turkish')
  })

  it('includes CEFR instructions for level', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'B1',
      known_vocab: [],
      goals: [],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain(CEFR_INSTRUCTIONS['B1'])
  })

  it('includes known vocab when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: ['merhaba', 'teşekkür'],
      goals: [],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain('merhaba')
    expect(prompt).toContain('teşekkür')
  })

  it('includes goals when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: ['Learn greetings'],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain('Learn greetings')
  })

  it('includes recent errors when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: [],
      recent_errors: ['Mixing -yor and -di'],
      last_topic: null,
    })
    expect(prompt).toContain('Mixing -yor and -di')
  })

  it('mentions last topic when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: [],
      recent_errors: [],
      last_topic: 'food',
    })
    expect(prompt).toContain('food')
  })
})

describe('CEFR_INSTRUCTIONS', () => {
  it('has entries for all 6 levels', () => {
    const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    for (const level of levels) {
      expect(CEFR_INSTRUCTIONS[level]).toBeDefined()
      expect(CEFR_INSTRUCTIONS[level].length).toBeGreaterThan(10)
    }
  })
})

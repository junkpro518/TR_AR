import { describe, it, expect } from 'vitest'
import {
  calculateNextReview,
  defaultCardState,
  isDue,
  getQualityLabel,
  type SRSCardState,
} from '../srs'

const baseCard: SRSCardState = {
  ease_factor: 2.5,
  interval: 6,
  repetitions: 2,
  next_review_at: '2026-03-27',
}

describe('calculateNextReview', () => {
  it('quality 0 resets repetitions to 0 and interval to 1', () => {
    const result = calculateNextReview(baseCard, 0)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  it('quality 1 resets repetitions to 0 and interval to 1', () => {
    const result = calculateNextReview(baseCard, 1)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  it('quality 5 after 2 successful reviews produces interval > 6', () => {
    const result = calculateNextReview(baseCard, 5)
    expect(result.interval).toBeGreaterThan(6)
    expect(result.repetitions).toBe(3)
  })

  it('ease_factor never goes below 1.3', () => {
    let card = defaultCardState()
    // Apply multiple failing reviews
    for (let i = 0; i < 10; i++) {
      card = calculateNextReview(card, 0)
    }
    expect(card.ease_factor).toBeGreaterThanOrEqual(1.3)
  })

  it('first successful review sets interval to 1', () => {
    const newCard = defaultCardState()
    const result = calculateNextReview(newCard, 4)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('second successful review sets interval to 6', () => {
    const card: SRSCardState = { ...defaultCardState(), repetitions: 1, interval: 1 }
    const result = calculateNextReview(card, 4)
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('returns a valid ISO date string for next_review_at', () => {
    const result = calculateNextReview(baseCard, 4, new Date('2026-03-27'))
    expect(result.next_review_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('defaultCardState', () => {
  it('returns ease_factor=2.5, interval=1, repetitions=0', () => {
    const card = defaultCardState()
    expect(card.ease_factor).toBe(2.5)
    expect(card.interval).toBe(1)
    expect(card.repetitions).toBe(0)
  })
})

describe('isDue', () => {
  it('returns true when next_review_at is today', () => {
    const today = new Date('2026-03-27')
    const card: SRSCardState = { ...defaultCardState(), next_review_at: '2026-03-27' }
    expect(isDue(card, today)).toBe(true)
  })

  it('returns true when next_review_at is in the past', () => {
    const today = new Date('2026-03-27')
    const card: SRSCardState = { ...defaultCardState(), next_review_at: '2026-03-20' }
    expect(isDue(card, today)).toBe(true)
  })

  it('returns false when next_review_at is in the future', () => {
    const today = new Date('2026-03-27')
    const card: SRSCardState = { ...defaultCardState(), next_review_at: '2026-04-01' }
    expect(isDue(card, today)).toBe(false)
  })
})

describe('getQualityLabel', () => {
  it('0 and 1 return forgot', () => {
    expect(getQualityLabel(0)).toBe('forgot')
    expect(getQualityLabel(1)).toBe('forgot')
  })
  it('2 returns hard', () => expect(getQualityLabel(2)).toBe('hard'))
  it('3 returns okay', () => expect(getQualityLabel(3)).toBe('okay'))
  it('4 returns good', () => expect(getQualityLabel(4)).toBe('good'))
  it('5 returns easy', () => expect(getQualityLabel(5)).toBe('easy'))
})

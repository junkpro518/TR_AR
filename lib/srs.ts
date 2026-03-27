export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5

export interface SRSCardState {
  ease_factor: number
  interval: number
  repetitions: number
  next_review_at: string
}

export type SRSResult = SRSCardState

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function calculateNextReview(
  current: SRSCardState,
  quality: SRSQuality,
  reviewDate: Date = new Date()
): SRSResult {
  let { ease_factor, interval, repetitions } = current

  // Update ease factor
  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease_factor < MIN_EASE) ease_factor = MIN_EASE

  if (quality < 3) {
    // Failed — reset
    repetitions = 0
    interval = 1
  } else {
    // Successful review
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * ease_factor)
    }
    repetitions += 1
  }

  const next_review_at = toDateString(addDays(reviewDate, interval))

  return { ease_factor, interval, repetitions, next_review_at }
}

export function defaultCardState(): SRSCardState {
  return {
    ease_factor: DEFAULT_EASE,
    interval: 1,
    repetitions: 0,
    next_review_at: toDateString(new Date()),
  }
}

export function isDue(card: SRSCardState, today: Date = new Date()): boolean {
  return card.next_review_at <= toDateString(today)
}

export function getQualityLabel(
  quality: SRSQuality
): 'forgot' | 'hard' | 'okay' | 'good' | 'easy' {
  if (quality <= 1) return 'forgot'
  if (quality === 2) return 'hard'
  if (quality === 3) return 'okay'
  if (quality === 4) return 'good'
  return 'easy'
}

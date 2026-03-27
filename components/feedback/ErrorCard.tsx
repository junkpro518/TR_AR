'use client'

import type { FeedbackItem } from '@/lib/types'

const CONFIG: Record<FeedbackItem['type'], { icon: string; color: string; bg: string; border: string }> = {
  correct:    { icon: '✓',  color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'rgba(74,153,104,0.25)' },
  correction: { icon: '⤴',  color: 'var(--orange)', bg: 'var(--orange-bg)', border: 'rgba(196,122,58,0.25)' },
  suggestion: { icon: '◈',  color: 'var(--blue)',   bg: 'var(--blue-bg)',   border: 'rgba(90,130,184,0.25)' },
  new_vocab:  { icon: '⬡',  color: 'var(--gold)',   bg: 'var(--gold-glow)', border: 'var(--border-gold)' },
}

interface ErrorCardProps {
  item: FeedbackItem
}

export function ErrorCard({ item }: ErrorCardProps) {
  const c = CONFIG[item.type]

  return (
    <div
      className="rounded-xl p-3 text-xs"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-start gap-2">
        <span style={{ color: c.color, fontSize: '0.8rem', lineHeight: 1, marginTop: '1px' }}>
          {c.icon}
        </span>
        <div className="flex-1 min-w-0">
          {item.original && item.correction && (
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span
                className="line-through"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {item.original}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</span>
              <span
                className="font-medium"
                style={{ color: c.color, fontFamily: 'var(--font-mono)' }}
              >
                {item.correction}
              </span>
            </div>
          )}
          <p
            className="leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {item.explanation}
          </p>
        </div>
      </div>
    </div>
  )
}

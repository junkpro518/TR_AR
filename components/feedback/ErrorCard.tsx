'use client'

import type { FeedbackItem } from '@/lib/types'

const ICONS: Record<FeedbackItem['type'], string> = {
  correct: '✓',
  correction: '✏️',
  suggestion: '💡',
  new_vocab: '📖',
}

const COLORS: Record<FeedbackItem['type'], string> = {
  correct: 'bg-green-50 border-green-200 text-green-800',
  correction: 'bg-orange-50 border-orange-200 text-orange-800',
  suggestion: 'bg-blue-50 border-blue-200 text-blue-800',
  new_vocab: 'bg-purple-50 border-purple-200 text-purple-800',
}

interface ErrorCardProps {
  item: FeedbackItem
}

export function ErrorCard({ item }: ErrorCardProps) {
  return (
    <div className={`border rounded-lg p-2 text-xs ${COLORS[item.type]}`}>
      <div className="flex items-start gap-1.5">
        <span className="text-sm">{ICONS[item.type]}</span>
        <div>
          {item.original && item.correction && (
            <div className="mb-0.5">
              <span className="line-through opacity-60">{item.original}</span>
              <span className="mx-1">→</span>
              <span className="font-semibold">{item.correction}</span>
            </div>
          )}
          <p className="opacity-80">{item.explanation}</p>
        </div>
      </div>
    </div>
  )
}

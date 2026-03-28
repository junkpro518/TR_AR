'use client'

import { useState } from 'react'
import type { QuizData } from '@/lib/quiz-parser'

export function QuizBlock({ quiz }: { quiz: QuizData }) {
  const [selected, setSelected] = useState<string | null>(null)
  const answered = selected !== null
  const isCorrect = selected === quiz.correct

  return (
    <div
      className="mt-3 rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border-gold)', background: 'var(--bg-base)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'var(--gold-glow)', borderBottom: '1px solid var(--border-gold)' }}
      >
        <span>🎯</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--gold-light)' }}>اختبار سريع</span>
      </div>

      {/* Question */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {quiz.question}
        </p>
      </div>

      {/* Options */}
      <div className="px-4 pb-4 space-y-2">
        {quiz.options.map(opt => {
          const isSelected = selected === opt.letter
          const isCorrectOpt = opt.letter === quiz.correct

          let bg = 'var(--bg-raised)'
          let border = 'var(--border)'
          let color = 'var(--text-secondary)'

          if (answered) {
            if (isCorrectOpt) { bg = 'rgba(74,222,128,0.12)'; border = 'rgba(74,222,128,0.5)'; color = '#4ade80' }
            else if (isSelected) { bg = 'rgba(248,113,113,0.12)'; border = 'rgba(248,113,113,0.5)'; color = '#f87171' }
          } else if (isSelected) {
            bg = 'var(--gold-glow)'; border = 'var(--border-gold)'; color = 'var(--gold-light)'
          }

          return (
            <button
              key={opt.letter}
              onClick={() => { if (!answered) setSelected(opt.letter) }}
              disabled={answered}
              className="w-full text-right rounded-lg px-4 py-2.5 text-sm flex items-center gap-3 transition-all"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color,
                cursor: answered ? 'default' : 'pointer',
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: answered && isCorrectOpt ? 'rgba(74,222,128,0.3)' : answered && isSelected ? 'rgba(248,113,113,0.3)' : 'var(--bg-surface)',
                  color: 'inherit',
                }}
              >
                {opt.letter}
              </span>
              <span>{opt.text}</span>
              {answered && isCorrectOpt && <span className="mr-auto">✓</span>}
              {answered && isSelected && !isCorrectOpt && <span className="mr-auto">✗</span>}
            </button>
          )
        })}
      </div>

      {/* Result */}
      {answered && (
        <div
          className="px-4 py-2.5 text-sm text-center"
          style={{
            borderTop: '1px solid var(--border)',
            color: isCorrect ? '#4ade80' : '#f87171',
            background: isCorrect ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
          }}
        >
          {isCorrect ? '🎉 إجابة صحيحة!' : `❌ الإجابة الصحيحة: ${quiz.correct} — ${quiz.options.find(o => o.letter === quiz.correct)?.text}`}
        </div>
      )}
    </div>
  )
}

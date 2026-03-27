'use client'

import type { FeedbackResponse, Session } from '@/lib/types'
import { ErrorCard } from './ErrorCard'

interface FeedbackPanelProps {
  feedback: FeedbackResponse | null
  session: Session | null
  goals: string[]
}

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function FeedbackPanel({ feedback, session, goals }: FeedbackPanelProps) {
  const levelIdx = session ? CEFR.indexOf(session.cefr_level) : 0
  const levelPct = ((levelIdx + 1) / CEFR.length) * 100

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <p
          className="text-xs uppercase tracking-widest font-medium"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}
        >
          لوحة التعلم
        </p>
      </div>

      <div className="flex flex-col gap-5 p-4">

        {/* XP + Streak */}
        {session && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>⚡</span>
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--gold-light)' }}
              >
                {session.total_xp.toLocaleString()} XP
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: '0.85rem' }}>🔥</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {session.streak_days} {session.streak_days === 1 ? 'يوم' : 'أيام'}
              </span>
            </div>
          </div>
        )}

        {/* CEFR Level */}
        {session && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>المستوى</span>
              <span
                className="badge badge-gold text-xs"
              >
                {session.cefr_level}
              </span>
            </div>
            <div
              className="flex justify-between mb-1.5"
              style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}
            >
              {CEFR.map((l, i) => (
                <span
                  key={l}
                  style={{ color: i === levelIdx ? 'var(--gold)' : undefined }}
                >
                  {l}
                </span>
              ))}
            </div>
            <div
              className="w-full rounded-full h-1"
              style={{ background: 'var(--border-light)' }}
            >
              <div
                className="h-1 rounded-full transition-all duration-700"
                style={{
                  width: `${levelPct}%`,
                  background: 'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                }}
              />
            </div>
          </div>
        )}

        {/* Gold divider */}
        <div className="divider-gold" aria-hidden="true" />

        {/* Goals */}
        {goals.length > 0 && (
          <div>
            <p
              className="text-xs uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              الأهداف
            </p>
            <div className="flex flex-col gap-1.5">
              {goals.map((goal, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ color: 'var(--gold)', marginTop: '4px', fontSize: '0.5rem' }}>◆</span>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {goal}
                  </span>
                </div>
              ))}
            </div>
            <div className="divider-gold mt-4" aria-hidden="true" />
          </div>
        )}

        {/* Feedback section */}
        <div>
          <p
            className="text-xs uppercase tracking-wide mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            التغذية الراجعة
          </p>

          {!feedback && (
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
            >
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                ابدأ المحادثة لرؤية<br />تحليل أخطائك هنا
              </p>
            </div>
          )}

          {feedback && feedback.items.length === 0 && (
            <div
              className="rounded-xl p-3 flex items-center gap-2"
              style={{ background: 'var(--green-bg)', border: '1px solid rgba(74,153,104,0.25)' }}
            >
              <span style={{ color: 'var(--green)', fontSize: '0.9rem' }}>✓</span>
              <p className="text-xs" style={{ color: 'var(--green)' }}>
                ممتاز! لا أخطاء في هذه الرسالة
              </p>
            </div>
          )}

          {feedback && feedback.items.length > 0 && (
            <div className="flex flex-col gap-2">
              {feedback.items.map((item, i) => (
                <ErrorCard key={i} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* New vocab */}
        {feedback && feedback.new_vocab.length > 0 && (
          <div>
            <p
              className="text-xs uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              مفردات جديدة
            </p>
            <div className="flex flex-col gap-1.5">
              {feedback.new_vocab.map((v, i) => (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2 flex justify-between items-center gap-2"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold-light)' }}
                  >
                    {v.word}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {v.translation}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XP earned indicator */}
        {feedback && feedback.xp_earned > 0 && (
          <div
            className="rounded-lg px-3 py-2 flex items-center justify-between"
            style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-gold)' }}
          >
            <span className="text-xs" style={{ color: 'var(--gold-light)' }}>نقاط مكتسبة</span>
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--gold)' }}
            >
              +{feedback.xp_earned} XP
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

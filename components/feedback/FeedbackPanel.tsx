'use client'

import type { FeedbackResponse, Session } from '@/lib/types'
import { ErrorCard } from './ErrorCard'

interface FeedbackPanelProps {
  feedback: FeedbackResponse | null
  session: Session | null
  goals: string[]
}

export function FeedbackPanel({ feedback, session, goals }: FeedbackPanelProps) {
  const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const currentLevelIndex = session ? CEFR_LEVELS.indexOf(session.cefr_level) : 0

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-y-auto">
      {/* XP + Streak */}
      {session && (
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span className="font-semibold text-indigo-600">⚡ {session.total_xp} XP</span>
          <span>🔥 {session.streak_days} {session.streak_days === 1 ? 'يوم' : 'أيام'}</span>
        </div>
      )}

      {/* CEFR Progress */}
      {session && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            {CEFR_LEVELS.map((level, i) => (
              <span
                key={level}
                className={`font-medium ${i === currentLevelIndex ? 'text-indigo-600' : ''}`}
              >
                {level}
              </span>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${((currentLevelIndex + 1) / CEFR_LEVELS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">الأهداف</h3>
          <div className="flex flex-col gap-1">
            {goals.map((goal, i) => (
              <div key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                {goal}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">التغذية الراجعة</h3>
        {!feedback && (
          <p className="text-xs text-gray-400 text-center py-4">
            ابدأ المحادثة لرؤية التغذية الراجعة
          </p>
        )}
        {feedback && feedback.items.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800 text-center">
            ✓ ممتاز! لا أخطاء في هذه الرسالة
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
    </div>
  )
}

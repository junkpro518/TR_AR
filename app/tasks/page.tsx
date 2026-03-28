'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Task, TaskFeedback, Language, CEFRLevel } from '@/lib/types'

type PageState = 'list' | 'doing' | 'result'

const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const TYPE_LABELS: Record<string, string> = {
  role_play: 'تمثيل أدوار',
  describe: 'وصف',
  story: 'قصة',
  debate: 'نقاش',
  daily_scenario: 'موقف يومي',
}

export default function TasksPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const language = (searchParams.get('language') ?? 'turkish') as Language
  const sessionId = searchParams.get('session_id') ?? ''

  const [level, setLevel] = useState<CEFRLevel>('A1')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [userText, setUserText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ feedback: TaskFeedback; xp_earned: number } | null>(null)
  const [page, setPage] = useState<PageState>('list')

  async function loadTasks(l: CEFRLevel) {
    setLoading(true)
    try {
      const res = await fetch(`/api/task?language=${language}&cefr_level=${l}`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTasks(level) }, [level, language])

  function startTask(task: Task) {
    setSelectedTask(task)
    setUserText('')
    setResult(null)
    setPage('doing')
  }

  async function submitTask() {
    if (!selectedTask || !userText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: selectedTask.id,
          session_id: sessionId,
          user_text: userText,
        }),
      })
      const data = await res.json()
      setResult(data)
      setPage('result')
    } finally {
      setSubmitting(false)
    }
  }

  const scoreColor = (s: number): string =>
    s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--gold)' : 'var(--red)'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => page === 'list' ? router.back() : setPage('list')}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ←
        </button>
        <h1
          className="font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {page === 'list' ? 'المهام التواصلية' : page === 'doing' ? selectedTask?.title : 'النتيجة'}
        </h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Task List */}
        {page === 'list' && (
          <>
            {/* Level selector */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {CEFR_LEVELS.map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className="px-3 py-1 rounded-full text-sm font-medium transition-all"
                  style={
                    level === l
                      ? { background: 'var(--gold)', color: '#0D0B08', border: '1px solid var(--gold)' }
                      : { background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', cursor: 'pointer' }
                  }
                >
                  {l}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                جاري التحميل...
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <p>لا توجد مهام لهذا المستوى بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="card p-4 animate-slide-up">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'var(--gold-glow)',
                            color: 'var(--gold)',
                            border: '1px solid var(--border-gold)',
                          }}
                        >
                          {TYPE_LABELS[task.type] ?? task.type}
                        </span>
                        <h3
                          className="font-semibold mt-2"
                          dir="ltr"
                          lang="tr"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          🇹🇷 {task.title}
                        </h3>
                        <p
                          className="text-sm mt-1 line-clamp-2"
                          dir="rtl"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {task.scenario}
                        </p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {task.target_vocab.slice(0, 3).map(w => (
                            <span
                              key={w}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--gold-light)' }}>
                          {task.xp_reward} XP
                        </p>
                        <button
                          onClick={() => startTask(task)}
                          className="btn-gold mt-2 px-3 py-1.5 rounded-lg text-sm"
                        >
                          ابدأ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Task Doing */}
        {page === 'doing' && selectedTask && (
          <div className="space-y-4 animate-slide-up">
            <div
              className="rounded-xl p-4"
              style={{
                background: 'var(--blue-bg)',
                border: '1px solid rgba(90,130,184,0.3)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {selectedTask.scenario}
              </p>
              {selectedTask.target_vocab.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    مفردات مستهدفة:
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTask.target_vocab.map(w => (
                      <span
                        key={w}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid rgba(90,130,184,0.3)' }}
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <textarea
              value={userText}
              onChange={e => setUserText(e.target.value)}
              placeholder="اكتب ردك هنا..."
              rows={6}
              className="input-field w-full rounded-xl p-4 resize-none"
              dir="auto"
            />

            <button
              onClick={submitTask}
              disabled={submitting || !userText.trim()}
              className="btn-gold w-full py-3 rounded-xl font-medium"
            >
              {submitting ? 'يتم التقييم...' : 'إرسال للتقييم'}
            </button>
          </div>
        )}

        {/* Result */}
        {page === 'result' && result && selectedTask && (
          <div className="space-y-4 animate-slide-up">
            <div className="card p-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>النتيجة الإجمالية</p>
              <p
                className="text-5xl font-bold mt-1"
                style={{ color: scoreColor(result.feedback.overall_score), fontFamily: 'var(--font-display)' }}
              >
                {result.feedback.overall_score}%
              </p>
              <p className="mt-2" style={{ color: 'var(--gold-light)' }}>
                +{result.xp_earned} XP
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'المفردات', value: result.feedback.vocabulary_score },
                { label: 'القواعد', value: result.feedback.grammar_score },
                { label: 'الطلاقة', value: result.feedback.fluency_score },
              ].map(item => (
                <div key={item.label} className="card p-3 text-center">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p
                    className="text-2xl font-bold mt-1"
                    style={{ color: scoreColor(item.value) }}
                  >
                    {item.value}%
                  </p>
                </div>
              ))}
            </div>

            {result.feedback.strengths.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--green-bg)', border: '1px solid rgba(74,153,104,0.3)' }}
              >
                <p className="font-medium text-sm mb-2" style={{ color: 'var(--green)' }}>
                  نقاط القوة
                </p>
                <ul className="space-y-1">
                  {result.feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      ✓ {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.feedback.improvements.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--orange-bg)', border: '1px solid rgba(196,122,58,0.3)' }}
              >
                <p className="font-medium text-sm mb-2" style={{ color: 'var(--orange)' }}>
                  للتحسين
                </p>
                <ul className="space-y-1">
                  {result.feedback.improvements.map((s, i) => (
                    <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      • {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.feedback.corrected_text && (
              <div className="card p-4">
                <p className="font-medium text-sm mb-2" style={{ color: 'var(--blue)' }}>
                  النص المصحح
                </p>
                <p className="text-sm" dir="auto" style={{ color: 'var(--text-secondary)' }}>
                  {result.feedback.corrected_text}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPage('list')}
                className="btn-ghost flex-1 py-3 rounded-xl text-sm"
              >
                مهمة أخرى
              </button>
              <button
                onClick={() => router.push(`/chat?language=${language}&session_id=${sessionId}`)}
                className="btn-gold flex-1 py-3 rounded-xl text-sm"
              >
                محادثة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

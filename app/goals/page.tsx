'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Language } from '@/lib/types'

interface Goal {
  id: string
  language: Language
  title: string
  is_auto: boolean
  progress: number
  completed: boolean
  created_at: string
}

export default function GoalsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const language = (searchParams.get('language') ?? 'turkish') as Language

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function loadGoals() {
    setLoading(true)
    const res = await fetch(`/api/goals?language=${language}`)
    const data = await res.json()
    setGoals(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { loadGoals() }, [language])

  async function addGoal() {
    if (!newTitle.trim()) return
    setAdding(true)
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, title: newTitle.trim() }),
    })
    setNewTitle('')
    setShowForm(false)
    await loadGoals()
    setAdding(false)
  }

  async function toggleComplete(goal: Goal) {
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: goal.id, completed: !goal.completed }),
    })
    await loadGoals()
  }

  async function deleteGoal(id: string) {
    await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
    await loadGoals()
  }

  const active = goals.filter(g => !g.completed)
  const done = goals.filter(g => g.completed)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => router.back()}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ←
        </button>
        <h1
          className="font-semibold flex-1"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          أهداف التعلم
        </h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm transition-colors"
          style={{ color: 'var(--gold)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-light)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--gold)')}
        >
          + إضافة
        </button>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Add form */}
        {showForm && (
          <div className="card p-4 mb-5 animate-slide-up">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="مثال: إتقان الأفعال الشاذة"
              className="input-field w-full rounded-lg px-3 py-2 text-sm"
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={addGoal}
                disabled={adding || !newTitle.trim()}
                className="btn-gold flex-1 py-2 rounded-lg text-sm"
              >
                {adding ? '...' : 'حفظ'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="btn-ghost px-4 py-2 rounded-lg text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            جاري التحميل...
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16 animate-slide-up">
            <p style={{ color: 'var(--text-secondary)' }}>لم تحدد أهدافًا بعد</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              أضف هدفًا لتوجيه محادثاتك
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-gold mt-4 px-6 py-2 rounded-xl text-sm"
            >
              أضف هدفًا
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active goals */}
            {active.length > 0 && (
              <div>
                <p
                  className="text-xs uppercase tracking-wide mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  قيد التنفيذ ({active.length})
                </p>
                <div className="space-y-2">
                  {active.map(goal => (
                    <div key={goal.id} className="card p-4 animate-slide-up">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleComplete(goal)}
                          className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all"
                          style={{
                            border: '2px solid var(--border-light)',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                          title="وضع علامة مكتمل"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {goal.title}
                          </p>
                          {goal.is_auto && (
                            <span className="badge badge-gold text-xs mt-1">تلقائي</span>
                          )}
                          {goal.progress > 0 && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                <span>التقدم</span>
                                <span style={{ color: 'var(--gold)' }}>{goal.progress}%</span>
                              </div>
                              <div className="w-full rounded-full h-1" style={{ background: 'var(--border-light)' }}>
                                <div
                                  className="h-1 rounded-full transition-all"
                                  style={{
                                    width: `${goal.progress}%`,
                                    background: 'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-sm shrink-0 transition-colors"
                          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed goals */}
            {done.length > 0 && (
              <div>
                <p
                  className="text-xs uppercase tracking-wide mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  مكتملة ({done.length})
                </p>
                <div className="space-y-2">
                  {done.map(goal => (
                    <div
                      key={goal.id}
                      className="rounded-xl p-4"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        opacity: 0.6,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm" style={{ color: 'var(--green)' }}>✓</span>
                        <p
                          className="text-sm flex-1 line-through"
                          style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}
                        >
                          {goal.title}
                        </p>
                        <button
                          onClick={() => toggleComplete(goal)}
                          className="text-xs transition-colors"
                          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          استعادة
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-sm transition-colors"
                          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

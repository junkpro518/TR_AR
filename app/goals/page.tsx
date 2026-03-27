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
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
          <h1 className="text-xl font-semibold">أهداف التعلم</h1>
          <button
            onClick={() => setShowForm(v => !v)}
            className="ml-auto text-blue-400 hover:text-blue-300 text-sm"
          >
            + إضافة
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="مثال: إتقان الأفعال الشاذة"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={addGoal}
                disabled={adding || !newTitle.trim()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg text-sm"
              >
                {adding ? '...' : 'حفظ'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-16">جاري التحميل...</div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">لم تحدد أهدافًا بعد</p>
            <p className="text-gray-600 text-sm mt-1">أضف هدفًا لتوجيه محادثاتك</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm"
            >
              أضف هدفًا
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active goals */}
            {active.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">قيد التنفيذ ({active.length})</p>
                <div className="space-y-2">
                  {active.map(goal => (
                    <div key={goal.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleComplete(goal)}
                          className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-500 hover:border-green-400 shrink-0 flex items-center justify-center"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200">{goal.title}</p>
                          {goal.is_auto && (
                            <span className="text-xs text-blue-400">تلقائي</span>
                          )}
                          {goal.progress > 0 && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>التقدم</span>
                                <span>{goal.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-800 rounded-full h-1">
                                <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${goal.progress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-gray-600 hover:text-red-400 text-sm shrink-0"
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
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">مكتملة ({done.length})</p>
                <div className="space-y-2">
                  {done.map(goal => (
                    <div key={goal.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 opacity-60">
                      <div className="flex items-center gap-3">
                        <span className="text-green-500 text-sm">✓</span>
                        <p className="text-sm text-gray-400 line-through flex-1">{goal.title}</p>
                        <button
                          onClick={() => toggleComplete(goal)}
                          className="text-xs text-gray-600 hover:text-gray-400"
                        >
                          استعادة
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-gray-700 hover:text-red-400 text-sm"
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

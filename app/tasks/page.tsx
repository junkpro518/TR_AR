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

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => page === 'list' ? router.back() : setPage('list')} className="text-gray-400 hover:text-white">
            ←
          </button>
          <h1 className="text-xl font-semibold">
            {page === 'list' ? 'المهام التواصلية' : page === 'doing' ? selectedTask?.title : 'النتيجة'}
          </h1>
        </div>

        {/* Task List */}
        {page === 'list' && (
          <>
            {/* Level selector */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {CEFR_LEVELS.map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    level === l ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-16">جاري التحميل...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <p>لا توجد مهام لهذا المستوى بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-blue-400 font-medium">
                          {TYPE_LABELS[task.type] ?? task.type}
                        </span>
                        <h3 className="font-semibold mt-1">{task.title}</h3>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{task.scenario}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {task.target_vocab.slice(0, 3).map(w => (
                            <span key={w} className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-300">
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-yellow-400 text-sm font-bold">{task.xp_reward} XP</p>
                        <button
                          onClick={() => startTask(task)}
                          className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
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
          <div className="space-y-4">
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
              <p className="text-sm text-blue-200">{selectedTask.scenario}</p>
              {selectedTask.target_vocab.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">مفردات مستهدفة:</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTask.target_vocab.map(w => (
                      <span key={w} className="text-xs bg-blue-800/50 px-2 py-0.5 rounded-full text-blue-200">
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
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
              dir="auto"
            />

            <button
              onClick={submitTask}
              disabled={submitting || !userText.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium"
            >
              {submitting ? 'يتم التقييم...' : 'إرسال للتقييم'}
            </button>
          </div>
        )}

        {/* Result */}
        {page === 'result' && result && selectedTask && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">النتيجة الإجمالية</p>
              <p className={`text-5xl font-bold mt-1 ${scoreColor(result.feedback.overall_score)}`}>
                {result.feedback.overall_score}%
              </p>
              <p className="text-yellow-400 mt-2">+{result.xp_earned} XP</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'المفردات', value: result.feedback.vocabulary_score },
                { label: 'القواعد', value: result.feedback.grammar_score },
                { label: 'الطلاقة', value: result.feedback.fluency_score },
              ].map(item => (
                <div key={item.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${scoreColor(item.value)}`}>{item.value}%</p>
                </div>
              ))}
            </div>

            {result.feedback.strengths.length > 0 && (
              <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4">
                <p className="text-green-400 font-medium text-sm mb-2">نقاط القوة</p>
                <ul className="space-y-1">
                  {result.feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300">✓ {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.feedback.improvements.length > 0 && (
              <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-4">
                <p className="text-orange-400 font-medium text-sm mb-2">للتحسين</p>
                <ul className="space-y-1">
                  {result.feedback.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.feedback.corrected_text && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <p className="text-blue-400 font-medium text-sm mb-2">النص المصحح</p>
                <p className="text-gray-300 text-sm" dir="auto">{result.feedback.corrected_text}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPage('list')}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm"
              >
                مهمة أخرى
              </button>
              <button
                onClick={() => router.push(`/chat?language=${language}&session_id=${sessionId}`)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm"
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

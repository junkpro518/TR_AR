'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Language } from '@/lib/types'

interface DashboardData {
  session: {
    cefr_level: string
    total_xp: number
    streak_days: number
    last_activity_date: string | null
  } | null
  vocab_stats: { total: number; mastered: number; weak: number; due_today: number }
  top_grammar_errors: Array<{ point: string; count: number }>
  achievements: Array<{ badge_id: string; badge_name: string; xp_reward: number; earned_at: string }>
}

const CEFR_PROGRESS: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
}

const GRAMMAR_LABELS: Record<string, string> = {
  past_tense: 'الماضي', present_tense: 'المضارع', future_tense: 'المستقبل',
  tense_confusion: 'الخلط بين الأزمنة', word_order: 'ترتيب الكلمات',
  vowel_harmony: 'الانسجام الصوتي', case_suffix: 'اللواحق الإعرابية',
  verb_conjugation: 'تصريف الفعل', plural_form: 'الجمع',
  preposition: 'حروف الجر', article: 'أداة التعريف',
  pronoun: 'الضمائر', adjective_agreement: 'توافق الصفة', negation: 'النفي',
  question_formation: 'صياغة السؤال', other: 'أخرى',
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const language = (searchParams.get('language') ?? 'turkish') as Language

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/dashboard?language=${language}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [language])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">جاري التحميل...</p>
    </div>
  )

  const sess = data?.session
  const vocab = data?.vocab_stats ?? { total: 0, mastered: 0, weak: 0, due_today: 0 }
  const cefrStep = CEFR_PROGRESS[sess?.cefr_level ?? 'A1'] ?? 1

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
          <h1 className="text-xl font-semibold">لوحة التقدم</h1>
          <span className="ml-auto text-sm text-gray-500">{language === 'turkish' ? 'التركية' : 'الإنجليزية'}</span>
        </div>

        {!sess ? (
          <div className="text-center py-16 text-gray-400">
            <p>ابدأ محادثة أولًا لعرض إحصائياتك</p>
            <button onClick={() => router.push(`/chat?language=${language}`)} className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm text-white">
              ابدأ محادثة
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'المستوى', value: sess.cefr_level, sub: 'CEFR' },
                { label: 'نقاط XP', value: sess.total_xp.toLocaleString(), sub: 'مجموع' },
                { label: 'Streak', value: `${sess.streak_days} 🔥`, sub: 'يوم متتالي' },
              ].map(item => (
                <div key={item.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{item.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.label}</p>
                  <p className="text-xs text-gray-600">{item.sub}</p>
                </div>
              ))}
            </div>

            {/* CEFR progress bar */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-sm text-gray-300 mb-3">مسار CEFR</p>
              <div className="flex justify-between mb-2">
                {['A1','A2','B1','B2','C1','C2'].map((l, i) => (
                  <div key={l} className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 <= cefrStep ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                      {l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${((cefrStep - 1) / 5) * 100}%` }} />
              </div>
            </div>

            {/* Vocab stats */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-300">المفردات</p>
                {vocab.due_today > 0 && (
                  <button
                    onClick={() => router.push(`/review?language=${language}`)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {vocab.due_today} بطاقة مستحقة اليوم →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'إجمالي', value: vocab.total, color: 'text-white' },
                  { label: 'متقنة', value: vocab.mastered, color: 'text-green-400' },
                  { label: 'ضعيفة', value: vocab.weak, color: 'text-orange-400' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Grammar errors */}
            {(data?.top_grammar_errors.length ?? 0) > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-300 mb-3">أكثر أخطائك النحوية</p>
                <div className="space-y-2">
                  {data!.top_grammar_errors.map((item, i) => (
                    <div key={item.point} className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-4">{i + 1}</span>
                      <span className="text-sm text-gray-200 flex-1">{GRAMMAR_LABELS[item.point] ?? item.point}</span>
                      <span className="text-xs text-red-400">{item.count}×</span>
                      <div className="w-20 bg-gray-800 rounded-full h-1.5">
                        <div
                          className="bg-red-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (item.count / (data!.top_grammar_errors[0].count)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Achievements */}
            {(data?.achievements.length ?? 0) > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-300 mb-3">الإنجازات ({data!.achievements.length})</p>
                <div className="flex flex-wrap gap-2">
                  {data!.achievements.map(a => (
                    <div key={a.badge_id} className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-3 py-1.5 text-center">
                      <p className="text-xs font-medium text-yellow-300">{a.badge_name}</p>
                      <p className="text-xs text-yellow-600">+{a.xp_reward} XP</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push(`/review?language=${language}`)}
                className="py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium"
              >
                مراجعة SRS
              </button>
              <button
                onClick={() => router.push(`/lessons?language=${language}&level=${sess.cefr_level}`)}
                className="py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm"
              >
                درس جديد
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

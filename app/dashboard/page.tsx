'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const GRAMMAR_LABELS: Record<string, string> = {
  past_tense: 'الماضي', present_tense: 'المضارع', future_tense: 'المستقبل',
  tense_confusion: 'الخلط بين الأزمنة', word_order: 'ترتيب الكلمات',
  vowel_harmony: 'الانسجام الصوتي', case_suffix: 'اللواحق الإعرابية',
  verb_conjugation: 'تصريف الفعل', plural_form: 'الجمع',
  preposition: 'حروف الجر', article: 'أداة التعريف',
  pronoun: 'الضمائر', negation: 'النفي',
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
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="text-center">
        <div
          className="w-8 h-8 rounded-full mx-auto mb-3"
          style={{ background: 'var(--gold-glow)', border: '2px solid var(--border-gold)', animation: 'dot-pulse 1.2s ease-in-out infinite' }}
        />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>جاري التحميل…</p>
      </div>
    </div>
  )

  const sess = data?.session
  const vocab = data?.vocab_stats ?? { total: 0, mastered: 0, weak: 0, due_today: 0 }
  const cefrIdx = CEFR_LEVELS.indexOf(sess?.cefr_level ?? 'A1')

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            ←
          </button>
          <h1
            className="font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            لوحة التقدم
          </h1>
        </div>
        <span className="badge badge-gold text-xs">
          {language === 'turkish' ? '🇹🇷 تركي' : '🇬🇧 إنجليزي'}
        </span>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {!sess ? (
          <div className="text-center py-20">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              ابدأ محادثة أولًا لعرض إحصائياتك
            </p>
            <Link
              href={`/chat?language=${language}`}
              className="btn-gold inline-flex mt-4 px-5 py-2 rounded-xl text-sm"
              style={{ textDecoration: 'none' }}
            >
              ابدأ محادثة
            </Link>
          </div>
        ) : (
          <>
            {/* Hero stats */}
            <div className="grid grid-cols-3 gap-3 animate-slide-up">
              {[
                { label: 'المستوى', value: sess.cefr_level, sub: 'CEFR', gold: true },
                { label: 'نقاط XP',  value: sess.total_xp.toLocaleString(), sub: 'مجموع' },
                { label: 'Streak',   value: `${sess.streak_days} 🔥`, sub: 'يوم متتالي' },
              ].map(item => (
                <div
                  key={item.label}
                  className="card text-center py-4 px-2"
                  style={item.gold ? { border: '1px solid var(--border-gold)', background: 'var(--gold-glow)' } : {}}
                >
                  <p
                    className="text-2xl font-bold leading-none mb-1"
                    style={{ color: item.gold ? 'var(--gold-light)' : 'var(--text-primary)', fontFamily: item.gold ? 'var(--font-display)' : undefined }}
                  >
                    {item.value}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* CEFR journey */}
            <div className="card p-4 animate-slide-up delay-100">
              <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                رحلة CEFR
              </p>
              <div className="flex justify-between mb-2">
                {CEFR_LEVELS.map((l, i) => (
                  <div key={l} className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={
                        i < cefrIdx
                          ? { background: 'var(--gold-dim)', color: 'var(--gold-light)', border: '1px solid var(--border-gold)' }
                          : i === cefrIdx
                          ? { background: 'var(--gold)', color: '#0D0B08', border: '2px solid var(--gold-light)' }
                          : { background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                      }
                    >
                      {i < cefrIdx ? '✓' : l}
                    </div>
                    <span className="text-xs" style={{ color: i === cefrIdx ? 'var(--gold)' : 'var(--text-muted)', fontSize: '0.6rem' }}>
                      {l}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="w-full rounded-full h-1 mt-1"
                style={{ background: 'var(--border-light)' }}
              >
                <div
                  className="h-1 rounded-full transition-all duration-700"
                  style={{
                    width: `${cefrIdx === 0 ? 8 : (cefrIdx / (CEFR_LEVELS.length - 1)) * 100}%`,
                    background: 'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                  }}
                />
              </div>
            </div>

            {/* Vocab stats */}
            <div className="card p-4 animate-slide-up delay-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  المفردات
                </p>
                {vocab.due_today > 0 && (
                  <Link
                    href={`/review?language=${language}`}
                    className="badge badge-gold"
                    style={{ textDecoration: 'none' }}
                  >
                    {vocab.due_today} مستحقة اليوم
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'الإجمالي',  value: vocab.total,    color: 'var(--text-primary)' },
                  { label: 'متقنة',     value: vocab.mastered, color: 'var(--green)' },
                  { label: 'تحتاج مراجعة', value: vocab.weak, color: 'var(--orange)' },
                ].map(item => (
                  <div
                    key={item.label}
                    className="text-center py-3 rounded-xl"
                    style={{ background: 'var(--bg-raised)' }}
                  >
                    <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Grammar errors */}
            {(data?.top_grammar_errors.length ?? 0) > 0 && (
              <div className="card p-4 animate-slide-up delay-300">
                <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                  أبرز أخطائك النحوية
                </p>
                <div className="space-y-2.5">
                  {data!.top_grammar_errors.map((item, i) => {
                    const maxCount = data!.top_grammar_errors[0].count
                    const pct = Math.max(8, (item.count / maxCount) * 100)
                    return (
                      <div key={item.point} className="flex items-center gap-3">
                        <span
                          className="text-xs w-4 text-right shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                          {GRAMMAR_LABELS[item.point] ?? item.point}
                        </span>
                        <span className="text-xs shrink-0" style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                          {item.count}×
                        </span>
                        <div
                          className="w-16 rounded-full h-1 shrink-0"
                          style={{ background: 'var(--border-light)' }}
                        >
                          <div
                            className="h-1 rounded-full"
                            style={{ width: `${pct}%`, background: 'var(--red)', opacity: 0.7 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Achievements */}
            {(data?.achievements.length ?? 0) > 0 && (
              <div className="card p-4 animate-slide-up delay-400">
                <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                  الإنجازات ({data!.achievements.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {data!.achievements.map(a => (
                    <div key={a.badge_id} className="badge badge-gold py-1.5">
                      <span className="mr-1">🏅</span>
                      {a.badge_name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 animate-slide-up delay-400">
              <Link
                href={`/review?language=${language}`}
                className="btn-gold flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
                style={{ textDecoration: 'none' }}
              >
                <span>مراجعة SRS</span>
                {vocab.due_today > 0 && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'rgba(0,0,0,0.25)' }}
                  >
                    {vocab.due_today}
                  </span>
                )}
              </Link>
              <Link
                href={`/lessons?language=${language}&level=${sess.cefr_level}&session_id=`}
                className="btn-ghost flex items-center justify-center rounded-xl py-3 text-sm"
                style={{ textDecoration: 'none' }}
              >
                درس جديد
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { VocabCard, Language } from '@/lib/types'
import { calculateNextReview, type SRSQuality } from '@/lib/srs'

type ReviewPhase = 'loading' | 'empty' | 'question' | 'answer' | 'done'

export default function ReviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const language = (searchParams.get('language') ?? 'turkish') as Language

  const [cards, setCards] = useState<VocabCard[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<ReviewPhase>('loading')
  const [reviewed, setReviewed] = useState(0)
  const [exporting, setExporting] = useState(false)

  const loadDueCards = useCallback(async () => {
    setPhase('loading')
    const res = await fetch(`/api/vocab?language=${language}`)
    if (!res.ok) { setPhase('empty'); return }

    const all: VocabCard[] = await res.json()
    const today = new Date().toISOString().split('T')[0]
    const due = all
      .filter(c => c.next_review_at <= today)
      .slice(0, 30)

    if (due.length === 0) { setPhase('empty'); return }
    setCards(due)
    setIndex(0)
    setReviewed(0)
    setPhase('question')
  }, [language])

  useEffect(() => { loadDueCards() }, [loadDueCards])

  const currentCard = cards[index]

  async function submitQuality(quality: SRSQuality) {
    if (!currentCard) return

    const newState = calculateNextReview(
      {
        ease_factor: currentCard.ease_factor,
        interval: currentCard.interval,
        repetitions: currentCard.repetitions,
        next_review_at: currentCard.next_review_at,
      },
      quality
    )

    await fetch('/api/vocab', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentCard.id, ...newState }),
    })

    setReviewed(r => r + 1)
    if (index + 1 >= cards.length) {
      setPhase('done')
    } else {
      setIndex(i => i + 1)
      setPhase('question')
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/export/anki?language=${language}`)
      if (!res.ok) { alert('لا توجد بطاقات للتصدير بعد'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vocab-${language}-${new Date().toISOString().split('T')[0]}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const qualityButtons: { label: string; q: SRSQuality; style: React.CSSProperties }[] = [
    { label: 'نسيت',  q: 0, style: { background: 'var(--red-bg)',    color: 'var(--red)',    border: '1px solid rgba(184,72,72,0.35)' } },
    { label: 'صعب',   q: 2, style: { background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid rgba(196,122,58,0.35)' } },
    { label: 'تمام',  q: 3, style: { background: 'var(--gold-glow)', color: 'var(--gold)',   border: '1px solid var(--border-gold)' } },
    { label: 'جيد',   q: 4, style: { background: 'var(--green-bg)',  color: 'var(--green)',  border: '1px solid rgba(74,153,104,0.35)' } },
    { label: 'سهل',   q: 5, style: { background: 'var(--blue-bg)',   color: 'var(--blue)',   border: '1px solid rgba(90,130,184,0.35)' } },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => router.back()}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ← رجوع
        </button>
        <h1
          className="font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          مراجعة {language === 'turkish' ? 'التركية' : 'الإنجليزية'}
        </h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs transition-colors disabled:opacity-40"
          style={{ color: 'var(--gold)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-light)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--gold)')}
        >
          {exporting ? '...' : '↓ Anki'}
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* Loading */}
          {phase === 'loading' && (
            <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
              <div className="shimmer w-12 h-12 rounded-full mx-auto mb-4" />
              جاري التحميل...
            </div>
          )}

          {/* Empty */}
          {phase === 'empty' && (
            <div className="text-center py-20 animate-slide-up">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-xl font-semibold mb-2" style={{ color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
                أحسنت! لا توجد بطاقات مستحقة اليوم
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                تحدث مع المعلم لإضافة مفردات جديدة
              </p>
              <button
                onClick={() => router.push(`/chat?language=${language}`)}
                className="btn-gold px-6 py-2 rounded-xl text-sm"
              >
                ابدأ محادثة
              </button>
            </div>
          )}

          {/* Done */}
          {phase === 'done' && (
            <div className="text-center py-20 animate-slide-up">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-xl font-semibold mb-1" style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-display)' }}>
                أنهيت المراجعة!
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                راجعت {reviewed} بطاقة
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push(`/chat?language=${language}`)}
                  className="btn-gold px-6 py-2 rounded-xl text-sm"
                >
                  محادثة
                </button>
                <button
                  onClick={loadDueCards}
                  className="btn-ghost px-6 py-2 rounded-xl text-sm"
                >
                  إعادة التحميل
                </button>
              </div>
            </div>
          )}

          {/* Card */}
          {(phase === 'question' || phase === 'answer') && currentCard && (
            <>
              {/* Progress */}
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span>{index + 1} / {cards.length}</span>
                  <span>المراجعة #{currentCard.repetitions + 1}</span>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border-light)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${(index / cards.length) * 100}%`,
                      background: 'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                    }}
                  />
                </div>
              </div>

              {/* Card face */}
              <div
                className="card-raised rounded-2xl p-8 text-center min-h-[220px] flex flex-col justify-center cursor-pointer select-none animate-slide-up transition-all"
                onClick={() => phase === 'question' && setPhase('answer')}
                style={{ border: phase === 'answer' ? '1px solid var(--border-gold)' : '1px solid var(--border-light)' }}
              >
                <p
                  className="text-3xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
                >
                  {currentCard.word}
                </p>

                {phase === 'question' ? (
                  <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                    اضغط للكشف
                  </p>
                ) : (
                  <>
                    <p className="text-xl mt-3" style={{ color: 'var(--gold-light)' }}>
                      {currentCard.translation}
                    </p>
                    {currentCard.example && (
                      <p className="text-sm mt-3 italic" style={{ color: 'var(--text-secondary)' }}>
                        {currentCard.example}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Quality buttons */}
              {phase === 'answer' ? (
                <div className="flex gap-2 mt-4">
                  {qualityButtons.map(btn => (
                    <button
                      key={btn.q}
                      onClick={() => submitQuality(btn.q)}
                      className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{ ...btn.style, cursor: 'pointer' }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  اضغط على البطاقة لرؤية الإجابة
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

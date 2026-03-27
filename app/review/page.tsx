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
      .slice(0, 30) // max 30/day

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

  const qualityButtons: { label: string; q: SRSQuality; color: string }[] = [
    { label: 'نسيت', q: 0, color: 'bg-red-500 hover:bg-red-600' },
    { label: 'صعب', q: 2, color: 'bg-orange-500 hover:bg-orange-600' },
    { label: 'تمام', q: 3, color: 'bg-yellow-500 hover:bg-yellow-600' },
    { label: 'جيد', q: 4, color: 'bg-green-500 hover:bg-green-600' },
    { label: 'سهل', q: 5, color: 'bg-blue-500 hover:bg-blue-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">
            ← رجوع
          </button>
          <h1 className="text-lg font-semibold">
            مراجعة {language === 'turkish' ? 'التركية' : 'الإنجليزية'}
          </h1>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
          >
            {exporting ? '...' : '↓ Anki'}
          </button>
        </div>

        {/* Loading */}
        {phase === 'loading' && (
          <div className="text-center text-gray-400 py-20">جاري التحميل...</div>
        )}

        {/* Empty */}
        {phase === 'empty' && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-xl font-semibold text-green-400">أحسنت! لا توجد بطاقات مستحقة اليوم</p>
            <p className="text-gray-400 mt-2 text-sm">تحدث مع المعلم لإضافة مفردات جديدة</p>
            <button
              onClick={() => router.push(`/chat?language=${language}`)}
              className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              ابدأ محادثة
            </button>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-xl font-semibold text-green-400">أنهيت المراجعة!</p>
            <p className="text-gray-400 mt-1">راجعت {reviewed} بطاقة</p>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => router.push(`/chat?language=${language}`)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                محادثة
              </button>
              <button
                onClick={loadDueCards}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
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
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{index + 1} / {cards.length}</span>
                <span>المراجعة #{currentCard.repetitions + 1}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((index) / cards.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Card face */}
            <div
              className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center min-h-[220px] flex flex-col justify-center cursor-pointer select-none"
              onClick={() => phase === 'question' && setPhase('answer')}
            >
              <p className="text-3xl font-bold mb-2">{currentCard.word}</p>

              {phase === 'question' ? (
                <p className="text-gray-500 text-sm mt-4">اضغط للكشف</p>
              ) : (
                <>
                  <p className="text-xl text-blue-300 mt-3">{currentCard.translation}</p>
                  {currentCard.example && (
                    <p className="text-gray-400 text-sm mt-3 italic">{currentCard.example}</p>
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
                    className={`flex-1 py-3 rounded-xl text-sm font-medium text-white ${btn.color} transition-colors`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 text-xs mt-3">
                اضغط على البطاقة لرؤية الإجابة
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

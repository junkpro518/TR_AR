'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Language, CEFRLevel } from '@/lib/types'

interface LessonData {
  title: string
  grammar_point: string
  explanation: string
  examples: Array<{ target: string; translation: string }>
  exercises: Array<{ question: string; answer: string; hint: string }>
  vocab: Array<{ word: string; translation: string; example: string }>
}

type PageState = 'idle' | 'loading' | 'lesson' | 'exercises'

export default function LessonsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const language = (searchParams.get('language') ?? 'turkish') as Language
  const cefr_level = (searchParams.get('level') ?? 'A1') as CEFRLevel
  const sessionId = searchParams.get('session_id') ?? ''

  const [topic, setTopic] = useState('')
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [page, setPage] = useState<PageState>('idle')
  const [error, setError] = useState('')

  // Exercise state
  const [exIndex, setExIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [exDone, setExDone] = useState(false)

  async function generateLesson() {
    setPage('loading')
    setError('')
    try {
      const res = await fetch('/api/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, cefr_level, topic: topic.trim() || undefined, session_id: sessionId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'فشل التوليد'); setPage('idle'); return }
      setLesson(data)
      setPage('lesson')
    } catch {
      setError('خطأ في الاتصال، حاول مرة أخرى')
      setPage('idle')
    }
  }

  function startExercises() {
    setExIndex(0)
    setUserAnswer('')
    setRevealed(false)
    setScore(0)
    setExDone(false)
    setPage('exercises')
  }

  function checkAnswer() {
    if (!lesson) return
    setRevealed(true)
    const correct = lesson.exercises[exIndex].answer.trim().toLowerCase()
    const given = userAnswer.trim().toLowerCase()
    if (given === correct) setScore(s => s + 1)
  }

  function nextExercise() {
    if (!lesson) return
    if (exIndex + 1 >= lesson.exercises.length) {
      setExDone(true)
    } else {
      setExIndex(i => i + 1)
      setUserAnswer('')
      setRevealed(false)
    }
  }

  const currentEx = lesson?.exercises[exIndex]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => page === 'idle' ? router.back() : setPage('idle')}
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
          {page === 'idle' ? 'درس جديد' : page === 'loading' ? 'يتم التوليد...' : page === 'exercises' ? 'تمارين' : lesson?.title ?? 'الدرس'}
        </h1>
        <span className="badge badge-gold text-xs">
          {cefr_level} • {language === 'turkish' ? 'تركي' : 'إنجليزي'}
        </span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Idle: topic input */}
        {page === 'idle' && (
          <div className="space-y-4 animate-slide-up">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              اختر موضوعًا للدرس أو اتركه فارغًا ليختار النظام:
            </p>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="مثال: الأفعال المضارعة، التحيات، الأرقام..."
              className="input-field w-full rounded-xl px-4 py-3"
              onKeyDown={e => e.key === 'Enter' && generateLesson()}
            />
            {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
            <button
              onClick={generateLesson}
              className="btn-gold w-full py-3 rounded-xl font-medium"
            >
              توليد الدرس
            </button>
          </div>
        )}

        {/* Loading */}
        {page === 'loading' && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 animate-pulse">📚</div>
            <p style={{ color: 'var(--text-muted)' }}>يتم تحضير درسك...</p>
          </div>
        )}

        {/* Lesson content */}
        {page === 'lesson' && lesson && (
          <div className="space-y-4 animate-slide-up">
            {/* Grammar explanation */}
            <div className="card p-5">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--gold)' }}>
                النقطة النحوية: {lesson.grammar_point}
              </p>
              <p className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {lesson.explanation}
              </p>
            </div>

            {/* Examples */}
            <div className="card p-5">
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                أمثلة
              </p>
              <div className="space-y-3">
                {lesson.examples.map((ex, i) => (
                  <div
                    key={i}
                    className="pr-3"
                    style={{ borderRight: '2px solid var(--border-gold)' }}
                  >
                    <p className="font-medium" dir="auto" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {ex.target}
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {ex.translation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vocabulary */}
            {lesson.vocab.length > 0 && (
              <div className="card p-5">
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  المفردات الجديدة
                </p>
                <div className="space-y-2">
                  {lesson.vocab.map((v, i) => (
                    <div key={i} className="flex justify-between items-start gap-4">
                      <span
                        className="font-medium"
                        dir="auto"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {v.word}
                      </span>
                      <div className="text-right">
                        <p className="text-sm" style={{ color: 'var(--gold-light)' }}>{v.translation}</p>
                        <p className="text-xs" dir="auto" style={{ color: 'var(--text-muted)' }}>{v.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={startExercises}
                className="btn-gold flex-1 py-3 rounded-xl font-medium"
              >
                ابدأ التمارين ({lesson.exercises.length})
              </button>
              <button
                onClick={generateLesson}
                className="btn-ghost px-4 py-3 rounded-xl text-sm"
              >
                درس جديد
              </button>
            </div>
          </div>
        )}

        {/* Exercises */}
        {page === 'exercises' && lesson && !exDone && currentEx && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              <span>{exIndex + 1} / {lesson.exercises.length}</span>
              <span style={{ color: 'var(--green)' }}>{score} صح</span>
            </div>
            <div className="w-full rounded-full h-1" style={{ background: 'var(--border-light)' }}>
              <div
                className="h-1 rounded-full transition-all"
                style={{
                  width: `${(exIndex / lesson.exercises.length) * 100}%`,
                  background: 'linear-gradient(90deg, var(--gold-dim), var(--gold))',
                }}
              />
            </div>

            <div className="card p-5">
              <p className="text-lg" dir="auto" style={{ color: 'var(--text-primary)' }}>
                {currentEx.question}
              </p>
              {currentEx.hint && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  تلميح: {currentEx.hint}
                </p>
              )}
            </div>

            {!revealed ? (
              <>
                <input
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  placeholder="إجابتك..."
                  className="input-field w-full rounded-xl px-4 py-3"
                  dir="auto"
                  onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                />
                <button
                  onClick={checkAnswer}
                  disabled={!userAnswer.trim()}
                  className="btn-gold w-full py-3 rounded-xl"
                >
                  تحقق
                </button>
              </>
            ) : (
              <>
                <div
                  className="rounded-xl p-4"
                  style={
                    userAnswer.trim().toLowerCase() === currentEx.answer.trim().toLowerCase()
                      ? { background: 'var(--green-bg)', border: '1px solid rgba(74,153,104,0.3)' }
                      : { background: 'var(--red-bg)', border: '1px solid rgba(184,72,72,0.3)' }
                  }
                >
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>الإجابة الصحيحة:</p>
                  <p
                    className="font-medium mt-1"
                    dir="auto"
                    style={{
                      color: userAnswer.trim().toLowerCase() === currentEx.answer.trim().toLowerCase()
                        ? 'var(--green)'
                        : 'var(--red)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {currentEx.answer}
                  </p>
                </div>
                <button
                  onClick={nextExercise}
                  className="btn-gold w-full py-3 rounded-xl"
                >
                  {exIndex + 1 < lesson.exercises.length ? 'التالي' : 'إنهاء'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Exercises done */}
        {page === 'exercises' && exDone && lesson && (
          <div className="text-center py-16 animate-slide-up">
            <div className="text-5xl mb-4">
              {score >= lesson.exercises.length * 0.8 ? '🎉' : score >= lesson.exercises.length * 0.5 ? '👍' : '💪'}
            </div>
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {score} / {lesson.exercises.length}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {score >= lesson.exercises.length * 0.8 ? 'ممتاز!' : 'تحتاج مراجعة'}
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => setPage('lesson')}
                className="btn-ghost px-5 py-2 rounded-xl text-sm"
              >
                راجع الدرس
              </button>
              <button
                onClick={generateLesson}
                className="btn-gold px-5 py-2 rounded-xl text-sm"
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

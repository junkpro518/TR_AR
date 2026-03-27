'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Language } from '@/lib/types'

interface SessionRow {
  id: string
  language: Language
  cefr_level: string
  total_xp: number
  streak_days: number
  last_activity_date: string | null
  created_at: string
  message_count: number
}

interface MessageRow {
  id: string
  role: 'user' | 'assistant'
  content: string
  xp_earned: number
  created_at: string
}

const PREVIEW_LENGTH = 300

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function MessageBubble({ m }: { m: MessageRow }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = m.content.length > PREVIEW_LENGTH
  const displayed = isLong && !expanded ? `${m.content.slice(0, PREVIEW_LENGTH)}…` : m.content

  return (
    <div className={`flex gap-2 pt-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="max-w-[85%] flex flex-col gap-1">
        <div
          className="rounded-xl px-3 py-2 text-xs leading-relaxed"
          dir="auto"
          style={
            m.role === 'user'
              ? {
                  background: 'linear-gradient(135deg, var(--gold-dim) 0%, var(--gold) 100%)',
                  color: '#0D0B08',
                }
              : {
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-light, var(--border))',
                  color: 'var(--text-primary)',
                }
          }
        >
          {displayed}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs self-start px-1"
            style={{ color: 'var(--gold)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {expanded ? 'عرض أقل' : 'عرض المزيد'}
          </button>
        )}
      </div>
      {m.xp_earned > 0 && (
        <span className="text-xs self-end shrink-0" style={{ color: 'var(--gold)', opacity: 0.7 }}>
          +{m.xp_earned}
        </span>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const language = (searchParams.get('language') ?? 'turkish') as Language

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  useEffect(() => {
    fetch(`/api/history?language=${language}`)
      .then(r => r.json())
      .then(d => { setSessions(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [language])

  async function loadMessages(session_id: string) {
    if (selectedSession === session_id) { setSelectedSession(null); setMessages([]); return }
    setSelectedSession(session_id)
    setLoadingMsgs(true)
    const res = await fetch(`/api/history?session_id=${session_id}`)
    const data = await res.json()
    setMessages(Array.isArray(data) ? data : [])
    setLoadingMsgs(false)
  }

  function resumeSession(e: React.MouseEvent, session_id: string) {
    e.stopPropagation()
    router.push(`/chat?session_id=${session_id}&language=turkish`)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => router.back()} style={{ color: 'var(--text-muted)' }}>←</button>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          سجل المحادثات
        </h1>
        <span className="badge badge-gold ml-auto text-xs">
          {language === 'turkish' ? '🇹🇷' : '🇬🇧'} {language === 'turkish' ? 'تركي' : 'إنجليزي'}
        </span>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-16">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>جاري التحميل…</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>لا توجد جلسات بعد</p>
            <button
              onClick={() => router.push(`/chat?language=${language}`)}
              className="btn-gold mt-4 px-5 py-2 rounded-xl text-sm"
            >
              ابدأ محادثة
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="card overflow-hidden">
                {/* Session row */}
                <button
                  onClick={() => loadMessages(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors"
                  style={{ background: selectedSession === s.id ? 'var(--bg-raised)' : 'transparent' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-gold text-xs">{s.cefr_level}</span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {s.message_count} رسالة
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ⚡ {s.total_xp} XP
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(s.created_at)}
                    </p>
                  </div>

                  {/* Resume button */}
                  <button
                    onClick={(e) => resumeSession(e, s.id)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg transition-opacity"
                    style={{
                      background: 'var(--gold)',
                      color: '#0D0B08',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  >
                    استئناف ←
                  </button>

                  <span
                    className="text-sm transition-transform"
                    style={{
                      color: 'var(--text-muted)',
                      transform: selectedSession === s.id ? 'rotate(180deg)' : 'none',
                    }}
                  >
                    ▾
                  </span>
                </button>

                {/* Messages accordion */}
                {selectedSession === s.id && (
                  <div
                    className="px-4 pb-4 space-y-2 animate-slide-up"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    {loadingMsgs ? (
                      <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                        جاري التحميل…
                      </p>
                    ) : messages.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                        لا توجد رسائل
                      </p>
                    ) : (
                      messages.map(m => <MessageBubble key={m.id} m={m} />)
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

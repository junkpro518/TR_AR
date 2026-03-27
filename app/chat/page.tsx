'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { InputBar } from '@/components/chat/InputBar'
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel'
import type { Language, FeedbackResponse, Session } from '@/lib/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [language, setLanguage] = useState<Language>('turkish')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [knownVocab, setKnownVocab] = useState<string[]>([])
  const [goals] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const resolvedLang: Language = 'turkish'
    if (resolvedLang !== language) setLanguage(resolvedLang)

    async function init(lang: Language) {
      try {
        const sessionUrl = sessionId
          ? `/api/session?id=${sessionId}`
          : `/api/session?language=${lang}`

        const [sessionRes, vocabRes] = await Promise.all([
          fetch(sessionUrl),
          fetch(`/api/vocab?language=${lang}&known=true`),
        ])
        if (sessionRes.ok) setSession(await sessionRes.json())
        if (vocabRes.ok) {
          const vocab = await vocabRes.json()
          setKnownVocab(vocab.map((v: { word: string }) => v.word))
        }
      } catch {
        setError('فشل تحميل الجلسة. تحقق من اتصالك بالإنترنت.')
      }
    }
    init(resolvedLang)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!session) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userMessage }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          language,
          session_id: session.id,
          cefr_level: session.cefr_level,
          known_vocab: knownVocab,
          goals,
          recent_errors: [],
          last_topic: null,
        }),
      })

      if (!chatRes.ok) throw new Error('فشل الاتصال بالمعلم')
      if (!chatRes.body) throw new Error('لا يوجد رد من الخادم')

      const reader = chatRes.body.getReader()
      const decoder = new TextDecoder()
      let userMsgDbId: string | null = null

      try {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n')
          buffer = parts.pop()!
          for (const line of parts) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: m.content + data.text } : m)
                )
              }
              if (data.done && data.user_message_id) userMsgDbId = data.user_message_id
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (userMsgDbId) {
        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, language, message_id: userMsgDbId }),
        }).then(r => r.json()).then(fb => {
          setFeedback(fb)
          if (fb.new_vocab?.length > 0) {
            setKnownVocab(prev => [...prev, ...fb.new_vocab.map((v: { word: string }) => v.word)])
          }
        }).catch(() => {})
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [session, language, knownVocab, goals])

  const langFlag = '🇹🇷'
  const langName = 'التركية'

  return (
    <div
      className="flex h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ─── Main Chat Column ─── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top Bar */}
        <header
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          {/* Left: Language + back */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-lg"
              aria-label="تغيير اللغة"
              style={{ textDecoration: 'none' }}
            >
              {langFlag}
            </Link>
            <div>
              <p
                className="text-sm font-semibold leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {langName}
              </p>
              {session && (
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {session.cefr_level} • {session.total_xp} XP
                </p>
              )}
            </div>
          </div>

          {/* Right: Nav links */}
          <nav className="flex items-center gap-1">
            {[
              { href: `/dashboard?language=turkish`, label: 'التقدم' },
              { href: `/review?language=turkish`, label: 'مراجعة' },
              { href: `/tasks?language=turkish&session_id=${session?.id ?? ''}`, label: 'مهام' },
              { href: `/goals?language=turkish`, label: 'أهداف' },
              { href: `/history?language=turkish`, label: 'سجل' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="px-2.5 py-1 rounded-lg text-xs transition-colors"
                style={{
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  background: 'transparent',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.color = 'var(--text-primary)'
                  ;(e.target as HTMLElement).style.background = 'var(--bg-raised)'
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.color = 'var(--text-muted)'
                  ;(e.target as HTMLElement).style.background = 'transparent'
                }}
              >
                {item.label}
              </Link>
            ))}

            {/* Mobile sidebar toggle */}
            <button
              className="md:hidden px-2.5 py-1 rounded-lg text-xs transition-colors"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="عرض التغذية الراجعة"
            >
              ◧
            </button>
          </nav>
        </header>

        {/* Messages */}
        <main
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{ background: 'var(--bg-base)' }}
        >
          {messages.length === 0 && !isLoading && (
            <div
              className="text-center animate-fade-in"
              style={{ marginTop: '15vh' }}
            >
              <p
                className="text-4xl mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {langFlag}
              </p>
              <p
                className="text-base font-medium mb-1"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
              >
                ابدأ المحادثة
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                معلمك يتكيّف مع كل رسالة تكتبها
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              language={language}
              isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3 text-xs animate-slide-up"
              style={{
                background: 'var(--red-bg)',
                border: '1px solid rgba(184,72,72,0.25)',
                color: 'var(--red)',
              }}
            >
              <span>⚠ {error}</span>
              <button
                onClick={() => setError(null)}
                style={{ color: 'var(--red)', opacity: 0.7 }}
              >
                ×
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* Input */}
        <InputBar onSend={sendMessage} disabled={isLoading || !session} language={language} />
      </div>

      {/* ─── Feedback Sidebar (desktop) ─── */}
      <aside
        className="w-64 shrink-0 hidden md:flex flex-col"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <FeedbackPanel feedback={feedback} session={session} goals={goals} />
      </aside>

      {/* ─── Mobile sidebar overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <aside
            className="absolute top-0 right-0 bottom-0 w-72 flex flex-col"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                لوحة التعلم
              </p>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            <FeedbackPanel feedback={feedback} session={session} goals={goals} />
          </aside>
        </div>
      )}
    </div>
  )
}

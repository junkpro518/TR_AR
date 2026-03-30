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

function generateSuggestions(assistantMessage: string): string[] {
  const sugs: string[] = []
  if (assistantMessage.includes('؟') || assistantMessage.includes('?')) {
    if (assistantMessage.includes('تمرين') || assistantMessage.includes('مثال')) {
      sugs.push('نعم، هيا بنا')
      sugs.push('أعطني مثالاً أولاً')
    } else {
      sugs.push('نعم')
      sugs.push('لا أعرف')
      sugs.push('أخبرني المزيد')
    }
  } else {
    sugs.push('أعطني مثالاً')
    sugs.push('كيف أستخدمها؟')
    sugs.push('هيا نتمرن')
  }
  return sugs.slice(0, 3)
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
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [startingNew, setStartingNew] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const assistantContentRef = useRef('')
  const abortControllerRef = useRef<AbortController | null>(null)

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
        if (sessionRes.ok) {
          setSession(await sessionRes.json())
          if (sessionId) {
            const histRes = await fetch(`/api/history?session_id=${sessionId}`)
            if (histRes.ok) {
              const prevMsgs: Array<{ id: string; role: 'user' | 'assistant'; content: string }> = await histRes.json()
              if (Array.isArray(prevMsgs) && prevMsgs.length > 0) {
                setMessages(prevMsgs.map(m => ({ id: m.id, role: m.role, content: m.content })))
              }
            }
          }
        }
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

    setSuggestions([])
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userMessage }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])
    assistantContentRef.current = ''

    try {
      const abortController = new AbortController()
      abortControllerRef.current = abortController

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
          ...(searchEnabled ? { web_search_override: true } : {}),
        }),
        signal: abortController.signal,
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
                assistantContentRef.current += data.text
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

      // Generate contextual suggestions from assistant response
      if (assistantContentRef.current) {
        setSuggestions(generateSuggestions(assistantContentRef.current))
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
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped the response — keep whatever was streamed
        setIsLoading(false)
        return
      }
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally {
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }, [session, language, knownVocab, goals, searchEnabled])

  const stopResponse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [])

  const startNewConversation = useCallback(async () => {
    if (startingNew) return
    setStartingNew(true)
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      })
      if (res.ok) {
        const newSession = await res.json()
        setSession(newSession)
        setMessages([])
        setSuggestions([])
        setFeedback(null)
        setError(null)
        // Update URL so navigating away and back preserves this session
        window.history.replaceState(null, '', `/chat?session_id=${newSession.id}`)
      }
    } finally {
      setStartingNew(false)
    }
  }, [language, startingNew])

  const langFlag = '🇹🇷'
  const langName = 'التركية'

  return (
    <div
      className="flex"
      style={{
        background: 'var(--bg-base)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 64,
        overflow: 'hidden',
      }}
    >
      {/* ─── Main Chat Column ─── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top Bar */}
        <header
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          {/* Left: Language + back + new conversation */}
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
            <button
              onClick={startNewConversation}
              disabled={startingNew || isLoading}
              title="بدء محادثة جديدة"
              className="text-xs px-2 py-1 rounded-lg"
              style={{
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                opacity: (startingNew || isLoading) ? 0.5 : 1,
              }}
            >
              {startingNew ? '...' : '✦ جديد'}
            </button>
          </div>

          {/* Right: search toggle + stop button + mobile feedback toggle */}
          <nav className="flex items-center gap-1">
            {/* Web search toggle */}
            <button
              onClick={() => setSearchEnabled(v => !v)}
              title={searchEnabled ? 'تعطيل البحث عن الإنترنت' : 'تفعيل البحث عن الإنترنت'}
              className="px-2 py-1 rounded-lg text-xs"
              style={{
                background: searchEnabled ? 'var(--gold-glow)' : 'transparent',
                border: `1px solid ${searchEnabled ? 'var(--border-gold)' : 'var(--border)'}`,
                color: searchEnabled ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              🔍
            </button>
            {/* Stop button — shown only when loading */}
            {isLoading && (
              <button
                onClick={stopResponse}
                title="إيقاف الرد"
                className="px-2 py-1 rounded-lg text-xs"
                style={{
                  background: 'rgba(184,72,72,0.15)',
                  border: '1px solid rgba(184,72,72,0.3)',
                  color: '#b84848',
                  cursor: 'pointer',
                }}
              >
                ⏹ إيقاف
              </button>
            )}
            {/* Mobile sidebar toggle */}
            <button
              className="md:hidden px-2.5 py-1 rounded-lg text-xs"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="عرض التغذية الراجعة"
            >◧</button>
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

        {/* Quick suggestions */}
        {suggestions.length > 0 && !isLoading && (
          <div
            className="flex gap-2 px-4 py-2 overflow-x-auto"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => { sendMessage(sug); setSuggestions([]) }}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <InputBar onSend={sendMessage} disabled={isLoading || !session} language={language} onTyping={() => setSuggestions([])} />
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

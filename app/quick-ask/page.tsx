'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function QuickAskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setError(null)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    // Build history for context (exclude the newly added messages)
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/quick-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      })

      if (!res.ok) throw new Error('فشل الاتصال بالمساعد')
      if (!res.body) throw new Error('لا يوجد رد من الخادم')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

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
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: m.content + data.text } : m
                  )
                )
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [messages, isLoading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearHistory() {
    setMessages([])
    setError(null)
    inputRef.current?.focus()
  }

  return (
    <div
      dir="rtl"
      className="flex flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', position: 'fixed', inset: 0 }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/chat?language=turkish"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            ← العودة
          </Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <h1
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            سؤال سريع
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notice badge */}
          <span
            className="hidden sm:inline-block text-xs px-3 py-1 rounded-full"
            style={{
              background: 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.25)',
              color: 'var(--gold)',
            }}
          >
            لا يُحفظ في قاعدة البيانات
          </span>

          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="btn-ghost text-xs px-3 py-1"
              style={{ fontSize: '0.75rem' }}
            >
              مسح المحادثة
            </button>
          )}
        </div>
      </header>

      {/* Notice — mobile only */}
      <div
        className="sm:hidden px-4 py-2 text-center text-xs"
        style={{
          background: 'rgba(212,175,55,0.07)',
          borderBottom: '1px solid rgba(212,175,55,0.15)',
          color: 'var(--gold)',
        }}
      >
        هذا النمط للأسئلة السريعة فقط — لا يُحفظ ولا يؤثر على خطة التعلم
      </div>

      {/* Messages area */}
      <main
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
        style={{ background: 'var(--bg-base)' }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="text-center" style={{ marginTop: '15vh' }}>
            <p className="text-3xl mb-3">💬</p>
            <p
              className="text-base font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              اسأل عن أي شيء في التركية
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              معنى كلمة • قاعدة نحوية • كيف أقول...
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              {[
                'ما معنى "merhaba"؟',
                'كيف أقول "أنا جائع" بالتركية؟',
                'ما الفرق بين "ve" و "ile"؟',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="btn-ghost text-xs px-4 py-2 rounded-xl"
                  style={{ maxWidth: '280px', width: '100%' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={
                msg.role === 'user'
                  ? {
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      borderTopRightRadius: '4px',
                    }
                  : {
                      background: 'rgba(212,175,55,0.12)',
                      border: '1px solid rgba(212,175,55,0.2)',
                      color: 'var(--text-primary)',
                      borderTopLeftRadius: '4px',
                    }
              }
            >
              {msg.content ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              ) : (
                isLoading && idx === messages.length - 1 && msg.role === 'assistant' ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                  </span>
                ) : null
              )}
            </div>
          </div>
        ))}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs"
            style={{
              background: 'rgba(184,72,72,0.1)',
              border: '1px solid rgba(184,72,72,0.25)',
              color: '#b84848',
            }}
          >
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)} style={{ color: '#b84848', opacity: 0.7 }}>
              ×
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input bar */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex gap-2 items-end max-w-3xl mx-auto"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '8px 12px',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب سؤالك هنا... (Enter للإرسال)"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent resize-none outline-none text-sm"
            style={{
              color: 'var(--text-primary)',
              lineHeight: '1.5',
              minHeight: '24px',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="btn-gold shrink-0"
            style={{
              fontSize: '0.75rem',
              padding: '0.4rem 0.9rem',
              opacity: isLoading || !input.trim() ? 0.5 : 1,
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            إرسال
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          هذا النمط للأسئلة السريعة فقط — لا يُحفظ في قاعدة البيانات ولا يؤثر على خطة التعلم
        </p>
      </div>
    </div>
  )
}

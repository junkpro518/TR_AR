'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { InputBar } from '@/components/chat/InputBar'
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel'
import type { Language, CEFRLevel, FeedbackResponse, Session } from '@/lib/types'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Read language from URL on client
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const lang = params.get('language') as Language
    if (lang === 'turkish' || lang === 'english') {
      setLanguage(lang)
    }
  }, [])

  // Load session and vocab when language is known
  useEffect(() => {
    async function init() {
      const [sessionRes, vocabRes] = await Promise.all([
        fetch(`/api/session?language=${language}`),
        fetch(`/api/vocab?language=${language}&known=true`),
      ])

      if (sessionRes.ok) setSession(await sessionRes.json())

      if (vocabRes.ok) {
        const vocab = await vocabRes.json()
        setKnownVocab(vocab.map((v: { word: string }) => v.word))
      }
    }
    init()
  }, [language])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!session) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    // Optimistic assistant bubble
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      // Start chat stream
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

      const reader = chatRes.body!.getReader()
      const decoder = new TextDecoder()
      let userMsgDbId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.text) {
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + data.text } : m)
              )
            }

            if (data.done && data.user_message_id) {
              userMsgDbId = data.user_message_id
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Trigger feedback analysis (fire and forget)
      if (userMsgDbId) {
        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            language,
            message_id: userMsgDbId,
          }),
        }).then(r => r.json()).then(fb => {
          setFeedback(fb)
          if (fb.new_vocab?.length > 0) {
            setKnownVocab(prev => [...prev, ...fb.new_vocab.map((v: { word: string }) => v.word)])
          }
        }).catch(() => {
          // Feedback failure doesn't affect chat
        })
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [session, language, knownVocab, goals])

  const langLabel = language === 'turkish' ? '🇹🇷 التركية' : '🇬🇧 الإنجليزية'

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat Area */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <h1 className="text-sm font-semibold text-gray-800">{langLabel}</h1>
          <a href="/" className="text-xs text-gray-400 hover:text-gray-600">تغيير اللغة</a>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-8">
              <p className="text-2xl mb-2">👋</p>
              <p>ابدأ المحادثة مع معلمك!</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-3 flex justify-between items-center">
              <span>⚠️ {error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 font-bold"
              >
                ×
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <InputBar onSend={sendMessage} disabled={isLoading || !session} />
      </div>

      {/* Feedback Sidebar */}
      <div className="w-64 border-l bg-white flex-shrink-0 hidden md:flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">لوحة التعلم</h2>
        </div>
        <FeedbackPanel feedback={feedback} session={session} goals={goals} />
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
  language?: 'turkish' | 'english'
}

const TTS_LANG: Record<string, string> = {
  turkish: 'tr-TR',
  english: 'en-US',
}

export function MessageBubble({ role, content, isStreaming, language = 'turkish' }: MessageBubbleProps) {
  const isUser = role === 'user'
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback(() => {
    if (!('speechSynthesis' in window) || !content || isStreaming) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    if (speaking) {
      setSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = TTS_LANG[language] ?? 'tr-TR'
    utterance.rate = 0.9
    utterance.pitch = 1

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [content, isStreaming, language, speaking])

  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window

  return (
    <div
      className={`flex items-end gap-2.5 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
          style={{
            background: 'linear-gradient(135deg, var(--gold-dim) 0%, var(--gold) 100%)',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            color: '#0D0B08',
            fontWeight: 600,
          }}
          aria-hidden="true"
        >
          T
        </div>
      )}

      {/* Bubble + TTS */}
      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'rounded-bl-none' : 'rounded-br-none'}`}
          style={
            isUser
              ? {
                  background: 'linear-gradient(135deg, var(--gold-dim) 0%, var(--gold) 100%)',
                  color: '#0D0B08',
                  fontWeight: 500,
                }
              : {
                  background: 'var(--bg-raised)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                }
          }
          dir="auto"
        >
          {content}

          {/* Streaming indicator */}
          {isStreaming && (
            <span
              data-testid="streaming-indicator"
              className="inline-flex items-center gap-1 ml-2 align-middle"
              role="status"
              aria-label="Assistant is typing"
            >
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="dot-pulse inline-block w-1 h-1 rounded-full"
                  style={{ background: 'var(--text-muted)', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
          )}
        </div>

        {/* TTS button — only for assistant, only when done streaming */}
        {!isUser && !isStreaming && content && hasTTS && (
          <button
            onClick={speak}
            aria-label={speaking ? 'إيقاف' : 'استمع'}
            title={speaking ? 'إيقاف الصوت' : 'اسمع الرد'}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs transition-all"
            style={{
              color: speaking ? 'var(--gold)' : 'var(--text-muted)',
              background: speaking ? 'var(--gold-glow)' : 'transparent',
              border: `1px solid ${speaking ? 'var(--border-gold)' : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            {speaking ? '⏹ إيقاف' : '▶ استمع'}
          </button>
        )}
      </div>
    </div>
  )
}

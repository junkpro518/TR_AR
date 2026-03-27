'use client'

import { useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
  language?: 'turkish'
}

const TTS_LANG: Record<string, string> = {
  turkish: 'tr-TR',
}

export function MessageBubble({ role, content, isStreaming, language = 'turkish' }: MessageBubbleProps) {
  const isUser = role === 'user'
  const [speaking, setSpeaking] = useState(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setSpeaking(false)
  }, [])

  const speakWithWebSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) { setSpeaking(false); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = TTS_LANG[language] ?? 'tr-TR'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [content, language])

  const speak = useCallback(async () => {
    if (!content || isStreaming) return

    if (speaking) {
      stopSpeaking()
      return
    }

    setSpeaking(true)

    try {
      // Try Voxtral TTS via server API
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, language: 'tr' }),
      })

      if (res.ok && res.headers.get('Content-Type')?.includes('audio')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentAudioRef.current = audio
        audio.onended = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
          currentAudioRef.current = null
        }
        audio.onerror = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
          currentAudioRef.current = null
          speakWithWebSpeech()
        }
        await audio.play()
        return
      }
    } catch {
      // Fall through to Web Speech API
    }

    speakWithWebSpeech()
  }, [content, isStreaming, speaking, stopSpeaking, speakWithWebSpeech])

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
          {isUser ? (
            content
          ) : (
            <div
              style={{
                color: 'inherit',
              }}
              className="markdown-body"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ ...props }) => (
                    <a
                      {...props}
                      style={{ color: 'var(--gold-light)', textDecoration: 'underline' }}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes('language-')
                    return isBlock ? (
                      <code
                        className={className}
                        style={{
                          display: 'block',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '0.5em 0.75em',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.85em',
                          overflowX: 'auto',
                          color: 'var(--gold-light)',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '0.1em 0.4em',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.85em',
                          color: 'var(--gold-light)',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  strong: ({ ...props }) => (
                    <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }} {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul style={{ paddingRight: '1.25em', marginTop: '0.25em', marginBottom: '0.25em', listStyleType: 'disc' }} {...props} />
                  ),
                  ol: ({ ...props }) => (
                    <ol style={{ paddingRight: '1.25em', marginTop: '0.25em', marginBottom: '0.25em', listStyleType: 'decimal' }} {...props} />
                  ),
                  li: ({ ...props }) => (
                    <li style={{ marginBottom: '0.15em' }} {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p style={{ marginBottom: '0.5em', marginTop: 0 }} {...props} />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote
                      style={{
                        borderRight: '3px solid var(--border-gold)',
                        paddingRight: '0.75em',
                        marginRight: 0,
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                      }}
                      {...props}
                    />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

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

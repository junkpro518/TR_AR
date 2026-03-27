'use client'

import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react'

interface InputBarProps {
  onSend: (message: string) => void
  disabled: boolean
  language?: 'turkish' | 'english'
}

// Type shim for browsers that prefix SpeechRecognition
type SpeechRecognitionCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((e: { resultIndex: number; results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

const STT_LANG: Record<string, string> = {
  turkish: 'tr-TR',
  english: 'en-US',
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function InputBar({ onSend, disabled, language = 'turkish' }: InputBarProps) {
  const [value, setValue] = useState('')
  const [listening, setListening] = useState(false)
  const [sttSupported, setSttSupported] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    setSttSupported(getSpeechRecognition() !== null)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    stopListening()

    const rec = new Ctor()
    rec.lang = STT_LANG[language] ?? 'tr-TR'
    rec.continuous = false
    rec.interimResults = true

    rec.onstart = () => setListening(true)

    rec.onresult = (e) => {
      let transcript = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setValue(transcript)
    }

    rec.onerror = () => stopListening()
    rec.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = rec
    rec.start()
  }, [language, stopListening])

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = !disabled && value.trim().length > 0

  return (
    <div
      className="flex items-end gap-2 px-4 py-3"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
    >
      {/* STT mic button */}
      {sttSupported && (
        <button
          onClick={() => listening ? stopListening() : startListening()}
          disabled={disabled}
          aria-label={listening ? 'إيقاف الاستماع' : 'تحدث'}
          title={listening ? 'إيقاف' : 'تحدث بدل الكتابة'}
          className="shrink-0 flex items-center justify-center rounded-xl transition-all"
          style={{
            width: '44px',
            height: '44px',
            background: listening ? 'var(--red-bg)' : 'var(--bg-raised)',
            border: `1px solid ${listening ? 'rgba(184,72,72,0.4)' : 'var(--border-light)'}`,
            color: listening ? 'var(--red)' : 'var(--text-muted)',
            fontSize: '1rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
          }}
        >
          {listening ? '⬛' : '🎤'}
        </button>
      )}

      {/* Textarea */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? 'يستمع…' : 'اكتب رسالتك… / Write your message…'}
          disabled={disabled}
          className="input-field w-full resize-none rounded-xl px-4 py-2.5 text-sm leading-relaxed"
          style={{ minHeight: '44px', maxHeight: '140px', overflow: 'hidden', fontFamily: 'var(--font-body)' }}
          dir="auto"
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        aria-label="إرسال"
        className="btn-gold flex items-center justify-center rounded-xl shrink-0"
        style={{ width: '44px', height: '44px', fontSize: '1.1rem' }}
      >
        ↑
      </button>
    </div>
  )
}

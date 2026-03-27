'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'

interface InputBarProps {
  onSend: (message: string) => void
  disabled: boolean
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

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
      className="flex items-end gap-3 px-4 py-3"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      {/* Textarea */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب رسالتك… / Write your message…"
          disabled={disabled}
          className="input-field w-full resize-none rounded-xl px-4 py-2.5 text-sm leading-relaxed"
          style={{
            minHeight: '44px',
            maxHeight: '140px',
            overflow: 'hidden',
            fontFamily: 'var(--font-body)',
          }}
          dir="auto"
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        aria-label="إرسال"
        className="btn-gold flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: '44px',
          height: '44px',
          fontSize: '1.1rem',
        }}
      >
        ↑
      </button>
    </div>
  )
}

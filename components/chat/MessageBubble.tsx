'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'

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

      {/* Bubble */}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'rounded-bl-none' : 'rounded-br-none'
        }`}
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
                style={{
                  background: 'var(--text-muted)',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

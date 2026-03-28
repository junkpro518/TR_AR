'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/chat', icon: '💬', label: 'محادثة' },
  { href: '/tasks', icon: '📋', label: 'مهام' },
  { href: '/goals', icon: '🎯', label: 'أهداف' },
  { href: '/history', icon: '📜', label: 'سجل' },
  { href: '/dashboard', icon: '📊', label: 'لوحة' },
  { href: '/settings', icon: '⚙️', label: 'إعدادات' },
]

const MORE_ITEMS = [
  { href: '/review', icon: '🔁', label: 'مراجعة SRS' },
  { href: '/lessons', icon: '📖', label: 'دروس' },
  { href: '/vocab-tracker', icon: '📝', label: 'مفرداتي' },
  { href: '/quick-ask', icon: '⚡', label: 'سؤال سريع' },
]

// الصفحات التي تظهر فيها الـ nav
const SHOW_ON = ['/chat', '/tasks', '/goals', '/dashboard', '/settings', '/history', '/vocab-tracker', '/review', '/lessons']

export function BottomNav() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  // أخفِ الـ nav في صفحات setup, quick-ask, وصفحة الـ home
  const shouldShow = SHOW_ON.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!shouldShow) return null

  return (
    <>
      {/* Spacer لمنع تغطية المحتوى */}
      <div style={{ height: '64px' }} />

      {/* Bottom Nav */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '8px 4px',
                borderRadius: '12px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                background: isActive ? 'var(--gold-glow)' : 'transparent',
                border: isActive ? '1px solid var(--border-gold)' : '1px solid transparent',
                flex: 1,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{item.icon}</span>
              <span
                style={{
                  fontSize: '0.6rem',
                  color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: '8px 4px',
            borderRadius: '12px',
            background: sheetOpen ? 'var(--gold-glow)' : 'transparent',
            border: sheetOpen ? '1px solid var(--border-gold)' : '1px solid transparent',
            flex: 1,
            minWidth: 0,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⋯</span>
          <span
            style={{
              fontSize: '0.6rem',
              color: sheetOpen ? 'var(--gold)' : 'var(--text-muted)',
              fontWeight: sheetOpen ? 700 : 400,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            المزيد
          </span>
        </button>
      </nav>

      {/* Slide-up sheet */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet panel */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 201,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px 20px 0 0',
              padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <p
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                المزيد
              </p>
              <button
                onClick={() => setSheetOpen(false)}
                style={{
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {MORE_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: 'var(--text-secondary)',
                    background: 'transparent',
                    transition: 'all 0.15s ease',
                    fontSize: '0.9rem',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.color = 'var(--text-primary)'
                    el.style.background = 'var(--bg-raised)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.color = 'var(--text-secondary)'
                    el.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

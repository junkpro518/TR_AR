'use client'

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

// الصفحات التي تظهر فيها الـ nav
const SHOW_ON = ['/chat', '/tasks', '/goals', '/dashboard', '/settings', '/history', '/vocab-tracker', '/review', '/lessons']

export function BottomNav() {
  const pathname = usePathname()

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
      </nav>
    </>
  )
}

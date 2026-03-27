'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface VocabItem {
  id: string
  word: string
  translation: string
  example: string
  ease_factor: number
  status: 'known' | 'unknown' | 'forgotten' | null
}

const STATUS_CONFIG = {
  known:     { label: 'أعرفها',    color: 'var(--green)',      bg: 'var(--green-bg)',  icon: '✓' },
  unknown:   { label: 'لا أعرفها', color: 'var(--text-muted)', bg: 'var(--bg-hover)',  icon: '?' },
  forgotten: { label: 'نسيتها',    color: 'var(--red)',        bg: 'var(--red-bg)',    icon: '✗' },
}

export default function VocabTrackerPage() {
  const router = useRouter()
  const [items, setItems] = useState<VocabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/vocab-tracker')
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: status as VocabItem['status'] } : item))
    await fetch('/api/vocab-tracker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
  }

  const filtered = items.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.word.includes(search) && !item.translation.includes(search)) return false
    return true
  })

  const counts = {
    known:     items.filter(i => i.status === 'known').length,
    unknown:   items.filter(i => i.status === 'unknown' || !i.status).length,
    forgotten: items.filter(i => i.status === 'forgotten').length,
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-5 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.back()}
            className="text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ←
          </button>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              fontSize: '1.2rem',
              fontWeight: 600,
            }}
          >
            مخزن المعرفة
          </h1>
          <div className="flex gap-2 mr-auto text-xs">
            <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
              ✓ {counts.known}
            </span>
            <span className="badge" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
              ✗ {counts.forgotten}
            </span>
            <span className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
              ? {counts.unknown}
            </span>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="ابحث عن كلمة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field w-full rounded-xl px-4 py-2 text-sm mb-3"
          dir="auto"
        />

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            ['all',       'الكل'],
            ['known',     'أعرفها'],
            ['forgotten', 'نسيتها'],
            ['unknown',   'لا أعرفها'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-3 py-1 rounded-lg text-xs transition-all"
              style={{
                background: filter === val ? 'var(--gold-glow)' : 'transparent',
                border:     `1px solid ${filter === val ? 'var(--border-gold)' : 'var(--border)'}`,
                color:      filter === val ? 'var(--gold-light)' : 'var(--text-muted)',
                cursor:     'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            جاري التحميل…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p>لا توجد كلمات بعد</p>
            <p className="text-xs mt-2">تحدث مع المعلم لإضافة مفردات جديدة</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => {
              const currentStatus = item.status ?? 'unknown'
              const cfg = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.unknown
              return (
                <div key={item.id} className="card p-4 animate-slide-up">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--gold-light)',
                            fontWeight: 600,
                            fontSize: '1rem',
                          }}
                        >
                          {item.word}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                          {item.translation}
                        </span>
                      </div>
                      {item.example && (
                        <p
                          className="text-xs mt-1"
                          dir="auto"
                          style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
                        >
                          {item.example}
                        </p>
                      )}
                    </div>

                    {/* Status selector */}
                    <div className="flex gap-1 shrink-0">
                      {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(item.id, status)}
                          title={config.label}
                          className="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all"
                          style={{
                            background: currentStatus === status ? config.bg    : 'transparent',
                            color:      currentStatus === status ? config.color : 'var(--text-muted)',
                            border:     `1px solid ${currentStatus === status ? config.color : 'var(--border)'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {config.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

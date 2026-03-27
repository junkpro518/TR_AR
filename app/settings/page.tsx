'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
type ResponseStyle = 'casual' | 'formal'
type CorrectionStrictness = 'gentle' | 'moderate' | 'strict'
type VocabRate = 'slow' | 'medium' | 'fast'
type FocusArea = 'grammar' | 'vocabulary' | 'conversation' | 'pronunciation'

interface UserSettings {
  cefr_override: CEFRLevel | ''
  daily_goal_minutes: 15 | 30 | 45 | 60
  telegram_chat_id: string
  telegram_notifications: boolean
  preferred_topics: string[]
}

interface TeacherSettings {
  response_style: ResponseStyle
  correction_strictness: CorrectionStrictness
  vocab_rate: VocabRate
  focus_areas: FocusArea[]
  custom_instructions: string
}

interface PendingState {
  [key: string]: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_CHIPS = ['السفر', 'الطعام', 'العمل', 'العائلة', 'التكنولوجيا', 'الثقافة']

const TEACHER_SETTING_LABELS: Record<string, string> = {
  response_style: 'أسلوب الردود',
  correction_strictness: 'صرامة التصحيح',
  vocab_rate: 'معدل إدخال المفردات',
  focus_areas: 'مجالات التركيز',
  custom_instructions: 'تعليمات مخصصة',
}

const RESPONSE_STYLE_LABELS: Record<ResponseStyle, string> = {
  casual: 'غير رسمي (محادثة يومية)',
  formal: 'رسمي (أكاديمي)',
}

const STRICTNESS_LABELS: Record<CorrectionStrictness, string> = {
  gentle: 'لطيف — تصحيح ضمني فقط',
  moderate: 'معتدل — تصحيح عند التكرار',
  strict: 'صارم — تصحيح فوري دائم',
}

const VOCAB_RATE_LABELS: Record<VocabRate, string> = {
  slow: 'بطيء — 5% مفردات جديدة',
  medium: 'متوسط — 15% مفردات جديدة',
  fast: 'سريع — 25% مفردات جديدة',
}

const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  grammar: 'القواعد النحوية',
  vocabulary: 'المفردات',
  conversation: 'المحادثة',
  pronunciation: 'النطق',
}

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_USER: UserSettings = {
  cefr_override: '',
  daily_goal_minutes: 30,
  telegram_chat_id: '',
  telegram_notifications: false,
  preferred_topics: [],
}

const DEFAULT_TEACHER: TeacherSettings = {
  response_style: 'casual',
  correction_strictness: 'moderate',
  vocab_rate: 'medium',
  focus_areas: ['conversation'],
  custom_instructions: '',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<UserSettings>(DEFAULT_USER)
  const [teacher, setTeacher] = useState<TeacherSettings>(DEFAULT_TEACHER)
  const [pending, setPending] = useState<PendingState>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [initialized, setInitialized] = useState(false)

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) throw new Error('failed')
        const data = await res.json()

        setUser(prev => ({
          ...prev,
          cefr_override: data.cefr_override?.value ?? data.cefr_override ?? '',
          daily_goal_minutes: data.daily_goal_minutes?.value ?? data.daily_goal_minutes ?? 30,
          telegram_chat_id: data.telegram_chat_id?.value ?? data.telegram_chat_id ?? '',
          telegram_notifications: data.telegram_notifications?.value ?? data.telegram_notifications ?? false,
          preferred_topics: data.preferred_topics?.value ?? data.preferred_topics ?? [],
        }))

        const pendingMap: PendingState = {}
        for (const key of Object.keys(TEACHER_SETTING_LABELS)) {
          if (data[key]?.pending) pendingMap[key] = true
        }
        setPending(pendingMap)

        setTeacher(prev => ({
          ...prev,
          response_style: data.response_style?.value ?? data.response_style ?? 'casual',
          correction_strictness: data.correction_strictness?.value ?? data.correction_strictness ?? 'moderate',
          vocab_rate: data.vocab_rate?.value ?? data.vocab_rate ?? 'medium',
          focus_areas: data.focus_areas?.value ?? data.focus_areas ?? ['conversation'],
          custom_instructions: data.custom_instructions?.value ?? data.custom_instructions ?? '',
        }))
      } catch {
        // Silently use defaults if settings haven't been set yet
      } finally {
        setInitialized(true)
      }
    }
    load()
  }, [])

  // ── Save user setting ───────────────────────────────────────────────────────
  const saveUserSetting = useCallback(async (key: keyof UserSettings, value: unknown) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) throw new Error('save failed')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [])

  // ── Propose teacher setting change ──────────────────────────────────────────
  const proposeTeacherSetting = useCallback(
    async (key: keyof TeacherSettings, value: unknown, description: string) => {
      setPending(p => ({ ...p, [key]: true }))
      try {
        const res = await fetch('/api/settings/telegram-proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, proposed_value: value, change_description: description }),
        })
        if (!res.ok) throw new Error('proposal failed')
      } catch {
        setPending(p => ({ ...p, [key]: false }))
      }
    },
    []
  )

  // ── User setting handlers ───────────────────────────────────────────────────
  function handleTopicToggle(topic: string) {
    const next = user.preferred_topics.includes(topic)
      ? user.preferred_topics.filter(t => t !== topic)
      : [...user.preferred_topics, topic]
    setUser(u => ({ ...u, preferred_topics: next }))
    saveUserSetting('preferred_topics', next)
  }

  function handleFocusAreaToggle(area: FocusArea) {
    const next = teacher.focus_areas.includes(area)
      ? teacher.focus_areas.filter(a => a !== area)
      : [...teacher.focus_areas, area]
    setTeacher(t => ({ ...t, focus_areas: next }))
    proposeTeacherSetting(
      'focus_areas',
      next,
      `تغيير مجالات التركيز إلى: ${next.map(a => FOCUS_AREA_LABELS[a]).join('، ')}`
    )
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>جارٍ التحميل...</p>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/chat?language=turkish"
            className="text-sm"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            ← العودة
          </Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            الإعدادات
          </h1>
        </div>

        {/* Save status indicator */}
        {saveStatus !== 'idle' && (
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{
              background: saveStatus === 'saved'
                ? 'rgba(var(--gold-rgb, 212,175,55), 0.15)'
                : saveStatus === 'error'
                ? 'rgba(184,72,72,0.15)'
                : 'var(--bg-raised)',
              color: saveStatus === 'saved'
                ? 'var(--gold)'
                : saveStatus === 'error'
                ? '#b84848'
                : 'var(--text-muted)',
            }}
          >
            {saveStatus === 'saving' && 'جارٍ الحفظ...'}
            {saveStatus === 'saved' && '✓ تم الحفظ'}
            {saveStatus === 'error' && '⚠ فشل الحفظ'}
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* ── Section A: User Settings ── */}
        <section>
          <SectionTitle
            title="إعداداتك الشخصية"
            subtitle="تُحفظ فوراً دون الحاجة لموافقة"
          />

          <div className="space-y-4">

            {/* CEFR Override */}
            <SettingCard label="مستوى CEFR (تجاوز تلقائي)">
              <select
                className="input-field w-full text-sm"
                value={user.cefr_override}
                onChange={e => {
                  const v = e.target.value as CEFRLevel | ''
                  setUser(u => ({ ...u, cefr_override: v }))
                  saveUserSetting('cefr_override', v)
                }}
                style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                <option value="">تلقائي (يحدده المعلم)</option>
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </SettingCard>

            {/* Daily Goal */}
            <SettingCard label="هدف الدراسة اليومي">
              <div className="flex gap-2 flex-wrap">
                {([15, 30, 45, 60] as const).map(mins => (
                  <button
                    key={mins}
                    onClick={() => {
                      setUser(u => ({ ...u, daily_goal_minutes: mins }))
                      saveUserSetting('daily_goal_minutes', mins)
                    }}
                    className={user.daily_goal_minutes === mins ? 'btn-gold' : 'btn-ghost'}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.9rem' }}
                  >
                    {mins} دقيقة
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Telegram Chat ID */}
            <SettingCard
              label="معرف محادثة Telegram"
              hint="احصل عليه عبر @userinfobot على Telegram"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1 text-sm"
                  placeholder="مثال: 123456789"
                  value={user.telegram_chat_id}
                  onChange={e => setUser(u => ({ ...u, telegram_chat_id: e.target.value }))}
                  onBlur={() => saveUserSetting('telegram_chat_id', user.telegram_chat_id)}
                  style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
              </div>
            </SettingCard>

            {/* Telegram Notifications Toggle */}
            <SettingCard label="إشعارات Telegram">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => {
                    const next = !user.telegram_notifications
                    setUser(u => ({ ...u, telegram_notifications: next }))
                    saveUserSetting('telegram_notifications', next)
                  }}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{
                    background: user.telegram_notifications ? 'var(--gold)' : 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full transition-transform"
                    style={{
                      background: 'var(--text-primary)',
                      transform: user.telegram_notifications ? 'translateX(-20px)' : 'translateX(0)',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {user.telegram_notifications ? 'مفعّل — ستتلقى تذكيرات يومية' : 'معطّل'}
                </span>
              </label>
            </SettingCard>

            {/* Preferred Topics */}
            <SettingCard label="الموضوعات المفضلة">
              <div className="flex flex-wrap gap-2">
                {TOPIC_CHIPS.map(topic => (
                  <button
                    key={topic}
                    onClick={() => handleTopicToggle(topic)}
                    className={user.preferred_topics.includes(topic) ? 'badge-gold' : 'btn-ghost'}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                    }}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </SettingCard>
          </div>
        </section>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* ── Section B: Teacher Settings ── */}
        <section>
          <SectionTitle
            title="إعدادات المعلم (الذكاء الاصطناعي)"
            subtitle="تتطلب موافقة عبر Telegram قبل التطبيق"
          />

          <div
            className="rounded-xl px-4 py-3 mb-5 text-xs flex items-start gap-2"
            style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <span>
              عند تغيير أي إعداد هنا، ستصلك رسالة Telegram لتأكيد أو رفض التعديل.
              الإعداد يبقى في حالة "انتظار" حتى تستجيب.
            </span>
          </div>

          <div className="space-y-4">

            {/* Response Style */}
            <SettingCard
              label={TEACHER_SETTING_LABELS.response_style}
              pendingBadge={pending.response_style}
            >
              <div className="flex gap-2 flex-wrap">
                {(['casual', 'formal'] as ResponseStyle[]).map(style => (
                  <button
                    key={style}
                    onClick={() => {
                      if (pending.response_style) return
                      setTeacher(t => ({ ...t, response_style: style }))
                      proposeTeacherSetting(
                        'response_style',
                        style,
                        `تغيير أسلوب الردود إلى: ${RESPONSE_STYLE_LABELS[style]}`
                      )
                    }}
                    className={teacher.response_style === style ? 'btn-gold' : 'btn-ghost'}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.9rem',
                      opacity: pending.response_style ? 0.6 : 1,
                      cursor: pending.response_style ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {RESPONSE_STYLE_LABELS[style]}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Correction Strictness */}
            <SettingCard
              label={TEACHER_SETTING_LABELS.correction_strictness}
              pendingBadge={pending.correction_strictness}
            >
              <div className="flex flex-col gap-2">
                {(['gentle', 'moderate', 'strict'] as CorrectionStrictness[]).map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      if (pending.correction_strictness) return
                      setTeacher(t => ({ ...t, correction_strictness: s }))
                      proposeTeacherSetting(
                        'correction_strictness',
                        s,
                        `تغيير صرامة التصحيح إلى: ${STRICTNESS_LABELS[s]}`
                      )
                    }}
                    className={teacher.correction_strictness === s ? 'btn-gold' : 'btn-ghost'}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.9rem',
                      textAlign: 'right',
                      opacity: pending.correction_strictness ? 0.6 : 1,
                      cursor: pending.correction_strictness ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {STRICTNESS_LABELS[s]}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Vocab Rate */}
            <SettingCard
              label={TEACHER_SETTING_LABELS.vocab_rate}
              pendingBadge={pending.vocab_rate}
            >
              <div className="flex flex-col gap-2">
                {(['slow', 'medium', 'fast'] as VocabRate[]).map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      if (pending.vocab_rate) return
                      setTeacher(t => ({ ...t, vocab_rate: r }))
                      proposeTeacherSetting(
                        'vocab_rate',
                        r,
                        `تغيير معدل المفردات الجديدة إلى: ${VOCAB_RATE_LABELS[r]}`
                      )
                    }}
                    className={teacher.vocab_rate === r ? 'btn-gold' : 'btn-ghost'}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.9rem',
                      textAlign: 'right',
                      opacity: pending.vocab_rate ? 0.6 : 1,
                      cursor: pending.vocab_rate ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {VOCAB_RATE_LABELS[r]}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Focus Areas */}
            <SettingCard
              label={TEACHER_SETTING_LABELS.focus_areas}
              pendingBadge={pending.focus_areas}
            >
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FOCUS_AREA_LABELS) as FocusArea[]).map(area => (
                  <button
                    key={area}
                    onClick={() => {
                      if (!pending.focus_areas) handleFocusAreaToggle(area)
                    }}
                    className={teacher.focus_areas.includes(area) ? 'badge-gold' : 'btn-ghost'}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      cursor: pending.focus_areas ? 'not-allowed' : 'pointer',
                      opacity: pending.focus_areas ? 0.6 : 1,
                    }}
                  >
                    {FOCUS_AREA_LABELS[area]}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Custom Instructions */}
            <SettingCard
              label={TEACHER_SETTING_LABELS.custom_instructions}
              pendingBadge={pending.custom_instructions}
            >
              <textarea
                className="input-field w-full text-sm resize-none"
                rows={4}
                placeholder="مثال: ركّز على الأفعال في الماضي. استخدم أمثلة من الحياة اليومية..."
                value={teacher.custom_instructions}
                disabled={!!pending.custom_instructions}
                onChange={e => setTeacher(t => ({ ...t, custom_instructions: e.target.value }))}
                onBlur={() => {
                  if (!pending.custom_instructions && teacher.custom_instructions.trim()) {
                    proposeTeacherSetting(
                      'custom_instructions',
                      teacher.custom_instructions,
                      `تعليمات مخصصة جديدة:\n"${teacher.custom_instructions.slice(0, 100)}..."`
                    )
                  }
                }}
                style={{
                  background: 'var(--bg-raised)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  opacity: pending.custom_instructions ? 0.6 : 1,
                }}
              />
            </SettingCard>
          </div>
        </section>

        {/* Footer spacing */}
        <div className="h-8" />
      </main>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function SettingCard({
  label,
  hint,
  pendingBadge,
  children,
}: {
  label: string
  hint?: string
  pendingBadge?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="card rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {label}
          </p>
          {hint && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {hint}
            </p>
          )}
        </div>
        {pendingBadge && (
          <span
            className="text-xs px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: 'rgba(212,175,55,0.15)',
              color: 'var(--gold)',
              border: '1px solid rgba(212,175,55,0.3)',
            }}
          >
            في انتظار موافقة المعلم
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

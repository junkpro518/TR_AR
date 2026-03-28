'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
type ResponseStyle = 'casual' | 'formal'
type CorrectionStrictness = 'gentle' | 'moderate' | 'strict'
type VocabRate = 'slow' | 'medium' | 'fast'
type FocusArea = 'grammar' | 'vocabulary' | 'conversation' | 'pronunciation'
type TeachingLanguageMix = 'arabic_heavy' | 'balanced' | 'turkish_heavy'
type QuizFrequency = 'never' | 'sometimes' | 'often'

interface UserSettings {
  cefr_override: CEFRLevel | ''
  daily_goal_minutes: 15 | 30 | 45 | 60
  telegram_chat_id: string
  telegram_notifications: boolean
  preferred_topics: string[]
  web_search_enabled: boolean
}

interface TeacherSettings {
  response_style: ResponseStyle
  correction_strictness: CorrectionStrictness
  vocab_rate: VocabRate
  focus_areas: FocusArea[]
  custom_instructions: string
  teaching_language_mix: TeachingLanguageMix
  quiz_frequency: QuizFrequency
  system_prompt_base: string
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
  teaching_language_mix: 'مزيج اللغتين',
  quiz_frequency: 'تكرار الاختبارات',
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
  grammar: '📖 القواعد النحوية',
  vocabulary: '📝 المفردات',
  conversation: '💬 المحادثة',
  pronunciation: '🔊 النطق',
}

const MIX_LABELS: Record<string, string> = {
  arabic_heavy: 'عربي أساسي — شرح أكثر بالعربية',
  balanced: 'متوازن — عربي وتركي بالتساوي',
  turkish_heavy: 'تركي أساسي — غمر في اللغة',
}

const QUIZ_FREQ_LABELS: Record<string, string> = {
  never: 'أبداً — لا اختبارات',
  sometimes: 'أحياناً — عند تعلم قاعدة جديدة',
  often: 'كثيراً — بعد كل موضوع',
}

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_USER: UserSettings = {
  cefr_override: '',
  daily_goal_minutes: 30,
  telegram_chat_id: '',
  telegram_notifications: false,
  preferred_topics: [],
  web_search_enabled: false,
}

const DEFAULT_TEACHER: TeacherSettings = {
  response_style: 'casual',
  correction_strictness: 'moderate',
  vocab_rate: 'medium',
  focus_areas: ['conversation'],
  custom_instructions: '',
  teaching_language_mix: 'balanced',
  quiz_frequency: 'sometimes',
  system_prompt_base: '',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<UserSettings>(DEFAULT_USER)
  const [teacher, setTeacher] = useState<TeacherSettings>(DEFAULT_TEACHER)
  const [pending, setPending] = useState<PendingState>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [initialized, setInitialized] = useState(false)
  const [promptPreview, setPromptPreview] = useState<string | null>(null)
  const [loadingPrompt, setLoadingPrompt] = useState(false)

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
          web_search_enabled: data.web_search_enabled?.value ?? data.web_search_enabled ?? false,
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
          teaching_language_mix: data.teaching_language_mix?.value ?? data.teaching_language_mix ?? 'balanced',
          quiz_frequency: data.quiz_frequency?.value ?? data.quiz_frequency ?? 'sometimes',
          system_prompt_base: data.system_prompt_base?.value ?? data.system_prompt_base ?? '',
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
        const data = await res.json()
        // إذا لم يُرسَل لـ Telegram (غير مضبوط)، احفظ مباشرة وأزل حالة الانتظار
        if (data.ok && !data.telegram_sent) {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          })
          // إلغاء الانتظار مباشرة لأنه لا يوجد Telegram للموافقة
          await fetch('/api/settings/cancel-pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
          })
          setPending(p => ({ ...p, [key]: false }))
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        }
      } catch {
        setPending(p => ({ ...p, [key]: false }))
      }
    },
    []
  )

  // ── Cancel pending proposal ──────────────────────────────────────────────────
  const cancelPending = useCallback(async (key: keyof TeacherSettings) => {
    try {
      await fetch('/api/settings/cancel-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      setPending(p => ({ ...p, [key]: false }))
    } catch {
      // صامت
    }
  }, [])

  // ── Direct apply (bypass Telegram approval) ─────────────────────────────────
  const directApply = useCallback(async (key: keyof TeacherSettings) => {
    try {
      await fetch('/api/settings/cancel-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      setPending(p => ({ ...p, [key]: false }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      // صامت
    }
  }, [])

  async function loadPromptPreview() {
    setLoadingPrompt(true)
    try {
      const res = await fetch('/api/settings/preview-prompt')
      const data = await res.json()
      setPromptPreview(data.prompt)
    } catch {
      setPromptPreview('❌ فشل تحميل الـ Prompt')
    }
    setLoadingPrompt(false)
  }

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

        {/* ── API Keys Setup Link ── */}
        <div className="max-w-xl mx-auto">
          <Link
            href="/setup"
            className="flex items-center justify-between w-full card p-4 transition-all"
            style={{ textDecoration: 'none', borderColor: 'var(--border-gold)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--gold-light)' }}>🔑 إعداد المفاتيح والتوكنات</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>OpenRouter · Telegram · Mistral</p>
            </div>
            <span style={{ color: 'var(--gold)' }}>←</span>
          </Link>
        </div>

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

            {/* Web Search Toggle */}
            <SettingCard
              label="البحث عبر الإنترنت"
              hint="المعلم يبحث في الإنترنت عند الحاجة — يتطلب SERPER_API_KEY في الإعداد"
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => {
                    const next = !user.web_search_enabled
                    setUser(u => ({ ...u, web_search_enabled: next }))
                    saveUserSetting('web_search_enabled', next)
                  }}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{
                    background: user.web_search_enabled ? 'var(--gold)' : 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full transition-transform"
                    style={{
                      background: 'var(--text-primary)',
                      transform: user.web_search_enabled ? 'translateX(-20px)' : 'translateX(0)',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {user.web_search_enabled ? '🔍 مفعّل — المعلم يبحث عند الحاجة' : 'معطّل'}
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
              onCancelPending={() => cancelPending('response_style')}
              onDirectApply={() => directApply('response_style')}
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
              onCancelPending={() => cancelPending('correction_strictness')}
              onDirectApply={() => directApply('correction_strictness')}
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
              onCancelPending={() => cancelPending('vocab_rate')}
              onDirectApply={() => directApply('vocab_rate')}
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
              onCancelPending={() => cancelPending('focus_areas')}
              onDirectApply={() => directApply('focus_areas')}
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

            {/* Language Mix */}
            <SettingCard label="مزيج اللغتين" pendingBadge={pending.teaching_language_mix} onCancelPending={() => cancelPending('teaching_language_mix')} onDirectApply={() => directApply('teaching_language_mix')}>
              <div className="flex flex-col gap-2">
                {(['arabic_heavy', 'balanced', 'turkish_heavy'] as const).map(mix => (
                  <button
                    key={mix}
                    onClick={() => {
                      if (pending.teaching_language_mix) return
                      setTeacher(t => ({ ...t, teaching_language_mix: mix }))
                      proposeTeacherSetting('teaching_language_mix', mix, `تغيير مزيج اللغة إلى: ${MIX_LABELS[mix]}`)
                    }}
                    className={teacher.teaching_language_mix === mix ? 'btn-gold' : 'btn-ghost'}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem', textAlign: 'right', opacity: pending.teaching_language_mix ? 0.6 : 1, cursor: pending.teaching_language_mix ? 'not-allowed' : 'pointer' }}
                  >
                    {MIX_LABELS[mix]}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Quiz Frequency */}
            <SettingCard label="تكرار الاختبارات" pendingBadge={pending.quiz_frequency} onCancelPending={() => cancelPending('quiz_frequency')} onDirectApply={() => directApply('quiz_frequency')}>
              <div className="flex flex-col gap-2">
                {(['never', 'sometimes', 'often'] as const).map(freq => (
                  <button
                    key={freq}
                    onClick={() => {
                      if (pending.quiz_frequency) return
                      setTeacher(t => ({ ...t, quiz_frequency: freq }))
                      proposeTeacherSetting('quiz_frequency', freq, `تغيير تكرار الاختبارات إلى: ${QUIZ_FREQ_LABELS[freq]}`)
                    }}
                    className={teacher.quiz_frequency === freq ? 'btn-gold' : 'btn-ghost'}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem', textAlign: 'right', opacity: pending.quiz_frequency ? 0.6 : 1, cursor: pending.quiz_frequency ? 'not-allowed' : 'pointer' }}
                  >
                    {QUIZ_FREQ_LABELS[freq]}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Custom Instructions */}
            <SettingCard
              label={TEACHER_SETTING_LABELS.custom_instructions}
              pendingBadge={pending.custom_instructions}
              onCancelPending={() => cancelPending('custom_instructions')}
              onDirectApply={() => directApply('custom_instructions')}
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

            {/* System Prompt */}
            <SettingCard
              label="System Prompt الكامل"
              hint="النص الكامل الذي يصف شخصية المعلم وقواعده — يمكن تعديله ويمر بموافقة"
              pendingBadge={pending.system_prompt_base}
              onCancelPending={() => cancelPending('system_prompt_base')}
              onDirectApply={() => directApply('system_prompt_base')}
            >
              <div className="space-y-3">
                {/* معاينة */}
                <button
                  onClick={loadPromptPreview}
                  disabled={loadingPrompt}
                  className="btn-ghost w-full py-2 rounded-xl text-xs"
                >
                  {loadingPrompt ? '⏳ جارٍ التحميل...' : '👁 عرض Prompt الحالي'}
                </button>
                {promptPreview && (
                  <textarea
                    readOnly
                    value={promptPreview}
                    rows={12}
                    className="input-field w-full text-xs font-mono resize-none"
                    style={{
                      background: 'var(--bg-raised)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      direction: 'rtl',
                      fontSize: '0.7rem',
                      lineHeight: 1.5,
                    }}
                  />
                )}

                {/* تعديل النص الأساسي */}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  لتعديل شخصية المعلم الأساسية (يُرسَل للموافقة):
                </p>
                <textarea
                  className="input-field w-full text-sm resize-none"
                  rows={6}
                  placeholder="أنت معلم لغة تركية دافئ ومشجع... (اتركه فارغاً لاستخدام النص الافتراضي)"
                  value={teacher.system_prompt_base}
                  disabled={!!pending.system_prompt_base}
                  onChange={e => setTeacher(t => ({ ...t, system_prompt_base: e.target.value }))}
                  onBlur={() => {
                    if (pending.system_prompt_base) return
                    proposeTeacherSetting(
                      'system_prompt_base',
                      teacher.system_prompt_base,
                      `تعديل النص الأساسي لـ System Prompt`
                    )
                  }}
                  style={{
                    background: 'var(--bg-raised)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    opacity: pending.system_prompt_base ? 0.6 : 1,
                  }}
                />
              </div>
            </SettingCard>

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
  onCancelPending,
  onDirectApply,
  children,
}: {
  label: string
  hint?: string
  pendingBadge?: boolean
  onCancelPending?: () => void
  onDirectApply?: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="card rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
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
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(212,175,55,0.15)',
                color: 'var(--gold)',
                border: '1px solid rgba(212,175,55,0.3)',
                whiteSpace: 'nowrap',
              }}
            >
              انتظار موافقة
            </span>
            {onDirectApply && (
              <button
                onClick={onDirectApply}
                title="تطبيق التعديل مباشرة"
                style={{
                  background: 'rgba(var(--gold-rgb, 212,175,55), 0.2)',
                  border: '1px solid rgba(212,175,55,0.4)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--gold)',
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  padding: '3px 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                ✓ تطبيق
              </button>
            )}
            {onCancelPending && (
              <button
                onClick={onCancelPending}
                title="إلغاء التعديل"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  lineHeight: 1,
                  padding: '2px 4px',
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

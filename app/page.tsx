import Link from 'next/link'

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Background geometry */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,149,42,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 20% 80%, rgba(201,149,42,0.04) 0%, transparent 60%)
          `,
        }}
      />

      {/* Decorative top line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--border-gold), transparent)' }}
        aria-hidden="true"
      />

      {/* Main content */}
      <div className="w-full max-w-sm relative z-10 text-center">

        {/* Ornament */}
        <div
          className="animate-slide-up mx-auto mb-5 text-xs tracking-[0.4em] uppercase"
          style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-body)' }}
        >
          ◆ &nbsp; معلم شخصي &nbsp; ◆
        </div>

        {/* Title */}
        <h1
          className="animate-slide-up delay-100 mb-2 leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.5rem, 12vw, 5rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          مُعلِّم
        </h1>

        {/* Subtitle */}
        <p
          className="animate-slide-up delay-200 mb-10"
          style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.7 }}
        >
          ذكاء اصطناعي يتكيّف مع مستواك<br />
          ويتتبع تقدمك بكل رسالة
        </p>

        {/* Gold divider */}
        <div
          className="animate-slide-up delay-200 mx-auto mb-8 w-16 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }}
          aria-hidden="true"
        />

        {/* Language Cards */}
        <div className="animate-slide-up delay-300 grid grid-cols-2 gap-3 mb-10">
          <LanguageCard
            href="/chat?language=turkish"
            flag="🇹🇷"
            nameAr="اللغة التركية"
            nameLatin="Türkçe"
          />
          <LanguageCard
            href="/chat?language=english"
            flag="🇬🇧"
            nameAr="الإنجليزية"
            nameLatin="English"
          />
        </div>

        {/* Feature pills */}
        <div className="animate-slide-up delay-400 flex flex-wrap justify-center gap-2">
          {['SRS مراجعة ذكية', 'مستويات CEFR', 'تتبع التقدم', 'مهام تواصلية'].map(f => (
            <span key={f} className="badge badge-gold">{f}</span>
          ))}
        </div>
      </div>

      {/* Bottom decoration */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }}
        aria-hidden="true"
      />
      <p
        className="animate-slide-up delay-500 absolute bottom-5 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        يتعلم معك. يتذكر تقدمك.
      </p>
    </div>
  )
}

function LanguageCard({
  href,
  flag,
  nameAr,
  nameLatin,
}: {
  href: string
  flag: string
  nameAr: string
  nameLatin: string
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center gap-2.5 p-5 rounded-xl transition-all duration-200"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
      }}
    >
      {/* Hover glow */}
      <span
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: 'var(--gold-glow)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'inherit',
        }}
        aria-hidden="true"
      />

      <span className="text-3xl relative">{flag}</span>
      <span
        className="relative font-medium text-sm"
        style={{ color: 'var(--text-primary)' }}
      >
        {nameAr}
      </span>
      <span
        className="relative font-mono text-xs"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {nameLatin}
      </span>

      {/* Arrow */}
      <span
        className="relative text-xs opacity-0 group-hover:opacity-100 transition-all duration-150 translate-y-1 group-hover:translate-y-0"
        style={{ color: 'var(--gold)' }}
      >
        ابدأ ←
      </span>
    </Link>
  )
}

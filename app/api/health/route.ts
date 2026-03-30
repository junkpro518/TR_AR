import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// GET /api/health — Docker healthcheck + env diagnostics
export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }

  // Env vars presence (masked — never expose values)
  const ENV_KEYS = [
    'OPENROUTER_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'TELEGRAM_BOT_TOKEN',
    'CHAT_MODEL',
  ]
  for (const k of ENV_KEYS) {
    checks[`env_${k}`] = process.env[k] ? 'set' : 'missing'
  }

  // Supabase connectivity
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('settings').select('key').limit(1)
    checks.supabase = error ? 'error' : 'ok'
  } catch {
    checks.supabase = 'unreachable'
  }

  return NextResponse.json(checks, { status: 200 })
}

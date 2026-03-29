import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// GET /api/health — used by Docker healthcheck and monitoring
export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }

  // Check Supabase connectivity
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('settings').select('key').limit(1)
    checks.supabase = error ? 'error' : 'ok'
  } catch {
    checks.supabase = 'unreachable'
  }

  const healthy = checks.supabase === 'ok'

  return NextResponse.json(checks, { status: healthy ? 200 : 503 })
}

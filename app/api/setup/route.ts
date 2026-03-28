import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { clearSecretsCache } from '@/lib/secrets-loader'

// GET - fetch current saved secrets (masked)
export async function GET() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'secrets')
    .single()

  const secrets = (data?.value ?? {}) as Record<string, string>

  // Mask values for display — show only last 6 chars
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(secrets)) {
    if (v && typeof v === 'string' && v.length > 6) {
      masked[k] = '••••••••••••' + v.slice(-6)
    } else {
      masked[k] = v ? '••••••' : ''
    }
  }

  // Also report which env vars are set (from process.env)
  const envStatus: Record<string, boolean> = {
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
    MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY,
    CHAT_MODEL: !!process.env.CHAT_MODEL,
    ANALYSIS_MODEL: !!process.env.ANALYSIS_MODEL,
    SERPER_API_KEY: !!process.env.SERPER_API_KEY,
  }

  return NextResponse.json({ masked, envStatus, hasSaved: Object.keys(secrets).length > 0 })
}

// POST - save secrets to Supabase
export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createServerClient()

  // Fetch existing secrets first
  const { data: existing } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'secrets')
    .single()

  const current = (existing?.value ?? {}) as Record<string, string>

  // Only update fields that have actual values (don't overwrite with empty strings)
  const updated = { ...current }
  for (const [k, v] of Object.entries(body as Record<string, string>)) {
    if (v && v.trim() && !v.includes('•')) {
      updated[k] = v.trim()
    }
  }

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'secrets', value: updated }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  clearSecretsCache() // invalidate cache so new values take effect immediately
  return NextResponse.json({ success: true })
}

// DELETE - clear a specific key
export async function DELETE(request: NextRequest) {
  const { key } = await request.json()
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'secrets')
    .single()

  const current = { ...(existing?.value ?? {}) } as Record<string, string>
  delete current[key]

  await supabase.from('settings').upsert({ key: 'secrets', value: current }, { onConflict: 'key' })
  return NextResponse.json({ success: true })
}

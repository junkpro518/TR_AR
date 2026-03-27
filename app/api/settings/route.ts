import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { sendTelegramApprovalRequest } from '@/lib/telegram'

// GET /api/settings — fetch all current settings
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('settings')
    .select('key, value, pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Convert row array → { key: value } map for convenience
  const map: Record<string, unknown> = {}
  for (const row of data ?? []) {
    map[row.key] = row.pending ? { value: row.value, pending: true } : row.value
  }

  return NextResponse.json(map)
}

// POST /api/settings — upsert one or more user-controlled settings
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { key, value } = body as { key: string; value: unknown }

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, pending: false }, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

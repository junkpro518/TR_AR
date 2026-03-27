import { createClient } from '@supabase/supabase-js'
import type { ApiLogEntry } from './types'

export async function logApiCall(entry: ApiLogEntry): Promise<void> {
  // Always log to console for local debugging
  const level = entry.success === false ? 'error' : 'info'
  console[level]('[api_log]', entry)

  // Persist to DB only when credentials are available (non-blocking)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  try {
    const supabase = createClient(url, key)
    await supabase.from('api_logs').insert(entry)
  } catch {
    // Logging must never crash the caller
  }
}

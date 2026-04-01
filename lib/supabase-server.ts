import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Singleton — reuse across requests in the same Node.js process/Worker isolate
// to avoid creating a new HTTP connection pool on every request.
let _client: ReturnType<typeof createSupabaseClient> | null = null

export function createServerClient() {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    )
  }

  _client = createSupabaseClient(url, key)
  return _client
}

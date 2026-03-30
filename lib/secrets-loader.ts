import { createServerClient } from './supabase-server'

let cachedSecrets: Record<string, string> | null = null
let cacheTime = 0
const CACHE_TTL = 5_000 // 5 seconds — short TTL so setup-page updates take effect quickly

export async function getSecrets(): Promise<Record<string, string>> {
  const now = Date.now()
  if (cachedSecrets && now - cacheTime < CACHE_TTL) {
    return cachedSecrets
  }

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'secrets')
      .single()

    cachedSecrets = (data?.value ?? {}) as Record<string, string>
    cacheTime = now
    return cachedSecrets
  } catch {
    return {}
  }
}

export async function getSecret(key: string): Promise<string> {
  // 1. process.env first — covers Cloudflare Secrets/Variables and .env on VPS
  if (process.env[key]) return process.env[key]!

  // 2. Supabase settings table — allows /setup page to override for local dev
  const secrets = await getSecrets()
  return secrets[key] ?? ''
}

export function clearSecretsCache() {
  cachedSecrets = null
  cacheTime = 0
}

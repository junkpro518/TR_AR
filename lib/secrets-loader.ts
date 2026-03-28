import { createServerClient } from './supabase-server'

let cachedSecrets: Record<string, string> | null = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

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
  // env var takes priority over Supabase stored secret
  const envVal = process.env[key]
  if (envVal) return envVal

  const secrets = await getSecrets()
  return secrets[key] ?? ''
}

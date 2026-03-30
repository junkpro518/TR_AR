/**
 * TTS Service — Voxtral TTS (Mistral) + Web Speech API fallback
 *
 * Voxtral TTS by Mistral (voxtral-mini-tts-2603):
 *  - Multilingual TTS (EN, FR, ES, PT, IT, NL, DE, HI, AR)
 *  - Turkish is not officially listed — uses a neutral voice for best approximation
 *  - API endpoint: https://api.mistral.ai/v1/audio/speech
 *  - To enable: add MISTRAL_API_KEY to Cloudflare Secrets or /setup page
 *
 * Setup:
 * 1. Get API key from https://console.mistral.ai
 * 2. Add MISTRAL_API_KEY as a Cloudflare Secret (or via /setup page)
 * 3. TTS will automatically use Voxtral when the key is present
 */

import { getSecret } from './secrets-loader'

// Cache fetched voice_id so we don't call /v1/audio/voices on every TTS request
let cachedVoiceId: string | null = null

async function getDefaultVoiceId(apiKey: string): Promise<string> {
  if (cachedVoiceId) return cachedVoiceId

  try {
    const res = await fetch('https://api.mistral.ai/v1/audio/voices', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (res.ok) {
      const data = await res.json()
      // Pick first available voice
      const voices: Array<{ id: string; name?: string }> = data.voices ?? data.data ?? []
      if (voices.length > 0) {
        cachedVoiceId = voices[0].id
        return cachedVoiceId
      }
    }
  } catch { /* fall through */ }

  // Fallback: use a known preset voice name — Mistral may accept lowercase names
  cachedVoiceId = 'oliver'
  return cachedVoiceId
}

export async function generateVoxtralAudio(
  text: string,
  language: 'tr' | 'ar' = 'tr'
): Promise<ArrayBuffer | null> {
  const apiKey = await getSecret('MISTRAL_API_KEY')
  if (!apiKey) return null

  try {
    const voiceId = await getDefaultVoiceId(apiKey)

    const response = await fetch('https://api.mistral.ai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voxtral-mini-tts-2603',
        input: text,
        voice_id: language === 'ar' ? 'yassir' : voiceId,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      console.warn('[Voxtral TTS] API error:', response.status, await response.text().catch(() => ''))
      return null
    }

    return await response.arrayBuffer()
  } catch (err) {
    console.warn('[Voxtral TTS] Request failed:', err)
    return null
  }
}

/**
 * TTS Service — Voxtral TTS (Mistral) + Web Speech API fallback
 *
 * Voxtral TTS by Mistral:
 *  - Open-weight multilingual TTS (9 languages including Turkish & Arabic)
 *  - Natural prosody, emotional expression
 *  - API endpoint: https://api.mistral.ai/v1/audio/speech (when available)
 *  - Outperforms ElevenLabs v2.5 Flash on native speaker evaluations
 *  - To enable: add MISTRAL_API_KEY to .env.local or via /setup page
 *
 * Setup:
 * 1. Get API key from https://console.mistral.ai
 * 2. Add MISTRAL_API_KEY=your_key to .env.local or save via /setup
 * 3. TTS will automatically use Voxtral when the key is present
 */

import { getSecret } from './secrets-loader'

export async function generateVoxtralAudio(
  text: string,
  language: 'tr' | 'ar' = 'tr'
): Promise<ArrayBuffer | null> {
  const apiKey = await getSecret('MISTRAL_API_KEY')
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.mistral.ai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voxtral-tts-v1',
        input: text,
        voice: language === 'tr' ? 'alloy' : 'nova',
        response_format: 'mp3',
        speed: 0.95,
      }),
    })

    if (!response.ok) {
      console.warn('[Voxtral TTS] API error:', response.status)
      return null
    }

    return await response.arrayBuffer()
  } catch (err) {
    console.warn('[Voxtral TTS] Request failed:', err)
    return null
  }
}

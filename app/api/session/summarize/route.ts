import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { summarizeSession } from '@/lib/session-summarizer'
import { getSecret } from '@/lib/secrets-loader'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { session_id } = body as { session_id: string }

  if (!session_id) {
    return new Response(JSON.stringify({ error: 'session_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey =
    process.env.OPENROUTER_API_KEY || (await getSecret('OPENROUTER_API_KEY'))
  const analysisModel =
    process.env.ANALYSIS_MODEL ||
    (await getSecret('ANALYSIS_MODEL')) ||
    'meta-llama/llama-3.1-8b-instruct'

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createServerClient()
  const result = await summarizeSession(supabase, session_id, apiKey, analysisModel)

  if (!result) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, summary: result }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

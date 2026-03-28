import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language } from '@/lib/types'

// GET /api/goals?language=turkish
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  if (!language) return NextResponse.json({ error: 'language required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('goals')
    .select('id, language, title, is_auto, progress, completed, created_at, milestones')
    .eq('language', language)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/goals — create a goal
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { language, title } = body as { language: Language; title: string }

  if (!language || !title?.trim()) {
    return NextResponse.json({ error: 'language and title required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('goals')
    .insert({ language, title: title.trim(), is_auto: false, progress: 0, completed: false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/goals — update progress or mark complete
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, progress, completed } = body as { id: string; progress?: number; completed?: boolean }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (progress != null) updates.progress = Math.min(100, Math.max(0, progress))
  if (completed != null) updates.completed = completed

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/goals?id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

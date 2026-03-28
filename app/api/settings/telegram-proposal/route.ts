import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { sendTelegramApprovalRequest } from '@/lib/telegram'

// POST /api/settings/telegram-proposal
// Body: { key, proposed_value, change_description }
// 1. Inserts a pending_proposals row
// 2. Marks the settings row as pending
// 3. Sends an approval request to Telegram
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { key, proposed_value, change_description } = body as {
    key: string
    proposed_value: unknown
    change_description: string
  }

  if (!key || proposed_value === undefined || !change_description) {
    return NextResponse.json(
      { error: 'key, proposed_value, and change_description are required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // احفظ القيمة الحالية قبل التغيير (للتراجع عند الرفض)
  const { data: currentSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single()

  let proposal: { id: string } | null = null

  // محاولة تخزين القيمة القديمة مع الاقتراح (للتراجع عند الرفض)
  const { data: p1, error: e1 } = await supabase
    .from('pending_proposals')
    .insert({ key, proposed_value, old_value: currentSetting?.value ?? null, status: 'pending' })
    .select('id')
    .single()

  if (e1 && (e1.code === '42703' || e1.message?.includes('old_value'))) {
    // العمود غير موجود — احفظ بدونه
    const { data: p2, error: proposalError } = await supabase
      .from('pending_proposals')
      .insert({ key, proposed_value, status: 'pending' })
      .select('id')
      .single()
    if (proposalError || !p2) {
      return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
    }
    proposal = p2
  } else if (e1 || !p1) {
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
  } else {
    proposal = p1
  }

  // Mark current setting as pending (upsert so it works even if row doesn't exist yet)
  await supabase
    .from('settings')
    .upsert({ key, value: proposed_value, pending: true }, { onConflict: 'key' })

  // Send Telegram message
  const sent = await sendTelegramApprovalRequest(proposal.id, change_description)

  return NextResponse.json({
    ok: true,
    proposal_id: proposal.id,
    telegram_sent: sent,
  })
}

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

  // Insert proposal record
  const { data: proposal, error: proposalError } = await supabase
    .from('pending_proposals')
    .insert({ key, proposed_value, status: 'pending' })
    .select('id')
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
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

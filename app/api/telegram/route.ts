import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { answerCallbackQuery, editMessageReplyMarkup, sendTelegramMessage } from '@/lib/telegram'

// POST /api/telegram — Telegram webhook endpoint
// Receives updates from Telegram (callback_query from inline keyboard buttons)
// Register webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/telegram
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const callbackQuery = body.callback_query as
    | {
        id: string
        from: { id: number }
        message?: { message_id: number; chat: { id: number } }
        data?: string
      }
    | undefined

  if (!callbackQuery?.data) {
    // Not a callback query — nothing to handle
    return NextResponse.json({ ok: true })
  }

  const { id: queryId, data, message } = callbackQuery

  const isApprove = data.startsWith('approve_')
  const isReject = data.startsWith('reject_')

  if (!isApprove && !isReject) {
    await answerCallbackQuery(queryId, 'أمر غير معروف')
    return NextResponse.json({ ok: true })
  }

  const proposalId = data.replace(/^(approve|reject)_/, '')
  const supabase = createServerClient()

  // Fetch the proposal
  const { data: proposal, error } = await supabase
    .from('pending_proposals')
    .select('id, key, proposed_value, old_value, status')
    .eq('id', proposalId)
    .single()

  if (error || !proposal) {
    await answerCallbackQuery(queryId, 'الاقتراح غير موجود أو انتهت صلاحيته')
    return NextResponse.json({ ok: true })
  }

  if (proposal.status !== 'pending') {
    await answerCallbackQuery(queryId, 'تم البت في هذا الاقتراح مسبقاً')
    return NextResponse.json({ ok: true })
  }

  const newStatus = isApprove ? 'approved' : 'rejected'

  // Update proposal status
  await supabase
    .from('pending_proposals')
    .update({ status: newStatus })
    .eq('id', proposalId)

  if (isApprove) {
    // Apply the setting — mark as no longer pending
    await supabase
      .from('settings')
      .upsert({ key: proposal.key, value: proposal.proposed_value, pending: false }, { onConflict: 'key' })

    await answerCallbackQuery(queryId, '✅ تم قبول التعديل وتطبيقه')
    await sendTelegramMessage(`✅ <b>تم قبول التعديل</b>\n\nالإعداد <code>${proposal.key}</code> تم تحديثه بنجاح.`)
  } else {
    // Revert to old value if available, otherwise just clear pending flag
    const oldValue = (proposal as { old_value?: unknown }).old_value
    if (oldValue !== undefined && oldValue !== null) {
      await supabase
        .from('settings')
        .upsert({ key: proposal.key, value: oldValue, pending: false }, { onConflict: 'key' })
    } else {
      await supabase
        .from('settings')
        .update({ pending: false })
        .eq('key', proposal.key)
    }

    await answerCallbackQuery(queryId, '❌ تم رفض التعديل')
    await sendTelegramMessage(`❌ <b>تم رفض التعديل</b>\n\nالإعداد <code>${proposal.key}</code> لم يتغير.`)
  }

  // Remove inline keyboard buttons from the original message to prevent double-clicks
  if (message) {
    await editMessageReplyMarkup(message.chat.id, message.message_id)
  }

  return NextResponse.json({ ok: true })
}

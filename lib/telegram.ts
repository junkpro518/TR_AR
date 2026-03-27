/**
 * Telegram Bot Helper
 *
 * Setup instructions:
 * 1. Create a bot via @BotFather on Telegram → copy the token
 * 2. Start a chat with your bot, then visit:
 *    https://api.telegram.org/bot<TOKEN>/getUpdates
 *    to find your personal chat_id from the "from.id" field
 * 3. Set environment variables in .env.local:
 *    TELEGRAM_BOT_TOKEN=<your bot token>
 *    TELEGRAM_CHAT_ID=<your chat id>
 * 4. Register the webhook so Telegram sends button presses to your app:
 *    https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendTelegramMessage(
  text: string,
  replyMarkup?: object
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    }
  )
  return res.ok
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text ?? '',
        show_alert: false,
      }),
    }
  )
  return res.ok
}

export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number
): Promise<boolean> {
  if (!BOT_TOKEN) return false

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    }
  )
  return res.ok
}

export async function sendTelegramApprovalRequest(
  proposalId: string,
  changeDescription: string
): Promise<boolean> {
  return sendTelegramMessage(
    `🎯 <b>اقتراح تعديل في إعدادات المعلم</b>\n\n${changeDescription}\n\nهل توافق على هذا التعديل؟`,
    {
      inline_keyboard: [
        [
          { text: '✅ قبول', callback_data: `approve_${proposalId}` },
          { text: '❌ رفض', callback_data: `reject_${proposalId}` },
        ],
      ],
    }
  )
}

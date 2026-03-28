import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// POST /api/admin/clear-data
// يُفرغ محتوى جداول التعلم (DELETE الصفوف فقط — الجداول تبقى كما هي)
// ⚠️ لا يمسّ: settings, app_secrets (المفاتيح والإعدادات تبقى محفوظة)
export async function POST() {
  const supabase = createServerClient()

  // الجداول المراد تفريغها — بالترتيب الصحيح (الأبناء قبل الآباء)
  // ⚠️ 'settings' و 'app_secrets' محذوفتان عمداً — لا نحذف المفاتيح والإعدادات
  const TABLES_TO_CLEAR = [
    'session_summaries',  // يعتمد على sessions
    'task_attempts',      // يعتمد على tasks
    'feedback_log',       // يعتمد على messages
    'achievements',
    'messages',           // يعتمد على sessions
    'vocab_cards',
    'goals',
    'tasks',
    'pending_proposals',
    'sessions',
    'api_logs',
  ] as const

  const results: Record<string, string> = {}

  for (const table of TABLES_TO_CLEAR) {
    // .not('id', 'is', null) = احذف كل صف له id (أي جميع الصفوف الحقيقية)
    // هذا يُفرغ المحتوى فقط — الجدول نفسه وبنيته تبقيان سليمَين
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null)

    if (error) {
      // تجاهل أخطاء الجدول غير الموجود (migration لم تُطبَّق بعد)
      const tableNotFound = error.code === '42P01' || error.message?.includes('does not exist')
      results[table] = tableNotFound ? 'skipped (not created yet)' : `error: ${error.message}`
    } else {
      results[table] = 'emptied'
    }
  }

  const hasErrors = Object.values(results).some(r => r.startsWith('error'))
  return NextResponse.json({ ok: !hasErrors, results })
}

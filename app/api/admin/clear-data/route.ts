import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// POST /api/admin/clear-data
// يحذف جميع بيانات التعلم (جلسات، رسائل، مفردات، إلخ)
// لإعادة البدء من الصفر بعد الاختبار
export async function POST() {
  const supabase = createServerClient()

  try {
    // حذف بالترتيب الصحيح (الجداول ذات المراجع أولاً)
    const tables = [
      'session_summaries',
      'task_attempts',
      'feedback_log',
      'achievements',
      'messages',
      'vocab_cards',
      'goals',
      'tasks',
      'pending_proposals',
      'sessions',
      'api_logs',
    ]

    const results: Record<string, string> = {}

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // حذف كل الصفوف

      if (error) {
        // تجاهل أخطاء "الجدول غير موجود" (migration لم تُطبَّق بعد)
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          results[table] = 'skipped (table not found)'
        } else {
          results[table] = `error: ${error.message}`
        }
      } else {
        results[table] = 'cleared'
      }
    }

    // إعادة ضبط الإعدادات للقيم الافتراضية (اختياري — نتركها)
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

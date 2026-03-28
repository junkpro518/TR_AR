import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// POST /api/settings/cancel-pending
// Body: { key }
// يلغي الاقتراح المعلّق لإعداد معلم ويعيد الإعداد للقيمة الحالية
export async function POST(request: NextRequest) {
  const { key } = await request.json() as { key: string }

  if (!key) {
    return NextResponse.json({ error: 'key مطلوب' }, { status: 400 })
  }

  const supabase = createServerClient()

  // حذف الاقتراحات المعلقة لهذا المفتاح
  await supabase
    .from('pending_proposals')
    .delete()
    .eq('key', key)
    .eq('status', 'pending')

  // إلغاء حالة الانتظار في جدول الإعدادات
  await supabase
    .from('settings')
    .update({ pending: false })
    .eq('key', key)

  return NextResponse.json({ ok: true })
}

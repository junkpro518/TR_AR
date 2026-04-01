-- إضافة عمود user_text لجدول task_attempts
-- مطلوب لدالة complete_task_attempt التي تحفظ نص الطالب مع النتيجة
ALTER TABLE task_attempts ADD COLUMN IF NOT EXISTS user_text TEXT;

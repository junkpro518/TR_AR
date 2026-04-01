-- دالة ذرية لإضافة XP لجلسة — تمنع race condition عند الاستدعاء المتزامن
CREATE OR REPLACE FUNCTION increment_session_xp(session_id UUID, amount INTEGER)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE sessions SET total_xp = total_xp + amount WHERE id = session_id;
$$;

-- دالة ذرية لحفظ نتيجة مهمة + تحديث XP في transaction واحد
-- تمنع الحالة التي يُحفظ فيها task_attempt دون تحديث XP أو العكس
CREATE OR REPLACE FUNCTION complete_task_attempt(
  p_task_id        UUID,
  p_session_id     UUID,
  p_user_text      TEXT,
  p_score          INTEGER,
  p_feedback_json  JSONB,
  p_completed      BOOLEAN,
  p_xp_earned      INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_id UUID;
BEGIN
  INSERT INTO task_attempts (task_id, session_id, user_text, score, feedback_json, completed, xp_earned)
  VALUES (p_task_id, p_session_id, p_user_text, p_score, p_feedback_json, p_completed, p_xp_earned)
  RETURNING id INTO attempt_id;

  IF p_xp_earned > 0 THEN
    UPDATE sessions SET total_xp = total_xp + p_xp_earned WHERE id = p_session_id;
  END IF;

  RETURN attempt_id;
END;
$$;

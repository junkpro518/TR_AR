-- Migration 004: session_summaries — persistent teacher memory
CREATE TABLE IF NOT EXISTS session_summaries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  language        TEXT        NOT NULL DEFAULT 'turkish',
  summary_ar      TEXT        NOT NULL,
  topics_covered  TEXT[]      DEFAULT '{}',
  vocab_introduced TEXT[]     DEFAULT '{}',
  errors_made     TEXT[]      DEFAULT '{}',
  milestones      TEXT[]      DEFAULT '{}',
  message_count   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_summaries_session
  ON session_summaries(session_id);

CREATE INDEX IF NOT EXISTS idx_session_summaries_language_created
  ON session_summaries(language, created_at DESC);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_summaries' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all" ON session_summaries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

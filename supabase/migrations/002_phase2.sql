-- Phase 2 migration: grammar taxonomy, tasks, task_attempts, api_logs

-- 1. Add grammar_point column to feedback_log (nullable TEXT)
ALTER TABLE feedback_log
  ADD COLUMN IF NOT EXISTS grammar_point TEXT;

-- Valid examples: 'past_tense', 'word_order', 'vowel_harmony', 'case_suffix',
-- 'verb_conjugation', 'plural_form', 'preposition', 'article', 'tense_confusion'


-- 2. Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  language       TEXT        NOT NULL CHECK (language IN ('turkish', 'english')),
  cefr_level     TEXT        NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  type           TEXT        NOT NULL CHECK (type IN ('role_play','describe','story','debate','daily_scenario')),
  title          TEXT        NOT NULL,
  scenario       TEXT        NOT NULL,
  target_vocab   TEXT[]      DEFAULT '{}',
  target_grammar TEXT        NOT NULL,
  rubric_json    JSONB       NOT NULL,
  xp_reward      INTEGER     NOT NULL DEFAULT 50,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);


-- 3. Create task_attempts table
CREATE TABLE IF NOT EXISTS task_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID        REFERENCES tasks(id) ON DELETE CASCADE,
  session_id    UUID        REFERENCES sessions(id) ON DELETE CASCADE,
  score         INTEGER     CHECK (score >= 0 AND score <= 100),
  feedback_json JSONB,
  completed     BOOLEAN     DEFAULT FALSE,
  xp_earned     INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- 4. Create api_logs table
CREATE TABLE IF NOT EXISTS api_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event         TEXT        NOT NULL,
  model         TEXT,
  tokens_used   INTEGER,
  latency_ms    INTEGER,
  success       BOOLEAN     DEFAULT TRUE,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- 5. Seed 5 example tasks

-- Turkish A1: daily_scenario — greetings / self-introduction
INSERT INTO tasks (language, cefr_level, type, title, scenario, target_vocab, target_grammar, rubric_json, xp_reward)
VALUES (
  'turkish', 'A1', 'daily_scenario',
  'Merhaba! Kendini Tanıt',
  'You have just met someone at a language exchange event in Istanbul. Introduce yourself: share your name, where you are from, and what you do.',
  ARRAY['merhaba', 'benim adım', 'ben', 'nereli', 'meslek'],
  'verb_conjugation',
  '{"vocabulary_usage": 30, "grammar_accuracy": 40, "fluency": 30}',
  50
);

-- Turkish A2: role_play — shopping at the market
INSERT INTO tasks (language, cefr_level, type, title, scenario, target_vocab, target_grammar, rubric_json, xp_reward)
VALUES (
  'turkish', 'A2', 'role_play',
  'Pazarda Alışveriş',
  'You are at a local market in Ankara. Ask the vendor about prices for fruit and vegetables, compare two items, and decide what to buy.',
  ARRAY['fiyat', 'kaç lira', 'ucuz', 'pahalı', 'almak', 'vermek'],
  'case_suffix',
  '{"vocabulary_usage": 30, "grammar_accuracy": 40, "fluency": 30}',
  50
);

-- Turkish B1: story — past weekend
INSERT INTO tasks (language, cefr_level, type, title, scenario, target_vocab, target_grammar, rubric_json, xp_reward)
VALUES (
  'turkish', 'B1', 'story',
  'Geçen Hafta Sonu',
  'Tell a short story about what you did last weekend. Include at least three different activities, mention the people you were with, and describe how you felt.',
  ARRAY['geçen', 'hafta sonu', 'gitmek', 'yapmak', 'eğlenmek', 'arkadaş'],
  'past_tense',
  '{"vocabulary_usage": 30, "grammar_accuracy": 40, "fluency": 30}',
  50
);

-- English A1: daily_scenario — ordering at a café
INSERT INTO tasks (language, cefr_level, type, title, scenario, target_vocab, target_grammar, rubric_json, xp_reward)
VALUES (
  'english', 'A1', 'daily_scenario',
  'At the Café',
  'You are at a small café. Order a drink and a snack, ask how much it costs, and say thank you when you receive your order.',
  ARRAY['I would like', 'please', 'how much', 'thank you', 'coffee', 'water'],
  'article',
  '{"vocabulary_usage": 30, "grammar_accuracy": 40, "fluency": 30}',
  50
);

-- English A2: describe — favourite place
INSERT INTO tasks (language, cefr_level, type, title, scenario, target_vocab, target_grammar, rubric_json, xp_reward)
VALUES (
  'english', 'A2', 'describe',
  'My Favourite Place',
  'Describe your favourite place — it could be a room, a park, or a city. Explain where it is, what it looks like, and why you like it.',
  ARRAY['there is', 'there are', 'beautiful', 'near', 'because', 'favourite'],
  'preposition',
  '{"vocabulary_usage": 30, "grammar_accuracy": 40, "fluency": 30}',
  50
);


-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_language_level ON tasks(language, cefr_level);
CREATE INDEX IF NOT EXISTS idx_task_attempts_session ON task_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_event        ON api_logs(event, created_at);

-- Add language column to achievements table for multi-language support
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'turkish';

CREATE INDEX IF NOT EXISTS idx_achievements_language ON achievements(language);

-- Migration 005: add old_value column to pending_proposals
-- Needed for Telegram reject → rollback to previous setting value

ALTER TABLE pending_proposals
  ADD COLUMN IF NOT EXISTS old_value JSONB;

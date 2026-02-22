-- ============================================================
-- Migration 00011: Fix regular_season_rosters column name
-- ============================================================
-- The set_updated_at trigger sets NEW.updated_at but the column
-- is named last_updated. Rename to match the trigger.

ALTER TABLE public.regular_season_rosters
  RENAME COLUMN last_updated TO updated_at;

-- ============================================================
-- Migration 00019: WNBA support — add sport column to players
-- ============================================================

-- Add sport column (default 'nba' for all existing rows)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'nba';

-- Index for filtering by sport
CREATE INDEX IF NOT EXISTS idx_players_sport ON public.players (sport);

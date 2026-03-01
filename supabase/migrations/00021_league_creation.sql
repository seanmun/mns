-- ============================================================
-- Migration 00021: League creation wizard support
-- Adds sport column and commissioner_id to leagues table.
-- Some columns may already exist from manual DB changes;
-- IF NOT EXISTS handles this safely.
-- ============================================================

-- Sport column for NBA vs WNBA leagues
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'nba';

-- Commissioner: the user who created/owns this league
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS commissioner_id uuid REFERENCES auth.users(id);

-- League lifecycle phase
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS league_phase text NOT NULL DEFAULT 'keeper_season';

-- Schedule config (weeks, playoff structure, etc.)
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS schedule jsonb;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leagues_sport ON public.leagues(sport);
CREATE INDEX IF NOT EXISTS idx_leagues_commissioner_id ON public.leagues(commissioner_id);

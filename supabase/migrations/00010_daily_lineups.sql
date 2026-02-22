-- ============================================================
-- Migration 00010: Daily Lineups
-- ============================================================
-- Stores which 10 players from the 13-player active roster
-- are set active for a given game date.

CREATE TABLE IF NOT EXISTS public.daily_lineups (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  game_date date NOT NULL,
  active_player_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, team_id, game_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_lineups_league_team_date
  ON public.daily_lineups(league_id, team_id, game_date);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.daily_lineups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_lineups DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_lineups;

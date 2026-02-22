-- Matchups table: stores weekly head-to-head matchups
CREATE TABLE public.league_matchups (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES public.leagues(id),
  season_year integer NOT NULL,
  matchup_week integer NOT NULL,
  home_team_id text NOT NULL REFERENCES public.teams(id),
  away_team_id text NOT NULL REFERENCES public.teams(id),
  home_score numeric(8,2) DEFAULT NULL,
  away_score numeric(8,2) DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (league_id, season_year, matchup_week, home_team_id),
  UNIQUE (league_id, season_year, matchup_week, away_team_id)
);

CREATE INDEX idx_matchups_league_season ON public.league_matchups(league_id, season_year);
CREATE INDEX idx_matchups_week ON public.league_matchups(league_id, season_year, matchup_week);

-- No RLS needed — admin-managed table
ALTER TABLE public.league_matchups DISABLE ROW LEVEL SECURITY;

-- Games table: stores NBA schedule data uploaded from Basketball Reference
CREATE TABLE public.games (
  id text PRIMARY KEY,
  season_year integer NOT NULL,
  game_date date NOT NULL,
  away_team text NOT NULL,
  home_team text NOT NULL,
  is_cup_game boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_season ON public.games(season_year);
CREATE INDEX idx_games_date ON public.games(game_date);

-- No RLS needed — admin-only table
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Migration 00016: Add slot column to players table
-- ============================================================
-- Single source of truth for roster position.
-- players.team_id = which team owns the player (NULL = free agent)
-- players.slot = roster position (active, ir, redshirt, international, bench)
-- No more separate regular_season_rosters arrays.

-- Add the slot column
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS slot text NOT NULL DEFAULT 'active';

-- Populate slot from existing regular_season_rosters data
-- IR players
UPDATE public.players p
SET slot = 'ir'
FROM public.regular_season_rosters r
WHERE r.league_id = p.league_id
  AND p.id = ANY(r.ir_slots);

-- Redshirt players
UPDATE public.players p
SET slot = 'redshirt'
FROM public.regular_season_rosters r
WHERE r.league_id = p.league_id
  AND p.id = ANY(r.redshirt_players);

-- International stash players
UPDATE public.players p
SET slot = 'international'
FROM public.regular_season_rosters r
WHERE r.league_id = p.league_id
  AND p.id = ANY(r.international_players);

-- Benched players (subset of active roster)
UPDATE public.players p
SET slot = 'bench'
FROM public.regular_season_rosters r
WHERE r.league_id = p.league_id
  AND p.id = ANY(r.benched_players);

-- Everyone else with a team_id stays 'active' (the default)
-- Free agents (team_id IS NULL) stay 'active' too — slot is irrelevant without a team

-- Index for fast roster queries
CREATE INDEX IF NOT EXISTS idx_players_team_slot ON public.players (team_id, slot);

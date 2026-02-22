-- ============================================================
-- Migration 00008: Formalize rookie_draft_picks schema & asset ownership
-- ============================================================
-- The rookie_draft_picks table was manually altered in Supabase to support
-- pick trading (original_team vs current_owner). This migration ensures
-- proper constraints and indexes exist for the current schema.
--
-- Asset ownership model (1-to-1):
--   Players:           players.team_id            → teams.id (one owner)
--   Rookie picks:      rookie_draft_picks.current_owner → teams.id (one owner)
--   Int'l stashes:     players.team_id (where is_international_stash = true)
--   Pick assignments:  pick_assignments.current_team_id → teams.id (one owner)
--
-- If the table still has the OLD schema (season_year, team_id columns from
-- the original migration), this script recreates it. If it already has the
-- NEW schema (year, original_team, current_owner), it just adds constraints.

-- ============================================================
-- Step 1: Ensure rookie_draft_picks has the correct schema
-- ============================================================
-- Check if the table has the new schema by looking for 'current_owner' column.
-- If it doesn't exist, drop and recreate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rookie_draft_picks'
      AND column_name = 'current_owner'
  ) THEN
    -- Table has old schema — drop and recreate
    DROP TABLE IF EXISTS public.rookie_draft_picks CASCADE;

    CREATE TABLE public.rookie_draft_picks (
      id text PRIMARY KEY,
      league_id text NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
      year integer NOT NULL,
      round integer NOT NULL,
      original_team text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      original_team_name text NOT NULL,
      current_owner text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Updated_at trigger
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.rookie_draft_picks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    RAISE NOTICE 'rookie_draft_picks: recreated with new schema';
  ELSE
    RAISE NOTICE 'rookie_draft_picks: already has current_owner column, keeping data';
  END IF;
END $$;

-- ============================================================
-- Step 2: Add indexes (safe — uses IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rookie_picks_league ON public.rookie_draft_picks(league_id);
CREATE INDEX IF NOT EXISTS idx_rookie_picks_current_owner ON public.rookie_draft_picks(current_owner);
CREATE INDEX IF NOT EXISTS idx_rookie_picks_original_team ON public.rookie_draft_picks(original_team);
CREATE INDEX IF NOT EXISTS idx_rookie_picks_year ON public.rookie_draft_picks(year);

-- Unique constraint: one pick per team per year per round (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rookie_picks_unique
  ON public.rookie_draft_picks(league_id, year, round, original_team);

-- ============================================================
-- Step 3: Add foreign key constraints if missing
-- ============================================================
-- Ensure original_team → teams.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rookie_draft_picks_original_team_fkey'
    AND table_name = 'rookie_draft_picks'
  ) THEN
    ALTER TABLE public.rookie_draft_picks
      ADD CONSTRAINT rookie_draft_picks_original_team_fkey
      FOREIGN KEY (original_team) REFERENCES public.teams(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: original_team → teams.id';
  END IF;
END $$;

-- Ensure current_owner → teams.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rookie_draft_picks_current_owner_fkey'
    AND table_name = 'rookie_draft_picks'
  ) THEN
    ALTER TABLE public.rookie_draft_picks
      ADD CONSTRAINT rookie_draft_picks_current_owner_fkey
      FOREIGN KEY (current_owner) REFERENCES public.teams(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: current_owner → teams.id';
  END IF;
END $$;

-- Ensure pick_assignments.current_team_id → teams.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pick_assignments_current_team_id_fkey'
    AND table_name = 'pick_assignments'
  ) THEN
    ALTER TABLE public.pick_assignments
      ADD CONSTRAINT pick_assignments_current_team_id_fkey
      FOREIGN KEY (current_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK: pick_assignments.current_team_id → teams.id';
  END IF;
END $$;

-- ============================================================
-- Step 4: Ensure RLS is disabled (matching 00004_disable_rls.sql)
-- ============================================================
ALTER TABLE public.rookie_draft_picks DISABLE ROW LEVEL SECURITY;

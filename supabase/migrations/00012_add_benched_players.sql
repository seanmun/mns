-- ============================================================
-- Migration 00012: Add benched_players column
-- ============================================================
-- Tracks which active roster players are benched.
-- Anyone in active_roster but NOT in benched_players is a starter.
-- Allows 0–13 players to be benched independently.

ALTER TABLE public.regular_season_rosters
  ADD COLUMN IF NOT EXISTS benched_players text[] NOT NULL DEFAULT '{}';

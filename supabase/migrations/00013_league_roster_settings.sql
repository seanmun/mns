-- ============================================================
-- Migration 00013: League roster settings
-- ============================================================
-- Adds configurable roster slot limits per league.
-- Defaults: 13 active, 10 starters, 2 IR.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS roster jsonb NOT NULL
  DEFAULT '{"maxActive": 13, "maxStarters": 10, "maxIR": 2}'::jsonb;

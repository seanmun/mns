-- ============================================================
-- Migration 00020: Add sport column to prospects table
-- ============================================================

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'nba';

CREATE INDEX IF NOT EXISTS idx_prospects_sport ON public.prospects (sport);

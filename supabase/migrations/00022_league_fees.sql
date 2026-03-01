-- ============================================================
-- Migration 00022: League fee settings
-- Adds configurable fee structure per league (buy-in, penalties)
-- ============================================================

ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS fees jsonb;

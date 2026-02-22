-- Add scoring_mode to leagues
-- 'matchup_record' = 1 W or L per week (traditional H2H)
-- 'category_record' = cumulative category W-L-T (e.g., 7-2 week = +7W +2L)
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'category_record'
  CHECK (scoring_mode IN ('matchup_record', 'category_record'));

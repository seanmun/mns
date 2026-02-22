-- Allow null pick_in_round and overall_pick for rookie draft picks
-- Some Firestore docs don't have these fields
ALTER TABLE public.rookie_draft_picks ALTER COLUMN pick_in_round DROP NOT NULL;
ALTER TABLE public.rookie_draft_picks ALTER COLUMN overall_pick DROP NOT NULL;

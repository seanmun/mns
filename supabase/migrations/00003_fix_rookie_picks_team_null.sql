-- Allow null team_id for rookie draft picks (unassigned picks)
ALTER TABLE public.rookie_draft_picks ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.rookie_draft_picks DROP CONSTRAINT IF EXISTS rookie_draft_picks_team_id_fkey;
ALTER TABLE public.rookie_draft_picks ADD CONSTRAINT rookie_draft_picks_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

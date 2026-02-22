-- ============================================================
-- Migration 00009: Trade Proposals (Trade Machine)
-- ============================================================
-- Supports multi-team trade proposals with per-team approval.
-- A trade executes automatically when ALL involved teams accept.

-- ============================================================
-- Table: trade_proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trade_proposals (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_year integer NOT NULL,

  -- Proposer info
  proposed_by_team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  proposed_by_email text NOT NULL,

  -- Lifecycle
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired', 'executed')),

  -- The trade payload: array of asset movements
  -- Each element: { type, id, displayName, salary, fromTeamId, fromTeamName, toTeamId, toTeamName }
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Teams involved (team IDs array, derived from assets for fast querying)
  involved_team_ids text[] NOT NULL DEFAULT '{}',

  -- Optional proposer note/message
  note text,

  -- Expiration (48 hours from creation by default)
  expires_at timestamptz,

  -- Execution metadata (set when trade is executed)
  executed_at timestamptz,
  executed_by text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trade_proposals_league ON public.trade_proposals(league_id);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_status ON public.trade_proposals(status);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_involved ON public.trade_proposals USING gin(involved_team_ids);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_proposed_by ON public.trade_proposals(proposed_by_team_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.trade_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Table: trade_proposal_responses
-- ============================================================
-- One row per team per proposal. The proposing team auto-accepts.
CREATE TABLE IF NOT EXISTS public.trade_proposal_responses (
  id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  team_id text NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_name text NOT NULL,

  -- Response
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  responded_by text,
  responded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(proposal_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_responses_proposal ON public.trade_proposal_responses(proposal_id);
CREATE INDEX IF NOT EXISTS idx_trade_responses_team ON public.trade_proposal_responses(team_id);
CREATE INDEX IF NOT EXISTS idx_trade_responses_status ON public.trade_proposal_responses(status);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.trade_proposal_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Disable RLS (matching 00004_disable_rls.sql pattern)
ALTER TABLE public.trade_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_proposal_responses DISABLE ROW LEVEL SECURITY;

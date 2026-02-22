-- MNS (Money Never Sleeps) — Supabase Schema
-- Maps all Firestore collections to PostgreSQL tables
-- Designed for multi-tenant keeper league management
--
-- Run this in the Supabase SQL Editor for project: pglqtbeanpqpzxuiynot

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- LEAGUES
-- ============================================================
create table public.leagues (
  id text primary key,
  name text not null,
  season_year integer not null,
  deadlines jsonb not null default '{}'::jsonb,
  cap jsonb not null default '{}'::jsonb,
  keepers_locked boolean not null default false,
  draft_status text check (draft_status in ('setup', 'in_progress', 'paused', 'completed')),
  season_status text check (season_status in ('pre_season', 'active', 'completed')),
  season_started_at timestamptz,
  season_started_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leagues enable row level security;

create policy "Authenticated users can read leagues"
  on public.leagues for select using (auth.role() = 'authenticated');

create policy "Admins can insert leagues"
  on public.leagues for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update leagues"
  on public.leagues for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete leagues"
  on public.leagues for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- TEAMS
-- ============================================================
create table public.teams (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  name text not null,
  abbrev text not null,
  owners text[] not null default '{}',
  owner_names text[] default '{}',
  telegram_username text,
  cap_adjustments jsonb not null default '{"tradeDelta": 0}'::jsonb,
  settings jsonb not null default '{"maxKeepers": 8}'::jsonb,
  banners integer[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;

create index idx_teams_league_id on public.teams(league_id);
create index idx_teams_owners on public.teams using gin(owners);

create policy "Authenticated users can read teams"
  on public.teams for select using (auth.role() = 'authenticated');

create policy "Admins can insert teams"
  on public.teams for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update teams"
  on public.teams for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Team owners can update their team"
  on public.teams for update using (
    (select email from public.profiles where id = auth.uid()) = any(owners)
  );

create policy "Admins can delete teams"
  on public.teams for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- PLAYERS
-- ============================================================
create table public.players (
  id text primary key,
  fantrax_id text unique not null,
  name text not null,
  position text not null,
  salary bigint not null default 0,
  nba_team text not null default '',
  league_id text references public.leagues(id) on delete cascade,
  team_id text references public.teams(id) on delete set null,
  on_ir boolean not null default false,
  is_rookie boolean not null default false,
  is_international_stash boolean not null default false,
  int_eligible boolean not null default false,
  rookie_draft_info jsonb,
  keeper_prior_year_round integer,
  keeper_derived_base_round integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;

create index idx_players_league_id on public.players(league_id);
create index idx_players_team_id on public.players(team_id);
create index idx_players_fantrax_id on public.players(fantrax_id);

create policy "Authenticated users can read players"
  on public.players for select using (auth.role() = 'authenticated');

create policy "Admins can insert players"
  on public.players for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update players"
  on public.players for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete players"
  on public.players for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- ROSTERS (keeper decisions per team per season)
-- ============================================================
create table public.rosters (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  season_year integer not null,
  entries jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'adminLocked')),
  saved_scenarios jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, team_id, season_year)
);

alter table public.rosters enable row level security;

create index idx_rosters_league_id on public.rosters(league_id);
create index idx_rosters_team_id on public.rosters(team_id);

create policy "Authenticated users can read rosters"
  on public.rosters for select using (auth.role() = 'authenticated');

create policy "Team owners can insert their roster"
  on public.rosters for insert with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Team owners can update their roster (if not locked)"
  on public.rosters for update using (
    status != 'adminLocked'
    and exists (
      select 1 from public.teams t
      where t.id = team_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Admins can insert rosters"
  on public.rosters for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update rosters"
  on public.rosters for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete rosters"
  on public.rosters for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- DRAFTS
-- ============================================================
create table public.drafts (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  status text not null default 'setup' check (status in ('setup', 'in_progress', 'paused', 'completed')),
  draft_order text[] not null default '{}',
  current_pick jsonb,
  picks jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{"allowAdminOverride": true, "isTestDraft": false}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (league_id, season_year)
);

alter table public.drafts enable row level security;

create index idx_drafts_league_id on public.drafts(league_id);

create policy "Authenticated users can read drafts"
  on public.drafts for select using (auth.role() = 'authenticated');

create policy "Authenticated users can update drafts"
  on public.drafts for update using (auth.role() = 'authenticated');

create policy "Admins can insert drafts"
  on public.drafts for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete drafts"
  on public.drafts for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- PICK ASSIGNMENTS (independent, tradeable draft picks)
-- ============================================================
create table public.pick_assignments (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  round integer not null,
  pick_in_round integer not null,
  overall_pick integer not null,
  current_team_id text not null references public.teams(id) on delete cascade,
  original_team_id text not null references public.teams(id) on delete cascade,
  original_team_name text not null,
  original_team_abbrev text not null,
  player_id text,
  player_name text,
  is_keeper_slot boolean not null default false,
  picked_at timestamptz,
  picked_by text,
  was_traded boolean not null default false,
  trade_history jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pick_assignments enable row level security;

create index idx_pick_assignments_league_id on public.pick_assignments(league_id);
create index idx_pick_assignments_current_team on public.pick_assignments(current_team_id);

create policy "Authenticated users can read pick assignments"
  on public.pick_assignments for select using (auth.role() = 'authenticated');

create policy "Authenticated users can update pick assignments"
  on public.pick_assignments for update using (auth.role() = 'authenticated');

create policy "Admins can insert pick assignments"
  on public.pick_assignments for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete pick assignments"
  on public.pick_assignments for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- ROOKIE DRAFT PICKS
-- ============================================================
create table public.rookie_draft_picks (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  round integer not null,
  pick_in_round integer not null,
  overall_pick integer not null,
  team_id text not null references public.teams(id) on delete cascade,
  player_id text,
  player_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rookie_draft_picks enable row level security;

create index idx_rookie_draft_picks_league on public.rookie_draft_picks(league_id);

create policy "Authenticated users can read rookie picks"
  on public.rookie_draft_picks for select using (auth.role() = 'authenticated');

create policy "Admins can manage rookie picks"
  on public.rookie_draft_picks for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- DRAFT HISTORY (archived completed drafts)
-- ============================================================
create table public.draft_history (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  picks jsonb not null default '[]'::jsonb,
  keepers jsonb not null default '[]'::jsonb,
  redshirt_players jsonb not null default '[]'::jsonb,
  international_players jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  completed_by text not null,
  created_at timestamptz not null default now(),
  unique (league_id, season_year)
);

alter table public.draft_history enable row level security;

create index idx_draft_history_league on public.draft_history(league_id);

create policy "Authenticated users can read draft history"
  on public.draft_history for select using (auth.role() = 'authenticated');

create policy "Admins can manage draft history"
  on public.draft_history for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- PROJECTED STATS
-- ============================================================
create table public.projected_stats (
  fantrax_id text primary key,
  name text not null,
  nba_team text not null default '',
  position text not null default '',
  rk_ov integer,
  age integer,
  salary bigint,
  score numeric(8,2),
  adp numeric(8,2),
  fg_percent numeric(5,3),
  three_point_made numeric(6,2),
  ft_percent numeric(5,3),
  points numeric(6,2),
  rebounds numeric(6,2),
  assists numeric(6,2),
  steals numeric(6,2),
  blocks numeric(6,2),
  assist_to_turnover numeric(6,2),
  salary_score numeric(8,2),
  season_year text not null default '2025-26',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projected_stats enable row level security;

create policy "Authenticated users can read projected stats"
  on public.projected_stats for select using (auth.role() = 'authenticated');

create policy "Admins can manage projected stats"
  on public.projected_stats for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- PREVIOUS STATS
-- ============================================================
create table public.previous_stats (
  fantrax_id text primary key,
  name text not null,
  nba_team text not null default '',
  position text not null default '',
  fg_percent numeric(5,3),
  three_point_made numeric(6,2),
  ft_percent numeric(5,3),
  points numeric(6,2),
  rebounds numeric(6,2),
  assists numeric(6,2),
  steals numeric(6,2),
  blocks numeric(6,2),
  assist_to_turnover numeric(6,2),
  season_year text not null default '2024-25',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.previous_stats enable row level security;

create policy "Authenticated users can read previous stats"
  on public.previous_stats for select using (auth.role() = 'authenticated');

create policy "Admins can manage previous stats"
  on public.previous_stats for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- REGULAR SEASON ROSTERS
-- ============================================================
create table public.regular_season_rosters (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  season_year integer not null,
  active_roster text[] not null default '{}',
  ir_slots text[] not null default '{}',
  redshirt_players text[] not null default '{}',
  international_players text[] not null default '{}',
  is_legal_roster boolean not null default true,
  last_updated timestamptz not null default now(),
  updated_by text,
  created_at timestamptz not null default now(),
  unique (league_id, team_id)
);

alter table public.regular_season_rosters enable row level security;

create index idx_reg_season_rosters_league on public.regular_season_rosters(league_id);
create index idx_reg_season_rosters_team on public.regular_season_rosters(team_id);

create policy "Authenticated users can read regular season rosters"
  on public.regular_season_rosters for select using (auth.role() = 'authenticated');

create policy "Team owners can update their regular season roster"
  on public.regular_season_rosters for update using (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Admins can manage regular season rosters"
  on public.regular_season_rosters for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- TEAM FEES
-- ============================================================
create table public.team_fees (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  season_year integer not null,
  franchise_tag_fees numeric not null default 0,
  redshirt_fees numeric not null default 0,
  first_apron_fee numeric not null default 0,
  second_apron_penalty numeric not null default 0,
  unredshirt_fees numeric not null default 0,
  fees_locked boolean not null default false,
  locked_at timestamptz,
  total_fees numeric not null default 0,
  fee_transactions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, team_id, season_year)
);

alter table public.team_fees enable row level security;

create index idx_team_fees_league on public.team_fees(league_id);
create index idx_team_fees_team on public.team_fees(team_id);

create policy "Authenticated users can read team fees"
  on public.team_fees for select using (auth.role() = 'authenticated');

create policy "Admins can manage team fees"
  on public.team_fees for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- KEEPER FEES (locked one-time fees from keeper phase)
-- ============================================================
create table public.keeper_fees (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  season_year integer not null,
  franchise_tag_fees numeric not null default 0,
  redshirt_fees numeric not null default 0,
  franchise_tag_count integer not null default 0,
  redshirt_count integer not null default 0,
  locked_at timestamptz not null,
  locked_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, team_id, season_year)
);

alter table public.keeper_fees enable row level security;

create index idx_keeper_fees_league on public.keeper_fees(league_id);

create policy "Authenticated users can read keeper fees"
  on public.keeper_fees for select using (auth.role() = 'authenticated');

create policy "Admins can manage keeper fees"
  on public.keeper_fees for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- WAGERS (side bets between teams)
-- ============================================================
create table public.wagers (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  proposer_id text not null references public.teams(id) on delete cascade,
  proposer_name text not null,
  opponent_id text not null references public.teams(id) on delete cascade,
  opponent_name text not null,
  description text not null,
  amount numeric not null,
  settlement_date text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'live', 'settled')),
  proposed_at timestamptz not null default now(),
  proposed_by text not null,
  responded_at timestamptz,
  responded_by text,
  settled_at timestamptz,
  winner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wagers enable row level security;

create index idx_wagers_league on public.wagers(league_id);
create index idx_wagers_proposer on public.wagers(proposer_id);
create index idx_wagers_opponent on public.wagers(opponent_id);

create policy "Authenticated users can read wagers"
  on public.wagers for select using (auth.role() = 'authenticated');

create policy "Team owners can propose wagers"
  on public.wagers for insert with check (
    exists (
      select 1 from public.teams t
      where t.id = proposer_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Involved team owners can update wagers"
  on public.wagers for update using (
    exists (
      select 1 from public.teams t
      where (t.id = proposer_id or t.id = opponent_id)
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Admins can manage wagers"
  on public.wagers for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- WATCHLISTS
-- ============================================================
create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  player_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (league_id, team_id)
);

alter table public.watchlists enable row level security;

create index idx_watchlists_league_team on public.watchlists(league_id, team_id);

create policy "Team owners can read their watchlist"
  on public.watchlists for select using (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Team owners can insert their watchlist"
  on public.watchlists for insert with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Team owners can update their watchlist"
  on public.watchlists for update using (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and (select email from public.profiles where id = auth.uid()) = any(t.owners)
    )
  );

create policy "Admins can manage watchlists"
  on public.watchlists for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- PROSPECTS
-- ============================================================
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  rank integer not null,
  player text not null,
  school text not null default '',
  year text not null default '',
  position text not null default '',
  position_rank integer,
  height text,
  weight integer,
  age integer,
  hometown text,
  high_school text,
  draft_year integer,
  draft_projection text,
  scouting_report text,
  strengths text[],
  weaknesses text[],
  player_comparison text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prospects enable row level security;

create policy "Authenticated users can read prospects"
  on public.prospects for select using (auth.role() = 'authenticated');

create policy "Admins can manage prospects"
  on public.prospects for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- PORTFOLIOS (prize pool wallet tracking)
-- ============================================================
create table public.portfolios (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  wallet_address text not null,
  usd_invested numeric not null default 0,
  last_updated timestamptz not null default now(),
  cached_eth_balance numeric,
  cached_usd_value numeric,
  cached_eth_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

create policy "Authenticated users can read portfolios"
  on public.portfolios for select using (auth.role() = 'authenticated');

create policy "Admins can manage portfolios"
  on public.portfolios for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- UPDATED_AT TRIGGER (auto-set updated_at on any update)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to all tables
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.leagues for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.players for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rosters for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.drafts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pick_assignments for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rookie_draft_picks for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.draft_history for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projected_stats for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.previous_stats for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.regular_season_rosters for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.team_fees for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.keeper_fees for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.wagers for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.watchlists for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.prospects for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.portfolios for each row execute function public.set_updated_at();

-- ============================================================
-- REALTIME (enable for tables that need live updates)
-- ============================================================
alter publication supabase_realtime add table public.rosters;
alter publication supabase_realtime add table public.drafts;
alter publication supabase_realtime add table public.pick_assignments;
alter publication supabase_realtime add table public.wagers;
alter publication supabase_realtime add table public.team_fees;
alter publication supabase_realtime add table public.regular_season_rosters;
alter publication supabase_realtime add table public.leagues;
alter publication supabase_realtime add table public.teams;

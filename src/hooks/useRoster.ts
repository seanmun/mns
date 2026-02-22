import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RosterDoc, RosterEntry, Player, Team, League } from '../types';
import { stackKeeperRounds, computeSummary } from '../lib/keeperAlgorithms';

// Map Supabase row → RosterDoc
function mapRoster(row: any): RosterDoc {
  return {
    id: row.id,
    teamId: row.team_id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    entries: row.entries || [],
    summary: row.summary || {},
    status: row.status,
    savedScenarios: row.saved_scenarios || [],
  };
}

// Map Supabase row → Player
function mapPlayer(row: any): Player {
  return {
    id: row.id,
    fantraxId: row.fantrax_id,
    name: row.name,
    position: row.position,
    salary: row.salary,
    nbaTeam: row.nba_team,
    roster: {
      leagueId: row.league_id,
      teamId: row.team_id,
      onIR: row.on_ir,
      isRookie: row.is_rookie,
      isInternationalStash: row.is_international_stash,
      intEligible: row.int_eligible,
      rookieDraftInfo: row.rookie_draft_info || undefined,
    },
    keeper: row.keeper_prior_year_round != null || row.keeper_derived_base_round != null
      ? {
          priorYearRound: row.keeper_prior_year_round || undefined,
          derivedBaseRound: row.keeper_derived_base_round || undefined,
        }
      : undefined,
  };
}

// Map Supabase row → Team
function mapTeam(row: any): Team {
  return {
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    abbrev: row.abbrev,
    owners: row.owners || [],
    ownerNames: row.owner_names || [],
    telegramUsername: row.telegram_username || undefined,
    capAdjustments: row.cap_adjustments || { tradeDelta: 0 },
    settings: row.settings || { maxKeepers: 8 },
    banners: row.banners || [],
  };
}

// Map Supabase row → League
function mapLeague(row: any): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines || {},
    cap: row.cap || {},
    schedule: row.schedule || undefined,
    keepersLocked: row.keepers_locked || false,
    draftStatus: row.draft_status || undefined,
    seasonStatus: row.season_status || undefined,
    seasonStartedAt: row.season_started_at ? new Date(row.season_started_at).getTime() : undefined,
    seasonStartedBy: row.season_started_by || undefined,
    leaguePhase: row.league_phase || 'keeper_season',
    scoringMode: row.scoring_mode || 'category_record',
  };
}

export function useRoster(leagueId: string, teamId: string, seasonYear?: number) {
  const [roster, setRoster] = useState<RosterDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const rosterId = seasonYear ? `${leagueId}_${teamId}_${seasonYear}` : `${leagueId}_${teamId}`;

  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const { data, error: err } = await supabase
          .from('rosters')
          .select('*')
          .eq('id', rosterId)
          .maybeSingle();

        if (err) throw err;

        if (data) {
          const rosterData = mapRoster(data);
          console.log(`[useRoster] Roster ${rosterId} exists. Entries count:`, rosterData.entries?.length || 0);
          console.log(`[useRoster] Roster status:`, rosterData.status);
          setRoster(rosterData);
        } else {
          console.log(`[useRoster] Roster ${rosterId} does NOT exist`);
          setRoster(null);
        }
      } catch (err) {
        console.error('Error fetching roster:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoster();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`roster-${rosterId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rosters',
        filter: `id=eq.${rosterId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setRoster(null);
        } else {
          setRoster(mapRoster(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rosterId, seasonYear]);

  return { roster, loading, error };
}

export function useTeamPlayers(leagueId: string, teamId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const { data, error: err } = await supabase
          .from('players')
          .select('*')
          .eq('league_id', leagueId)
          .eq('team_id', teamId);

        if (err) throw err;

        setPlayers((data || []).map(mapPlayer));
      } catch (err) {
        console.error('Error fetching players:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [leagueId, teamId]);

  return { players, loading, error };
}

export function useTeam(teamId: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const { data, error: err } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .maybeSingle();

        if (err) throw err;

        setTeam(data ? mapTeam(data) : null);
      } catch (err) {
        console.error('Error fetching team:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();

    // Realtime subscription
    const channel = supabase
      .channel(`team-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `id=eq.${teamId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTeam(null);
        } else {
          setTeam(mapTeam(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  return { team, loading, error };
}

export function useLeague(leagueId: string) {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLeague = async () => {
      try {
        const { data, error: err } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .maybeSingle();

        if (err) throw err;

        setLeague(data ? mapLeague(data) : null);
      } catch (err) {
        console.error('Error fetching league:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeague();

    // Realtime subscription
    const channel = supabase
      .channel(`league-${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${leagueId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setLeague(null);
        } else {
          setLeague(mapLeague(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]);

  return { league, loading, error };
}

interface UpdateRosterParams {
  leagueId: string;
  teamId: string;
  entries: RosterEntry[];
  allPlayers: Map<string, Player>;
  tradeDelta: number;
}

// Helper to remove undefined values from an object
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, removeUndefined(v)])
    );
  }
  return obj;
}

export async function updateRoster(params: UpdateRosterParams) {
  const { leagueId, teamId, entries, allPlayers, tradeDelta } = params;
  const rosterId = `${leagueId}_${teamId}`;

  // Apply stacking algorithm
  const { entries: stackedEntries, franchiseTags } = stackKeeperRounds(entries);

  // Compute summary
  const summary = computeSummary({
    entries: stackedEntries,
    allPlayers,
    tradeDelta,
    franchiseTags,
  });

  // Check if roster exists
  const { data: existing } = await supabase
    .from('rosters')
    .select('status')
    .eq('id', rosterId)
    .maybeSingle();

  const updateData = removeUndefined({
    id: rosterId,
    team_id: teamId,
    league_id: leagueId,
    season_year: new Date().getFullYear(),
    entries: stackedEntries,
    summary,
    status: existing?.status || 'draft',
  });

  const { error } = await supabase
    .from('rosters')
    .upsert(updateData, { onConflict: 'id' });

  if (error) throw error;

  return { entries: stackedEntries, summary };
}

interface SaveScenarioParams {
  leagueId: string;
  teamId: string;
  scenarioName: string;
  entries: RosterEntry[];
  summary: any;
  savedBy?: string;
}

export async function saveScenario(params: SaveScenarioParams) {
  const { leagueId, teamId, scenarioName, entries, summary, savedBy } = params;
  const rosterId = `${leagueId}_${teamId}`;

  const { data: rosterData, error: fetchErr } = await supabase
    .from('rosters')
    .select('saved_scenarios')
    .eq('id', rosterId)
    .single();

  if (fetchErr) throw new Error('Roster does not exist');

  const scenarios = rosterData.saved_scenarios || [];

  const newScenario = removeUndefined({
    scenarioId: `scenario_${Date.now()}`,
    name: scenarioName,
    timestamp: Date.now(),
    savedBy,
    entries,
    summary,
  });

  const { error } = await supabase
    .from('rosters')
    .update({ saved_scenarios: [...scenarios, newScenario] })
    .eq('id', rosterId);

  if (error) throw error;

  return newScenario;
}

export async function submitRoster(leagueId: string, teamId: string) {
  const rosterId = `${leagueId}_${teamId}`;

  const { error } = await supabase
    .from('rosters')
    .update({ status: 'submitted' })
    .eq('id', rosterId);

  if (error) throw error;
}

export async function deleteScenario(leagueId: string, teamId: string, scenarioId: string) {
  const rosterId = `${leagueId}_${teamId}`;

  const { data: rosterData, error: fetchErr } = await supabase
    .from('rosters')
    .select('saved_scenarios')
    .eq('id', rosterId)
    .single();

  if (fetchErr) throw new Error('Roster does not exist');

  const scenarios = rosterData.saved_scenarios || [];
  const updatedScenarios = scenarios.filter((s: any) => s.scenarioId !== scenarioId);

  const { error } = await supabase
    .from('rosters')
    .update({ saved_scenarios: updatedScenarios })
    .eq('id', rosterId);

  if (error) throw error;
}

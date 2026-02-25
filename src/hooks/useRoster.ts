import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RosterEntry, Player } from '../types';
import { stackKeeperRounds, computeSummary } from '../lib/keeperAlgorithms';
import { mapRoster, mapPlayer, mapTeam, mapLeague } from '../lib/mappers';

export function useRoster(leagueId: string, teamId: string, seasonYear?: number) {
  const queryClient = useQueryClient();
  const rosterId = seasonYear ? `${leagueId}_${teamId}_${seasonYear}` : `${leagueId}_${teamId}`;

  const { data: roster = null, isLoading: loading, error } = useQuery({
    queryKey: ['roster', rosterId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('rosters')
        .select('*')
        .eq('id', rosterId)
        .maybeSingle();

      if (err) throw err;
      return data ? mapRoster(data) : null;
    },
  });

  // Realtime subscription — update React Query cache
  useEffect(() => {
    const channel = supabase
      .channel(`roster-${rosterId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rosters',
        filter: `id=eq.${rosterId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['roster', rosterId], null);
        } else {
          queryClient.setQueryData(['roster', rosterId], mapRoster(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rosterId, queryClient]);

  return { roster, loading, error: error as Error | null };
}

export function useTeamPlayers(leagueId: string, teamId: string) {
  const { data: players = [], isLoading: loading, error } = useQuery({
    queryKey: ['teamPlayers', leagueId, teamId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('players')
        .select('*')
        .eq('league_id', leagueId)
        .eq('team_id', teamId);

      if (err) throw err;
      return (data || []).map(mapPlayer);
    },
    enabled: !!leagueId && !!teamId,
  });

  return { players, loading, error: error as Error | null };
}

export function useTeam(teamId: string) {
  const queryClient = useQueryClient();

  const { data: team = null, isLoading: loading, error } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();

      if (err) throw err;
      return data ? mapTeam(data) : null;
    },
    enabled: !!teamId,
  });

  // Realtime subscription — update React Query cache
  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`team-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `id=eq.${teamId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['team', teamId], null);
        } else {
          queryClient.setQueryData(['team', teamId], mapTeam(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient]);

  return { team, loading, error: error as Error | null };
}

export function useLeague(leagueId: string) {
  const queryClient = useQueryClient();

  const { data: league = null, isLoading: loading, error } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .maybeSingle();

      if (err) throw err;
      return data ? mapLeague(data) : null;
    },
    enabled: !!leagueId,
  });

  // Realtime subscription — update React Query cache
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`league-${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${leagueId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['league', leagueId], null);
        } else {
          queryClient.setQueryData(['league', leagueId], mapLeague(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, queryClient]);

  return { league, loading, error: error as Error | null };
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

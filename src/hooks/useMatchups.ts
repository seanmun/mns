import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TeamRecord, ScoringMode } from '../types';
import { mapMatchup } from '../lib/mappers';

interface UseMatchupsOptions {
  leagueId?: string;
  seasonYear?: number;
  scoringMode?: ScoringMode;
}

export function useMatchups(options: UseMatchupsOptions) {
  const queryClient = useQueryClient();

  const { data: matchups = [], isLoading: loading, error } = useQuery({
    queryKey: ['matchups', options.leagueId, options.seasonYear],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('league_matchups')
        .select('*')
        .eq('league_id', options.leagueId!)
        .eq('season_year', options.seasonYear!)
        .order('matchup_week', { ascending: true });

      if (err) throw err;
      return (data || []).map(mapMatchup);
    },
    enabled: !!options.leagueId && !!options.seasonYear,
  });

  // Realtime subscription — invalidate on changes
  useEffect(() => {
    if (!options.leagueId || !options.seasonYear) return;

    const channel = supabase
      .channel(`matchups-${options.leagueId}-${options.seasonYear}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'league_matchups',
        filter: `league_id=eq.${options.leagueId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['matchups', options.leagueId, options.seasonYear] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.leagueId, options.seasonYear, queryClient]);

  const scoringMode = options.scoringMode || 'category_record';

  // Derive W-L-T records from completed matchups
  const records = useMemo(() => {
    const map = new Map<string, TeamRecord>();

    for (const m of matchups) {
      if (m.homeScore === null || m.awayScore === null) continue;

      if (!map.has(m.homeTeamId)) map.set(m.homeTeamId, { wins: 0, losses: 0, ties: 0 });
      if (!map.has(m.awayTeamId)) map.set(m.awayTeamId, { wins: 0, losses: 0, ties: 0 });

      const homeRec = map.get(m.homeTeamId)!;
      const awayRec = map.get(m.awayTeamId)!;

      if (scoringMode === 'category_record') {
        homeRec.wins += m.homeScore;
        homeRec.losses += m.awayScore;
        awayRec.wins += m.awayScore;
        awayRec.losses += m.homeScore;
      } else {
        if (m.homeScore > m.awayScore) {
          homeRec.wins++;
          awayRec.losses++;
        } else if (m.awayScore > m.homeScore) {
          awayRec.wins++;
          homeRec.losses++;
        } else {
          homeRec.ties++;
          awayRec.ties++;
        }
      }
    }

    return map;
  }, [matchups, scoringMode]);

  return { matchups, records, loading, error: error as Error | null };
}

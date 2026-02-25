import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapWager } from '../lib/mappers';
import type { Wager } from '../types';

interface UseWagersOptions {
  leagueId?: string;
  teamId?: string;
  status?: Wager['status'];
  includeAll?: boolean;
}

export function useWagers(options: UseWagersOptions = {}) {
  const queryClient = useQueryClient();
  const { leagueId, teamId, status, includeAll } = options;

  const { data: allWagers = [], isLoading: loading, error } = useQuery({
    queryKey: ['wagers', leagueId, status],
    queryFn: async () => {
      let query = supabase
        .from('wagers')
        .select('*')
        .eq('league_id', leagueId!)
        .order('proposed_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      return (data || []).map(mapWager);
    },
    enabled: !!leagueId,
  });

  // Client-side filtering by team
  const wagers = useMemo(() => {
    if (teamId && !includeAll) {
      return allWagers.filter(
        (wager) => wager.proposerId === teamId || wager.opponentId === teamId
      );
    }
    return allWagers;
  }, [allWagers, teamId, includeAll]);

  // Realtime subscription — invalidate cache on changes
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`wagers-${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wagers',
        filter: `league_id=eq.${leagueId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['wagers', leagueId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, queryClient]);

  return { wagers, loading, error: error as Error | null };
}

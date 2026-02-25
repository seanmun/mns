import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapTeamFees } from '../lib/mappers';

export function useTeamFees(leagueId: string, teamId: string, seasonYear: number) {
  const queryClient = useQueryClient();
  const feesId = `${leagueId}_${teamId}_${seasonYear}`;

  const { data: teamFees = null, isLoading: loading } = useQuery({
    queryKey: ['teamFees', feesId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_fees')
        .select('*')
        .eq('id', feesId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapTeamFees(data) : null;
    },
    enabled: !!leagueId && !!teamId && !!seasonYear,
  });

  // Realtime subscription — update React Query cache
  useEffect(() => {
    if (!leagueId || !teamId || !seasonYear) return;

    const channel = supabase
      .channel(`team-fees-${feesId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_fees',
        filter: `id=eq.${feesId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['teamFees', feesId], null);
        } else {
          queryClient.setQueryData(['teamFees', feesId], mapTeamFees(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [feesId, leagueId, teamId, seasonYear, queryClient]);

  return { teamFees, loading };
}

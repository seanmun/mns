import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapRegularSeasonRoster } from '../lib/mappers';

export function useRegularSeasonRoster(leagueId: string, teamId: string) {
  const queryClient = useQueryClient();
  const rosterId = `${leagueId}_${teamId}`;

  const { data: roster = null, isLoading: loading } = useQuery({
    queryKey: ['regularSeasonRoster', rosterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regular_season_rosters')
        .select('*')
        .eq('id', rosterId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapRegularSeasonRoster(data) : null;
    },
    enabled: !!leagueId && !!teamId,
  });

  // Realtime subscription — update React Query cache
  useEffect(() => {
    if (!leagueId || !teamId) return;

    const channel = supabase
      .channel(`reg-roster-${rosterId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'regular_season_rosters',
        filter: `id=eq.${rosterId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['regularSeasonRoster', rosterId], null);
        } else {
          queryClient.setQueryData(['regularSeasonRoster', rosterId], mapRegularSeasonRoster(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rosterId, leagueId, teamId, queryClient]);

  return { roster, loading };
}

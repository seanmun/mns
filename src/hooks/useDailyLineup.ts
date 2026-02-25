import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapDailyLineup } from '../lib/mappers';

export function useDailyLineup(leagueId: string, teamId: string, gameDate: string) {
  const queryClient = useQueryClient();
  const lineupId = `${leagueId}_${teamId}_${gameDate}`;

  const { data: lineup = null, isLoading: loading } = useQuery({
    queryKey: ['dailyLineup', lineupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_lineups')
        .select('*')
        .eq('id', lineupId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDailyLineup(data) : null;
    },
    enabled: !!leagueId && !!teamId && !!gameDate,
  });

  // Realtime subscription — update React Query cache
  useEffect(() => {
    if (!leagueId || !teamId || !gameDate) return;

    const channel = supabase
      .channel(`daily-lineup-${lineupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_lineups',
        filter: `id=eq.${lineupId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['dailyLineup', lineupId], null);
        } else {
          queryClient.setQueryData(['dailyLineup', lineupId], mapDailyLineup(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lineupId, leagueId, teamId, gameDate, queryClient]);

  return { lineup, loading };
}

export async function saveDailyLineup(
  leagueId: string,
  teamId: string,
  gameDate: string,
  activePlayerIds: string[],
  updatedBy: string
): Promise<void> {
  const lineupId = `${leagueId}_${teamId}_${gameDate}`;

  const { error } = await supabase
    .from('daily_lineups')
    .upsert({
      id: lineupId,
      league_id: leagueId,
      team_id: teamId,
      game_date: gameDate,
      active_player_ids: activePlayerIds,
      updated_by: updatedBy,
    }, { onConflict: 'id' });

  if (error) throw error;
}

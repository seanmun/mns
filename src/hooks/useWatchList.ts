import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapWatchList } from '../lib/mappers';
import type { WatchList } from '../types';

export function useWatchList(_userId: string | undefined, leagueId: string | undefined, teamId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: watchList = null, isLoading: loading } = useQuery({
    queryKey: ['watchList', leagueId, teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlists')
        .select('*')
        .eq('league_id', leagueId!)
        .eq('team_id', teamId!)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return mapWatchList(data);
      }

      // Return empty watchlist (team-based)
      return {
        id: '',
        leagueId: leagueId!,
        teamId: teamId!,
        playerIds: [],
        updatedAt: Date.now(),
      } as WatchList;
    },
    enabled: !!leagueId && !!teamId,
  });

  const setWatchList = (updatedWatchList: WatchList | null) => {
    queryClient.setQueryData(['watchList', leagueId, teamId], updatedWatchList);
  };

  return { watchList, loading, setWatchList };
}

export async function togglePlayerInWatchList(
  _userId: string,
  leagueId: string,
  teamId: string,
  playerFantraxId: string,
  currentWatchList: WatchList | null
): Promise<WatchList> {
  const playerIds = currentWatchList?.playerIds || [];
  const isWatched = playerIds.includes(playerFantraxId);

  const updatedPlayerIds = isWatched
    ? playerIds.filter(id => id !== playerFantraxId)
    : [...playerIds, playerFantraxId];

  const updatedWatchList: WatchList = {
    id: currentWatchList?.id || '',
    leagueId,
    teamId,
    playerIds: updatedPlayerIds,
    updatedAt: Date.now(),
  };

  if (!currentWatchList?.id) {
    // Create new watchlist
    const { data, error } = await supabase
      .from('watchlists')
      .insert({
        league_id: leagueId,
        team_id: teamId,
        player_ids: updatedPlayerIds,
      })
      .select('id')
      .single();

    if (error) throw error;
    updatedWatchList.id = data.id;
  } else {
    // Update existing watchlist
    const { error } = await supabase
      .from('watchlists')
      .update({ player_ids: updatedPlayerIds })
      .eq('id', currentWatchList.id);

    if (error) throw error;
  }

  return updatedWatchList;
}

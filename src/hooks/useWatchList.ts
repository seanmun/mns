import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { WatchList } from '../types';

export function useWatchList(_userId: string | undefined, leagueId: string | undefined, teamId: string | undefined) {
  const [watchList, setWatchList] = useState<WatchList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchList = async () => {
      if (!leagueId || !teamId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('watchlists')
          .select('*')
          .eq('league_id', leagueId)
          .eq('team_id', teamId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setWatchList({
            id: data.id,
            leagueId: data.league_id,
            teamId: data.team_id,
            playerIds: data.player_ids || [],
            updatedAt: new Date(data.updated_at).getTime(),
          });
        } else {
          // Initialize empty watchlist (team-based)
          setWatchList({
            id: '',
            leagueId,
            teamId,
            playerIds: [],
            updatedAt: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchList();
  }, [leagueId, teamId]);

  return { watchList, loading, setWatchList };
}

export async function togglePlayerInWatchList(
  _userId: string,
  leagueId: string,
  teamId: string,
  playerFantraxId: string,
  currentWatchList: WatchList | null
): Promise<WatchList> {
  try {
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
  } catch (error) {
    console.error('Error toggling player in watchlist:', error);
    throw error;
  }
}

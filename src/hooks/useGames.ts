import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapNBAGame } from '../lib/mappers';
import type { PlayerGameInfo } from '../types';

export function useGames(seasonYear: number, gameDate: string) {
  const { data: games = [], isLoading: loading } = useQuery({
    queryKey: ['games', seasonYear, gameDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('season_year', seasonYear)
        .eq('game_date', gameDate);

      if (error) throw error;
      return (data || []).map(mapNBAGame);
    },
    enabled: !!seasonYear && !!gameDate,
  });

  // Map NBA team abbreviation → game info for that date
  const teamGameMap = useMemo(() => {
    const map = new Map<string, PlayerGameInfo>();
    for (const game of games) {
      map.set(game.awayTeam, {
        opponent: game.homeTeam,
        isHome: false,
        isCupGame: game.isCupGame,
      });
      map.set(game.homeTeam, {
        opponent: game.awayTeam,
        isHome: true,
        isCupGame: game.isCupGame,
      });
    }
    return map;
  }, [games]);

  return { games, teamGameMap, loading };
}

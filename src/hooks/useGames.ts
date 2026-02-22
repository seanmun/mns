import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { NBAGame, PlayerGameInfo } from '../types';

function mapGame(row: any): NBAGame {
  return {
    id: row.id,
    seasonYear: row.season_year,
    gameDate: row.game_date,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    isCupGame: row.is_cup_game || false,
    notes: row.notes || null,
  };
}

export function useGames(seasonYear: number, gameDate: string) {
  const [games, setGames] = useState<NBAGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonYear || !gameDate) {
      setLoading(false);
      return;
    }

    const fetchGames = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('season_year', seasonYear)
          .eq('game_date', gameDate);

        if (error) throw error;
        setGames((data || []).map(mapGame));
      } catch (err) {
        console.error('Error fetching games for date:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [seasonYear, gameDate]);

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

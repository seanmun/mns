import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DailyLineup } from '../types';

function mapDailyLineup(row: any): DailyLineup {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    gameDate: row.game_date,
    activePlayerIds: row.active_player_ids || [],
    updatedAt: new Date(row.updated_at).getTime(),
    updatedBy: row.updated_by || '',
  };
}

export function useDailyLineup(leagueId: string, teamId: string, gameDate: string) {
  const [lineup, setLineup] = useState<DailyLineup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !teamId || !gameDate) {
      setLoading(false);
      return;
    }

    const lineupId = `${leagueId}_${teamId}_${gameDate}`;

    const fetchLineup = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('daily_lineups')
          .select('*')
          .eq('id', lineupId)
          .maybeSingle();

        if (error) throw error;
        setLineup(data ? mapDailyLineup(data) : null);
      } catch (err) {
        console.error('Error fetching daily lineup:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLineup();

    // Realtime subscription
    const channel = supabase
      .channel(`daily-lineup-${lineupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_lineups',
        filter: `id=eq.${lineupId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setLineup(null);
        } else {
          setLineup(mapDailyLineup(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, teamId, gameDate]);

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

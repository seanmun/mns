import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PreviousStats } from '../types';

export function usePreviousStats() {
  const [previousStats, setPreviousStats] = useState<Map<string, PreviousStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPreviousStats = async () => {
      try {
        const { data, error: err } = await supabase
          .from('previous_stats')
          .select('*');

        if (err) throw err;

        const statsMap = new Map<string, PreviousStats>();
        (data || []).forEach((row: any) => {
          statsMap.set(row.fantrax_id, {
            fantraxId: row.fantrax_id,
            name: row.name,
            nbaTeam: row.nba_team,
            position: row.position,
            fgPercent: Number(row.fg_percent) || 0,
            threePointMade: Number(row.three_point_made) || 0,
            ftPercent: Number(row.ft_percent) || 0,
            points: Number(row.points) || 0,
            rebounds: Number(row.rebounds) || 0,
            assists: Number(row.assists) || 0,
            steals: Number(row.steals) || 0,
            blocks: Number(row.blocks) || 0,
            assistToTurnover: Number(row.assist_to_turnover) || 0,
            seasonYear: row.season_year,
          });
        });

        setPreviousStats(statsMap);
      } catch (err) {
        console.error('Error fetching previous stats:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviousStats();
  }, []);

  return { previousStats, loading, error };
}

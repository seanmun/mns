import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ProjectedStats } from '../types';

export function useProjectedStats() {
  const [projectedStats, setProjectedStats] = useState<Map<string, ProjectedStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProjectedStats = async () => {
      try {
        const { data, error: err } = await supabase
          .from('projected_stats')
          .select('*');

        if (err) throw err;

        const statsMap = new Map<string, ProjectedStats>();
        (data || []).forEach((row: any) => {
          statsMap.set(row.fantrax_id, {
            fantraxId: row.fantrax_id,
            name: row.name,
            nbaTeam: row.nba_team,
            position: row.position,
            rkOv: Number(row.rk_ov) || 0,
            age: Number(row.age) || 0,
            salary: Number(row.salary) || 0,
            score: Number(row.score) || 0,
            adp: Number(row.adp) || 0,
            fgPercent: Number(row.fg_percent) || 0,
            threePointMade: Number(row.three_point_made) || 0,
            ftPercent: Number(row.ft_percent) || 0,
            points: Number(row.points) || 0,
            rebounds: Number(row.rebounds) || 0,
            assists: Number(row.assists) || 0,
            steals: Number(row.steals) || 0,
            blocks: Number(row.blocks) || 0,
            assistToTurnover: Number(row.assist_to_turnover) || 0,
            salaryScore: Number(row.salary_score) || 0,
            seasonYear: row.season_year,
          });
        });

        setProjectedStats(statsMap);
      } catch (err) {
        console.error('Error fetching projected stats:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectedStats();
  }, []);

  return { projectedStats, loading, error };
}

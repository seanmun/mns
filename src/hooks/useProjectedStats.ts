import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapProjectedStats } from '../lib/mappers';
import type { ProjectedStats } from '../types';

export function useProjectedStats(seasonYear?: string) {
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['projectedStats', seasonYear],
    queryFn: async () => {
      let query = supabase.from('projected_stats').select('*');
      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapProjectedStats);
    },
  });

  const projectedStats = useMemo(() => {
    const map = new Map<string, ProjectedStats>();
    for (const stat of data || []) {
      map.set(stat.fantraxId, stat);
    }
    return map;
  }, [data]);

  return { projectedStats, loading, error: error as Error | null };
}

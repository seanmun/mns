import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapProjectedStats } from '../lib/mappers';
import type { ProjectedStats } from '../types';

export function useProjectedStats(seasonYear?: string) {
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['projectedStats', seasonYear],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: any[] = [];
      let from = 0;
      while (true) {
        let query = supabase.from('projected_stats').select('*').range(from, from + PAGE_SIZE - 1);
        if (seasonYear) {
          query = query.eq('season_year', seasonYear);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all.map(mapProjectedStats);
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

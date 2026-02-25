import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapPreviousStats } from '../lib/mappers';
import type { PreviousStats } from '../types';

export function usePreviousStats(seasonYear?: string) {
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['previousStats', seasonYear],
    queryFn: async () => {
      let query = supabase.from('previous_stats').select('*');
      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapPreviousStats);
    },
  });

  const previousStats = useMemo(() => {
    const map = new Map<string, PreviousStats>();
    for (const stat of data || []) {
      map.set(stat.fantraxId, stat);
    }
    return map;
  }, [data]);

  return { previousStats, loading, error: error as Error | null };
}

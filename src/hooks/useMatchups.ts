import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Matchup, TeamRecord, ScoringMode } from '../types';

function mapMatchup(row: any): Matchup {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    matchupWeek: row.matchup_week,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score != null ? Number(row.home_score) : null,
    awayScore: row.away_score != null ? Number(row.away_score) : null,
  };
}

interface UseMatchupsOptions {
  leagueId?: string;
  seasonYear?: number;
  scoringMode?: ScoringMode;
}

export function useMatchups(options: UseMatchupsOptions) {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options.leagueId || !options.seasonYear) {
      setLoading(false);
      return;
    }

    const fetchMatchups = async () => {
      try {
        const { data, error: err } = await supabase
          .from('league_matchups')
          .select('*')
          .eq('league_id', options.leagueId!)
          .eq('season_year', options.seasonYear!)
          .order('matchup_week', { ascending: true });

        if (err) throw err;
        setMatchups((data || []).map(mapMatchup));
      } catch (err) {
        console.error('Error fetching matchups:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatchups();

    // Realtime subscription
    const channel = supabase
      .channel(`matchups-${options.leagueId}-${options.seasonYear}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'league_matchups',
        filter: `league_id=eq.${options.leagueId}`,
      }, () => {
        fetchMatchups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.leagueId, options.seasonYear]);

  const scoringMode = options.scoringMode || 'category_record';

  // Derive W-L-T records from completed matchups
  const records = useMemo(() => {
    const map = new Map<string, TeamRecord>();

    for (const m of matchups) {
      if (m.homeScore === null || m.awayScore === null) continue;

      if (!map.has(m.homeTeamId)) map.set(m.homeTeamId, { wins: 0, losses: 0, ties: 0 });
      if (!map.has(m.awayTeamId)) map.set(m.awayTeamId, { wins: 0, losses: 0, ties: 0 });

      const homeRec = map.get(m.homeTeamId)!;
      const awayRec = map.get(m.awayTeamId)!;

      if (scoringMode === 'category_record') {
        // Category record: scores ARE the category wins (e.g., 7-2 = +7W +2L)
        homeRec.wins += m.homeScore;
        homeRec.losses += m.awayScore;
        awayRec.wins += m.awayScore;
        awayRec.losses += m.homeScore;
      } else {
        // Matchup record: 1 W or L per week based on who won
        if (m.homeScore > m.awayScore) {
          homeRec.wins++;
          awayRec.losses++;
        } else if (m.awayScore > m.homeScore) {
          awayRec.wins++;
          homeRec.losses++;
        } else {
          homeRec.ties++;
          awayRec.ties++;
        }
      }
    }

    return map;
  }, [matchups, scoringMode]);

  return { matchups, records, loading, error };
}

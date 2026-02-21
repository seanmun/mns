import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Wager } from '../types';

function mapWager(row: any): Wager {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    proposerId: row.proposer_id,
    proposerName: row.proposer_name,
    opponentId: row.opponent_id,
    opponentName: row.opponent_name,
    description: row.description,
    amount: Number(row.amount),
    settlementDate: row.settlement_date,
    status: row.status,
    proposedAt: new Date(row.proposed_at).getTime(),
    proposedBy: row.proposed_by,
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
    respondedBy: row.responded_by || undefined,
    settledAt: row.settled_at ? new Date(row.settled_at).getTime() : undefined,
    winnerId: row.winner_id || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

interface UseWagersOptions {
  leagueId?: string;
  teamId?: string;
  status?: Wager['status'];
  includeAll?: boolean;
}

export function useWagers(options: UseWagersOptions = {}) {
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options.leagueId) {
      setLoading(false);
      return;
    }

    const fetchWagers = async () => {
      try {
        let query = supabase
          .from('wagers')
          .select('*')
          .eq('league_id', options.leagueId!)
          .order('proposed_at', { ascending: false });

        if (options.status) {
          query = query.eq('status', options.status);
        }

        const { data, error: err } = await query;

        if (err) throw err;

        let wagersData = (data || []).map(mapWager);

        // Client-side filtering by team if needed
        if (options.teamId && !options.includeAll) {
          wagersData = wagersData.filter(
            (wager) =>
              wager.proposerId === options.teamId || wager.opponentId === options.teamId
          );
        }

        setWagers(wagersData);
      } catch (err) {
        console.error('Error fetching wagers:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchWagers();

    // Realtime subscription
    const channel = supabase
      .channel(`wagers-${options.leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wagers',
        filter: `league_id=eq.${options.leagueId}`,
      }, () => {
        // Re-fetch on any change
        fetchWagers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.leagueId, options.teamId, options.status, options.includeAll]);

  return { wagers, loading, error };
}

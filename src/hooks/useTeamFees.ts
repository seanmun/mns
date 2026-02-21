import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TeamFees } from '../types';

function mapTeamFees(row: any): TeamFees {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    seasonYear: row.season_year,
    franchiseTagFees: Number(row.franchise_tag_fees) || 0,
    redshirtFees: Number(row.redshirt_fees) || 0,
    firstApronFee: Number(row.first_apron_fee) || 0,
    secondApronPenalty: Number(row.second_apron_penalty) || 0,
    unredshirtFees: Number(row.unredshirt_fees) || 0,
    feesLocked: row.fees_locked || false,
    lockedAt: row.locked_at ? new Date(row.locked_at).getTime() : undefined,
    totalFees: Number(row.total_fees) || 0,
    feeTransactions: row.fee_transactions || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function useTeamFees(leagueId: string, teamId: string, seasonYear: number) {
  const [teamFees, setTeamFees] = useState<TeamFees | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !teamId || !seasonYear) {
      setLoading(false);
      return;
    }

    const feesId = `${leagueId}_${teamId}_${seasonYear}`;

    const fetchFees = async () => {
      try {
        const { data, error } = await supabase
          .from('team_fees')
          .select('*')
          .eq('id', feesId)
          .maybeSingle();

        if (error) throw error;

        setTeamFees(data ? mapTeamFees(data) : null);
      } catch (err) {
        console.error('Error fetching team fees:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFees();

    // Realtime subscription
    const channel = supabase
      .channel(`team-fees-${feesId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_fees',
        filter: `id=eq.${feesId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTeamFees(null);
        } else {
          setTeamFees(mapTeamFees(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, teamId, seasonYear]);

  return { teamFees, loading };
}

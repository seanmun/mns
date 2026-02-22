import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { RegularSeasonRoster } from '../types';

function mapRegularSeasonRoster(row: any): RegularSeasonRoster {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    seasonYear: row.season_year,
    activeRoster: row.active_roster || [],
    irSlots: row.ir_slots || [],
    redshirtPlayers: row.redshirt_players || [],
    internationalPlayers: row.international_players || [],
    benchedPlayers: row.benched_players || [],
    isLegalRoster: row.is_legal_roster ?? true,
    lastUpdated: new Date(row.updated_at).getTime(),
    updatedBy: row.updated_by || '',
  };
}

export function useRegularSeasonRoster(leagueId: string, teamId: string) {
  const [roster, setRoster] = useState<RegularSeasonRoster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !teamId) {
      setLoading(false);
      return;
    }

    const rosterId = `${leagueId}_${teamId}`;

    const fetchRoster = async () => {
      try {
        const { data, error } = await supabase
          .from('regular_season_rosters')
          .select('*')
          .eq('id', rosterId)
          .maybeSingle();

        if (error) throw error;

        setRoster(data ? mapRegularSeasonRoster(data) : null);
      } catch (err) {
        console.error('Error fetching regular season roster:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoster();

    // Realtime subscription
    const channel = supabase
      .channel(`reg-roster-${rosterId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'regular_season_rosters',
        filter: `id=eq.${rosterId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setRoster(null);
        } else {
          setRoster(mapRegularSeasonRoster(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, teamId]);

  return { roster, loading };
}

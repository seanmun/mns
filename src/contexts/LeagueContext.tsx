import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { League } from '../types';

interface LeagueContextType {
  currentLeagueId: string | null;
  currentLeague: League | null;
  userLeagues: League[];
  loading: boolean;
  setCurrentLeagueId: (leagueId: string) => void;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

// Map Supabase row (snake_case) to League type (camelCase)
function mapLeague(row: any): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines || {},
    cap: row.cap || {},
    keepersLocked: row.keepers_locked || false,
    draftStatus: row.draft_status || undefined,
    seasonStatus: row.season_status || undefined,
    seasonStartedAt: row.season_started_at ? new Date(row.season_started_at).getTime() : undefined,
    seasonStartedBy: row.season_started_by || undefined,
  };
}

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [currentLeagueId, setCurrentLeagueIdState] = useState<string | null>(null);
  const [currentLeague, setCurrentLeague] = useState<League | null>(null);
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's leagues
  useEffect(() => {
    if (!user) {
      setUserLeagues([]);
      setCurrentLeagueIdState(null);
      setCurrentLeague(null);
      setLoading(false);
      return;
    }

    const fetchUserLeagues = async () => {
      try {
        setLoading(true);

        let leagues: League[] = [];

        if (role === 'admin') {
          // Admin sees all leagues
          const { data, error } = await supabase
            .from('leagues')
            .select('*');

          if (error) throw error;
          leagues = (data || []).map(mapLeague);
        } else {
          // Regular user: find leagues where they own a team
          const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('league_id')
            .contains('owners', [user.email]);

          if (teamsError) throw teamsError;

          const leagueIds = [...new Set((teams || []).map(t => t.league_id))];

          if (leagueIds.length > 0) {
            const { data, error } = await supabase
              .from('leagues')
              .select('*')
              .in('id', leagueIds);

            if (error) throw error;
            leagues = (data || []).map(mapLeague);
          }
        }

        setUserLeagues(leagues);

        // Set default league if none selected
        if (!currentLeagueId && leagues.length > 0) {
          const savedLeagueId = localStorage.getItem('currentLeagueId');
          const defaultLeague = leagues.find(l => l.id === savedLeagueId) || leagues[0];
          setCurrentLeagueIdState(defaultLeague.id);
          setCurrentLeague(defaultLeague);
          localStorage.setItem('currentLeagueId', defaultLeague.id);
        }
      } catch (error) {
        console.error('Error fetching user leagues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserLeagues();
  }, [user, role]);

  // Update current league when ID changes
  useEffect(() => {
    if (currentLeagueId && userLeagues.length > 0) {
      const league = userLeagues.find(l => l.id === currentLeagueId);
      setCurrentLeague(league || null);
    }
  }, [currentLeagueId, userLeagues]);

  const setCurrentLeagueId = (leagueId: string) => {
    setCurrentLeagueIdState(leagueId);
    localStorage.setItem('currentLeagueId', leagueId);
    const league = userLeagues.find(l => l.id === leagueId);
    setCurrentLeague(league || null);
  };

  const value = {
    currentLeagueId,
    currentLeague,
    userLeagues,
    loading,
    setCurrentLeagueId,
  };

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
}

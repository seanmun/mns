import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { League } from '../types';
import { mapLeague } from '../lib/mappers';

interface LeagueContextType {
  currentLeagueId: string | null;
  currentLeague: League | null;
  userLeagues: League[];
  loading: boolean;
  setCurrentLeagueId: (leagueId: string) => void;
  refreshLeagues: () => void;
  isLeagueManager: boolean;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [currentLeagueId, setCurrentLeagueIdState] = useState<string | null>(null);
  const [currentLeague, setCurrentLeague] = useState<League | null>(null);
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchVersion, setFetchVersion] = useState(0);

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
          // Regular user: find leagues where they own a team or are commissioner (single parallel fetch)
          const [teamsResult, commResult] = await Promise.all([
            supabase.from('teams').select('league_id').contains('owners', [user.email]),
            supabase.from('leagues').select('*').eq('commissioner_id', user.id),
          ]);

          if (teamsResult.error) throw teamsResult.error;
          if (commResult.error) throw commResult.error;

          const teamLeagueIds = [...new Set((teamsResult.data || []).map(t => t.league_id))];
          const commLeagueIds = (commResult.data || []).map(l => l.id);
          const allLeagueIds = [...new Set([...teamLeagueIds, ...commLeagueIds])];

          if (allLeagueIds.length > 0) {
            const { data, error } = await supabase
              .from('leagues')
              .select('*')
              .in('id', allLeagueIds);

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
  }, [user, role, fetchVersion]);

  // Update current league when ID changes
  useEffect(() => {
    if (currentLeagueId && userLeagues.length > 0) {
      const league = userLeagues.find(l => l.id === currentLeagueId);
      setCurrentLeague(league || null);
    }
  }, [currentLeagueId, userLeagues]);

  const setCurrentLeagueId = useCallback((leagueId: string) => {
    setCurrentLeagueIdState(leagueId);
    localStorage.setItem('currentLeagueId', leagueId);
  }, []);

  const refreshLeagues = useCallback(() => {
    setFetchVersion(v => v + 1);
  }, []);

  const isLeagueManager = useMemo(
    () => !!(user && currentLeague?.commissionerId && user.id === currentLeague.commissionerId),
    [user, currentLeague]
  );

  const value = useMemo(() => ({
    currentLeagueId,
    currentLeague,
    userLeagues,
    loading,
    setCurrentLeagueId,
    refreshLeagues,
    isLeagueManager,
  }), [currentLeagueId, currentLeague, userLeagues, loading, setCurrentLeagueId, refreshLeagues, isLeagueManager]);

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
}

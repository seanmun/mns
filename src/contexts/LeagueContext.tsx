import { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

        // If admin, get all leagues
        if (role === 'admin') {
          const leaguesRef = collection(db, 'leagues');
          const snapshot = await getDocs(leaguesRef);
          const leagues = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as League[];

          setUserLeagues(leagues);

          // Set default league if none selected
          if (!currentLeagueId && leagues.length > 0) {
            const savedLeagueId = localStorage.getItem('currentLeagueId');
            const defaultLeague = leagues.find(l => l.id === savedLeagueId) || leagues[0];
            setCurrentLeagueIdState(defaultLeague.id);
            setCurrentLeague(defaultLeague);
            localStorage.setItem('currentLeagueId', defaultLeague.id);
          }
        } else {
          // For regular users, find leagues where they own a team
          const teamsRef = collection(db, 'teams');
          const teamsQuery = query(teamsRef, where('owners', 'array-contains', user.email));
          const teamsSnapshot = await getDocs(teamsQuery);

          // Get unique league IDs from teams
          const leagueIds = Array.from(new Set(teamsSnapshot.docs.map(doc => doc.data().leagueId)));

          // Fetch league details
          const leaguesRef = collection(db, 'leagues');
          const leaguesSnapshot = await getDocs(leaguesRef);
          const leagues = leaguesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(league => leagueIds.includes(league.id)) as League[];

          setUserLeagues(leagues);

          // Set default league if none selected
          if (!currentLeagueId && leagues.length > 0) {
            const savedLeagueId = localStorage.getItem('currentLeagueId');
            const defaultLeague = leagues.find(l => l.id === savedLeagueId) || leagues[0];
            setCurrentLeagueIdState(defaultLeague.id);
            setCurrentLeague(defaultLeague);
            localStorage.setItem('currentLeagueId', defaultLeague.id);
          }
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

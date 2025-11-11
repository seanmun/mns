import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RegularSeasonRoster } from '../types';

export function useRegularSeasonRoster(leagueId: string, teamId: string) {
  const [roster, setRoster] = useState<RegularSeasonRoster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !teamId) {
      setLoading(false);
      return;
    }

    const rosterId = `${leagueId}_${teamId}`;
    const rosterRef = doc(db, 'regularSeasonRosters', rosterId);

    const unsubscribe = onSnapshot(rosterRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoster({ id: snapshot.id, ...snapshot.data() } as RegularSeasonRoster);
      } else {
        setRoster(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [leagueId, teamId]);

  return { roster, loading };
}

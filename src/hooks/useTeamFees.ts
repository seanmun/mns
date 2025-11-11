import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { TeamFees } from '../types';

export function useTeamFees(leagueId: string, teamId: string, seasonYear: number) {
  const [teamFees, setTeamFees] = useState<TeamFees | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !teamId || !seasonYear) {
      setLoading(false);
      return;
    }

    const feesId = `${leagueId}_${teamId}_${seasonYear}`;
    const feesRef = doc(db, 'teamFees', feesId);

    const unsubscribe = onSnapshot(feesRef, (snapshot) => {
      if (snapshot.exists()) {
        setTeamFees({ id: snapshot.id, ...snapshot.data() } as TeamFees);
      } else {
        setTeamFees(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [leagueId, teamId, seasonYear]);

  return { teamFees, loading };
}

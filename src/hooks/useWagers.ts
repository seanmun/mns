import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Wager } from '../types';

interface UseWagersOptions {
  leagueId?: string;
  teamId?: string;
  status?: Wager['status'];
  includeAll?: boolean; // If true, get all wagers for the league
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

    try {
      const wagersRef = collection(db, 'wagers');
      let q = query(
        wagersRef,
        where('leagueId', '==', options.leagueId),
        orderBy('proposedAt', 'desc')
      );

      // Filter by team if provided (get wagers involving this team)
      if (options.teamId && !options.includeAll) {
        // Note: Firestore doesn't support OR queries directly, so we'll filter client-side
        // Or we could create two queries and merge results
      }

      // Filter by status if provided
      if (options.status) {
        q = query(
          wagersRef,
          where('leagueId', '==', options.leagueId),
          where('status', '==', options.status),
          orderBy('proposedAt', 'desc')
        );
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let wagersData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Wager[];

          // Client-side filtering by team if needed
          if (options.teamId && !options.includeAll) {
            wagersData = wagersData.filter(
              (wager) =>
                wager.proposerId === options.teamId || wager.opponentId === options.teamId
            );
          }

          setWagers(wagersData);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching wagers:', err);
          setError(err as Error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up wagers listener:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [options.leagueId, options.teamId, options.status, options.includeAll]);

  return { wagers, loading, error };
}

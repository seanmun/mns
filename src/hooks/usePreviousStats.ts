import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PreviousStats } from '../types';

export function usePreviousStats() {
  const [previousStats, setPreviousStats] = useState<Map<string, PreviousStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPreviousStats = async () => {
      try {
        const statsRef = collection(db, 'previousStats');
        const snapshot = await getDocs(statsRef);

        const statsMap = new Map<string, PreviousStats>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as PreviousStats;
          statsMap.set(doc.id, data); // doc.id is fantraxId
        });

        setPreviousStats(statsMap);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching previous stats:', err);
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchPreviousStats();
  }, []);

  return { previousStats, loading, error };
}

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ProjectedStats } from '../types';

export function useProjectedStats() {
  const [projectedStats, setProjectedStats] = useState<Map<string, ProjectedStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProjectedStats = async () => {
      try {
        const statsRef = collection(db, 'projectedStats');
        const snapshot = await getDocs(statsRef);

        const statsMap = new Map<string, ProjectedStats>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as ProjectedStats;
          statsMap.set(doc.id, data); // doc.id is fantraxId
        });

        setProjectedStats(statsMap);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching projected stats:', err);
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchProjectedStats();
  }, []);

  return { projectedStats, loading, error };
}

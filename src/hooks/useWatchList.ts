import { useEffect, useState } from 'react';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WatchList } from '../types';

export function useWatchList(_userId: string | undefined, leagueId: string | undefined, teamId: string | undefined) {
  const [watchList, setWatchList] = useState<WatchList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchList = async () => {
      if (!leagueId || !teamId) {
        setLoading(false);
        return;
      }

      try {
        // Query for watchlist by leagueId and teamId only (team-based, not user-based)
        const watchListRef = collection(db, 'watchlists');
        const q = query(
          watchListRef,
          where('leagueId', '==', leagueId),
          where('teamId', '==', teamId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setWatchList({
            id: doc.id,
            ...doc.data(),
          } as WatchList);
        } else {
          // Initialize empty watchlist (team-based)
          setWatchList({
            id: '',
            leagueId,
            teamId,
            playerIds: [],
            updatedAt: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchList();
  }, [leagueId, teamId]);

  return { watchList, loading, setWatchList };
}

export async function togglePlayerInWatchList(
  _userId: string,
  leagueId: string,
  teamId: string,
  playerFantraxId: string,
  currentWatchList: WatchList | null
): Promise<WatchList> {
  try {
    const playerIds = currentWatchList?.playerIds || [];
    const isWatched = playerIds.includes(playerFantraxId);

    const updatedPlayerIds = isWatched
      ? playerIds.filter(id => id !== playerFantraxId)
      : [...playerIds, playerFantraxId];

    const updatedWatchList: WatchList = {
      id: currentWatchList?.id || '',
      leagueId,
      teamId,
      playerIds: updatedPlayerIds,
      updatedAt: Date.now(),
    };

    // If no ID, create new document
    if (!currentWatchList?.id) {
      const watchListRef = collection(db, 'watchlists');
      const docRef = doc(watchListRef);
      await setDoc(docRef, {
        leagueId,
        teamId,
        playerIds: updatedPlayerIds,
        updatedAt: Date.now(),
      });
      updatedWatchList.id = docRef.id;
    } else {
      // Update existing document
      const docRef = doc(db, 'watchlists', currentWatchList.id);
      await setDoc(docRef, {
        leagueId,
        teamId,
        playerIds: updatedPlayerIds,
        updatedAt: Date.now(),
      });
    }

    return updatedWatchList;
  } catch (error) {
    console.error('Error toggling player in watchlist:', error);
    throw error;
  }
}

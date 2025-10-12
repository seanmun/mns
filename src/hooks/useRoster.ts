import { useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RosterDoc, RosterEntry, Player, Team } from '../types';
import { stackKeeperRounds, computeSummary } from '../lib/keeperAlgorithms';

export function useRoster(leagueId: string, teamId: string) {
  const [roster, setRoster] = useState<RosterDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const rosterId = `${leagueId}_${teamId}`;

  useEffect(() => {
    const rosterRef = doc(db, 'rosters', rosterId);

    const unsubscribe = onSnapshot(
      rosterRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRoster({ id: snapshot.id, ...snapshot.data() } as RosterDoc);
        } else {
          setRoster(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching roster:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [rosterId]);

  return { roster, loading, error };
}

export function useTeamPlayers(leagueId: string, teamId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const playersRef = collection(db, 'players');
        const q = query(
          playersRef,
          where('roster.leagueId', '==', leagueId),
          where('roster.teamId', '==', teamId)
        );

        const snapshot = await getDocs(q);
        const playerData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Player[];

        setPlayers(playerData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching players:', err);
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [leagueId, teamId]);

  return { players, loading, error };
}

export function useTeam(teamId: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const teamRef = doc(db, 'teams', teamId);

    const unsubscribe = onSnapshot(
      teamRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setTeam({ id: snapshot.id, ...snapshot.data() } as Team);
        } else {
          setTeam(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching team:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId]);

  return { team, loading, error };
}

interface UpdateRosterParams {
  leagueId: string;
  teamId: string;
  entries: RosterEntry[];
  allPlayers: Map<string, Player>;
  tradeDelta: number;
}

// Helper to remove undefined values from an object
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, removeUndefined(v)])
    );
  }
  return obj;
}

export async function updateRoster(params: UpdateRosterParams) {
  const { leagueId, teamId, entries, allPlayers, tradeDelta } = params;
  const rosterId = `${leagueId}_${teamId}`;

  // Apply stacking algorithm
  const { entries: stackedEntries, franchiseTags } = stackKeeperRounds(entries);

  // Compute summary
  const summary = computeSummary({
    entries: stackedEntries,
    allPlayers,
    tradeDelta,
    franchiseTags,
  });

  // Update Firestore
  const rosterRef = doc(db, 'rosters', rosterId);
  const rosterDoc = await getDoc(rosterRef);

  const updateData = removeUndefined({
    teamId,
    leagueId,
    seasonYear: new Date().getFullYear(),
    entries: stackedEntries,
    summary,
    status: rosterDoc.exists() ? rosterDoc.data().status : 'draft',
  });

  if (rosterDoc.exists()) {
    await updateDoc(rosterRef, updateData);
  } else {
    await setDoc(rosterRef, updateData);
  }

  return { entries: stackedEntries, summary };
}

interface SaveScenarioParams {
  leagueId: string;
  teamId: string;
  scenarioName: string;
  entries: RosterEntry[];
  summary: any;
  savedBy?: string;
}

export async function saveScenario(params: SaveScenarioParams) {
  const { leagueId, teamId, scenarioName, entries, summary, savedBy } = params;
  const rosterId = `${leagueId}_${teamId}`;

  const rosterRef = doc(db, 'rosters', rosterId);
  const rosterDoc = await getDoc(rosterRef);

  if (!rosterDoc.exists()) {
    throw new Error('Roster does not exist');
  }

  const currentData = rosterDoc.data() as RosterDoc;
  const scenarios = currentData.savedScenarios || [];

  const newScenario = removeUndefined({
    scenarioId: `scenario_${Date.now()}`,
    name: scenarioName,
    timestamp: Date.now(),
    savedBy,
    entries,
    summary,
  });

  await updateDoc(rosterRef, {
    savedScenarios: [...scenarios, newScenario],
  });

  return newScenario;
}

export async function submitRoster(leagueId: string, teamId: string) {
  const rosterId = `${leagueId}_${teamId}`;
  const rosterRef = doc(db, 'rosters', rosterId);

  await updateDoc(rosterRef, {
    status: 'submitted',
  });
}

export async function deleteScenario(leagueId: string, teamId: string, scenarioId: string) {
  const rosterId = `${leagueId}_${teamId}`;
  const rosterRef = doc(db, 'rosters', rosterId);
  const rosterDoc = await getDoc(rosterRef);

  if (!rosterDoc.exists()) {
    throw new Error('Roster does not exist');
  }

  const currentData = rosterDoc.data() as RosterDoc;
  const scenarios = currentData.savedScenarios || [];

  const updatedScenarios = scenarios.filter((s) => s.scenarioId !== scenarioId);

  await updateDoc(rosterRef, {
    savedScenarios: updatedScenarios,
  });
}

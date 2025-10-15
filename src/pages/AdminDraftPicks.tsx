import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import type { Team } from '../types';

interface DraftPick {
  id: string;                    // e.g., "mns_1" for pick #1
  pickNumber: number;             // 1-156
  round: number;                  // 1-13
  pickInRound: number;            // 1-12
  originalTeam: string;           // Team ID that originally owned it
  originalTeamName: string;       // "Lakers" (for display)
  currentOwner: string;           // Team ID that currently owns it
  leagueId: string;
  isKeeperSlot: boolean;          // true if this pick is pre-filled with a keeper
}

export function AdminDraftPicks() {
  const { role } = useAuth();
  const { currentLeagueId } = useLeague();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPick, setEditingPick] = useState<DraftPick | null>(null);
  const [newOwner, setNewOwner] = useState('');
  const [showInitModal, setShowInitModal] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>(Array(12).fill(''));

  useEffect(() => {
    if (role !== 'admin' || !currentLeagueId) {
      if (role !== 'admin') navigate('/');
      return;
    }

    loadData();
  }, [role, currentLeagueId, navigate]);

  const loadData = async () => {
    if (!currentLeagueId) return;

    setLoading(true);
    try {
      // Load teams
      const teamsRef = collection(db, 'teams');
      const teamsQuery = query(teamsRef, where('leagueId', '==', currentLeagueId));
      const teamsSnap = await getDocs(teamsQuery);
      const teamsData = teamsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setTeams(teamsData.sort((a, b) => a.name.localeCompare(b.name)));

      // Load draft picks
      const picksRef = collection(db, 'draftPicks');
      const picksQuery = query(picksRef, where('leagueId', '==', currentLeagueId));
      const picksSnap = await getDocs(picksQuery);
      const picksData = picksSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DraftPick[];
      setPicks(picksData.sort((a, b) => a.pickNumber - b.pickNumber));

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePicks = async () => {
    if (!currentLeagueId) return;

    // Validate all slots are filled
    if (draftOrder.some(id => !id)) {
      alert('Please select a team for all 12 draft positions');
      return;
    }

    // Check for duplicates
    const uniqueTeams = new Set(draftOrder);
    if (uniqueTeams.size !== 12) {
      alert('Each team can only be selected once');
      return;
    }

    // Get team objects
    const selectedTeams = draftOrder.map(id => teams.find(t => t.id === id)!);

    const confirmed = window.confirm(
      `Initialize draft picks?\n\n` +
      `This will create 156 picks (12 teams × 13 rounds) in snake order.\n\n` +
      `Draft order:\n${selectedTeams.map((t, i) => `${i + 1}. ${t.name}`).join('\n')}\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setShowInitModal(false);

    try {
      const newPicks: DraftPick[] = [];
      let pickNumber = 1;

      for (let round = 1; round <= 13; round++) {
        // Snake draft: odd rounds go forward, even rounds go backward
        const roundOrder = round % 2 === 1
          ? selectedTeams
          : [...selectedTeams].reverse();

        for (let i = 0; i < roundOrder.length; i++) {
          const team = roundOrder[i];
          const pickId = `${currentLeagueId}_${pickNumber}`;

          const pick: DraftPick = {
            id: pickId,
            pickNumber,
            round,
            pickInRound: i + 1,
            originalTeam: team.id,
            originalTeamName: team.name,
            currentOwner: team.id,
            leagueId: currentLeagueId,
            isKeeperSlot: false, // Will be set when draft is initialized
          };

          await setDoc(doc(db, 'draftPicks', pickId), pick);
          newPicks.push(pick);
          pickNumber++;
        }
      }

      setPicks(newPicks);
      alert(`Successfully created ${newPicks.length} draft picks!`);
    } catch (error) {
      console.error('Error initializing picks:', error);
      alert('Failed to initialize picks');
    }
  };

  const handleDeleteAllPicks = async () => {
    const confirmed = window.confirm(
      `DELETE ALL draft picks?\n\n` +
      `This will delete ${picks.length} picks.\n\n` +
      `This action cannot be undone. Continue?`
    );

    if (!confirmed) return;

    try {
      for (const pick of picks) {
        await deleteDoc(doc(db, 'draftPicks', pick.id));
      }
      setPicks([]);
      alert('All picks deleted successfully');
    } catch (error) {
      console.error('Error deleting picks:', error);
      alert('Failed to delete picks');
    }
  };

  const handleEditPick = (pick: DraftPick) => {
    setEditingPick(pick);
    setNewOwner(pick.currentOwner);
  };

  const handleSaveEdit = async () => {
    if (!editingPick || !newOwner) return;

    try {
      const updatedPick = { ...editingPick, currentOwner: newOwner };
      await setDoc(doc(db, 'draftPicks', editingPick.id), updatedPick);

      setPicks(picks.map(p => p.id === editingPick.id ? updatedPick : p));
      setEditingPick(null);
      setNewOwner('');
      alert('Pick ownership updated!');
    } catch (error) {
      console.error('Error updating pick:', error);
      alert('Failed to update pick');
    }
  };

  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Group picks by round
  const picksByRound: Record<number, DraftPick[]> = {};
  picks.forEach(pick => {
    if (!picksByRound[pick.round]) {
      picksByRound[pick.round] = [];
    }
    picksByRound[pick.round].push(pick);
  });

  // Sort picks within each round by pick number
  Object.keys(picksByRound).forEach(round => {
    picksByRound[Number(round)].sort((a, b) => a.pickNumber - b.pickNumber);
  });

  const rounds = Object.keys(picksByRound).sort((a, b) => Number(a) - Number(b)).map(Number);

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Draft Picks Manager</h1>
          <p className="text-gray-400 mt-2">Manage draft pick ownership and trades (13 rounds, snake format)</p>
        </div>

        {/* Actions */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <div className="flex gap-4">
            {picks.length === 0 ? (
              <button
                onClick={() => setShowInitModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                Initialize All Picks (156 picks)
              </button>
            ) : (
              <>
                <div className="text-white">
                  <div className="text-2xl font-bold">{picks.length}</div>
                  <div className="text-sm text-gray-400">Total Picks</div>
                </div>
                <button
                  onClick={handleDeleteAllPicks}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                >
                  Delete All Picks
                </button>
              </>
            )}
          </div>
        </div>

        {/* Picks by Round */}
        {rounds.map(round => (
          <div key={round} className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Round {round}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {picksByRound[round].map(pick => {
                const ownerTeam = teams.find(t => t.id === pick.currentOwner);
                const isTraded = pick.currentOwner !== pick.originalTeam;

                return (
                  <div
                    key={pick.id}
                    className={`p-4 rounded border ${
                      isTraded
                        ? 'bg-yellow-400/10 border-yellow-400/30'
                        : pick.isKeeperSlot
                        ? 'bg-green-400/10 border-green-400/30'
                        : 'bg-[#0a0a0a] border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-white text-lg">Pick #{pick.pickNumber}</div>
                        <div className="text-xs text-gray-400">
                          {pick.originalTeamName}'s pick
                        </div>
                      </div>
                      {pick.isKeeperSlot && (
                        <span className="text-xs bg-green-400/20 text-green-400 px-2 py-1 rounded">Keeper</span>
                      )}
                    </div>

                    <div className="text-sm text-gray-300 mb-2">
                      Owner: <span className="text-white font-medium">{ownerTeam?.name || 'Unknown'}</span>
                    </div>

                    {isTraded && (
                      <div className="text-xs text-yellow-400 mb-2">Traded</div>
                    )}

                    <button
                      onClick={() => handleEditPick(pick)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Change Owner
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Initialize Modal */}
        {showInitModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-[#121212] rounded-lg border border-gray-700 p-6 max-w-2xl w-full mx-4 my-8">
              <h3 className="text-xl font-bold text-white mb-4">Set Draft Order (Round 1)</h3>
              <p className="text-sm text-gray-400 mb-4">
                Select teams in draft order for Round 1. Snake draft will be applied for subsequent rounds.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6 max-h-96 overflow-y-auto">
                {draftOrder.map((teamId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-white font-semibold w-8">{index + 1}.</span>
                    <select
                      value={teamId}
                      onChange={(e) => {
                        const newOrder = [...draftOrder];
                        newOrder[index] = e.target.value;
                        setDraftOrder(newOrder);
                      }}
                      className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded text-white"
                    >
                      <option value="">Select team...</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowInitModal(false);
                    setDraftOrder(Array(12).fill(''));
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitializePicks}
                  disabled={draftOrder.some(id => !id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Initialize Picks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingPick && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#121212] rounded-lg border border-gray-700 p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Change Pick Ownership</h3>

              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-2">
                  Pick #{editingPick.pickNumber} - Round {editingPick.round} ({editingPick.originalTeamName}'s pick)
                </div>

                <label className="block text-sm font-medium text-white mb-2">
                  New Owner
                </label>
                <select
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded text-white"
                >
                  <option value="">Select team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditingPick(null);
                    setNewOwner('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!newOwner}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import type { Team, Player, RosterDoc } from '../types';

interface RookieDraftPick {
  id: string;
  year: number;
  round: 1 | 2;
  originalTeam: string;
  originalTeamName: string;
  currentOwner: string;
  leagueId: string;
}

interface DraftPick {
  id: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  originalTeam: string;
  originalTeamName: string;
  currentOwner: string;
  leagueId: string;
  isKeeperSlot: boolean;
}

interface TradeAsset {
  type: 'keeper' | 'redshirt' | 'int_stash' | 'rookie_pick' | 'draft_pick';
  id: string;
  displayName: string;
  fromTeam: string;
  toTeam: string;
}

export function AdminTradeManager() {
  const { role } = useAuth();
  const { currentLeagueId, currentLeague } = useLeague();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [rosters, setRosters] = useState<Map<string, RosterDoc>>(new Map());
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [rookiePicks, setRookiePicks] = useState<RookieDraftPick[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeAssets, setTradeAssets] = useState<TradeAsset[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (role !== 'admin' || !currentLeagueId) {
      if (role !== 'admin') navigate('/');
      return;
    }

    loadData();
  }, [role, currentLeagueId, navigate]);

  const loadData = async () => {
    if (!currentLeagueId || !currentLeague) return;

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

      // Load all players
      const playersSnap = await getDocs(collection(db, 'players'));
      const playersMap = new Map<string, Player>();
      playersSnap.docs.forEach((doc) => {
        playersMap.set(doc.id, { id: doc.id, ...doc.data() } as Player);
      });
      setPlayers(playersMap);

      // Load rosters
      const rostersSnap = await getDocs(collection(db, 'rosters'));
      const rostersMap = new Map<string, RosterDoc>();
      for (const team of teamsData) {
        const rosterId = `${currentLeagueId}_${team.id}`;
        const rosterDoc = rostersSnap.docs.find(d => d.id === rosterId);
        if (rosterDoc) {
          rostersMap.set(team.id, {
            id: rosterDoc.id,
            ...rosterDoc.data(),
          } as RosterDoc);
        }
      }
      setRosters(rostersMap);

      // Load rookie picks
      const picksRef = collection(db, 'rookieDraftPicks');
      const picksQuery = query(picksRef, where('leagueId', '==', currentLeagueId));
      const picksSnap = await getDocs(picksQuery);
      const picksData = picksSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RookieDraftPick[];
      setRookiePicks(picksData);

      // Load draft picks
      const draftPicksRef = collection(db, 'draftPicks');
      const draftPicksQuery = query(draftPicksRef, where('leagueId', '==', currentLeagueId));
      const draftPicksSnap = await getDocs(draftPicksQuery);
      const draftPicksData = draftPicksSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DraftPick[];
      setDraftPicks(draftPicksData.sort((a, b) => a.pickNumber - b.pickNumber));

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const addAsset = (type: TradeAsset['type'], id: string, displayName: string, fromTeam: string) => {
    setTradeAssets(prev => [...prev, {
      type,
      id,
      displayName,
      fromTeam,
      toTeam: '', // Will be set by dropdown
    }]);
  };

  const removeAsset = (index: number) => {
    setTradeAssets(prev => prev.filter((_, i) => i !== index));
  };

  const updateAssetDestination = (index: number, toTeam: string) => {
    setTradeAssets(prev => prev.map((asset, i) =>
      i === index ? { ...asset, toTeam } : asset
    ));
  };

  const handleExecuteTrade = async () => {
    // Validate all assets have destinations
    const incompleteAssets = tradeAssets.filter(a => !a.toTeam);
    if (incompleteAssets.length > 0) {
      alert('Please select a destination team for all assets');
      return;
    }

    const confirmed = window.confirm(
      `Execute trade?\n\n` +
      `This will transfer ${tradeAssets.length} assets between teams.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setIsExecuting(true);
    try {
      // Group assets by team
      const updates = new Map<string, {
        keepersToAdd: string[],
        keepersToRemove: string[],
        redshirtsToAdd: string[],
        redshirtsToRemove: string[],
        intStashToAdd: string[],
        intStashToRemove: string[],
        rookiePicksToUpdate: string[],
      }>();

      // Initialize for selected teams
      selectedTeamIds.forEach(teamId => {
        updates.set(teamId, {
          keepersToAdd: [],
          keepersToRemove: [],
          redshirtsToAdd: [],
          redshirtsToRemove: [],
          intStashToAdd: [],
          intStashToRemove: [],
          rookiePicksToUpdate: [],
        });
      });

      // Process each asset
      for (const asset of tradeAssets) {
        const fromUpdates = updates.get(asset.fromTeam);
        const toUpdates = updates.get(asset.toTeam);

        if (!fromUpdates || !toUpdates) continue;

        if (asset.type === 'keeper') {
          fromUpdates.keepersToRemove.push(asset.id);
          toUpdates.keepersToAdd.push(asset.id);
        } else if (asset.type === 'redshirt') {
          fromUpdates.redshirtsToRemove.push(asset.id);
          toUpdates.redshirtsToAdd.push(asset.id);
        } else if (asset.type === 'int_stash') {
          fromUpdates.intStashToRemove.push(asset.id);
          toUpdates.intStashToAdd.push(asset.id);
        } else if (asset.type === 'rookie_pick') {
          fromUpdates.rookiePicksToUpdate.push(asset.id);
        }
      }

      // Apply roster updates
      for (const [teamId, teamUpdates] of updates.entries()) {
        const roster = rosters.get(teamId);
        if (!roster) continue;

        const entries = [...(roster.entries || [])];

        // Remove players
        const toRemove = new Set([
          ...teamUpdates.keepersToRemove,
          ...teamUpdates.redshirtsToRemove,
          ...teamUpdates.intStashToRemove,
        ]);

        const filteredEntries = entries.filter(e => !toRemove.has(e.playerId));

        // Add players
        teamUpdates.keepersToAdd.forEach(playerId => {
          filteredEntries.push({
            playerId,
            decision: 'KEEP',
            baseRound: 13, // Will be recalculated
          });
        });

        teamUpdates.redshirtsToAdd.forEach(playerId => {
          filteredEntries.push({
            playerId,
            decision: 'REDSHIRT',
            baseRound: 13,
          });
        });

        teamUpdates.intStashToAdd.forEach(playerId => {
          filteredEntries.push({
            playerId,
            decision: 'INT_STASH',
            baseRound: 13,
          });
        });

        // Update roster
        const rosterId = `${currentLeagueId}_${teamId}`;
        await updateDoc(doc(db, 'rosters', rosterId), {
          entries: filteredEntries,
        });
      }

      // Update draft pick ownership
      for (const asset of tradeAssets.filter(a => a.type === 'draft_pick')) {
        await updateDoc(doc(db, 'draftPicks', asset.id), {
          currentOwner: asset.toTeam,
        });
      }

      // Update rookie pick ownership
      for (const asset of tradeAssets.filter(a => a.type === 'rookie_pick')) {
        await updateDoc(doc(db, 'rookieDraftPicks', asset.id), {
          currentOwner: asset.toTeam,
        });
      }

      alert('Trade executed successfully!');
      setTradeAssets([]);
      await loadData();

    } catch (error) {
      console.error('Error executing trade:', error);
      alert('Failed to execute trade');
    } finally {
      setIsExecuting(false);
    }
  };

  if (role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Trade Manager</h1>
          <p className="text-gray-400 mt-2">Manage multi-team trades</p>
        </div>

        {/* Step 1: Select Teams */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 1: Select Teams Involved</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => handleTeamToggle(team.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedTeamIds.includes(team.id)
                    ? 'bg-green-400/20 border-green-400'
                    : 'bg-[#0a0a0a] border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="font-semibold text-white">{team.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select Assets */}
        {selectedTeamIds.length >= 2 && (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Step 2: Select Assets to Trade</h2>

            <div className="space-y-6">
              {selectedTeamIds.map(teamId => {
                const team = teams.find(t => t.id === teamId);
                const roster = rosters.get(teamId);
                const teamPicks = rookiePicks.filter(p => p.currentOwner === teamId);
                const teamDraftPicks = draftPicks.filter(p => p.currentOwner === teamId);

                if (!team || !roster) return null;

                const keepers = roster.entries?.filter(e => e.decision === 'KEEP') || [];
                const redshirts = roster.entries?.filter(e => e.decision === 'REDSHIRT') || [];
                const intStash = roster.entries?.filter(e => e.decision === 'INT_STASH') || [];

                return (
                  <div key={teamId} className="bg-[#0a0a0a] rounded-lg p-4">
                    <h3 className="text-lg font-bold text-white mb-3">{team.name}</h3>

                    {/* Keepers */}
                    {keepers.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">Keepers</h4>
                        <div className="space-y-1">
                          {keepers.map(entry => {
                            const player = players.get(entry.playerId);
                            const isSelected = tradeAssets.some(a => a.id === entry.playerId && a.fromTeam === teamId);
                            return (
                              <button
                                key={entry.playerId}
                                onClick={() => {
                                  if (!isSelected) {
                                    addAsset('keeper', entry.playerId, player?.name || 'Unknown', teamId);
                                  }
                                }}
                                disabled={isSelected}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${
                                  isSelected
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#121212] text-white hover:bg-gray-800'
                                }`}
                              >
                                {player?.name || 'Unknown'} - {player?.position}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Redshirts */}
                    {redshirts.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-yellow-400 mb-2">Redshirts</h4>
                        <div className="space-y-1">
                          {redshirts.map(entry => {
                            const player = players.get(entry.playerId);
                            const isSelected = tradeAssets.some(a => a.id === entry.playerId && a.fromTeam === teamId);
                            return (
                              <button
                                key={entry.playerId}
                                onClick={() => {
                                  if (!isSelected) {
                                    addAsset('redshirt', entry.playerId, player?.name || 'Unknown', teamId);
                                  }
                                }}
                                disabled={isSelected}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${
                                  isSelected
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#121212] text-white hover:bg-gray-800'
                                }`}
                              >
                                {player?.name || 'Unknown'} - {player?.position}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Int Stash */}
                    {intStash.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">International Stash</h4>
                        <div className="space-y-1">
                          {intStash.map(entry => {
                            const player = players.get(entry.playerId);
                            const isSelected = tradeAssets.some(a => a.id === entry.playerId && a.fromTeam === teamId);
                            return (
                              <button
                                key={entry.playerId}
                                onClick={() => {
                                  if (!isSelected) {
                                    addAsset('int_stash', entry.playerId, player?.name || 'Unknown', teamId);
                                  }
                                }}
                                disabled={isSelected}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${
                                  isSelected
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#121212] text-white hover:bg-gray-800'
                                }`}
                              >
                                {player?.name || 'Unknown'} - {player?.position}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Draft Picks */}
                    {teamDraftPicks.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-orange-400 mb-2">Draft Picks</h4>
                        <div className="space-y-1">
                          {teamDraftPicks.map(pick => {
                            const isSelected = tradeAssets.some(a => a.id === pick.id && a.fromTeam === teamId);
                            const displayName = `Pick #${pick.pickNumber} - Rd ${pick.round} (${pick.originalTeamName})`;
                            return (
                              <button
                                key={pick.id}
                                onClick={() => {
                                  if (!isSelected) {
                                    addAsset('draft_pick', pick.id, displayName, teamId);
                                  }
                                }}
                                disabled={isSelected || pick.isKeeperSlot}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${
                                  pick.isKeeperSlot
                                    ? 'bg-gray-900 text-gray-600 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#121212] text-white hover:bg-gray-800'
                                }`}
                              >
                                {displayName} {pick.isKeeperSlot && '(Keeper)'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rookie Picks */}
                    {teamPicks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-purple-400 mb-2">Rookie Draft Picks</h4>
                        <div className="space-y-1">
                          {teamPicks.map(pick => {
                            const isSelected = tradeAssets.some(a => a.id === pick.id && a.fromTeam === teamId);
                            const displayName = `${pick.year} Round ${pick.round} (${pick.originalTeamName})`;
                            return (
                              <button
                                key={pick.id}
                                onClick={() => {
                                  if (!isSelected) {
                                    addAsset('rookie_pick', pick.id, displayName, teamId);
                                  }
                                }}
                                disabled={isSelected}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${
                                  isSelected
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#121212] text-white hover:bg-gray-800'
                                }`}
                              >
                                {displayName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Trade Summary */}
        {tradeAssets.length > 0 && (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Step 3: Assign Destinations</h2>
            <div className="space-y-3">
              {tradeAssets.map((asset, index) => {
                const fromTeam = teams.find(t => t.id === asset.fromTeam);
                return (
                  <div key={index} className="bg-[#0a0a0a] p-4 rounded-lg flex items-center gap-4">
                    <button
                      onClick={() => removeAsset(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>

                    <div className="flex-1">
                      <div className="text-white font-medium">{asset.displayName}</div>
                      <div className="text-xs text-gray-400">
                        {asset.type.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-400">
                        From: <span className="text-white">{fromTeam?.name}</span>
                      </div>

                      <div className="text-gray-500">→</div>

                      <select
                        value={asset.toTeam}
                        onChange={(e) => updateAssetDestination(index, e.target.value)}
                        className="px-3 py-2 bg-[#121212] border border-gray-700 rounded text-white text-sm"
                      >
                        <option value="">Select team...</option>
                        {selectedTeamIds
                          .filter(id => id !== asset.fromTeam)
                          .map(id => {
                            const team = teams.find(t => t.id === id);
                            return (
                              <option key={id} value={id}>{team?.name}</option>
                            );
                          })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleExecuteTrade}
                disabled={isExecuting || tradeAssets.some(a => !a.toTeam)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isExecuting ? 'Executing Trade...' : 'Execute Trade'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

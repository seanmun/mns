import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import type { Player, Team } from '../types';

export function AdminPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load teams
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const teamsData = teamsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setTeams(teamsData);

      // Load players
      const playersSnap = await getDocs(collection(db, 'players'));
      const playersData = playersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];
      setPlayers(playersData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
  };

  const handleSave = async () => {
    if (!editingPlayer) return;

    try {
      const { id, ...playerData } = editingPlayer;
      await updateDoc(doc(db, 'players', id), playerData);
      alert('Player updated successfully!');
      setEditingPlayer(null);
      await loadData();
    } catch (error: any) {
      console.error('Error updating player:', error);
      alert(`Failed to update player: ${error?.message || 'Unknown error'}`);
    }
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.nbaTeam?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = selectedTeamFilter === 'all' ||
                       selectedTeamFilter === 'free-agent' && !player.roster?.teamId ||
                       player.roster?.teamId === selectedTeamFilter;
    return matchesSearch && matchesTeam;
  });

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
          <button
            onClick={() => navigate('/admin/teams')}
            className="text-green-400 hover:text-green-300 mb-4"
          >
            ← Back to Manage Teams
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Manage Players</h1>
              <p className="text-gray-400 mt-1">
                Edit player information and team assignments
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-[#121212] border border-gray-800 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Search Players
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or NBA team..."
                className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Filter by Team
              </label>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
              >
                <option value="all">All Players</option>
                <option value="free-agent">Free Agents</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Showing {filteredPlayers.length} of {players.length} players
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-[#121212] border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    NBA Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Salary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Fantasy Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredPlayers.map((player) => {
                  const team = teams.find((t) => t.id === player.roster?.teamId);
                  return (
                    <tr key={player.id} className="hover:bg-[#1a1a1a]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="text-xs text-gray-500">{player.fantraxId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {player.position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {player.nbaTeam}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        ${(player.salary / 1_000_000).toFixed(1)}M
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {team ? (
                          <span className="text-green-400">{team.name}</span>
                        ) : (
                          <span className="text-gray-500">Free Agent</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1 flex-wrap">
                          {player.roster?.isRookie && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-400/10 text-blue-400 border border-blue-400/30 text-xs font-semibold rounded">
                              Rookie
                            </span>
                          )}
                          {player.roster?.onIR && (
                            <span className="inline-flex items-center px-2 py-1 bg-red-400/10 text-red-400 border border-red-400/30 text-xs font-semibold rounded">
                              IR
                            </span>
                          )}
                          {player.roster?.isInternationalStash && (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-400/10 text-purple-400 border border-purple-400/30 text-xs font-semibold rounded">
                              Int'l
                            </span>
                          )}
                          {player.keeper?.priorYearRound && (
                            <span className="inline-flex items-center px-2 py-1 bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 text-xs font-semibold rounded">
                              R{player.keeper.priorYearRound}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(player)}
                          className="text-green-400 hover:text-green-300 font-medium text-sm"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-[#121212] border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">Edit Player</h2>
                  <button
                    onClick={() => setEditingPlayer(null)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Player Name
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.name}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, name: e.target.value })
                      }
                      className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                    />
                  </div>

                  {/* Position and NBA Team */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Position
                      </label>
                      <input
                        type="text"
                        value={editingPlayer.position}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, position: e.target.value })
                        }
                        placeholder="e.g., PG, SG,SF"
                        className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        NBA Team
                      </label>
                      <input
                        type="text"
                        value={editingPlayer.nbaTeam || ''}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, nbaTeam: e.target.value })
                        }
                        placeholder="e.g., LAL"
                        className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                      />
                    </div>
                  </div>

                  {/* Salary */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Salary ($M)
                    </label>
                    <input
                      type="number"
                      value={(editingPlayer.salary / 1_000_000).toFixed(2)}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          salary: parseFloat(e.target.value || '0') * 1_000_000,
                        })
                      }
                      step="0.1"
                      className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                    />
                  </div>

                  {/* Fantasy Team */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Fantasy Team
                    </label>
                    <select
                      value={editingPlayer.roster?.teamId || ''}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          roster: {
                            ...editingPlayer.roster!,
                            teamId: e.target.value || null,
                          },
                        })
                      }
                      className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                    >
                      <option value="">Free Agent</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Flags */}
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingPlayer.roster?.onIR || false}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            roster: {
                              ...editingPlayer.roster!,
                              onIR: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-[#0a0a0a] border-gray-800 text-green-400 focus:ring-green-400"
                      />
                      <span className="text-sm text-gray-300">On IR</span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingPlayer.roster?.isRookie || false}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            roster: {
                              ...editingPlayer.roster!,
                              isRookie: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-[#0a0a0a] border-gray-800 text-green-400 focus:ring-green-400"
                      />
                      <span className="text-sm text-gray-300">Rookie</span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingPlayer.roster?.isInternationalStash || false}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            roster: {
                              ...editingPlayer.roster!,
                              isInternationalStash: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-[#0a0a0a] border-gray-800 text-green-400 focus:ring-green-400"
                      />
                      <span className="text-sm text-gray-300">International Stash</span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingPlayer.roster?.intEligible || false}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            roster: {
                              ...editingPlayer.roster!,
                              intEligible: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-[#0a0a0a] border-gray-800 text-green-400 focus:ring-green-400"
                      />
                      <span className="text-sm text-gray-300">Int'l Eligible</span>
                    </label>
                  </div>

                  {/* Prior Year Round */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Prior Year Round (for returning players)
                    </label>
                    <input
                      type="number"
                      value={editingPlayer.keeper?.priorYearRound || ''}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          keeper: {
                            ...editingPlayer.keeper,
                            priorYearRound: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      min="1"
                      max="13"
                      placeholder="Leave blank for new players"
                      className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                    />
                  </div>

                  {/* Rookie Info */}
                  {editingPlayer.roster?.isRookie && (
                    <div className="border border-gray-800 rounded-lg p-4 space-y-4">
                      <h3 className="font-semibold text-white">Rookie Draft Info</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Round
                          </label>
                          <input
                            type="number"
                            value={editingPlayer.roster.rookieDraftInfo?.round || ''}
                            onChange={(e) =>
                              setEditingPlayer({
                                ...editingPlayer,
                                roster: {
                                  ...editingPlayer.roster!,
                                  rookieDraftInfo: {
                                    ...editingPlayer.roster!.rookieDraftInfo,
                                    round: parseInt(e.target.value) as 1 | 2 | 3,
                                    pick: editingPlayer.roster!.rookieDraftInfo?.pick || 1,
                                    redshirtEligible: editingPlayer.roster!.rookieDraftInfo?.redshirtEligible || false,
                                  },
                                },
                              })
                            }
                            min="1"
                            max="3"
                            className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Pick
                          </label>
                          <input
                            type="number"
                            value={editingPlayer.roster.rookieDraftInfo?.pick || ''}
                            onChange={(e) =>
                              setEditingPlayer({
                                ...editingPlayer,
                                roster: {
                                  ...editingPlayer.roster!,
                                  rookieDraftInfo: {
                                    ...editingPlayer.roster!.rookieDraftInfo,
                                    round: editingPlayer.roster!.rookieDraftInfo?.round || 1,
                                    pick: parseInt(e.target.value),
                                    redshirtEligible: editingPlayer.roster!.rookieDraftInfo?.redshirtEligible || false,
                                  },
                                },
                              })
                            }
                            min="1"
                            max="12"
                            className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Redshirt Eligible
                          </label>
                          <input
                            type="checkbox"
                            checked={editingPlayer.roster.rookieDraftInfo?.redshirtEligible || false}
                            onChange={(e) =>
                              setEditingPlayer({
                                ...editingPlayer,
                                roster: {
                                  ...editingPlayer.roster!,
                                  rookieDraftInfo: {
                                    round: editingPlayer.roster!.rookieDraftInfo?.round || 1,
                                    pick: editingPlayer.roster!.rookieDraftInfo?.pick || 1,
                                    redshirtEligible: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="mt-2 rounded bg-[#0a0a0a] border-gray-800 text-green-400 focus:ring-green-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingPlayer(null)}
                    className="px-6 py-2 border border-gray-800 text-gray-300 rounded-lg hover:bg-[#1a1a1a]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import type { Team, League } from '../types';

export function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const navigate = useNavigate();

  // Available championship years
  const championshipYears = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    abbrev: '',
    leagueId: '',
    owners: '',
    ownerNames: '',
    maxKeepers: 8,
    tradeDelta: 0,
    banners: [] as number[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load leagues
      const leaguesSnap = await getDocs(collection(db, 'leagues'));
      const leaguesData = leaguesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as League[];
      setLeagues(leaguesData);

      // Load teams
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const teamsData = teamsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      abbrev: team.abbrev,
      leagueId: team.leagueId,
      owners: team.owners.join(', '),
      ownerNames: team.ownerNames?.join(', ') || '',
      maxKeepers: team.settings.maxKeepers,
      tradeDelta: team.capAdjustments.tradeDelta,
      banners: team.banners || [],
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.abbrev || !formData.leagueId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const ownersArray = formData.owners
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const ownerNamesArray = formData.ownerNames
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      const teamData = {
        name: formData.name,
        abbrev: formData.abbrev,
        leagueId: formData.leagueId,
        owners: ownersArray,
        ownerNames: ownerNamesArray,
        capAdjustments: {
          tradeDelta: formData.tradeDelta,
        },
        settings: {
          maxKeepers: formData.maxKeepers,
        },
        banners: formData.banners,
      };

      if (editingTeam) {
        // Update existing team
        await updateDoc(doc(db, 'teams', editingTeam.id), teamData);
        alert('Team updated successfully!');
      } else {
        // Create new team
        await addDoc(collection(db, 'teams'), teamData);
        alert('Team created successfully!');
      }

      // Reset form
      setFormData({
        name: '',
        abbrev: '',
        leagueId: '',
        owners: '',
        ownerNames: '',
        maxKeepers: 8,
        tradeDelta: 0,
        banners: [],
      });
      setShowForm(false);
      setEditingTeam(null);

      // Reload teams
      loadData();
    } catch (error: any) {
      console.error('Error saving team:', error);
      alert(`Failed to save team: ${error?.message || 'Unknown error'}`);
    }
  };

  const toggleBanner = (year: number) => {
    setFormData({
      ...formData,
      banners: formData.banners.includes(year)
        ? formData.banners.filter(y => y !== year)
        : [...formData.banners, year].sort((a, b) => b - a),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const unlockTeamKeepers = async (team: Team) => {
    const confirmed = window.confirm(
      `Unlock keepers for ${team.name}?\n\nThis will:\n1. Set keepersSubmitted to false\n2. Allow the owner to modify their keeper selections again\n\nContinue?`
    );

    if (!confirmed) return;

    try {
      // Update team's keepersSubmitted flag
      await updateDoc(doc(db, 'teams', team.id), {
        keepersSubmitted: false,
      });

      alert(`Keepers unlocked for ${team.name}!`);

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error unlocking team keepers:', error);
      alert('Failed to unlock team keepers');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to My Teams
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Teams</h1>
              <p className="text-gray-500 mt-1">
                Create and manage teams and owners
              </p>
            </div>
            <button
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  setEditingTeam(null);
                  setFormData({
                    name: '',
                    abbrev: '',
                    leagueId: '',
                    owners: '',
                    ownerNames: '',
                    maxKeepers: 8,
                    tradeDelta: 0,
                    banners: [],
                  });
                } else {
                  setShowForm(true);
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : '+ Add Team'}
            </button>
          </div>
        </div>

        {/* League Settings */}
        <div className="bg-[#121212] border border-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">League Settings</h2>
          {leagues.map((league) => (
            <div key={league.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0">
              <div>
                <div className="font-semibold text-white">{league.name} ({league.seasonYear})</div>
                <div className="text-sm text-gray-400">
                  Keepers are {league.keepersLocked ? 'locked and visible to all' : 'private until locked'}
                </div>
              </div>
              <button
                onClick={async () => {
                  const newValue = !league.keepersLocked;
                  const confirmed = window.confirm(
                    newValue
                      ? 'Lock keepers? This will:\n\n1. Make all submitted keeper decisions visible to everyone\n2. Drop all non-kept players to free agency (removes teamId)\n\nThis action cannot be easily undone. Continue?'
                      : 'Unlock keepers? This will hide keeper decisions again (for testing purposes).\n\nNote: This will NOT reassign dropped players back to teams.'
                  );

                  if (!confirmed) return;

                  try {
                    // Update league keepersLocked flag
                    await updateDoc(doc(db, 'leagues', league.id), {
                      keepersLocked: newValue,
                    });

                    // If locking, drop non-kept players to free agency
                    if (newValue) {
                      // Get all rosters for this league
                      const rostersSnap = await getDocs(collection(db, 'rosters'));
                      const leagueRosters = rostersSnap.docs.filter(doc =>
                        doc.id.startsWith(`${league.id}_`)
                      );

                      // Collect all player IDs that should be kept
                      const keptPlayerIds = new Set<string>();
                      leagueRosters.forEach(rosterDoc => {
                        const roster = rosterDoc.data();
                        roster.entries?.forEach((entry: any) => {
                          if (entry.decision === 'KEEP' || entry.decision === 'REDSHIRT' || entry.decision === 'INT_STASH') {
                            keptPlayerIds.add(entry.playerId);
                          }
                        });
                      });

                      // Get all players in this league
                      const playersSnap = await getDocs(collection(db, 'players'));
                      const leaguePlayers = playersSnap.docs.filter(doc => {
                        const data = doc.data();
                        return data.roster?.leagueId === league.id && data.roster?.teamId;
                      });

                      // Drop players not in the kept list
                      let droppedCount = 0;
                      for (const playerDoc of leaguePlayers) {
                        if (!keptPlayerIds.has(playerDoc.id)) {
                          await updateDoc(doc(db, 'players', playerDoc.id), {
                            'roster.teamId': null,
                          });
                          droppedCount++;
                        }
                      }

                      alert(`Keepers locked successfully!\n\n${droppedCount} players dropped to free agency.`);
                    } else {
                      alert('Keepers unlocked successfully!');
                    }

                    // Reload data
                    await loadData();
                  } catch (error) {
                    console.error('Error updating league:', error);
                    alert('Failed to update league settings');
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  league.keepersLocked
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'border-2 border-green-400 text-green-400 hover:bg-green-400/10'
                }`}
              >
                {league.keepersLocked ? '🔓 Unlock Keepers' : '🔒 Lock Keepers'}
              </button>
            </div>
          ))}
        </div>

        {/* Create/Edit Team Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {editingTeam ? 'Edit Team' : 'Create New Team'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Boston Ballers"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abbreviation *
                  </label>
                  <input
                    type="text"
                    value={formData.abbrev}
                    onChange={(e) =>
                      setFormData({ ...formData, abbrev: e.target.value })
                    }
                    placeholder="e.g., BOST"
                    maxLength={4}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    League *
                  </label>
                  <select
                    value={formData.leagueId}
                    onChange={(e) =>
                      setFormData({ ...formData, leagueId: e.target.value })
                    }
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a league</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name} ({league.seasonYear})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Keepers
                  </label>
                  <input
                    type="number"
                    value={formData.maxKeepers}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxKeepers: parseInt(e.target.value),
                      })
                    }
                    min="0"
                    max="13"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trade Delta ($M)
                  </label>
                  <input
                    type="number"
                    value={formData.tradeDelta / 1_000_000}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tradeDelta: parseInt(e.target.value || '0') * 1_000_000,
                      })
                    }
                    min="-40"
                    max="40"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -40M to +40M</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Emails (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.owners}
                    onChange={(e) =>
                      setFormData({ ...formData, owners: e.target.value })
                    }
                    placeholder="e.g., owner1@email.com, owner2@email.com"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Names (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.ownerNames}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerNames: e.target.value })
                    }
                    placeholder="e.g., John Smith, Jane Doe"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Championship Banners
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {championshipYears.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => toggleBanner(year)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          formData.banners.includes(year)
                            ? 'bg-yellow-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {formData.banners.includes(year) && '🏆 '}
                        {year}
                      </button>
                    ))}
                  </div>
                  {formData.banners.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded">
                      <div className="flex flex-wrap gap-2">
                        {formData.banners.map((year) => (
                          <span
                            key={year}
                            className="inline-flex items-center px-2 py-1 bg-yellow-300 text-gray-900 text-xs font-bold rounded shadow-sm"
                          >
                            🏆 {year} Champs
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                {editingTeam ? 'Update Team' : 'Create Team'}
              </button>
            </form>
          </div>
        )}

        {/* Teams List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Teams ({teams.length})</h2>
          </div>

          {teams.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No teams found. Create one above!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      League
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owners
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Settings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Banners
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teams.map((team) => {
                    const league = leagues.find((l) => l.id === team.leagueId);
                    return (
                      <tr key={team.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {team.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {team.abbrev}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {league?.name || team.leagueId}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {team.ownerNames && team.ownerNames.length > 0 ? (
                              team.ownerNames.map((name, idx) => (
                                <div key={idx}>
                                  <div className="font-medium">{name}</div>
                                  <div className="text-xs text-gray-500">{team.owners[idx]}</div>
                                </div>
                              ))
                            ) : (
                              team.owners.map((email) => (
                                <div key={email}>{email}</div>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>Max Keepers: {team.settings.maxKeepers}</div>
                          <div>
                            Trade Δ: $
                            {(team.capAdjustments.tradeDelta / 1_000_000).toFixed(
                              0
                            )}
                            M
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {team.banners && team.banners.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {team.banners.map((year) => (
                                <span
                                  key={year}
                                  className="inline-flex items-center px-2 py-1 bg-yellow-300 text-gray-900 text-xs font-bold rounded shadow-sm"
                                >
                                  🏆 {year}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {team.keepersSubmitted ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-400/10 text-green-400 border border-green-400/30 text-xs font-semibold rounded">
                              ✓ Submitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(team.id)}
                            className="text-xs font-mono bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                            title="Click to copy"
                          >
                            {team.id.substring(0, 12)}...
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(team)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                              Edit
                            </button>
                            {team.keepersSubmitted && (
                              <button
                                onClick={() => unlockTeamKeepers(team)}
                                className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                              >
                                🔓 Unlock
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

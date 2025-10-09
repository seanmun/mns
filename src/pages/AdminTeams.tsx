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
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    abbrev: '',
    leagueId: '',
    owners: '',
    maxKeepers: 8,
    tradeDelta: 0,
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

      const newTeam = {
        name: formData.name,
        abbrev: formData.abbrev,
        leagueId: formData.leagueId,
        owners: ownersArray,
        capAdjustments: {
          tradeDelta: formData.tradeDelta,
        },
        settings: {
          maxKeepers: formData.maxKeepers,
        },
      };

      await addDoc(collection(db, 'teams'), newTeam);
      alert('Team created successfully!');

      // Reset form
      setFormData({
        name: '',
        abbrev: '',
        leagueId: '',
        owners: '',
        maxKeepers: 8,
        tradeDelta: 0,
      });
      setShowForm(false);

      // Reload teams
      loadData();
    } catch (error: any) {
      console.error('Error creating team:', error);
      alert(`Failed to create team: ${error?.message || 'Unknown error'}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
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
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : '+ Add Team'}
            </button>
          </div>
        </div>

        {/* Create Team Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
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
                    max="14"
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
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                Create Team
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
                      Team ID
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
                            {team.owners.map((email) => (
                              <div key={email}>{email}</div>
                            ))}
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(team.id)}
                            className="text-xs font-mono bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                            title="Click to copy"
                          >
                            {team.id.substring(0, 12)}...
                          </button>
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

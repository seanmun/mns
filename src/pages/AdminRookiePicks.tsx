import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import type { Team } from '../types';

interface RookieDraftPick {
  id: string;
  year: number;
  round: 1 | 2;
  originalTeam: string;
  originalTeamName: string;
  currentOwner: string;
  leagueId: string;
}

export function AdminRookiePicks() {
  const { role } = useAuth();
  const { currentLeagueId } = useLeague();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<RookieDraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPick, setEditingPick] = useState<RookieDraftPick | null>(null);
  const [newOwner, setNewOwner] = useState('');

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
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', currentLeagueId);
      if (teamsError) throw teamsError;

      const mappedTeams = (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        abbrev: t.abbrev,
        owners: t.owners,
        leagueId: t.league_id,
        ownerNames: t.owner_names,
        capAdjustments: t.cap_adjustments,
        telegramUsername: t.telegram_username,
      })) as Team[];
      setTeams(mappedTeams);

      // Load rookie picks
      const { data: picksData, error: picksError } = await supabase
        .from('rookie_draft_picks')
        .select('*')
        .eq('league_id', currentLeagueId);
      if (picksError) throw picksError;

      const mappedPicks = (picksData || []).map((p: any): RookieDraftPick => ({
        id: p.id,
        year: p.year,
        round: p.round,
        originalTeam: p.original_team,
        originalTeamName: p.original_team_name,
        currentOwner: p.current_owner,
        leagueId: p.league_id,
      }));
      setPicks(mappedPicks);

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePicks = async () => {
    if (!currentLeagueId) return;

    const confirmed = window.confirm(
      `Initialize rookie draft picks?\n\n` +
      `This will create ${teams.length * 3 * 2} picks:\n` +
      `- 3 years (2026-2028)\n` +
      `- 2 rounds per year\n` +
      `- ${teams.length} teams\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      const newPicks: RookieDraftPick[] = [];
      const currentYear = 2026;

      for (const team of teams) {
        for (let yearOffset = 0; yearOffset < 3; yearOffset++) {
          const year = currentYear + yearOffset;
          for (const round of [1, 2] as const) {
            const pickId = `${currentLeagueId}_${year}_${round}_${team.id}`;
            const pick: RookieDraftPick = {
              id: pickId,
              year,
              round,
              originalTeam: team.id,
              originalTeamName: team.name,
              currentOwner: team.id,
              leagueId: currentLeagueId,
            };

            const { error } = await supabase
              .from('rookie_draft_picks')
              .upsert({
                id: pickId,
                year,
                round,
                original_team: team.id,
                original_team_name: team.name,
                current_owner: team.id,
                league_id: currentLeagueId,
              });
            if (error) throw error;

            newPicks.push(pick);
          }
        }
      }

      setPicks(newPicks);
      alert(`Successfully created ${newPicks.length} rookie draft picks!`);
    } catch (error) {
      console.error('Error initializing picks:', error);
      alert('Failed to initialize picks');
    }
  };

  const handleDeleteAllPicks = async () => {
    const confirmed = window.confirm(
      `DELETE ALL rookie draft picks?\n\n` +
      `This will delete ${picks.length} picks.\n\n` +
      `This action cannot be undone. Continue?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('rookie_draft_picks')
        .delete()
        .eq('league_id', currentLeagueId!);
      if (error) throw error;

      setPicks([]);
      alert('All picks deleted successfully');
    } catch (error) {
      console.error('Error deleting picks:', error);
      alert('Failed to delete picks');
    }
  };

  const handleEditPick = (pick: RookieDraftPick) => {
    setEditingPick(pick);
    setNewOwner(pick.currentOwner);
  };

  const handleSaveEdit = async () => {
    if (!editingPick || !newOwner) return;

    try {
      const { error } = await supabase
        .from('rookie_draft_picks')
        .update({ current_owner: newOwner })
        .eq('id', editingPick.id);
      if (error) throw error;

      const updatedPick = { ...editingPick, currentOwner: newOwner };
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

  // Group picks by year and round
  const picksByYear: Record<number, RookieDraftPick[]> = {};
  picks.forEach(pick => {
    if (!picksByYear[pick.year]) {
      picksByYear[pick.year] = [];
    }
    picksByYear[pick.year].push(pick);
  });

  // Sort picks within each year by round then original team
  Object.keys(picksByYear).forEach(year => {
    picksByYear[Number(year)].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.originalTeamName.localeCompare(b.originalTeamName);
    });
  });

  const years = Object.keys(picksByYear).sort().map(Number);

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Rookie Draft Picks Manager</h1>
          <p className="text-gray-400 mt-2">Manage rookie draft pick ownership and trades</p>
        </div>

        {/* Actions */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <div className="flex gap-4">
            {picks.length === 0 ? (
              <button
                onClick={handleInitializePicks}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                Initialize All Picks ({teams.length * 3 * 2} picks)
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

        {/* Picks by Year */}
        {years.map(year => (
          <div key={year} className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">{year} Rookie Draft</h2>

            <div className="space-y-6">
              {/* 1st Round */}
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-3">1st Round</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {picksByYear[year]
                    .filter(p => p.round === 1)
                    .map(pick => {
                      const ownerTeam = teams.find(t => t.id === pick.currentOwner);
                      const isTraded = pick.currentOwner !== pick.originalTeam;

                      return (
                        <div
                          key={pick.id}
                          className={`p-4 rounded border ${
                            isTraded
                              ? 'bg-yellow-400/10 border-yellow-400/30'
                              : 'bg-[#0a0a0a] border-gray-700'
                          }`}
                        >
                          <div className="font-semibold text-white">
                            {pick.originalTeamName}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            Owner: <span className="text-green-400">{ownerTeam?.name || 'Unknown'}</span>
                          </div>
                          {isTraded && (
                            <div className="text-xs text-yellow-400 mt-1">Traded</div>
                          )}
                          <button
                            onClick={() => handleEditPick(pick)}
                            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                          >
                            Change Owner
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 2nd Round */}
              <div>
                <h3 className="text-lg font-semibold text-purple-400 mb-3">2nd Round</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {picksByYear[year]
                    .filter(p => p.round === 2)
                    .map(pick => {
                      const ownerTeam = teams.find(t => t.id === pick.currentOwner);
                      const isTraded = pick.currentOwner !== pick.originalTeam;

                      return (
                        <div
                          key={pick.id}
                          className={`p-4 rounded border ${
                            isTraded
                              ? 'bg-yellow-400/10 border-yellow-400/30'
                              : 'bg-[#0a0a0a] border-gray-700'
                          }`}
                        >
                          <div className="font-semibold text-white">
                            {pick.originalTeamName}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            Owner: <span className="text-purple-400">{ownerTeam?.name || 'Unknown'}</span>
                          </div>
                          {isTraded && (
                            <div className="text-xs text-yellow-400 mt-1">Traded</div>
                          )}
                          <button
                            onClick={() => handleEditPick(pick)}
                            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                          >
                            Change Owner
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Edit Modal */}
        {editingPick && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#121212] rounded-lg border border-gray-700 p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Change Pick Ownership</h3>

              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-2">
                  {editingPick.year} Round {editingPick.round} ({editingPick.originalTeamName})
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

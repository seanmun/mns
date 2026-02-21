import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Pick {
  id: string;
  round: number;
  pickInRound: number;
  overallPick: number;
  currentTeamId: string;
  originalTeamId: string;
  playerId: string | null;
  playerName: string | null;
  isKeeperSlot: boolean;
  wasTraded?: boolean;
}

export function AdminPicksView() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load picks
      const { data: picksData, error: picksError } = await supabase
        .from('pick_assignments')
        .select('*');
      if (picksError) throw picksError;

      const mappedPicks = (picksData || []).map((row: any): Pick => ({
        id: row.id,
        round: row.round,
        pickInRound: row.pick_in_round,
        overallPick: row.overall_pick,
        currentTeamId: row.current_team_id,
        originalTeamId: row.original_team_id,
        playerId: row.player_id,
        playerName: row.player_name,
        isKeeperSlot: row.is_keeper_slot,
        wasTraded: row.was_traded,
      }));

      mappedPicks.sort((a, b) => a.overallPick - b.overallPick);

      // Debug: Check first 5 picks
      console.log('First 5 picks:', mappedPicks.slice(0, 5).map(p => ({
        pick: p.overallPick,
        player: p.playerName,
        isKeeperSlot: p.isKeeperSlot,
        type: typeof p.isKeeperSlot
      })));

      setPicks(mappedPicks);

      // Load team names
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*');
      if (teamsError) throw teamsError;

      const names: Record<string, string> = {};
      (teamsData || []).forEach((row: any) => {
        names[row.id] = row.name || row.abbrev || row.id.substring(0, 8);
      });
      setTeamNames(names);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading picks...</div>
      </div>
    );
  }

  // Group by round
  const byRound: Record<number, Pick[]> = {};
  picks.forEach(pick => {
    if (!byRound[pick.round]) byRound[pick.round] = [];
    byRound[pick.round].push(pick);
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Pick Assignments View</h1>
          <p className="text-gray-400 mt-2">All picks from pick_assignments table ({picks.length} total)</p>
        </div>

        <div className="space-y-8">
          {Object.keys(byRound).sort((a, b) => parseInt(a) - parseInt(b)).map(round => (
            <div key={round} className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Round {round}</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 py-2 px-3">Pick</th>
                      <th className="text-left text-gray-400 py-2 px-3">Player</th>
                      <th className="text-left text-gray-400 py-2 px-3">Current Owner</th>
                      <th className="text-left text-gray-400 py-2 px-3">Original Owner</th>
                      <th className="text-left text-gray-400 py-2 px-3">Type</th>
                      <th className="text-left text-gray-400 py-2 px-3">Keeper?</th>
                      <th className="text-left text-gray-400 py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRound[parseInt(round)].map(pick => {
                      const wasTraded = pick.currentTeamId !== pick.originalTeamId;
                      return (
                        <tr key={pick.id} className={`border-b border-gray-800 ${wasTraded ? 'bg-yellow-900/10' : ''}`}>
                          <td className="py-3 px-3 text-white font-mono">{pick.overallPick}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white">{pick.playerName || '(empty)'}</span>
                              {pick.isKeeperSlot && (
                                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">K</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={wasTraded ? 'text-yellow-400 font-semibold' : 'text-gray-300'}>
                              {teamNames[pick.currentTeamId] || pick.currentTeamId?.substring(0, 8)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-400">
                            {teamNames[pick.originalTeamId] || pick.originalTeamId?.substring(0, 8)}
                          </td>
                          <td className="py-3 px-3">
                            {pick.isKeeperSlot ? (
                              <span className="text-blue-400">Keeper</span>
                            ) : (
                              <span className="text-gray-400">Draft</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-400 font-mono text-xs">
                            {String(pick.isKeeperSlot)}
                          </td>
                          <td className="py-3 px-3">
                            {wasTraded && (
                              <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">TRADED</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

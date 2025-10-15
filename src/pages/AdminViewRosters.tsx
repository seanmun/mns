import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import type { Team, Player, RosterDoc, RosterEntry } from '../types';
import { stackKeeperRounds } from '../lib/keeperAlgorithms';

export function AdminViewRosters() {
  const { role } = useAuth();
  const { currentLeagueId, currentLeague } = useLeague();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [rosters, setRosters] = useState<Map<string, RosterDoc>>(new Map());
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

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

      // Load rosters for each team
      const rostersMap = new Map<string, RosterDoc>();
      for (const team of teamsData) {
        const rosterId = `${currentLeagueId}_${team.id}_${currentLeague.seasonYear}`;
        const rostersSnap = await getDocs(collection(db, 'rosters'));
        const rosterDoc = rostersSnap.docs.find(d => d.id === rosterId);

        if (rosterDoc) {
          rostersMap.set(team.id, {
            id: rosterDoc.id,
            ...rosterDoc.data(),
          } as RosterDoc);
        }
      }
      setRosters(rostersMap);

      // Auto-select first team
      if (teamsData.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teamsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
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

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedRoster = selectedTeamId ? rosters.get(selectedTeamId) : null;

  // Get keeper entries and apply stacking
  const getKeeperInfo = (roster: RosterDoc | null | undefined) => {
    if (!roster || !roster.entries) {
      return { keepers: [], redshirts: [], intStash: [], franchiseTags: 0 };
    }

    const entries = [...roster.entries];
    const { entries: stackedEntries, franchiseTags } = stackKeeperRounds(entries);

    const keepers = stackedEntries.filter(e => e.decision === 'KEEP');
    const redshirts = stackedEntries.filter(e => e.decision === 'REDSHIRT');
    const intStash = stackedEntries.filter(e => e.decision === 'INT_STASH');

    return { keepers, redshirts, intStash, franchiseTags };
  };

  const selectedInfo = getKeeperInfo(selectedRoster);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin: View All Rosters</h1>
            <p className="text-gray-400 mt-1">
              {currentLeague?.name} ({currentLeague?.seasonYear})
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/teams')}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Back to Admin
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Team List Sidebar */}
          <div className="col-span-3 bg-[#121212] border border-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Teams</h2>
            <div className="space-y-2">
              {teams.map((team) => {
                const roster = rosters.get(team.id);
                const info = getKeeperInfo(roster);
                const isSubmitted = roster?.status === 'submitted';

                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedTeamId === team.id
                        ? 'bg-green-400/20 border-2 border-green-400'
                        : 'bg-[#0a0a0a] border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{team.name}</span>
                      {isSubmitted ? (
                        <span className="text-xs text-green-400">✓</span>
                      ) : (
                        <span className="text-xs text-gray-500">Draft</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {info.keepers.length} keepers
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roster Detail */}
          <div className="col-span-9 bg-[#121212] border border-gray-800 rounded-lg p-6">
            {selectedTeam && selectedRoster ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedTeam.name}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-sm px-2 py-1 rounded ${
                        selectedRoster.status === 'submitted'
                          ? 'bg-green-400/20 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {selectedRoster.status === 'submitted' ? '✓ Submitted' : 'Draft'}
                      </span>
                      <span className="text-sm text-gray-400">
                        {selectedInfo.keepers.length} keepers •
                        {selectedInfo.redshirts.length} redshirts •
                        {selectedInfo.franchiseTags > 0 && ` ${selectedInfo.franchiseTags} franchise tags`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Keepers Table */}
                {selectedInfo.keepers.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Keepers ({selectedInfo.keepers.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#0a0a0a] border-b border-gray-700">
                          <tr>
                            <th className="text-left p-2">Player</th>
                            <th className="text-left p-2">Pos</th>
                            <th className="text-right p-2">Salary</th>
                            <th className="text-center p-2">Base Rd</th>
                            <th className="text-center p-2">Final Rd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInfo.keepers
                            .sort((a, b) => (a.keeperRound || 99) - (b.keeperRound || 99))
                            .map((entry) => {
                              const player = players.get(entry.playerId);
                              return (
                                <tr key={entry.playerId} className="border-b border-gray-800">
                                  <td className="p-2 font-medium">{player?.name || 'Unknown'}</td>
                                  <td className="p-2 text-gray-400">{player?.position || '-'}</td>
                                  <td className="p-2 text-right">
                                    ${((player?.salary || 0) / 1_000_000).toFixed(2)}M
                                  </td>
                                  <td className="p-2 text-center">{entry.baseRound}</td>
                                  <td className="p-2 text-center font-semibold text-green-400">
                                    {entry.keeperRound}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Redshirts */}
                {selectedInfo.redshirts.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Redshirts ({selectedInfo.redshirts.length})</h3>
                    <div className="space-y-2">
                      {selectedInfo.redshirts.map((entry) => {
                        const player = players.get(entry.playerId);
                        return (
                          <div key={entry.playerId} className="p-2 bg-[#0a0a0a] rounded">
                            {player?.name || 'Unknown'} - {player?.position}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedInfo.keepers.length === 0 && selectedInfo.redshirts.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No keepers selected
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select a team to view their roster
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

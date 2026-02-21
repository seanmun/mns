import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import type { Team } from '../types';

// Mock player names for randomization
const MOCK_PLAYER_POOL = [
  'LeBron James', 'Stephen Curry', 'Giannis Antetokounmpo', 'Nikola Jokic', 'Joel Embiid',
  'Luka Doncic', 'Kevin Durant', 'Jayson Tatum', 'Anthony Davis', 'Damian Lillard',
  'Jimmy Butler', 'Kawhi Leonard', 'Devin Booker', 'Jaylen Brown', 'Tyrese Haliburton',
  'Shai Gilgeous-Alexander', 'Anthony Edwards', 'Donovan Mitchell', 'Bam Adebayo', 'Julius Randle',
  'Karl-Anthony Towns', 'Domantas Sabonis', 'Pascal Siakam', 'DeMar DeRozan', 'Trae Young',
  'LaMelo Ball', 'Ja Morant', 'Zion Williamson', 'Paolo Banchero', 'Cade Cunningham',
];

interface DraftPick {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  isKeeperSlot: boolean;
  keeperPlayerName?: string;
  selectedPlayer?: string;
}

export function AdminDraftTest() {
  const { role, user } = useAuth();
  const { currentLeagueId } = useLeague();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [draftBoard, setDraftBoard] = useState<DraftPick[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [isOrderSet, setIsOrderSet] = useState(false);
  const [mockKeepers, setMockKeepers] = useState<Record<string, { round: number; playerName: string }[]>>({});

  // Fetch real teams from Supabase
  useEffect(() => {
    if (role !== 'admin' || !currentLeagueId) {
      if (role !== 'admin') navigate('/');
      return;
    }

    const fetchTeams = async () => {
      try {
        const { data: teamsData, error } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', currentLeagueId);
        if (error) throw error;

        const teamData = (teamsData || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          abbrev: t.abbrev,
          owners: t.owners,
          leagueId: t.league_id,
          ownerNames: t.owner_names,
          capAdjustments: t.cap_adjustments,
          telegramUsername: t.telegram_username,
        })) as Team[];

        setTeams(teamData);

        // Generate random mock keepers for each team
        const keepers: Record<string, { round: number; playerName: string }[]> = {};
        teamData.forEach((team) => {
          const keeperCount = Math.floor(Math.random() * 4) + 1; // 1-4 keepers
          const teamKeepers: { round: number; playerName: string }[] = [];
          const usedRounds = new Set<number>();
          const usedPlayers = new Set<string>();

          for (let i = 0; i < keeperCount; i++) {
            let round;
            do {
              round = Math.floor(Math.random() * 13) + 1;
            } while (usedRounds.has(round));
            usedRounds.add(round);

            let player;
            do {
              player = MOCK_PLAYER_POOL[Math.floor(Math.random() * MOCK_PLAYER_POOL.length)];
            } while (usedPlayers.has(player));
            usedPlayers.add(player);

            teamKeepers.push({ round, playerName: player });
          }

          keepers[team.id] = teamKeepers;
        });

        setMockKeepers(keepers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setLoading(false);
      }
    };

    fetchTeams();
  }, [role, currentLeagueId, navigate]);

  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading teams...</div>
      </div>
    );
  }

  const handleSetRandomOrder = () => {
    const shuffled = [...teams]
      .map((team) => team.id)
      .sort(() => Math.random() - 0.5);
    setDraftOrder(shuffled);
  };

  const handleGenerateDraftBoard = () => {
    if (draftOrder.length !== teams.length) {
      alert('Please set the draft order first');
      return;
    }

    const picks: DraftPick[] = [];
    let overallPick = 1;

    for (let round = 1; round <= 13; round++) {
      const roundOrder = round % 2 === 1 ? draftOrder : [...draftOrder].reverse();

      roundOrder.forEach((teamId, index) => {
        const team = teams.find((t) => t.id === teamId)!;
        const teamKeepers = mockKeepers[teamId] || [];
        const keeper = teamKeepers.find((k) => k.round === round);

        picks.push({
          round,
          pickInRound: index + 1,
          overallPick,
          teamId,
          teamName: team.name,
          teamAbbrev: team.abbrev,
          isKeeperSlot: !!keeper,
          keeperPlayerName: keeper?.playerName,
          selectedPlayer: keeper?.playerName, // Pre-fill keepers
        });

        overallPick++;
      });
    }

    setDraftBoard(picks);
    setIsOrderSet(true);
  };

  const getRoundPicks = (round: number) => {
    return draftBoard.filter((pick) => pick.round === round);
  };

  // Determine which teams belong to the current user
  const userTeamIds = teams
    .filter((team) => team.owners.includes(user?.email || ''))
    .map((team) => team.id);

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Warning Banner */}
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold">TEST PAGE - Mock Data Only</span>
          </div>
          <p className="text-sm text-yellow-400 mt-1">
            This page uses fake data and will NOT affect real keeper or draft data.
          </p>
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">Draft System Test</h1>

        {!isOrderSet ? (
          /* Step 1: Set Draft Order */
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Step 1: Set Draft Order</h2>

              <button
                onClick={handleSetRandomOrder}
                className="mb-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Generate Random Order
              </button>

              {draftOrder.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Draft Order:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {draftOrder.map((teamId, index) => {
                      const team = teams.find((t) => t.id === teamId);
                      return (
                        <div
                          key={teamId}
                          className="flex items-center gap-2 p-2 bg-[#0a0a0a] border border-gray-700 rounded"
                        >
                          <span className="text-green-400 font-bold">{index + 1}.</span>
                          <span className="text-white text-sm">
                            {team?.abbrev} - {team?.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {draftOrder.length > 0 && (
              <button
                onClick={handleGenerateDraftBoard}
                className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
              >
                Generate Draft Board (13 Rounds, Snake Format)
              </button>
            )}
          </div>
        ) : (
          /* Step 2: View Draft Board */
          <div className="space-y-6">
            {/* Round Tabs */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 13 }, (_, i) => i + 1).map((round) => (
                  <button
                    key={round}
                    onClick={() => setSelectedRound(round)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      selectedRound === round
                        ? 'bg-green-500 text-white'
                        : 'bg-[#0a0a0a] text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {round}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500/10 border border-blue-500/30"></div>
                  <span className="text-gray-400">Keeper Slot</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500/10 border border-green-500/30"></div>
                  <span className="text-gray-400">Your Pick</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#0a0a0a] border border-gray-700"></div>
                  <span className="text-gray-400">Other Teams</span>
                </div>
              </div>
            </div>

            {/* Draft Board */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Round {selectedRound} {selectedRound % 2 === 0 && '(Snake - Reversed)'}
                  </h2>
                  {(() => {
                    const roundPicks = getRoundPicks(selectedRound);
                    const userPickIndex = roundPicks.findIndex(p => userTeamIds.includes(p.teamId));
                    if (userPickIndex !== -1) {
                      const picksUntilUser = userPickIndex;
                      return (
                        <p className="text-sm text-green-400 mt-1">
                          {picksUntilUser === 0
                            ? "You're on the clock!"
                            : `${picksUntilUser} pick${picksUntilUser === 1 ? '' : 's'} until you're up`}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                <button
                  onClick={() => setIsOrderSet(false)}
                  className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Reset
                </button>
              </div>

              <div className="space-y-2">
                {getRoundPicks(selectedRound).map((pick) => {
                  const isUserPick = userTeamIds.includes(pick.teamId);
                  return (
                  <div
                    key={pick.overallPick}
                    className={`p-4 rounded-lg border ${
                      pick.isKeeperSlot
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : isUserPick
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-[#0a0a0a] border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Overall</div>
                          <div className="text-lg font-bold text-green-400">
                            {pick.overallPick}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Pick</div>
                          <div className="text-sm font-semibold text-white">
                            {pick.pickInRound}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {pick.teamAbbrev} - {pick.teamName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pick.isKeeperSlot ? 'Keeper Slot' : 'Available Pick'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {pick.isKeeperSlot ? (
                          <div>
                            <div className="text-sm font-semibold text-blue-400">
                              {pick.keeperPlayerName}
                            </div>
                            <div className="text-xs text-gray-500">Keeper</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">Select player...</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
                <div className="text-sm text-gray-400">Total Picks</div>
                <div className="text-2xl font-bold text-white">{teams.length * 13}</div>
              </div>
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
                <div className="text-sm text-gray-400">Keeper Slots</div>
                <div className="text-2xl font-bold text-blue-400">
                  {draftBoard.filter((p) => p.isKeeperSlot).length}
                </div>
              </div>
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
                <div className="text-sm text-gray-400">Available Picks</div>
                <div className="text-2xl font-bold text-green-400">
                  {draftBoard.filter((p) => !p.isKeeperSlot).length}
                </div>
              </div>
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
                <div className="text-sm text-gray-400">Format</div>
                <div className="text-lg font-bold text-purple-400">Snake</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

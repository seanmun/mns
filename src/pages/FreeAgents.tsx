import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, fetchAllRows } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { usePreviousStats } from '../hooks/usePreviousStats';
import { useWatchList, togglePlayerInWatchList } from '../hooks/useWatchList';
import { PlayerModal } from '../components/PlayerModal';
import type { Player, RegularSeasonRoster } from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';

type SortColumn = 'score' | 'salary' | 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'fgPercent' | 'ftPercent' | 'threePointMade';

function mapPlayer(row: any): Player {
  return {
    id: row.id, fantraxId: row.fantrax_id, name: row.name, position: row.position,
    salary: row.salary, nbaTeam: row.nba_team,
    roster: { leagueId: row.league_id, teamId: row.team_id, onIR: row.on_ir,
      isRookie: row.is_rookie, isInternationalStash: row.is_international_stash,
      intEligible: row.int_eligible, rookieDraftInfo: row.rookie_draft_info || undefined },
    keeper: row.keeper_prior_year_round != null || row.keeper_derived_base_round != null
      ? { priorYearRound: row.keeper_prior_year_round || undefined, derivedBaseRound: row.keeper_derived_base_round || undefined }
      : undefined,
  };
}

function mapRegularSeasonRoster(row: any): RegularSeasonRoster {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    seasonYear: row.season_year,
    activeRoster: row.active_roster || [],
    irSlots: row.ir_slots || [],
    redshirtPlayers: row.redshirt_players || [],
    internationalPlayers: row.international_players || [],
    benchedPlayers: row.benched_players || [],
    isLegalRoster: row.is_legal_roster,
    lastUpdated: row.last_updated,
    updatedBy: row.updated_by,
  };
}

export function FreeAgents() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<Set<string>>(new Set());
  const [seasonYear, setSeasonYear] = useState<number>(2025);
  const [maxActive, setMaxActive] = useState<number>(DEFAULT_ROSTER_SETTINGS.maxActive);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [userRoster, setUserRoster] = useState<RegularSeasonRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number>(-1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [addingPlayer, setAddingPlayer] = useState<Player | null>(null);
  const [playerToDrop, setPlayerToDrop] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { projectedStats } = useProjectedStats();
  const { previousStats } = usePreviousStats();
  const { watchList, setWatchList } = useWatchList(
    user?.email || undefined,
    leagueId,
    userTeamId || undefined
  );

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleToggleWatchList = async (e: React.MouseEvent, playerFantraxId: string) => {
    e.stopPropagation(); // Prevent row click from opening modal

    if (!user?.email || !leagueId || !userTeamId) {
      alert('Please sign in to add players to your watchlist');
      return;
    }

    try {
      const updatedWatchList = await togglePlayerInWatchList(
        user.email,
        leagueId,
        userTeamId,
        playerFantraxId,
        watchList
      );
      setWatchList(updatedWatchList);
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      alert('Failed to update watchlist');
    }
  };

  // Fetch league to get seasonYear
  useEffect(() => {
    const fetchLeague = async () => {
      if (!leagueId) return;

      try {
        const { data, error } = await supabase
          .from('leagues')
          .select('season_year, roster')
          .eq('id', leagueId)
          .single();

        if (error) throw error;
        if (data) {
          setSeasonYear(data.season_year);
          setMaxActive(data.roster?.maxActive ?? DEFAULT_ROSTER_SETTINGS.maxActive);
        }
      } catch (error) {
        console.error('Error fetching league:', error);
      }
    };

    fetchLeague();
  }, [leagueId]);

  // Fetch user's team
  useEffect(() => {
    const fetchUserTeam = async () => {
      if (!leagueId || !user?.email) return;

      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', leagueId);

        if (error) throw error;

        const userTeam = (data || []).find((row: any) => {
          return row.owners && row.owners.includes(user.email);
        });

        if (userTeam) {
          setUserTeamId(userTeam.id);
        }
      } catch (error) {
        console.error('Error fetching user team:', error);
      }
    };

    fetchUserTeam();
  }, [leagueId, user]);

  // Load all players and regular season rosters with real-time updates
  useEffect(() => {
    if (!leagueId || !seasonYear) return;

    // Load all players (one-time, players collection doesn't change often)
    const loadPlayers = async () => {
      try {
        const data = await fetchAllRows('players');
        const playerData = data.map(mapPlayer);
        setAllPlayers(playerData);
      } catch (error) {
        console.error('Error loading players:', error);
      }
    };

    loadPlayers();

    // Load regular season rosters initially
    const loadRosters = async () => {
      try {
        const { data, error } = await supabase
          .from('regular_season_rosters')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', seasonYear);

        if (error) throw error;

        const ownedIds = new Set<string>();
        (data || []).forEach((row: any) => {
          const roster = mapRegularSeasonRoster(row);
          roster.activeRoster.forEach(id => ownedIds.add(id));
          roster.irSlots.forEach(id => ownedIds.add(id));
          roster.redshirtPlayers.forEach(id => ownedIds.add(id));
          roster.internationalPlayers.forEach(id => ownedIds.add(id));

          if (userTeamId && roster.teamId === userTeamId) {
            setUserRoster(roster);
          }
        });

        setOwnedPlayerIds(ownedIds);
        setLoading(false);
      } catch (error) {
        console.error('Error loading rosters:', error);
        setLoading(false);
      }
    };

    loadRosters();

    // Set up real-time listener for regular season rosters
    const channel = supabase
      .channel('regular_season_rosters_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'regular_season_rosters',
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          // Reload rosters on any change
          loadRosters();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, seasonYear, userTeamId]);

  // Apply search and sorting to free agents
  const freeAgents = useMemo(() => {
    // Filter out owned players (those in regularSeasonRosters)
    let agents = allPlayers.filter(player => !ownedPlayerIds.has(player.id));

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      agents = agents.filter(player =>
        player.name.toLowerCase().includes(search) ||
        player.position.toLowerCase().includes(search) ||
        player.nbaTeam.toLowerCase().includes(search)
      );
    }

    // Sort by selected column
    return agents.sort((a, b) => {
      let valueA: number;
      let valueB: number;

      if (sortColumn === 'salary') {
        valueA = a.salary;
        valueB = b.salary;
      } else {
        const statsA = projectedStats.get(a.fantraxId);
        const statsB = projectedStats.get(b.fantraxId);

        switch (sortColumn) {
          case 'score':
            valueA = statsA?.score ?? 0;
            valueB = statsB?.score ?? 0;
            break;
          case 'points':
            valueA = statsA?.points ?? 0;
            valueB = statsB?.points ?? 0;
            break;
          case 'rebounds':
            valueA = statsA?.rebounds ?? 0;
            valueB = statsB?.rebounds ?? 0;
            break;
          case 'assists':
            valueA = statsA?.assists ?? 0;
            valueB = statsB?.assists ?? 0;
            break;
          case 'steals':
            valueA = statsA?.steals ?? 0;
            valueB = statsB?.steals ?? 0;
            break;
          case 'blocks':
            valueA = statsA?.blocks ?? 0;
            valueB = statsB?.blocks ?? 0;
            break;
          case 'fgPercent':
            valueA = statsA?.fgPercent ?? 0;
            valueB = statsB?.fgPercent ?? 0;
            break;
          case 'ftPercent':
            valueA = statsA?.ftPercent ?? 0;
            valueB = statsB?.ftPercent ?? 0;
            break;
          case 'threePointMade':
            valueA = statsA?.threePointMade ?? 0;
            valueB = statsB?.threePointMade ?? 0;
            break;
          default:
            valueA = 0;
            valueB = 0;
        }
      }

      return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [allPlayers, ownedPlayerIds, projectedStats, sortColumn, sortDirection, searchTerm]);

  const formatSalary = (salary: number) => {
    return `$${(salary / 1_000_000).toFixed(2)}M`;
  };

  const formatStat = (stat: number | undefined) => {
    if (stat === undefined) return '-';
    return stat.toFixed(1);
  };

  const formatPercent = (percent: number | undefined) => {
    if (percent === undefined) return '-';
    return `${(percent * 100).toFixed(1)}%`;
  };

  const renderSortHeader = (label: string, column: SortColumn, align: 'left' | 'center' | 'right' = 'center') => {
    const isActive = sortColumn === column;
    const alignClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

    return (
      <th
        className={`px-4 py-3 text-${align} text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors`}
        onClick={() => handleSort(column)}
      >
        <div className={`flex items-center gap-1 ${alignClass}`}>
          {label}
          {isActive && (
            <svg
              className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </th>
    );
  };

  const handleAddPlayer = (player: Player) => {
    if (!userRoster || !userTeamId) {
      alert('You must be a team owner to add players');
      return;
    }
    setAddingPlayer(player);
  };

  const handleConfirmAdd = async () => {
    if (!addingPlayer || !userRoster || processing) return;

    try {
      setProcessing(true);

      // If roster is at 13, must drop a player first
      if (userRoster.activeRoster.length >= 13) {
        if (!playerToDrop) {
          alert('You must select a player to drop');
          setProcessing(false);
          return;
        }

        // Drop the selected player first
        const newActiveAfterDrop = userRoster.activeRoster.filter(id => id !== playerToDrop);

        const { error: dropError } = await supabase
          .from('regular_season_rosters')
          .update({
            active_roster: newActiveAfterDrop,
            last_updated: Date.now(),
          })
          .eq('id', userRoster.id);

        if (dropError) throw dropError;

        // Add the new player
        const { error: addError } = await supabase
          .from('regular_season_rosters')
          .update({
            active_roster: [...newActiveAfterDrop, addingPlayer.id],
            last_updated: Date.now(),
          })
          .eq('id', userRoster.id);

        if (addError) throw addError;
      } else {
        // Just add the new player
        const newActive = [...userRoster.activeRoster, addingPlayer.id];

        const { error } = await supabase
          .from('regular_season_rosters')
          .update({
            active_roster: newActive,
            last_updated: Date.now(),
          })
          .eq('id', userRoster.id);

        if (error) throw error;
      }

      setAddingPlayer(null);
      setPlayerToDrop(null);
      setProcessing(false);
    } catch (error) {
      console.error('Error adding player:', error);
      alert(`Error adding player: ${error}`);
      setProcessing(false);
    }
  };

  // Get active roster players for drop selection
  const activeRosterPlayers = useMemo(() => {
    if (!userRoster) return [];
    return userRoster.activeRoster
      .map(playerId => allPlayers.find(p => p.id === playerId))
      .filter((p): p is Player => p !== undefined);
  }, [userRoster, allPlayers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Free Agent Pool</h1>
          <p className="text-gray-400 mt-1">
            {freeAgents.length} available players {searchTerm && `matching "${searchTerm}"`}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 bg-[#121212] p-4 rounded-lg border border-gray-800">
          <label className="block text-sm font-medium text-white mb-2">
            Search Players
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, position, or team..."
            className="w-full md:w-96 rounded-md bg-[#0a0a0a] border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-green-400 focus:ring-green-400 px-4 py-2"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-2 text-sm text-gray-400 hover:text-white"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#0a0a0a] px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-r border-gray-800 w-36 sm:w-48">
                    Player
                  </th>
                  {renderSortHeader('Salary', 'salary', 'right')}
                  {renderSortHeader('Score', 'score')}
                  {renderSortHeader('PTS', 'points')}
                  {renderSortHeader('REB', 'rebounds')}
                  {renderSortHeader('AST', 'assists')}
                  {renderSortHeader('ST', 'steals')}
                  {renderSortHeader('BLK', 'blocks')}
                  {renderSortHeader('FG%', 'fgPercent')}
                  {renderSortHeader('FT%', 'ftPercent')}
                  {renderSortHeader('3PM', 'threePointMade')}
                  {userTeamId && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-[#121212] divide-y divide-gray-800">
                {freeAgents && freeAgents.map((player, index) => {
                  const stats = projectedStats.get(player.fantraxId);
                  const isWatched = watchList?.playerIds.includes(player.fantraxId) || false;

                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedPlayer(player);
                        setSelectedPlayerIndex(index);
                      }}
                    >
                      <td className="sticky left-0 z-10 bg-[#121212] px-2 sm:px-4 py-3 border-r border-gray-800 w-36 sm:w-48">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleToggleWatchList(e, player.fantraxId)}
                            className="flex-shrink-0 hover:scale-110 transition-transform"
                          >
                            <svg
                              className={`w-4 h-4 ${
                                isWatched ? 'fill-green-400 text-green-400' : 'fill-none text-gray-600'
                              } stroke-current stroke-2`}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                              />
                            </svg>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {player.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {player.nbaTeam} | {player.position}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-white text-right font-medium">
                        {formatSalary(player.salary)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-400 text-center font-semibold">
                        {formatStat(stats?.score)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.points)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.rebounds)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.assists)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.steals)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.blocks)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatPercent(stats?.fgPercent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatPercent(stats?.ftPercent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.threePointMade)}
                      </td>
                      {userTeamId && (
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddPlayer(player);
                            }}
                            className="px-3 py-1 text-xs border border-green-500 text-green-400 rounded hover:bg-green-500/10 transition-colors"
                          >
                            Add
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Player Modal */}
      <PlayerModal
        player={selectedPlayer}
        onClose={() => {
          setSelectedPlayer(null);
          setSelectedPlayerIndex(-1);
        }}
        onNext={() => {
          if (selectedPlayerIndex < freeAgents.length - 1) {
            const nextIndex = selectedPlayerIndex + 1;
            setSelectedPlayer(freeAgents[nextIndex]);
            setSelectedPlayerIndex(nextIndex);
          }
        }}
        onPrev={() => {
          if (selectedPlayerIndex > 0) {
            const prevIndex = selectedPlayerIndex - 1;
            setSelectedPlayer(freeAgents[prevIndex]);
            setSelectedPlayerIndex(prevIndex);
          }
        }}
        hasNext={selectedPlayerIndex < freeAgents.length - 1}
        hasPrev={selectedPlayerIndex > 0}
        projectedStats={selectedPlayer ? projectedStats.get(selectedPlayer.fantraxId) : undefined}
        previousStats={selectedPlayer ? previousStats.get(selectedPlayer.fantraxId) : undefined}
      />

      {/* Add Player Modal */}
      {addingPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121212] rounded-lg border border-gray-800 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Add Player</h2>
                  <p className="text-gray-400 mt-1">
                    Adding {addingPlayer.name} to your roster
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAddingPlayer(null);
                    setPlayerToDrop(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Roster Status */}
              {userRoster && (
                <div className="mb-6">
                  <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                    <div className="text-sm text-gray-400">Active Roster</div>
                    <div className={`text-2xl font-bold ${userRoster.activeRoster.length >= maxActive ? 'text-pink-400' : 'text-white'}`}>
                      {userRoster.activeRoster.length}/{maxActive}
                    </div>
                  </div>
                </div>
              )}

              {/* Drop Player Selection */}
              {userRoster && userRoster.activeRoster.length >= 13 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Select a Player to Drop
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Your active roster is full. You must drop a player to add {addingPlayer.name}.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activeRosterPlayers.map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          playerToDrop === player.id
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-gray-700 hover:border-gray-600 bg-[#0a0a0a]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="playerToDrop"
                          value={player.id}
                          checked={playerToDrop === player.id}
                          onChange={() => setPlayerToDrop(player.id)}
                          className="text-pink-500 focus:ring-pink-500"
                        />
                        <div className="flex-1">
                          <div className="text-white font-medium">{player.name}</div>
                          <div className="text-sm text-gray-400">
                            {player.position} | {player.nbaTeam} | ${(player.salary / 1_000_000).toFixed(1)}M
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAddingPlayer(null);
                    setPlayerToDrop(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAdd}
                  disabled={processing || (userRoster !== null && userRoster.activeRoster.length >= 13 && playerToDrop === null)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? 'Adding...' : 'Confirm Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

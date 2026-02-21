import { useState, useEffect, useMemo } from 'react';
import { supabase, fetchAllRows } from '../lib/supabase';
import type { Team, Player, RegularSeasonRoster } from '../types';

interface AdminRosterManagementProps {
  leagueId: string;
  seasonYear: number;
  onClose: () => void;
}

type ActionType = 'add_to_ir' | 'move_to_active' | 'drop_player' | 'add_free_agent';

function mapTeam(row: any): Team {
  return {
    id: row.id, leagueId: row.league_id, name: row.name, abbrev: row.abbrev,
    owners: row.owners || [], ownerNames: row.owner_names || [],
    telegramUsername: row.telegram_username || undefined,
    capAdjustments: row.cap_adjustments || { tradeDelta: 0 },
    settings: row.settings || { maxKeepers: 8 }, banners: row.banners || [],
  };
}

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
    isLegalRoster: row.is_legal_roster,
    lastUpdated: row.last_updated,
    updatedBy: row.updated_by,
  };
}

export function AdminRosterManagement({ leagueId, seasonYear, onClose }: AdminRosterManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Map<string, RegularSeasonRoster>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [actionType, setActionType] = useState<ActionType>('add_free_agent');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [leagueId, seasonYear]);

  const loadData = async () => {
    try {
      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      if (teamsError) throw teamsError;
      const mappedTeams = (teamsData || []).map(mapTeam).sort((a, b) => a.name.localeCompare(b.name));
      setTeams(mappedTeams);

      // Load all players (paginated past 1000-row limit)
      const playersData = await fetchAllRows('players');
      const mappedPlayers = playersData.map(mapPlayer).sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(mappedPlayers);

      // Load regular season rosters
      const { data: rostersData, error: rostersError } = await supabase
        .from('regular_season_rosters')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_year', seasonYear);

      if (rostersError) throw rostersError;
      const rostersMap = new Map<string, RegularSeasonRoster>();
      (rostersData || []).forEach((row: any) => {
        const roster = mapRegularSeasonRoster(row);
        rostersMap.set(roster.teamId, roster);
      });
      setRosters(rostersMap);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    }
  };

  // Get current roster for selected team
  const currentRoster = useMemo(() => {
    if (!selectedTeam) return null;
    return rosters.get(selectedTeam) || null;
  }, [selectedTeam, rosters]);

  // Get available players based on action type
  const availablePlayers = useMemo(() => {
    if (!currentRoster) return [];

    const ownedPlayerIds = new Set([
      ...currentRoster.activeRoster,
      ...currentRoster.irSlots,
      ...currentRoster.redshirtPlayers,
      ...currentRoster.internationalPlayers
    ]);

    let filtered: Player[] = [];

    switch (actionType) {
      case 'add_to_ir':
        // Only active roster players
        filtered = players.filter(p => currentRoster.activeRoster.includes(p.id));
        break;

      case 'move_to_active':
        // Only IR players
        filtered = players.filter(p => currentRoster.irSlots.includes(p.id));
        break;

      case 'drop_player':
        // Any owned player
        filtered = players.filter(p => ownedPlayerIds.has(p.id));
        break;

      case 'add_free_agent':
        // Players not owned by any team
        const allOwnedIds = new Set<string>();
        rosters.forEach(roster => {
          roster.activeRoster.forEach(id => allOwnedIds.add(id));
          roster.irSlots.forEach(id => allOwnedIds.add(id));
          roster.redshirtPlayers.forEach(id => allOwnedIds.add(id));
          roster.internationalPlayers.forEach(id => allOwnedIds.add(id));
        });
        filtered = players.filter(p => !allOwnedIds.has(p.id));
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.nbaTeam.toLowerCase().includes(term) ||
        p.position.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [currentRoster, actionType, players, rosters, searchTerm]);

  const executeAction = async () => {
    if (!selectedTeam || !selectedPlayer) {
      alert('Please select a team and player');
      return;
    }

    const roster = rosters.get(selectedTeam);
    if (!roster) {
      alert('Roster not found');
      return;
    }

    setProcessing(true);

    try {
      const rosterId = `${leagueId}_${selectedTeam}`;

      switch (actionType) {
        case 'add_to_ir': {
          // Move from active to IR (max 2)
          if (roster.irSlots.length >= 2) {
            alert('IR is full (max 2 players)');
            setProcessing(false);
            return;
          }
          const newActive = roster.activeRoster.filter(id => id !== selectedPlayer);
          const newIR = [...roster.irSlots, selectedPlayer];
          const { error } = await supabase
            .from('regular_season_rosters')
            .update({
              active_roster: newActive,
              ir_slots: newIR,
              last_updated: Date.now(),
              updated_by: 'admin'
            })
            .eq('id', rosterId);
          if (error) throw error;
          break;
        }

        case 'move_to_active': {
          // Move from IR to active
          const newIR = roster.irSlots.filter(id => id !== selectedPlayer);
          const newActive = [...roster.activeRoster, selectedPlayer];
          const { error } = await supabase
            .from('regular_season_rosters')
            .update({
              ir_slots: newIR,
              active_roster: newActive,
              last_updated: Date.now(),
              updated_by: 'admin'
            })
            .eq('id', rosterId);
          if (error) throw error;
          break;
        }

        case 'drop_player': {
          // Remove from all arrays
          console.log('[AdminRosterManagement] Dropping player:', selectedPlayer);
          console.log('[AdminRosterManagement] Current roster:', {
            active: roster.activeRoster,
            ir: roster.irSlots,
            redshirt: roster.redshirtPlayers,
            intl: roster.internationalPlayers
          });

          const updates: any = {
            last_updated: Date.now(),
            updated_by: 'admin'
          };

          if (roster.activeRoster.includes(selectedPlayer)) {
            console.log('[AdminRosterManagement] Removing from activeRoster');
            updates.active_roster = roster.activeRoster.filter(id => id !== selectedPlayer);
          }
          if (roster.irSlots.includes(selectedPlayer)) {
            console.log('[AdminRosterManagement] Removing from irSlots');
            updates.ir_slots = roster.irSlots.filter(id => id !== selectedPlayer);
          }
          if (roster.redshirtPlayers.includes(selectedPlayer)) {
            console.log('[AdminRosterManagement] Removing from redshirtPlayers');
            updates.redshirt_players = roster.redshirtPlayers.filter(id => id !== selectedPlayer);
          }
          if (roster.internationalPlayers.includes(selectedPlayer)) {
            console.log('[AdminRosterManagement] Removing from internationalPlayers');
            updates.international_players = roster.internationalPlayers.filter(id => id !== selectedPlayer);
          }

          console.log('[AdminRosterManagement] Updates to apply:', updates);
          const { error } = await supabase
            .from('regular_season_rosters')
            .update(updates)
            .eq('id', rosterId);
          if (error) throw error;
          console.log('[AdminRosterManagement] Drop completed successfully');
          break;
        }

        case 'add_free_agent': {
          // Add to active roster
          const newActive = [...roster.activeRoster, selectedPlayer];
          const { error } = await supabase
            .from('regular_season_rosters')
            .update({
              active_roster: newActive,
              last_updated: Date.now(),
              updated_by: 'admin'
            })
            .eq('id', rosterId);
          if (error) throw error;
          break;
        }
      }

      // Reload data
      await loadData();

      // Reset form
      setSelectedPlayer('');
      setSearchTerm('');

      alert('Action completed successfully');
    } catch (error) {
      console.error('Error executing action:', error);
      alert(`Failed to execute action: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const getPlayerLocation = (playerId: string) => {
    if (!currentRoster) return '';

    if (currentRoster.activeRoster.includes(playerId)) return 'Active Roster';
    if (currentRoster.irSlots.includes(playerId)) return 'IR';
    if (currentRoster.redshirtPlayers.includes(playerId)) return 'Redshirt';
    if (currentRoster.internationalPlayers.includes(playerId)) return 'Int Stash';
    return 'Free Agent';
  };

  const selectedPlayerObj = players.find(p => p.id === selectedPlayer);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-8">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#121212] rounded-lg border border-gray-800 max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Admin Roster Management</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage player rosters for the {seasonYear} season
          </p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setSelectedPlayer('');
                setSearchTerm('');
              }}
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Select Team --</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Roster Summary */}
          {currentRoster && (
            <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4">
              <div className="text-sm font-semibold text-white mb-3">Current Roster</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Active</div>
                  <div className="text-white font-semibold">{currentRoster.activeRoster.length}/13</div>
                </div>
                <div>
                  <div className="text-gray-400">IR</div>
                  <div className="text-white font-semibold">{currentRoster.irSlots.length}/2</div>
                </div>
                <div>
                  <div className="text-gray-400">Redshirt</div>
                  <div className="text-white font-semibold">{currentRoster.redshirtPlayers.length}</div>
                </div>
                <div>
                  <div className="text-gray-400">Int Stash</div>
                  <div className="text-white font-semibold">{currentRoster.internationalPlayers.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Action
            </label>
            <select
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value as ActionType);
                setSelectedPlayer('');
                setSearchTerm('');
              }}
              disabled={!selectedTeam}
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
              <option value="add_free_agent">Add Free Agent to Active Roster</option>
              <option value="add_to_ir">Move Player to IR</option>
              <option value="move_to_active">Move Player from IR to Active</option>
              <option value="drop_player">Drop Player</option>
            </select>
          </div>

          {/* Player Search */}
          {selectedTeam && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Player
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, team, or position..."
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {/* Player Selection */}
          {selectedTeam && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Player ({availablePlayers.length} available)
              </label>
              <div className="max-h-64 overflow-y-auto bg-[#0a0a0a] border border-gray-700 rounded-lg">
                {availablePlayers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No players available for this action
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {availablePlayers.map(player => (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayer(player.id)}
                        className={`w-full px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors ${
                          selectedPlayer === player.id ? 'bg-purple-500/20 border-l-4 border-purple-500' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-white font-medium">{player.name}</div>
                            <div className="text-sm text-gray-400">
                              {player.position} - {player.nbaTeam}
                              {actionType === 'drop_player' && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({getPlayerLocation(player.id)})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            ${(player.salary / 1_000_000).toFixed(1)}M
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selected Player Preview */}
          {selectedPlayerObj && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="text-sm font-semibold text-blue-400 mb-2">Selected Player</div>
              <div className="text-white font-medium">{selectedPlayerObj.name}</div>
              <div className="text-sm text-gray-400 mt-1">
                {selectedPlayerObj.position} - {selectedPlayerObj.nbaTeam} - ${(selectedPlayerObj.salary / 1_000_000).toFixed(1)}M
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Current Location: {getPlayerLocation(selectedPlayerObj.id)}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
          <button
            onClick={executeAction}
            disabled={processing || !selectedTeam || !selectedPlayer}
            className="flex-1 px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Execute Action'}
          </button>
        </div>
      </div>
    </div>
  );
}

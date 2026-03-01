import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { Team, Player, LeagueRosterSettings, PlayerSlot } from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';
import { mapTeam, mapPlayer } from '../lib/mappers';
import { assignPlayerToTeam, dropPlayerFromTeam, movePlayerSlot } from '../lib/rosterOps';

interface AdminRosterManagementProps {
  leagueId: string;
  seasonYear: number;
  rosterSettings?: LeagueRosterSettings;
  sport?: string;
  onClose: () => void;
}

type ActionType = 'add_to_ir' | 'move_to_active' | 'drop_player' | 'add_free_agent';

export function AdminRosterManagement({ leagueId, seasonYear, rosterSettings = DEFAULT_ROSTER_SETTINGS, sport = 'nba', onClose }: AdminRosterManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [actionType, setActionType] = useState<ActionType>('add_free_agent');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create player state
  const [showCreatePlayer, setShowCreatePlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', position: 'G', nbaTeam: '', salary: 0 });
  const [creatingPlayer, setCreatingPlayer] = useState(false);

  useEffect(() => {
    loadData();
  }, [leagueId, seasonYear]);

  const loadData = async () => {
    try {
      const [teamsRes, playersRes] = await Promise.all([
        supabase.from('teams').select('*').eq('league_id', leagueId),
        supabase.from('players').select('*').eq('league_id', leagueId),
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (playersRes.error) throw playersRes.error;

      setTeams((teamsRes.data || []).map(mapTeam).sort((a, b) => a.name.localeCompare(b.name)));
      setPlayers((playersRes.data || []).map(mapPlayer).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    } catch (error) {
      logger.error('Error loading data:', error);
      toast.error('Failed to load data');
    }
  };

  // Get team's players from players.slot
  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return players.filter(p => p.roster.teamId === selectedTeam);
  }, [selectedTeam, players]);

  const activeCount = teamPlayers.filter(p => p.slot === 'active' || p.slot === 'bench').length;
  const irCount = teamPlayers.filter(p => p.slot === 'ir').length;
  const redshirtCount = teamPlayers.filter(p => p.slot === 'redshirt').length;
  const intCount = teamPlayers.filter(p => p.slot === 'international').length;

  // Get available players based on action type
  const availablePlayers = useMemo(() => {
    let filtered: Player[] = [];

    switch (actionType) {
      case 'add_to_ir':
        filtered = teamPlayers.filter(p => p.slot === 'active' || p.slot === 'bench');
        break;
      case 'move_to_active':
        filtered = teamPlayers.filter(p => p.slot === 'ir');
        break;
      case 'drop_player':
        filtered = teamPlayers;
        break;
      case 'add_free_agent':
        filtered = players.filter(p => !p.roster.teamId);
        break;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.nbaTeam.toLowerCase().includes(term) ||
        p.position.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [teamPlayers, actionType, players, searchTerm]);

  const executeAction = async () => {
    if (!selectedTeam || !selectedPlayer) {
      toast.error('Please select a team and player');
      return;
    }

    setProcessing(true);

    try {
      let result;

      switch (actionType) {
        case 'add_to_ir': {
          if (irCount >= rosterSettings.maxIR) {
            toast.error(`IR is full (max ${rosterSettings.maxIR} players)`);
            setProcessing(false);
            return;
          }
          result = await movePlayerSlot({
            playerId: selectedPlayer,
            teamId: selectedTeam,
            leagueId,
            toSlot: 'ir',
          });
          break;
        }

        case 'move_to_active': {
          result = await movePlayerSlot({
            playerId: selectedPlayer,
            teamId: selectedTeam,
            leagueId,
            toSlot: 'active',
          });
          break;
        }

        case 'drop_player': {
          result = await dropPlayerFromTeam({
            playerId: selectedPlayer,
            teamId: selectedTeam,
            leagueId,
          });
          break;
        }

        case 'add_free_agent': {
          result = await assignPlayerToTeam({
            playerId: selectedPlayer,
            teamId: selectedTeam,
            leagueId,
            slot: 'active',
          });
          break;
        }
      }

      if (result && !result.success) {
        toast.error(result.error || 'Action failed');
      } else {
        toast.success('Action completed successfully');
      }

      await loadData();
      setSelectedPlayer('');
      setSearchTerm('');
    } catch (error) {
      logger.error('Error executing action:', error);
      toast.error(`Failed to execute action: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreatePlayer = async () => {
    if (!newPlayer.name.trim()) {
      toast.error('Player name is required');
      return;
    }
    setCreatingPlayer(true);
    try {
      const playerId = `${sport}_${newPlayer.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const { error } = await supabase.from('players').insert({
        id: playerId,
        name: newPlayer.name.trim(),
        position: newPlayer.position,
        nba_team: newPlayer.nbaTeam.trim(),
        salary: newPlayer.salary,
        sport,
        league_id: leagueId,
        slot: 'free_agent',
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('A player with this name already exists');
        } else {
          throw error;
        }
      } else {
        toast.success(`${newPlayer.name} created as free agent`);
        setNewPlayer({ name: '', position: 'G', nbaTeam: '', salary: 0 });
        await loadData();
      }
    } catch (error) {
      logger.error('Error creating player:', error);
      toast.error(`Failed to create player: ${error}`);
    } finally {
      setCreatingPlayer(false);
    }
  };

  const getSlotLabel = (slot: PlayerSlot) => {
    switch (slot) {
      case 'active': return 'Active';
      case 'bench': return 'Bench';
      case 'ir': return 'IR';
      case 'redshirt': return 'Redshirt';
      case 'international': return 'Int Stash';
      default: return slot;
    }
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
          {selectedTeam && (
            <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4">
              <div className="text-sm font-semibold text-white mb-3">Current Roster</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Active</div>
                  <div className="text-white font-semibold">{activeCount}/{rosterSettings.maxActive}</div>
                </div>
                <div>
                  <div className="text-gray-400">IR</div>
                  <div className="text-white font-semibold">{irCount}/{rosterSettings.maxIR}</div>
                </div>
                <div>
                  <div className="text-gray-400">Redshirt</div>
                  <div className="text-white font-semibold">{redshirtCount}</div>
                </div>
                <div>
                  <div className="text-gray-400">Int Stash</div>
                  <div className="text-white font-semibold">{intCount}</div>
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
                                  ({getSlotLabel(player.slot)})
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
                Current Slot: {getSlotLabel(selectedPlayerObj.slot)}
              </div>
            </div>
          )}
        </div>

        {/* Create Player */}
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowCreatePlayer(!showCreatePlayer)}
            className="text-sm text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
          >
            <span>{showCreatePlayer ? '−' : '+'}</span>
            <span>Create New Player</span>
          </button>
          {showCreatePlayer && (
            <div className="mt-3 bg-[#0a0a0a] border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Player Name *"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="px-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-400"
                />
                <select
                  value={newPlayer.position}
                  onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                  className="px-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-400"
                >
                  <option value="G">G</option>
                  <option value="F">F</option>
                  <option value="C">C</option>
                  <option value="G-F">G-F</option>
                  <option value="F-C">F-C</option>
                  <option value="F-G">F-G</option>
                </select>
                <input
                  type="text"
                  placeholder={sport === 'wnba' ? 'WNBA Team' : 'NBA Team'}
                  value={newPlayer.nbaTeam}
                  onChange={(e) => setNewPlayer({ ...newPlayer, nbaTeam: e.target.value })}
                  className="px-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-400"
                />
                <input
                  type="number"
                  placeholder="Salary"
                  value={newPlayer.salary || ''}
                  onChange={(e) => setNewPlayer({ ...newPlayer, salary: parseInt(e.target.value) || 0 })}
                  className="px-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <button
                onClick={handleCreatePlayer}
                disabled={creatingPlayer || !newPlayer.name.trim()}
                className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingPlayer ? 'Creating...' : 'Create Player'}
              </button>
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

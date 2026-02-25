import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase, fetchAllRows } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useNavigate } from 'react-router-dom';
import { useCanManageLeague } from '../hooks/useCanManageLeague';
import { useLeague } from '../contexts/LeagueContext';
import { useAuth } from '../contexts/AuthContext';
import type { Player, Team, PlayerSlot } from '../types';
import { mapTeam, mapPlayer } from '../lib/mappers';

interface ParsedRow {
  fantraxId: string;
  position: string;
  playerName: string;
  nbaTeam: string;
  eligible: string;
  status: string;
  slot: PlayerSlot;
  matchedPlayer: Player | null;
  matchType: 'exact' | 'name' | 'none';
}

const STATUS_TO_SLOT: Record<string, PlayerSlot> = {
  Act: 'active',
  Res: 'active',
  IR: 'ir',
  Min: 'redshirt', // default for Min — user can toggle to 'international' per player
};

const SLOT_LABELS: Record<PlayerSlot, string> = {
  active: 'Active',
  ir: 'IR',
  redshirt: 'Redshirt',
  international: 'Int\'l',
  bench: 'Bench',
};

function parseTSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);
  const rows: ParsedRow[] = [];

  for (const line of dataLines) {
    const cols = line.split('\t');
    if (cols.length < 6) continue;

    const rawId = cols[0].trim();
    const position = cols[1].trim();
    const playerName = cols[2].trim();
    const nbaTeam = cols[3].trim().replace('(N/A)', 'N/A');
    const eligible = cols[4].trim();
    const status = cols[5].trim();

    // Strip asterisks from Fantrax ID: *0631x* → 0631x
    const fantraxId = rawId.replace(/\*/g, '');

    const slot = STATUS_TO_SLOT[status] || 'active';

    rows.push({
      fantraxId,
      position,
      playerName,
      nbaTeam,
      eligible,
      status,
      slot,
      matchedPlayer: null,
      matchType: 'none',
    });
  }

  return rows;
}

function matchPlayers(rows: ParsedRow[], players: Player[]): ParsedRow[] {
  // Build lookup maps
  const byFantraxId = new Map<string, Player>();
  const byNameLower = new Map<string, Player>();

  for (const p of players) {
    if (p.fantraxId) byFantraxId.set(p.fantraxId, p);
    byNameLower.set(p.name.toLowerCase(), p);
  }

  return rows.map(row => {
    // Try exact fantrax_id match first
    const byId = byFantraxId.get(row.fantraxId);
    if (byId) {
      return { ...row, matchedPlayer: byId, matchType: 'exact' as const };
    }

    // Fallback to name match
    const byName = byNameLower.get(row.playerName.toLowerCase());
    if (byName) {
      return { ...row, matchedPlayer: byName, matchType: 'name' as const };
    }

    return { ...row, matchedPlayer: null, matchType: 'none' as const };
  });
}

export function AdminRosterImport() {
  const canManage = useCanManageLeague();
  const navigate = useNavigate();
  const { currentLeagueId } = useLeague();
  const { user: _user } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [completedTeams, setCompletedTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!canManage) navigate('/');
  }, [canManage, navigate]);

  useEffect(() => {
    if (!currentLeagueId) return;
    loadData();
  }, [currentLeagueId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsRes, playersRows] = await Promise.all([
        supabase.from('teams').select('*').eq('league_id', currentLeagueId),
        fetchAllRows('players', '*', (q: any) => q.eq('league_id', currentLeagueId)),
      ]);

      if (teamsRes.error) throw teamsRes.error;
      setTeams((teamsRes.data || []).map(mapTeam));
      setPlayers(playersRows.map(mapPlayer));
    } catch (error) {
      logger.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const selectedTeam = useMemo(
    () => teams.find(t => t.id === selectedTeamId),
    [teams, selectedTeamId]
  );

  const handleParse = () => {
    if (!pasteText.trim()) {
      toast.error('Paste a Fantrax roster export first');
      return;
    }
    const raw = parseTSV(pasteText);
    if (raw.length === 0) {
      toast.error('Could not parse any rows. Check the format.');
      return;
    }
    const matched = matchPlayers(raw, players);
    setParsedRows(matched);
  };

  const unmatchedCount = parsedRows.filter(r => r.matchType === 'none').length;

  const handleSlotToggle = (rowIndex: number, slot: PlayerSlot) => {
    setParsedRows(prev =>
      prev.map((r, i) => i === rowIndex ? { ...r, slot } : r)
    );
  };

  const handleManualMatch = (rowIndex: number, playerId: string) => {
    const player = players.find(p => p.id === playerId) || null;
    setParsedRows(prev =>
      prev.map((r, i) =>
        i === rowIndex
          ? { ...r, matchedPlayer: player, matchType: player ? 'name' as const : 'none' as const }
          : r
      )
    );
  };

  const handleConfirm = async () => {
    if (!selectedTeamId || !currentLeagueId) return;
    if (unmatchedCount > 0) {
      toast.error('Resolve all unmatched players before confirming');
      return;
    }

    setConfirming(true);
    try {
      const matchedPlayerIds = new Set<string>();

      // Collect all matched players with their slots
      const playerUpdates: Array<{ id: string; slot: PlayerSlot; name: string }> = [];
      for (const row of parsedRows) {
        if (!row.matchedPlayer) continue;
        matchedPlayerIds.add(row.matchedPlayer.id);
        playerUpdates.push({
          id: row.matchedPlayer.id,
          slot: row.slot,
          name: row.matchedPlayer.name,
        });
      }

      // 1. Find players currently on this team that are NOT in the new roster
      const currentlyOnTeam = players.filter(
        p => p.roster?.teamId === selectedTeamId
      );
      const removedPlayers = currentlyOnTeam.filter(
        p => !matchedPlayerIds.has(p.id)
      );

      // 2. Set players.team_id + players.slot for all matched players
      for (const update of playerUpdates) {
        const { error } = await supabase
          .from('players')
          .update({
            team_id: selectedTeamId,
            slot: update.slot,
            on_ir: update.slot === 'ir',
          })
          .eq('id', update.id);
        if (error) {
          logger.error(`Failed to update ${update.name}:`, error);
        }
      }

      // 3. Release removed players (null team_id, reset slot)
      for (const p of removedPlayers) {
        const { error } = await supabase
          .from('players')
          .update({ team_id: null, slot: 'active', on_ir: false })
          .eq('id', p.id);
        if (error) {
          logger.error(`Failed to release ${p.name}:`, error);
        }
      }

      toast.success(
        `Roster imported for ${selectedTeam?.name || selectedTeamId}! ` +
        `${matchedPlayerIds.size} players assigned, ${removedPlayers.length} released.`
      );

      // Mark team as done, reset form
      setCompletedTeams(prev => new Set([...prev, selectedTeamId]));
      setParsedRows([]);
      setPasteText('');
      setSelectedTeamId('');

      // Refresh player data so next team sees updated ownership
      await loadData();
    } catch (error) {
      logger.error('Error importing roster:', error);
      toast.error('Failed to import roster');
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setPasteText('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Admin Roster Import</h1>
      <p className="text-gray-400 text-sm mb-6">
        Paste a Fantrax roster export to set a team's roster. Updates{' '}
        <code className="text-green-400">players.team_id</code> and{' '}
        <code className="text-green-400">players.slot</code>.
      </p>

      {/* Progress */}
      {teams.length > 0 && (
        <div className="mb-6 p-3 bg-[#111] rounded border border-gray-800">
          <div className="text-xs text-gray-500 mb-2">
            Progress: {completedTeams.size} / {teams.length} teams imported
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.map(t => (
              <span
                key={t.id}
                className={`text-xs px-2 py-1 rounded ${
                  completedTeams.has(t.id)
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}
              >
                {t.abbrev || t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Select team */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Team</label>
        <select
          className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white"
          value={selectedTeamId}
          onChange={e => {
            setSelectedTeamId(e.target.value);
            setParsedRows([]);
            setPasteText('');
          }}
        >
          <option value="">Select a team...</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} {completedTeams.has(t.id) ? '✓' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: Paste */}
      {selectedTeamId && (
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">
            Paste Fantrax Roster (tab-separated)
          </label>
          <textarea
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white font-mono text-xs h-48 resize-y"
            placeholder={`ID\tPos\tPlayer\tTeam\tEligible\tStatus\n*0631x*\tG\tCJ McCollum\tATL\tG\tAct`}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleParse}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
            >
              Parse & Match
            </button>
            {parsedRows.length > 0 && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {parsedRows.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">
              Preview — {parsedRows.length} players
            </h2>
            {unmatchedCount > 0 && (
              <span className="text-red-400 text-sm font-medium">
                {unmatchedCount} unmatched
              </span>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-800 rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111] text-gray-400 text-xs">
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-left px-3 py-2">Pos</th>
                  <th className="text-left px-3 py-2">NBA</th>
                  <th className="text-left px-3 py-2">Slot</th>
                  <th className="text-left px-3 py-2">Match</th>
                  <th className="text-left px-3 py-2">DB Player</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-800 ${
                      row.matchType === 'none' ? 'bg-red-950/30' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">{row.playerName}</td>
                    <td className="px-3 py-2 text-gray-400">{row.position}</td>
                    <td className="px-3 py-2 text-gray-400">{row.nbaTeam}</td>
                    <td className="px-3 py-2">
                      {row.status === 'Min' ? (
                        <select
                          value={row.slot}
                          onChange={e => handleSlotToggle(i, e.target.value as PlayerSlot)}
                          className="bg-[#1a1a1a] border border-purple-700 rounded px-2 py-1 text-xs text-purple-400"
                        >
                          <option value="redshirt">Redshirt</option>
                          <option value="international">Int'l Stash</option>
                        </select>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            row.slot === 'active'
                              ? 'bg-green-900/50 text-green-400'
                              : row.slot === 'ir'
                              ? 'bg-yellow-900/50 text-yellow-400'
                              : 'bg-purple-900/50 text-purple-400'
                          }`}
                        >
                          {SLOT_LABELS[row.slot]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.matchType === 'exact' && (
                        <span className="text-green-400 text-xs">ID match</span>
                      )}
                      {row.matchType === 'name' && (
                        <span className="text-blue-400 text-xs">Name match</span>
                      )}
                      {row.matchType === 'none' && (
                        <span className="text-red-400 text-xs font-medium">No match</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.matchType !== 'none' ? (
                        <span className="text-gray-300 text-xs">
                          {row.matchedPlayer?.name}
                          {row.matchedPlayer?.roster?.teamId &&
                            row.matchedPlayer.roster.teamId !== selectedTeamId && (
                              <span className="text-yellow-400 ml-1">
                                (on {teams.find(t => t.id === row.matchedPlayer?.roster?.teamId)?.abbrev || 'other'})
                              </span>
                            )}
                        </span>
                      ) : (
                        <select
                          className="bg-[#1a1a1a] border border-red-700 rounded px-2 py-1 text-xs text-white w-full"
                          value=""
                          onChange={e => handleManualMatch(i, e.target.value)}
                        >
                          <option value="">Select player...</option>
                          {players
                            .filter(p =>
                              p.name.toLowerCase().includes(row.playerName.split(' ').pop()?.toLowerCase() || '')
                            )
                            .slice(0, 20)
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.nbaTeam})
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming || unmatchedCount > 0}
              className={`px-6 py-2 rounded text-sm font-medium ${
                confirming || unmatchedCount > 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {confirming ? 'Importing...' : `Confirm Import for ${selectedTeam?.name || 'team'}`}
            </button>
            {unmatchedCount > 0 && (
              <span className="text-gray-500 text-xs">
                Fix {unmatchedCount} unmatched player{unmatchedCount > 1 ? 's' : ''} first
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

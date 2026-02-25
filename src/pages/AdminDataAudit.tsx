import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { useLeague } from '../contexts/LeagueContext';
import { supabase } from '../lib/supabase';
import { mapPlayer } from '../lib/mappers';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

interface IntegrityIssue {
  type: 'invalid_slot' | 'orphaned_team_id' | 'free_agent_bad_slot' | 'missing_slot';
  playerId: string;
  playerName: string;
  teamId?: string;
  teamName?: string;
  details: string;
}

export function AdminDataAudit() {
  const isSiteAdmin = useIsSiteAdmin();
  const navigate = useNavigate();
  const { currentLeagueId } = useLeague();
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [_playerCount, setPlayerCount] = useState(0);
  const [_teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    if (!isSiteAdmin) {
      navigate('/');
    }
  }, [isSiteAdmin, navigate]);

  const runAudit = async () => {
    if (!currentLeagueId) {
      toast.error('No league selected');
      return;
    }

    setLoading(true);
    try {
      // Load all players and teams
      const [playersRes, teamsRes] = await Promise.all([
        supabase.from('players').select('*').eq('league_id', currentLeagueId),
        supabase.from('teams').select('id, name').eq('league_id', currentLeagueId),
      ]);

      if (playersRes.error) throw playersRes.error;
      if (teamsRes.error) throw teamsRes.error;

      const players = (playersRes.data || []).map(mapPlayer);
      const teams = teamsRes.data || [];
      const teamMap = new Map(teams.map(t => [t.id, t.name]));

      setPlayerCount(players.length);
      setTeamCount(teams.length);

      const foundIssues: IntegrityIssue[] = [];
      const validSlots = ['active', 'bench', 'ir', 'redshirt', 'international'];

      for (const player of players) {
        // Check: player has a team_id that doesn't match any team
        if (player.roster.teamId && !teamMap.has(player.roster.teamId)) {
          foundIssues.push({
            type: 'orphaned_team_id',
            playerId: player.id,
            playerName: player.name,
            teamId: player.roster.teamId,
            details: `team_id "${player.roster.teamId}" does not match any team in this league`,
          });
        }

        // Check: invalid slot value
        if (!validSlots.includes(player.slot)) {
          foundIssues.push({
            type: 'invalid_slot',
            playerId: player.id,
            playerName: player.name,
            teamId: player.roster.teamId || undefined,
            teamName: player.roster.teamId ? teamMap.get(player.roster.teamId) : undefined,
            details: `slot="${player.slot}" is not a valid slot`,
          });
        }

        // Check: free agent with non-default slot
        if (!player.roster.teamId && player.slot !== 'active') {
          foundIssues.push({
            type: 'free_agent_bad_slot',
            playerId: player.id,
            playerName: player.name,
            details: `Free agent with slot="${player.slot}" (should be "active")`,
          });
        }
      }

      // Check roster counts per team
      const teamRosterCounts = new Map<string, number>();
      for (const player of players) {
        if (player.roster.teamId) {
          teamRosterCounts.set(
            player.roster.teamId,
            (teamRosterCounts.get(player.roster.teamId) || 0) + 1
          );
        }
      }

      setIssues(foundIssues);

      if (foundIssues.length === 0) {
        const rosterSummary = Array.from(teamRosterCounts.entries())
          .map(([teamId, count]) => `${teamMap.get(teamId) || teamId}: ${count}`)
          .join(', ');
        setSummary(`All clear! ${players.length} players, ${teams.length} teams. Roster sizes: ${rosterSummary}`);
        toast.success('No integrity issues found');
      } else {
        setSummary(`Found ${foundIssues.length} issue(s) across ${players.length} players`);
        toast.error(`Found ${foundIssues.length} issue(s)`);
      }
    } catch (error) {
      logger.error('Error running audit:', error);
      toast.error('Failed to run audit');
    } finally {
      setLoading(false);
    }
  };

  const handleFixFreeAgentSlots = async () => {
    if (!currentLeagueId) return;
    setFixing(true);
    try {
      const playerIds = issues
        .filter(i => i.type === 'free_agent_bad_slot')
        .map(i => i.playerId);

      if (playerIds.length === 0) return;

      const { error } = await supabase
        .from('players')
        .update({ slot: 'active', on_ir: false })
        .in('id', playerIds);

      if (error) throw error;

      toast.success(`Fixed ${playerIds.length} free agent slot(s)`);
      await runAudit();
    } catch (error) {
      logger.error('Error fixing slots:', error);
      toast.error('Failed to fix slots');
    } finally {
      setFixing(false);
    }
  };

  const handleClearOrphanedTeamIds = async () => {
    if (!currentLeagueId) return;
    setFixing(true);
    try {
      const playerIds = issues
        .filter(i => i.type === 'orphaned_team_id')
        .map(i => i.playerId);

      if (playerIds.length === 0) return;

      const { error } = await supabase
        .from('players')
        .update({ team_id: null, slot: 'active', on_ir: false })
        .in('id', playerIds);

      if (error) throw error;

      toast.success(`Cleared ${playerIds.length} orphaned team_id(s)`);
      await runAudit();
    } catch (error) {
      logger.error('Error clearing team_ids:', error);
      toast.error('Failed to clear team_ids');
    } finally {
      setFixing(false);
    }
  };

  const orphanedIssues = issues.filter(i => i.type === 'orphaned_team_id');
  const slotIssues = issues.filter(i => i.type === 'invalid_slot' || i.type === 'free_agent_bad_slot');

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-white mb-2">Data Integrity Audit</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Validates players.team_id and players.slot consistency.
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={runAudit}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Run Audit'}
          </button>
        </div>

        {summary && (
          <div className={`p-4 rounded-lg mb-6 border ${issues.length === 0 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
            {summary}
          </div>
        )}

        {/* Fix All buttons */}
        {issues.length > 0 && (
          <div className="bg-[#121212] border border-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">Quick Fixes</h3>
            <div className="flex flex-wrap gap-3">
              {orphanedIssues.length > 0 && (
                <button
                  onClick={handleClearOrphanedTeamIds}
                  disabled={fixing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                >
                  {fixing ? 'Fixing...' : `Clear Orphaned team_ids (${orphanedIssues.length})`}
                </button>
              )}
              {slotIssues.length > 0 && (
                <button
                  onClick={handleFixFreeAgentSlots}
                  disabled={fixing}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                >
                  {fixing ? 'Fixing...' : `Fix Bad Slots (${slotIssues.length})`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Orphaned Team IDs */}
        {orphanedIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-red-400 mb-3">
              Orphaned Team IDs ({orphanedIssues.length})
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Players whose team_id doesn't match any team in the league.
            </p>
            <div className="bg-[#121212] border border-gray-800 rounded-lg divide-y divide-gray-800">
              {orphanedIssues.map((issue, idx) => (
                <div key={idx} className="p-3 text-sm">
                  <span className="text-white font-medium">{issue.playerName}</span>
                  <span className="text-gray-400 ml-2">{issue.details}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Slot Issues */}
        {slotIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-yellow-400 mb-3">
              Slot Issues ({slotIssues.length})
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Players with invalid or inconsistent slot values.
            </p>
            <div className="bg-[#121212] border border-gray-800 rounded-lg divide-y divide-gray-800">
              {slotIssues.map((issue, idx) => (
                <div key={idx} className="p-3 text-sm">
                  <span className="text-white font-medium">{issue.playerName}</span>
                  <span className="text-gray-400 ml-2">{issue.details}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { useLeague } from '../contexts/LeagueContext';
import { validateLeagueIntegrity, fixOrphanedIds, fixTeamIdMismatches, fixNotInRoster, rebuildAllRosters } from '../lib/rosterOps';
import { toast } from 'sonner';

interface IntegrityIssue {
  type: 'orphaned_id' | 'team_id_mismatch' | 'duplicate' | 'null_team_id';
  teamId: string;
  teamName?: string;
  playerId: string;
  playerName?: string;
  slot?: string;
  details: string;
}

export function AdminDataAudit() {
  const isSiteAdmin = useIsSiteAdmin();
  const navigate = useNavigate();
  const { currentLeagueId, currentLeague } = useLeague();
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

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
      const result = await validateLeagueIntegrity({ leagueId: currentLeagueId });
      setIssues(result.issues);
      setSummary(result.summary);
      if (result.issues.length === 0) {
        toast.success('No integrity issues found');
      } else {
        toast.error(`Found ${result.issues.length} issue(s)`);
      }
    } catch (error) {
      toast.error('Failed to run audit');
    } finally {
      setLoading(false);
    }
  };

  const handleFixAllOrphans = async () => {
    if (!currentLeagueId) return;
    setFixing(true);
    try {
      const orphansByTeam = new Map<string, string[]>();
      for (const issue of issues.filter(i => i.type === 'orphaned_id')) {
        const existing = orphansByTeam.get(issue.teamId) || [];
        existing.push(issue.playerId);
        orphansByTeam.set(issue.teamId, existing);
      }

      let totalFixed = 0;
      for (const [teamId, orphanIds] of orphansByTeam) {
        const result = await fixOrphanedIds({
          leagueId: currentLeagueId,
          teamId,
          orphanedIds: orphanIds,
          updatedBy: 'admin_audit',
        });
        if (result.success) {
          totalFixed += orphanIds.length;
        } else {
          toast.error(`Failed to fix orphans for team ${teamId}: ${result.error}`);
        }
      }

      toast.success(`Removed ${totalFixed} orphaned ID(s) across ${orphansByTeam.size} teams`);
      await runAudit();
    } finally {
      setFixing(false);
    }
  };

  const handleFixOrphans = async (teamId: string) => {
    if (!currentLeagueId) return;
    setFixing(true);
    try {
      const orphanIds = issues
        .filter(i => i.type === 'orphaned_id' && i.teamId === teamId)
        .map(i => i.playerId);

      const result = await fixOrphanedIds({
        leagueId: currentLeagueId,
        teamId,
        orphanedIds: orphanIds,
        updatedBy: 'admin_audit',
      });

      if (result.success) {
        toast.success(`Removed ${orphanIds.length} orphaned ID(s)`);
        await runAudit();
      } else {
        toast.error(result.error || 'Fix failed');
      }
    } finally {
      setFixing(false);
    }
  };

  const handleFixMismatches = async () => {
    setFixing(true);
    try {
      const fixes = issues
        .filter(i => i.type === 'team_id_mismatch')
        .map(i => ({ playerId: i.playerId, correctTeamId: i.teamId }));

      const result = await fixTeamIdMismatches({ fixes });

      if (result.success) {
        toast.success(`Fixed ${fixes.length} team_id mismatch(es)`);
        await runAudit();
      } else {
        toast.error(result.error || 'Fix failed');
      }
    } finally {
      setFixing(false);
    }
  };

  const handleFixNotInRoster = async (action: 'add_to_roster' | 'clear_team_id') => {
    if (!currentLeagueId) return;
    setFixing(true);
    try {
      const fixes = missingFromRosterIssues.map(i => ({
        playerId: i.playerId,
        teamId: i.teamId,
        action,
      }));

      const result = await fixNotInRoster({
        fixes,
        leagueId: currentLeagueId,
        updatedBy: 'admin_audit',
      });

      if (result.success) {
        const label = action === 'add_to_roster' ? 'added to rosters' : 'cleared team_id';
        toast.success(`${fixes.length} player(s) ${label}`);
        await runAudit();
      } else {
        toast.error(result.error || 'Fix failed');
      }
    } finally {
      setFixing(false);
    }
  };

  const handleRebuildAll = async () => {
    if (!currentLeagueId) return;
    setFixing(true);
    try {
      const result = await rebuildAllRosters({
        leagueId: currentLeagueId,
        seasonYear: currentLeague?.seasonYear || new Date().getFullYear(),
        updatedBy: 'admin_audit',
      });

      if (result.success) {
        toast.success(result.details || 'Rosters rebuilt');
        await runAudit();
      } else {
        toast.error(result.error || 'Rebuild failed');
      }
    } finally {
      setFixing(false);
    }
  };

  const orphanedIssues = issues.filter(i => i.type === 'orphaned_id');
  const mismatchIssues = issues.filter(i => i.type === 'team_id_mismatch');
  const duplicateIssues = issues.filter(i => i.type === 'duplicate');
  const missingFromRosterIssues = issues.filter(i => i.type === 'null_team_id');

  // Group orphaned issues by team
  const orphansByTeam = new Map<string, IntegrityIssue[]>();
  for (const issue of orphanedIssues) {
    const existing = orphansByTeam.get(issue.teamId) || [];
    existing.push(issue);
    orphansByTeam.set(issue.teamId, existing);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-white mb-2">Data Integrity Audit</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Checks for desync between players.team_id, regular_season_rosters arrays, and the players table.
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={runAudit}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Run Audit'}
          </button>

          <button
            onClick={handleRebuildAll}
            disabled={fixing || loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {fixing ? 'Rebuilding...' : 'Rebuild All Rosters from team_id'}
          </button>
        </div>

        {summary && (
          <div className={`p-4 rounded-lg mb-6 border ${issues.length === 0 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
            {summary}
          </div>
        )}

        {/* Fix All button when there are issues */}
        {issues.length > 0 && (
          <div className="bg-[#121212] border border-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">Quick Fix All</h3>
            <div className="flex flex-wrap gap-3">
              {orphanedIssues.length > 0 && (
                <button
                  onClick={handleFixAllOrphans}
                  disabled={fixing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                >
                  {fixing ? 'Fixing...' : `Remove All Orphans (${orphanedIssues.length})`}
                </button>
              )}
              {mismatchIssues.length > 0 && (
                <button
                  onClick={handleFixMismatches}
                  disabled={fixing}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                >
                  {fixing ? 'Fixing...' : `Fix All Mismatches (${mismatchIssues.length})`}
                </button>
              )}
              {missingFromRosterIssues.length > 0 && (
                <>
                  <button
                    onClick={() => handleFixNotInRoster('add_to_roster')}
                    disabled={fixing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                  >
                    {fixing ? 'Fixing...' : `Add Missing to Rosters (${missingFromRosterIssues.length})`}
                  </button>
                  <button
                    onClick={() => handleFixNotInRoster('clear_team_id')}
                    disabled={fixing}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                  >
                    {fixing ? 'Fixing...' : `Clear team_id Instead (${missingFromRosterIssues.length})`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Orphaned IDs */}
        {orphanedIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-red-400 mb-3">
              Orphaned IDs ({orphanedIssues.length})
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Player IDs in roster arrays that don't match any player in the database. These cause silent roster count drops.
            </p>

            {Array.from(orphansByTeam.entries()).map(([teamId, teamIssues]) => (
              <div key={teamId} className="bg-[#121212] border border-gray-800 rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">
                    {teamIssues[0].teamName || teamId} — {teamIssues.length} orphan(s)
                  </h3>
                  <button
                    onClick={() => handleFixOrphans(teamId)}
                    disabled={fixing}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50"
                  >
                    Remove Orphans
                  </button>
                </div>
                {teamIssues.map((issue, idx) => (
                  <div key={idx} className="text-gray-400 text-sm font-mono">
                    {issue.slot}: {issue.playerId}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {/* Team ID Mismatches */}
        {mismatchIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-yellow-400 mb-3">
              Team ID Mismatches ({mismatchIssues.length})
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Players whose players.team_id doesn't match the roster they appear in. Fix sets team_id to match the roster.
            </p>

            <div className="bg-[#121212] border border-gray-800 rounded-lg divide-y divide-gray-800">
              {mismatchIssues.map((issue, idx) => (
                <div key={idx} className="p-3 text-sm">
                  <span className="text-white font-medium">{issue.playerName}</span>
                  <span className="text-gray-400 ml-2">{issue.details}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Duplicates */}
        {duplicateIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-red-500 mb-3">
              Duplicates ({duplicateIssues.length})
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Players appearing on multiple teams' rosters. This is a critical integrity violation.
            </p>

            <div className="bg-[#121212] border border-red-800 rounded-lg divide-y divide-gray-800">
              {duplicateIssues.map((issue, idx) => (
                <div key={idx} className="p-3 text-sm">
                  <span className="text-white font-medium">{issue.playerName}</span>
                  <span className="text-red-400 ml-2">{issue.details}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Missing from roster */}
        {missingFromRosterIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-orange-400 mb-3">
              Not in Roster ({missingFromRosterIssues.length})
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Players with a team_id set but not appearing in that team's regular_season_rosters arrays.
              You can add them to their team's active roster, or clear their team_id to make them free agents.
            </p>

            <div className="bg-[#121212] border border-gray-800 rounded-lg divide-y divide-gray-800">
              {missingFromRosterIssues.map((issue, idx) => (
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

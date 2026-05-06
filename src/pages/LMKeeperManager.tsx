import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useLeague as useLeagueContext } from '../contexts/LeagueContext';
import { useCanManageLeague } from '../hooks/useCanManageLeague';
import { useTeamPlayers, useRoster, updateRoster, submitRoster } from '../hooks/useRoster';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { usePreviousStats } from '../hooks/usePreviousStats';
import { RosterTable } from '../components/RosterTable';
import { baseKeeperRound, assignInauguralKeeperRounds, validateRoster } from '../lib/keeperAlgorithms';
import { mapPlayer, mapRoster, mapTeam } from '../lib/mappers';
import type { Decision, RosterEntry, Team } from '../types';

export function LMKeeperManager() {
  const navigate = useNavigate();
  const canManage = useCanManageLeague();
  const { currentLeague, currentLeagueId } = useLeagueContext();

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const { players } = useTeamPlayers(currentLeagueId || '', selectedTeamId || '');
  const { roster } = useRoster(currentLeagueId || '', selectedTeamId || '');
  const { projectedStats } = useProjectedStats();
  const { previousStats } = usePreviousStats();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  useEffect(() => {
    if (!canManage) {
      navigate('/');
    }
  }, [canManage, navigate]);

  useEffect(() => {
    if (!currentLeagueId) {
      setTeams([]);
      setTeamsLoading(false);
      return;
    }

    const fetchTeams = async () => {
      setTeamsLoading(true);
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', currentLeagueId);
        if (error) throw error;
        const mapped = (data || []).map(mapTeam).sort((a, b) => a.name.localeCompare(b.name));
        setTeams(mapped);
      } catch (err) {
        logger.error('LMKeeperManager: failed to load teams', err);
        toast.error('Failed to load teams');
      } finally {
        setTeamsLoading(false);
      }
    };

    fetchTeams();
  }, [currentLeagueId]);

  const playersMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Initialize entries when team changes (or roster loads). Prefer saved
  // roster.entries (so the LM sees what the owner submitted); otherwise seed
  // a clean slate of DROPs from the team's player list.
  useEffect(() => {
    if (!selectedTeamId) {
      setEntries([]);
      return;
    }
    if (roster?.entries && roster.entries.length > 0) {
      const refreshed = roster.entries.map((entry) => {
        const player = playersMap.get(entry.playerId);
        return {
          ...entry,
          baseRound: player ? baseKeeperRound(player) || 13 : entry.baseRound || 13,
        };
      });
      setEntries(refreshed);
    } else if (players.length > 0) {
      setEntries(
        players.map((p) => ({
          playerId: p.id,
          decision: 'DROP' as Decision,
          baseRound: baseKeeperRound(p) || 13,
        })),
      );
    } else {
      setEntries([]);
    }
  }, [selectedTeamId, roster, players, playersMap]);

  const handleDecisionChange = (playerId: string, decision: Decision) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.playerId !== playerId) return entry;
        const player = playersMap.get(playerId);
        const calculatedBaseRound = player ? baseKeeperRound(player) || 13 : entry.baseRound || 13;
        return { ...entry, decision, baseRound: calculatedBaseRound };
      }),
    );
  };

  const handleUpdatePriority = (playerId: string, direction: 'up' | 'down') => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.playerId === playerId);
      if (!entry?.baseRound) return prev;

      const sameBaseRoundEntries = prev.filter(
        (e) => e.baseRound === entry.baseRound && e.decision !== 'DROP',
      );
      if (sameBaseRoundEntries.length <= 1) return prev;

      const sorted = [...sameBaseRoundEntries].sort((a, b) => {
        const prioA = a.priority ?? 999;
        const prioB = b.priority ?? 999;
        return prioA - prioB;
      });

      const currentIndex = sorted.findIndex((e) => e.playerId === playerId);
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= sorted.length) return prev;

      [sorted[currentIndex], sorted[newIndex]] = [sorted[newIndex], sorted[currentIndex]];

      const priorityMap = new Map(sorted.map((e, idx) => [e.playerId, idx]));
      return prev.map((e) => {
        const newPriority = priorityMap.get(e.playerId);
        return newPriority !== undefined ? { ...e, priority: newPriority } : e;
      });
    });
  };

  // Inaugural-year mode: number KEEPs 1..N from highest salary so the LM
  // can preview the resulting keeper rounds before saving.
  const stackedEntries = useMemo(
    () => assignInauguralKeeperRounds(entries.map((e) => ({ ...e })), playersMap).entries,
    [entries, playersMap],
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const entryA = entries.find((e) => e.playerId === a.id);
      const entryB = entries.find((e) => e.playerId === b.id);
      const baseA = entryA?.baseRound ?? a.keeper?.derivedBaseRound ?? 999;
      const baseB = entryB?.baseRound ?? b.keeper?.derivedBaseRound ?? 999;
      return baseA - baseB;
    });
  }, [players, entries]);

  const handleSaveAndSubmit = async () => {
    if (!currentLeagueId || !selectedTeamId || !selectedTeam) return;

    const errors = validateRoster(entries, playersMap, selectedTeam.settings.maxKeepers);
    const blocking = errors.filter((e) => e.type === 'error');
    if (blocking.length > 0) {
      toast.error(
        'Please fix the following errors before submitting:\n\n' +
          blocking.map((e) => `• ${e.message}`).join('\n'),
      );
      return;
    }

    const confirmed = window.confirm(
      `Save and submit keepers for ${selectedTeam.name}? This will set the roster status to 'submitted'.`,
    );
    if (!confirmed) return;

    try {
      setIsSaving(true);
      await updateRoster({
        leagueId: currentLeagueId,
        teamId: selectedTeamId,
        entries,
        allPlayers: playersMap,
        tradeDelta: selectedTeam.capAdjustments.tradeDelta || 0,
        stackingMode: 'inaugural',
      });
      await submitRoster(currentLeagueId, selectedTeamId);
      toast.success(`Keepers submitted for ${selectedTeam.name}.`);
    } catch (err: any) {
      logger.error('LMKeeperManager: submit failed', err);
      toast.error(`Failed to submit keepers: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReassignAllRounds = async () => {
    if (!currentLeagueId) return;
    if (teams.length === 0) {
      toast.error('No teams loaded.');
      return;
    }

    const confirmed = window.confirm(
      `Reassign keeper rounds for all ${teams.length} teams in ${currentLeague?.name}?\n\n` +
        `Each team's KEEP entries will be renumbered 1..N by salary (highest = round 1). ` +
        `Decisions, redshirts, drops, and roster status will not change.`,
    );
    if (!confirmed) return;

    try {
      setIsBatchRunning(true);

      const [playersRes, rostersRes] = await Promise.all([
        supabase.from('players').select('*').eq('league_id', currentLeagueId),
        supabase.from('rosters').select('*').eq('league_id', currentLeagueId),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (rostersRes.error) throw rostersRes.error;

      const allPlayers = new Map((playersRes.data || []).map(mapPlayer).map((p) => [p.id, p]));
      const rosterRows = rostersRes.data || [];

      let processed = 0;
      let skipped = 0;
      for (const row of rosterRows) {
        const mapped = mapRoster(row);
        const teamEntries = mapped.entries.map((e) => ({ ...e }));
        const hasKeeps = teamEntries.some((e) => e.decision === 'KEEP');
        if (!hasKeeps) {
          skipped++;
          continue;
        }

        const { entries: renumbered } = assignInauguralKeeperRounds(teamEntries, allPlayers);

        const { error: upsertErr } = await supabase
          .from('rosters')
          .update({ entries: renumbered })
          .eq('id', mapped.id);
        if (upsertErr) throw upsertErr;
        processed++;
      }

      toast.success(
        `Renumbered keeper rounds for ${processed} team${processed === 1 ? '' : 's'}` +
          (skipped > 0 ? ` (${skipped} had no KEEPs)` : '') +
          `.`,
      );
    } catch (err: any) {
      logger.error('LMKeeperManager: batch reassign failed', err);
      toast.error(`Batch reassign failed: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsBatchRunning(false);
    }
  };

  if (!canManage) return null;

  if (!currentLeague) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No League Selected</p>
          <p className="text-sm mt-1">Select a league to manage keepers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mns-dark py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/lm')}
            className="text-sm text-gray-400 hover:text-green-400 transition-colors mb-3 inline-flex items-center gap-1"
          >
            <span>←</span> Back to League Manager
          </button>
          <h1 className="text-2xl font-bold text-white">Manage Keepers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentLeague.name} — set KEEP / REDSHIRT / INT_STASH / DROP and keeper rounds for any team.
          </p>
        </div>

        <div className="bg-mns-card border border-gray-800 rounded-lg p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Inaugural-year round assignment</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Renumbers every team's KEEPs to rounds 1..N by salary (highest = round 1).
              Decisions and redshirts are untouched.
            </div>
          </div>
          <button
            onClick={handleReassignAllRounds}
            disabled={isBatchRunning || teamsLoading}
            className="px-4 py-2 border border-green-400/50 text-green-400 text-sm font-semibold rounded hover:bg-green-400/10 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isBatchRunning ? 'Reassigning…' : 'Reassign rounds for all teams'}
          </button>
        </div>

        <div className="bg-mns-card border border-gray-800 rounded-lg p-5 mb-6">
          <label className="block text-sm font-medium text-white mb-2">Select team</label>
          <select
            value={selectedTeamId || ''}
            onChange={(e) => setSelectedTeamId(e.target.value || null)}
            disabled={teamsLoading}
            className="w-full rounded-md bg-mns-dark border-gray-700 text-white shadow-sm focus:border-green-400 focus:ring-green-400"
          >
            <option value="">{teamsLoading ? 'Loading teams…' : '— Choose a team —'}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {selectedTeam && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>Status:</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold ${
                  roster?.status === 'submitted'
                    ? 'bg-green-400/15 text-green-400'
                    : roster?.status === 'adminLocked'
                      ? 'bg-yellow-400/15 text-yellow-400'
                      : 'bg-gray-700 text-gray-300'
                }`}
              >
                {roster?.status || 'no roster yet'}
              </span>
              <span className="text-gray-600">•</span>
              <span>{players.length} players on roster</span>
            </div>
          )}
        </div>

        {selectedTeamId && selectedTeam && (
          <>
            <div className="mb-6">
              <RosterTable
                players={sortedPlayers}
                entries={stackedEntries}
                onDecisionChange={handleDecisionChange}
                onUpdatePriority={handleUpdatePriority}
                isLocked={false}
                isOwner={true}
                canViewDecisions={true}
                projectedStats={projectedStats}
                previousStats={previousStats}
              />
            </div>

            <div className="bg-mns-card border border-gray-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-400">
                <div>
                  <span className="text-white font-semibold">
                    {entries.filter((e) => e.decision === 'KEEP').length}
                  </span>{' '}
                  KEEP •{' '}
                  <span className="text-white font-semibold">
                    {entries.filter((e) => e.decision === 'REDSHIRT').length}
                  </span>{' '}
                  REDSHIRT •{' '}
                  <span className="text-white font-semibold">
                    {entries.filter((e) => e.decision === 'INT_STASH').length}
                  </span>{' '}
                  INT •{' '}
                  <span className="text-white font-semibold">
                    {entries.filter((e) => e.decision === 'DROP').length}
                  </span>{' '}
                  DROP
                </div>
              </div>
              <button
                onClick={handleSaveAndSubmit}
                disabled={isSaving}
                className="px-6 py-2 bg-green-400 text-black font-semibold rounded hover:bg-green-300 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save & Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

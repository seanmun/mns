import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { stackKeeperRounds } from '../lib/keeperAlgorithms';
import type {
  Draft,
  Team,
  Player,
  RosterDoc,
  DraftHistory,
  DraftHistoryPick,
  DraftHistoryKeeper,
  DraftHistoryPlayer,
  PlayerSlot,
  TeamFees
} from '../types';
import { mapTeam, mapPlayer } from '../lib/mappers';

interface CompleteDraftModalProps {
  draft: Draft;
  leagueId: string;
  seasonYear: number;
  maxActive?: number;
  onClose: () => void;
  onComplete: () => void;
  currentUserEmail: string;
}

export function CompleteDraftModal({
  draft,
  leagueId,
  seasonYear,
  onClose,
  onComplete,
  currentUserEmail,
  maxActive: _maxActive = 13
}: CompleteDraftModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [rosters, setRosters] = useState<Map<string, RosterDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'confirm' | 'processing' | 'complete'>('confirm');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      if (teamsError) throw teamsError;
      setTeams((teamsData || []).map(mapTeam));

      // Load players for this league
      const { data: playersData = [], error: playersErr } = await supabase
        .from('players')
        .select('*')
        .eq('league_id', leagueId);
      if (playersErr) throw playersErr;
      const playersMap = new Map<string, Player>();
      (playersData || []).forEach((row: any) => {
        const player = mapPlayer(row);
        playersMap.set(player.id, player);
      });
      setPlayers(playersMap);

      // Load rosters
      const { data: rostersData, error: rostersError } = await supabase
        .from('rosters')
        .select('*')
        .eq('league_id', leagueId);

      if (rostersError) throw rostersError;
      const rostersMap = new Map<string, RosterDoc>();
      (rostersData || []).forEach((row: any) => {
        const roster = {
          id: row.id,
          leagueId: row.league_id,
          teamId: row.team_id,
          seasonYear: row.season_year,
          entries: row.entries || [],
        } as RosterDoc;
        rostersMap.set(roster.teamId, roster);
      });
      setRosters(rostersMap);

      setLoading(false);
    } catch (error) {
      logger.error('Error loading data:', error);
      toast.error('Failed to load data');
      onClose();
    }
  };

  const completeDraft = async () => {
    setProcessing(true);
    setStep('processing');

    try {
      // Step 1: Create Draft History
      const draftHistory = createDraftHistory();
      const draftHistoryId = `${leagueId}_${seasonYear}`;
      const { error: historyError } = await supabase
        .from('draft_history')
        .upsert({
          id: draftHistoryId,
          league_id: draftHistory.leagueId,
          season_year: draftHistory.seasonYear,
          picks: draftHistory.picks,
          keepers: draftHistory.keepers,
          redshirt_players: draftHistory.redshirtPlayers,
          international_players: draftHistory.internationalPlayers,
          completed_at: draftHistory.completedAt,
          completed_by: draftHistory.completedBy,
        });

      if (historyError) throw historyError;

      // Step 2: Set players.team_id + players.slot for each team
      for (const team of teams) {
        const slotAssignments = getTeamSlotAssignments(team);

        for (const { playerId, slot } of slotAssignments) {
          const { error: slotError } = await supabase
            .from('players')
            .update({ team_id: team.id, slot, on_ir: slot === 'ir' })
            .eq('id', playerId);

          if (slotError) {
            logger.error(`Failed to set slot for player ${playerId} on team ${team.name}:`, slotError);
          }
        }
      }

      // Step 3: Create Team Fees documents (pre-draft fees only)
      for (const team of teams) {
        const teamFeesData = createTeamFees(team);
        const feesId = `${leagueId}_${team.id}_${seasonYear}`;
        const { error: feesError } = await supabase
          .from('team_fees')
          .upsert({
            id: feesId,
            league_id: teamFeesData.leagueId,
            team_id: teamFeesData.teamId,
            season_year: teamFeesData.seasonYear,
            franchise_tag_fees: teamFeesData.franchiseTagFees,
            redshirt_fees: teamFeesData.redshirtFees,
            first_apron_fee: teamFeesData.firstApronFee,
            second_apron_penalty: teamFeesData.secondApronPenalty,
            unredshirt_fees: teamFeesData.unredshirtFees,
            fees_locked: teamFeesData.feesLocked,
            total_fees: teamFeesData.totalFees,
            fee_transactions: teamFeesData.feeTransactions,
            created_at: teamFeesData.createdAt,
            updated_at: teamFeesData.updatedAt,
          });

        if (feesError) throw feesError;
      }

      // Step 4: Update draft status
      const draftId = `${leagueId}_${seasonYear}`;
      const { error: draftError } = await supabase
        .from('drafts')
        .update({
          status: 'completed',
          completed_at: Date.now()
        })
        .eq('id', draftId);

      if (draftError) throw draftError;

      // Step 5: Update league status
      const { error: leagueError } = await supabase
        .from('leagues')
        .update({
          draft_status: 'completed',
          season_status: 'pre_season',
          league_phase: 'regular_season',
        })
        .eq('id', leagueId);

      if (leagueError) throw leagueError;

      setStep('complete');
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      logger.error('Error completing draft:', error);
      toast.error(`Failed to complete draft: ${error}`);
      setProcessing(false);
      setStep('confirm');
    }
  };

  const createDraftHistory = (): DraftHistory => {
    const picks: DraftHistoryPick[] = [];
    const keepers: DraftHistoryKeeper[] = [];
    const redshirtPlayers: DraftHistoryPlayer[] = [];
    const internationalPlayers: DraftHistoryPlayer[] = [];

    // Process all draft picks
    draft.picks.forEach(pick => {
      if (pick.playerId && pick.playerName) {
        const player = players.get(pick.playerId);
        const team = teams.find(t => t.id === pick.teamId);

        if (player && team) {
          picks.push({
            overallPick: pick.overallPick,
            round: pick.round,
            pickInRound: pick.pickInRound,
            teamId: team.id,
            teamName: team.name,
            teamAbbrev: team.abbrev,
            playerId: player.id,
            playerName: player.name,
            salary: player.salary,
            nextYearKeeperRound: Math.max(1, pick.round - 1)
          });
        }
      }
    });

    // Process keepers from rosters
    rosters.forEach((roster, teamId) => {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const { entries: stackedEntries } = stackKeeperRounds(roster.entries);

      stackedEntries.forEach(entry => {
        const player = players.get(entry.playerId);
        if (!player) return;

        if (entry.decision === 'KEEP' && entry.keeperRound && entry.baseRound) {
          keepers.push({
            teamId: team.id,
            teamName: team.name,
            teamAbbrev: team.abbrev,
            playerId: player.id,
            playerName: player.name,
            salary: player.salary,
            baseRound: entry.baseRound,
            keeperRound: entry.keeperRound,
            nextYearKeeperRound: Math.max(1, entry.keeperRound - 1)
          });
        } else if (entry.decision === 'REDSHIRT') {
          redshirtPlayers.push({
            teamId: team.id,
            teamName: team.name,
            teamAbbrev: team.abbrev,
            playerId: player.id,
            playerName: player.name
          });
        } else if (entry.decision === 'INT_STASH') {
          internationalPlayers.push({
            teamId: team.id,
            teamName: team.name,
            teamAbbrev: team.abbrev,
            playerId: player.id,
            playerName: player.name
          });
        }
      });
    });

    return {
      id: `${leagueId}_${seasonYear}`,
      leagueId,
      seasonYear,
      picks,
      keepers,
      redshirtPlayers,
      internationalPlayers,
      completedAt: Date.now(),
      completedBy: currentUserEmail
    };
  };

  const getTeamSlotAssignments = (team: Team): { playerId: string; slot: PlayerSlot }[] => {
    const assignments: { playerId: string; slot: PlayerSlot }[] = [];
    const roster = rosters.get(team.id);

    // Add keepers with their appropriate slots
    if (roster) {
      roster.entries.forEach(entry => {
        if (entry.decision === 'KEEP') {
          assignments.push({ playerId: entry.playerId, slot: 'active' });
        } else if (entry.decision === 'REDSHIRT') {
          assignments.push({ playerId: entry.playerId, slot: 'redshirt' });
        } else if (entry.decision === 'INT_STASH') {
          assignments.push({ playerId: entry.playerId, slot: 'international' });
        }
      });
    }

    // Add drafted players to active roster
    draft.picks.forEach(pick => {
      if (pick.teamId === team.id && pick.playerId && !pick.isKeeperSlot) {
        assignments.push({ playerId: pick.playerId, slot: 'active' });
      }
    });

    return assignments;
  };

  const createTeamFees = (team: Team): TeamFees => {
    const roster = rosters.get(team.id);

    let franchiseTags = 0;
    let redshirtCount = 0;

    if (roster) {
      const { franchiseTags: tags } = stackKeeperRounds(roster.entries);
      franchiseTags = tags;
      redshirtCount = roster.entries.filter(e => e.decision === 'REDSHIRT').length;

      console.log(`[CompleteDraftModal] Team ${team.name}:`, {
        franchiseTags,
        redshirtCount,
        rosterEntriesCount: roster.entries.length
      });
    } else {
      console.log(`[CompleteDraftModal] No roster found for team ${team.name}`);
    }

    const franchiseTagFees = franchiseTags * 15;
    const redshirtFees = redshirtCount * 10;

    return {
      id: `${leagueId}_${team.id}_${seasonYear}`,
      leagueId,
      teamId: team.id,
      seasonYear,
      franchiseTagFees,
      redshirtFees,
      firstApronFee: 0,
      secondApronPenalty: 0,
      unredshirtFees: 0,
      feesLocked: false,
      totalFees: franchiseTagFees + redshirtFees,
      feeTransactions: [
        ...(franchiseTags > 0 ? [{
          type: 'franchise' as const,
          amount: franchiseTagFees,
          timestamp: Date.now(),
          triggeredBy: currentUserEmail,
          note: `${franchiseTags} franchise tag${franchiseTags > 1 ? 's' : ''}`
        }] : []),
        ...(redshirtCount > 0 ? [{
          type: 'redshirt' as const,
          amount: redshirtFees,
          timestamp: Date.now(),
          triggeredBy: currentUserEmail,
          note: `${redshirtCount} redshirt player${redshirtCount > 1 ? 's' : ''}`
        }] : [])
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-8">
          <div className="text-white">Loading draft data...</div>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-8">
          <div className="text-white text-center">
            <div className="text-2xl mb-4">🏀</div>
            <div className="text-xl font-bold mb-2">Archiving Draft...</div>
            <div className="text-sm text-gray-400">Creating draft history and regular season rosters...</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-8">
          <div className="text-white text-center">
            <div className="text-4xl mb-4">✓</div>
            <div className="text-xl font-bold mb-2 text-green-400">Draft Archived!</div>
            <div className="text-sm text-gray-400">Regular season rosters have been created.</div>
          </div>
        </div>
      </div>
    );
  }

  const totalPicks = draft.picks.filter(p => p.playerId).length;
  const totalKeeperSlots = draft.picks.filter(p => p.isKeeperSlot).length;
  const draftedPicks = totalPicks - totalKeeperSlots;
  const totalRedshirts = Array.from(rosters.values()).reduce((sum, roster) =>
    sum + roster.entries.filter(e => e.decision === 'REDSHIRT').length, 0
  );
  const totalInternational = Array.from(rosters.values()).reduce((sum, roster) =>
    sum + roster.entries.filter(e => e.decision === 'INT_STASH').length, 0
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#121212] rounded-lg border border-gray-800 max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Archive Draft</h2>
          <p className="text-sm text-gray-400 mt-1">
            This will archive the draft and create regular season rosters for all teams
          </p>
        </div>

        {/* Summary */}
        <div className="p-6 border-b border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Total Picks</div>
              <div className="text-2xl font-bold text-white">{draft.picks.length}</div>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Drafted</div>
              <div className="text-2xl font-bold text-green-400">{draftedPicks}</div>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Keepers</div>
              <div className="text-2xl font-bold text-blue-400">{totalKeeperSlots}</div>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Teams</div>
              <div className="text-2xl font-bold text-purple-400">{teams.length}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Redshirt Players</div>
              <div className="text-xl font-bold text-yellow-400">{totalRedshirts}</div>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">International Players</div>
              <div className="text-xl font-bold text-cyan-400">{totalInternational}</div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="p-6 border-b border-gray-800">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <div className="font-semibold text-yellow-400 mb-1">Important</div>
                <div className="text-sm text-gray-300">
                  This will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Archive this draft permanently</li>
                    <li>Create regular season rosters for all teams</li>
                    <li>Lock in keeper and redshirt fees</li>
                    <li>Set league status to "Pre-Season"</li>
                  </ul>
                  <div className="mt-2 font-semibold">This action cannot be undone.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={completeDraft}
            disabled={processing}
            className="flex-1 px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Archiving...' : 'Archive Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

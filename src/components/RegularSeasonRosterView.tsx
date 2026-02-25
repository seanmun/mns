import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { dropPlayerFromTeam, movePlayerSlot, swapPlayerSlots } from '../lib/rosterOps';
import type { RegularSeasonRoster, Player, Team, League, RosterSummary, TeamFees } from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';
import { useGames } from '../hooks/useGames';
import { CapThermometer } from './CapThermometer';
import { SummaryCard } from './SummaryCard';

interface RegularSeasonRosterViewProps {
  regularSeasonRoster: RegularSeasonRoster;
  allPlayers: Player[];
  team: Team;
  teamFees: TeamFees | null;
  isOwner: boolean;
  league: League;
  userEmail: string;
}

export function RegularSeasonRosterView({ regularSeasonRoster, allPlayers, team, teamFees, isOwner, league, userEmail }: RegularSeasonRosterViewProps) {
  const rosterSettings = league.roster ?? DEFAULT_ROSTER_SETTINGS;
  const [processing, setProcessing] = useState(false);
  const [swappingIR, setSwappingIR] = useState(false);
  const [playerToMoveToIR, setPlayerToMoveToIR] = useState<string | null>(null);
  const [mobileCapTab, setMobileCapTab] = useState(0);

  // Date navigation for game info
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { teamGameMap, loading: gamesLoading } = useGames(league.seasonYear, selectedDate);

  const navigateDate = (offset: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const gameCount = Math.floor(teamGameMap.size / 2);

  // Create player map for quick lookups
  const playersMap = useMemo(() => {
    return new Map(allPlayers.map(p => [p.id, p]));
  }, [allPlayers]);

  // Get players for each roster section (track orphaned IDs)
  const { activePlayers, orphanedIds } = useMemo(() => {
    const resolved: Player[] = [];
    const orphaned: string[] = [];

    // Check active roster and build resolved list
    for (const playerId of regularSeasonRoster.activeRoster) {
      const player = playersMap.get(playerId);
      if (player) {
        resolved.push(player);
      } else {
        orphaned.push(playerId);
      }
    }

    // Also check other slots for orphans
    for (const playerId of regularSeasonRoster.irSlots) {
      if (!playersMap.has(playerId)) orphaned.push(playerId);
    }
    for (const playerId of regularSeasonRoster.redshirtPlayers) {
      if (!playersMap.has(playerId)) orphaned.push(playerId);
    }
    for (const playerId of regularSeasonRoster.internationalPlayers) {
      if (!playersMap.has(playerId)) orphaned.push(playerId);
    }

    return { activePlayers: resolved, orphanedIds: orphaned };
  }, [regularSeasonRoster.activeRoster, regularSeasonRoster.irSlots, regularSeasonRoster.redshirtPlayers, regularSeasonRoster.internationalPlayers, playersMap]);

  // Bench is explicit — anyone in benchedPlayers is benched, the rest start
  const benchedSet = useMemo(() => new Set(regularSeasonRoster.benchedPlayers), [regularSeasonRoster.benchedPlayers]);
  const startingPlayers = activePlayers.filter(p => !benchedSet.has(p.id));
  const benchPlayers = activePlayers.filter(p => benchedSet.has(p.id));

  const irPlayers = useMemo(() => {
    return regularSeasonRoster.irSlots
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.irSlots, playersMap]);

  const redshirtPlayers = useMemo(() => {
    return regularSeasonRoster.redshirtPlayers
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.redshirtPlayers, playersMap]);

  const internationalPlayers = useMemo(() => {
    return regularSeasonRoster.internationalPlayers
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.internationalPlayers, playersMap]);

  // Calculate total salary from active + IR players only
  const totalSalary = useMemo(() => {
    const activeTotal = activePlayers.reduce((sum, p) => sum + (p?.salary || 0), 0);
    const irTotal = irPlayers.reduce((sum, p) => sum + (p?.salary || 0), 0);
    return activeTotal + irTotal;
  }, [activePlayers, irPlayers]);

  const isIllegalRoster = activePlayers.length > rosterSettings.maxActive;

  // Create summary for CapThermometer and SummaryCard
  const summary: RosterSummary = useMemo(() => {
    const baseCap = 225_000_000;
    const tradeDelta = team.capAdjustments.tradeDelta || 0;
    const capEffective = Math.max(170_000_000, Math.min(255_000_000, baseCap + tradeDelta));

    const overBy = Math.max(0, totalSalary - 225_000_000);
    const overByM = Math.ceil(overBy / 1_000_000);
    const penaltyDues = overByM * 2;
    const firstApronFee = totalSalary > 195_000_000 ? 50 : 0;

    const franchiseTagDues = teamFees?.franchiseTagFees || 0;
    const redshirtDues = teamFees?.redshirtFees || 0;
    const activationDues = teamFees?.unredshirtFees || 0;

    const lockedFirstApronFee = teamFees?.feesLocked ? teamFees.firstApronFee : firstApronFee;
    const lockedPenaltyDues = teamFees?.feesLocked ? teamFees.secondApronPenalty : penaltyDues;

    const totalFees = franchiseTagDues + redshirtDues + activationDues + lockedFirstApronFee + lockedPenaltyDues;

    return {
      keepersCount: activePlayers.length,
      draftedCount: 0,
      redshirtsCount: redshirtPlayers.length,
      intStashCount: internationalPlayers.length,
      capUsed: totalSalary,
      capBase: baseCap,
      capTradeDelta: tradeDelta,
      capEffective,
      overSecondApronByM: overByM,
      penaltyDues: lockedPenaltyDues,
      franchiseTags: 0,
      franchiseTagDues,
      redshirtDues,
      firstApronFee: lockedFirstApronFee,
      activationDues,
      totalFees,
    };
  }, [activePlayers, irPlayers, redshirtPlayers, internationalPlayers, totalSalary, team, teamFees]);

  // Handler functions for roster management
  const handleActivateRedshirt = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = playersMap.get(playerId);
    if (!player) return;

    const confirmed = confirm(
      `Activate ${player.name} from redshirt?\n\n` +
      `This will:\n` +
      `- Add $25 activation fee\n` +
      `- Move player to active roster\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

      // Move redshirt → active via rosterOps
      const result = await movePlayerSlot({
        playerId,
        teamId: regularSeasonRoster.teamId,
        leagueId: regularSeasonRoster.leagueId,
        fromSlot: 'redshirt_players',
        toSlot: 'active_roster',
        updatedBy: userEmail,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to activate redshirt');
        setProcessing(false);
        return;
      }

      // Apply activation fee
      const feesId = `${regularSeasonRoster.leagueId}_${regularSeasonRoster.teamId}_${regularSeasonRoster.seasonYear}`;
      const currentUnredshirtFees = teamFees?.unredshirtFees || 0;
      const currentTotalFees = teamFees?.totalFees || 0;
      const currentTransactions = teamFees?.feeTransactions || [];

      const { error: feesError } = await supabase
        .from('team_fees')
        .update({
          unredshirt_fees: currentUnredshirtFees + 25,
          total_fees: currentTotalFees + 25,
          fee_transactions: [
            ...currentTransactions,
            {
              type: 'unredshirt',
              amount: 25,
              timestamp: Date.now(),
              triggeredBy: playerId,
              note: `Activated ${player.name} from redshirt`,
            },
          ],
        })
        .eq('id', feesId);

      if (feesError) throw feesError;

      setProcessing(false);
    } catch (error) {
      logger.error('Error activating redshirt:', error);
      toast.error(`Error activating player: ${error}`);
      setProcessing(false);
    }
  };

  const handleDropPlayer = async (playerId: string, location: 'active' | 'ir') => {
    if (!isOwner || processing) return;

    const player = playersMap.get(playerId);
    if (!player) return;

    const confirmed = confirm(
      `Drop ${player.name} from ${location === 'active' ? 'active roster' : 'IR'}?\n\n` +
      `This will remove the player from your roster.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

      // Drop via rosterOps (updates players.team_id + regular_season_rosters)
      const result = await dropPlayerFromTeam({
        playerId,
        teamId: regularSeasonRoster.teamId,
        leagueId: regularSeasonRoster.leagueId,
        updatedBy: userEmail,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to drop player');
      }
      setProcessing(false);
    } catch (error) {
      logger.error('Error dropping player:', error);
      toast.error(`Error dropping player: ${error}`);
      setProcessing(false);
    }
  };

  const handleMoveToIR = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = playersMap.get(playerId);
    if (!player) return;

    if (irPlayers.length >= rosterSettings.maxIR) {
      setPlayerToMoveToIR(playerId);
      setSwappingIR(true);
      return;
    }

    const confirmed = confirm(
      `Move ${player.name} to IR?\n\n` +
      `This will move the player from active roster to IR.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: regularSeasonRoster.teamId,
        leagueId: regularSeasonRoster.leagueId,
        fromSlot: 'active_roster',
        toSlot: 'ir_slots',
        updatedBy: userEmail,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to move to IR');
      }
      setProcessing(false);
    } catch (error) {
      logger.error('Error moving to IR:', error);
      toast.error(`Error moving player to IR: ${error}`);
      setProcessing(false);
    }
  };

  const handleMoveToActive = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = playersMap.get(playerId);
    if (!player) return;

    const confirmed = confirm(
      `Move ${player.name} to active roster?\n\n` +
      `This will move the player from IR to active roster.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: regularSeasonRoster.teamId,
        leagueId: regularSeasonRoster.leagueId,
        fromSlot: 'ir_slots',
        toSlot: 'active_roster',
        updatedBy: userEmail,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to move to active');
      }
      setProcessing(false);
    } catch (error) {
      logger.error('Error moving to active:', error);
      toast.error(`Error moving player to active: ${error}`);
      setProcessing(false);
    }
  };

  const handleSwapIRPlayer = async (playerToRemove: string, playerToAdd: string) => {
    if (!isOwner || processing) return;

    const removedPlayer = playersMap.get(playerToRemove);
    const addedPlayer = playersMap.get(playerToAdd);

    const confirmed = confirm(
      `Swap IR players?\n\n` +
      `Remove from IR: ${removedPlayer?.name}\n` +
      `Add to IR: ${addedPlayer?.name}\n\n` +
      `Continue?`
    );

    if (!confirmed) {
      setSwappingIR(false);
      setPlayerToMoveToIR(null);
      return;
    }

    try {
      setProcessing(true);

      const result = await swapPlayerSlots({
        playerToMoveId: playerToAdd,
        playerToSwapId: playerToRemove,
        teamId: regularSeasonRoster.teamId,
        leagueId: regularSeasonRoster.leagueId,
        moveToSlot: 'ir_slots',
        swapToSlot: 'active_roster',
        updatedBy: userEmail,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to swap players');
      }

      setSwappingIR(false);
      setPlayerToMoveToIR(null);
      setProcessing(false);
    } catch (error) {
      logger.error('Error swapping IR player:', error);
      toast.error(`Error swapping players: ${error}`);
      setProcessing(false);
    }
  };

  // Add a player to the bench
  const handleBenchPlayer = async (playerId: string) => {
    if (!isOwner || processing) return;

    try {
      setProcessing(true);

      const newBenched = [...regularSeasonRoster.benchedPlayers, playerId];

      const { error } = await supabase
        .from('regular_season_rosters')
        .update({
          benched_players: newBenched,
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
        })
        .eq('id', regularSeasonRoster.id);

      if (error) throw error;
    } catch (error) {
      logger.error('Error benching player:', error);
      toast.error(`Error benching player: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Remove a player from the bench (start them)
  const handleStartPlayer = async (playerId: string) => {
    if (!isOwner || processing) return;

    try {
      setProcessing(true);

      const newBenched = regularSeasonRoster.benchedPlayers.filter(id => id !== playerId);

      const { error } = await supabase
        .from('regular_season_rosters')
        .update({
          benched_players: newBenched,
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
        })
        .eq('id', regularSeasonRoster.id);

      if (error) throw error;
    } catch (error) {
      logger.error('Error starting player:', error);
      toast.error(`Error starting player: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Shared row renderer for both starting and bench tables
  const renderPlayerRow = (player: Player, section: 'starting' | 'bench') => {
    const gameInfo = teamGameMap.get(player.nbaTeam);
    const isBench = section === 'bench';

    return (
      <tr
        key={player.id}
        className={`hover:bg-[#1a1a1a] ${isBench ? 'opacity-60' : ''}`}
      >
        <td className="px-4 py-3">
          <div className="text-white">{player.name}</div>
          <div className="text-xs text-gray-500 sm:hidden">{player.position} &middot; {player.nbaTeam}</div>
        </td>
        <td className="px-4 py-3 text-gray-400 text-sm hidden sm:table-cell">{player.position}</td>
        <td className="px-4 py-3 text-gray-400 text-sm hidden sm:table-cell">{player.nbaTeam}</td>
        <td className="px-4 py-3 text-center text-sm">
          {gamesLoading ? (
            <span className="text-gray-600">...</span>
          ) : gameInfo ? (
            <span className={`font-medium ${gameInfo.isCupGame ? 'text-yellow-400' : 'text-green-400'}`}>
              {gameInfo.isHome ? 'vs' : '@'} {gameInfo.opponent}
            </span>
          ) : (
            <span className="text-gray-600">&mdash;</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-white text-sm">
          ${(player.salary / 1_000_000).toFixed(1)}M
        </td>
        {isOwner && (
          <td className="px-4 py-3 text-right">
            <div className="flex gap-2 justify-end">
              {section === 'starting' && (
                <button
                  onClick={() => handleBenchPlayer(player.id)}
                  disabled={processing}
                  className="px-3 py-1 text-xs border border-orange-500 text-orange-400 rounded hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Bench
                </button>
              )}
              {section === 'bench' && (
                <button
                  onClick={() => handleStartPlayer(player.id)}
                  disabled={processing || startingPlayers.length >= rosterSettings.maxStarters}
                  className="px-3 py-1 text-xs border border-green-500 text-green-400 rounded hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start
                </button>
              )}
              <button
                onClick={() => handleMoveToIR(player.id)}
                disabled={processing}
                className="px-3 py-1 text-xs border border-purple-500 text-purple-400 rounded hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed hidden md:inline-block"
              >
                IR
              </button>
              <button
                onClick={() => handleDropPlayer(player.id, 'active')}
                disabled={processing}
                className="px-3 py-1 text-xs border border-pink-500 text-pink-400 rounded hover:bg-pink-500/10 disabled:opacity-50 disabled:cursor-not-allowed hidden md:inline-block"
              >
                Drop
              </button>
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Roster Status Banner */}
      {isIllegalRoster && (
        <div className="bg-pink-500/10 border border-pink-400/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-pink-400">Illegal Roster</div>
              <div className="text-sm text-gray-300">
                Active roster has {activePlayers.length} players. Maximum is {rosterSettings.maxActive}.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orphaned IDs Warning */}
      {orphanedIds.length > 0 && (
        <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <div className="font-semibold text-red-400">Data Integrity Issue</div>
              <div className="text-sm text-gray-300">
                {orphanedIds.length} player ID(s) on this roster could not be matched to any player in the database.
                This may cause incorrect roster counts. Contact your commissioner or visit{' '}
                <a href="/admin/data-audit" className="text-green-400 underline">Data Audit</a> to fix.
              </div>
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">Show orphaned IDs</summary>
                <div className="mt-1 text-xs text-gray-500 font-mono">
                  {orphanedIds.map(id => <div key={id}>{id}</div>)}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* IR Swap Mode Banner */}
      {swappingIR && playerToMoveToIR && (
        <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="font-semibold text-blue-400">IR Swap Mode</div>
                <div className="text-sm text-gray-300">
                  IR is full ({rosterSettings.maxIR}/{rosterSettings.maxIR}). Select a player below to remove from IR and replace with {playersMap.get(playerToMoveToIR)?.name}.
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setSwappingIR(false);
                setPlayerToMoveToIR(null);
              }}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Desktop: Side by side layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CapThermometer summary={summary} maxKeepers={team.settings.maxKeepers} isRegularSeason={true} />
        </div>
        <div>
          <SummaryCard summary={summary} maxKeepers={team.settings.maxKeepers} maxActive={rosterSettings.maxActive} isRegularSeason={true} />
        </div>
      </div>

      {/* Mobile: Tab bar */}
      <div className="lg:hidden mb-6">
        <div className="flex rounded-lg border border-gray-800 overflow-hidden mb-4">
          <button
            onClick={() => setMobileCapTab(0)}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
              mobileCapTab === 0
                ? 'bg-green-400/10 text-green-400 border-b-2 border-green-400'
                : 'bg-[#121212] text-gray-400 hover:text-white'
            }`}
          >
            Salary Cap
          </button>
          <button
            onClick={() => setMobileCapTab(1)}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
              mobileCapTab === 1
                ? 'bg-green-400/10 text-green-400 border-b-2 border-green-400'
                : 'bg-[#121212] text-gray-400 hover:text-white'
            }`}
          >
            Fees & Roster
          </button>
        </div>

        {mobileCapTab === 0 && (
          <CapThermometer summary={summary} maxKeepers={team.settings.maxKeepers} isRegularSeason={true} />
        )}
        {mobileCapTab === 1 && (
          <SummaryCard summary={summary} maxKeepers={team.settings.maxKeepers} maxActive={rosterSettings.maxActive} isRegularSeason={true} />
        )}
      </div>

      {/* Active Roster */}
      <div className="bg-[#121212] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Active Roster</h3>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${startingPlayers.length > rosterSettings.maxStarters ? 'text-pink-400' : startingPlayers.length === rosterSettings.maxStarters ? 'text-green-400' : 'text-yellow-400'}`}>
                {startingPlayers.length}/{rosterSettings.maxStarters} Starting
              </span>
              <span className={`text-sm font-medium ${isIllegalRoster ? 'text-pink-400' : 'text-gray-400'}`}>
                {activePlayers.length}/{rosterSettings.maxActive}
              </span>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={() => navigateDate(-1)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center min-w-[160px]">
              <span className={`font-medium ${isToday ? 'text-green-400' : 'text-white'}`}>
                {displayDate}
              </span>
              {isToday && (
                <span className="ml-2 text-xs text-green-400/70">Today</span>
              )}
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="ml-2 text-xs text-green-400 hover:underline"
                >
                  Today
                </button>
              )}
            </div>
            <button
              onClick={() => navigateDate(1)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Game count */}
          {!gamesLoading && (
            <div className="text-center mt-1 text-xs text-gray-500">
              {gameCount === 0 ? 'No NBA games' : `${gameCount} NBA game${gameCount !== 1 ? 's' : ''}`} on this date
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a0a0a]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Team</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Game</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
                {isOwner && <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {activePlayers.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                    No active players
                  </td>
                </tr>
              ) : (
                <>
                  {/* Starting Lineup (first 10) */}
                  {startingPlayers.map((player) => renderPlayerRow(player, 'starting'))}

                  {/* Bench separator */}
                  {benchPlayers.length > 0 && (
                    <tr>
                      <td colSpan={isOwner ? 6 : 5} className="px-4 py-2 bg-[#0a0a0a]">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-gray-700" />
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bench</span>
                          <div className="h-px flex-1 bg-gray-700" />
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Bench Players (remaining) */}
                  {benchPlayers.map((player) => renderPlayerRow(player, 'bench'))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IR Slots */}
      <div className="bg-[#121212] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">IR Slots</h3>
            <span className="text-sm text-gray-400">{irPlayers.length}/{rosterSettings.maxIR}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a0a0a]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
                {isOwner && <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {irPlayers.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                    No IR players
                  </td>
                </tr>
              ) : (
                irPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-white">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {swappingIR ? (
                            <button
                              onClick={() => handleSwapIRPlayer(player.id, playerToMoveToIR!)}
                              disabled={processing}
                              className="px-3 py-1 text-xs border border-green-500 text-green-400 rounded hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Select to Remove
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleMoveToActive(player.id)}
                                disabled={processing}
                                className="px-3 py-1 text-xs border border-green-500 text-green-400 rounded hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Activate
                              </button>
                              <button
                                onClick={() => handleDropPlayer(player.id, 'ir')}
                                disabled={processing}
                                className="px-3 py-1 text-xs border border-pink-500 text-pink-400 rounded hover:bg-pink-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Drop
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Redshirt Players */}
      {redshirtPlayers.length > 0 && (
        <div className="bg-[#121212] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Redshirt Players</h3>
              <span className="text-sm text-yellow-400">{redshirtPlayers.length}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Does not count toward salary</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
                  {isOwner && <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {redshirtPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-yellow-400">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleActivateRedshirt(player.id)}
                          disabled={processing}
                          className="px-3 py-1 text-xs border border-green-500 text-green-400 rounded hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Activate ($25)
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* International Players */}
      {internationalPlayers.length > 0 && (
        <div className="bg-[#121212] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">International Stash</h3>
              <span className="text-sm text-cyan-400">{internationalPlayers.length}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Does not count toward salary</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {internationalPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

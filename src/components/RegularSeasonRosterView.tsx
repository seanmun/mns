import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { dropPlayerFromTeam, movePlayerSlot, swapPlayerSlots } from '../lib/rosterOps';
import type { Player, Team, League, RosterSummary, TeamFees, PlayerSlot } from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';
import { useGames } from '../hooks/useGames';
import { CapThermometer } from './CapThermometer';
import { todayET } from '../utils/date';
import { SummaryCard } from './SummaryCard';

interface RegularSeasonRosterViewProps {
  teamPlayers: Player[];
  team: Team;
  teamFees: TeamFees | null;
  isOwner: boolean;
  league: League;
  userEmail: string;
}

export function RegularSeasonRosterView({ teamPlayers, team, teamFees, isOwner, league, userEmail: _userEmail }: RegularSeasonRosterViewProps) {
  const rosterSettings = league.roster ?? DEFAULT_ROSTER_SETTINGS;
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [swappingIR, setSwappingIR] = useState(false);
  const [playerToMoveToIR, setPlayerToMoveToIR] = useState<string | null>(null);
  const [mobileCapTab, setMobileCapTab] = useState(0);

  // Optimistic cache update — instantly move player in the UI
  const optimisticUpdateSlot = (playerId: string, newSlot: PlayerSlot) => {
    queryClient.setQueryData(['teamPlayers', league.id, team.id], (old: Player[] | undefined) => {
      if (!old) return old;
      return old.map(p => p.id === playerId ? { ...p, slot: newSlot } : p);
    });
  };

  const optimisticRemovePlayer = (playerId: string) => {
    queryClient.setQueryData(['teamPlayers', league.id, team.id], (old: Player[] | undefined) => {
      if (!old) return old;
      return old.filter(p => p.id !== playerId);
    });
  };

  // Date navigation for game info
  const [selectedDate, setSelectedDate] = useState(() => todayET());
  const { teamGameMap, loading: gamesLoading } = useGames(league.seasonYear, selectedDate);

  const navigateDate = (offset: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + offset);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === todayET();

  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const gameCount = Math.floor(teamGameMap.size / 2);

  // Build roster sections from players.slot
  const { startingPlayers, benchPlayers, activePlayers, irPlayers, redshirtPlayers, internationalPlayers } = useMemo(() => {
    const active: Player[] = [];
    const ir: Player[] = [];
    const redshirt: Player[] = [];
    const international: Player[] = [];
    const bench: Player[] = [];

    for (const p of teamPlayers) {
      switch (p.slot) {
        case 'ir': ir.push(p); break;
        case 'redshirt': redshirt.push(p); break;
        case 'international': international.push(p); break;
        case 'bench': bench.push(p); break;
        case 'active':
        default: active.push(p); break;
      }
    }

    // Auto-split: if more than maxStarters have slot='active', treat overflow as bench
    // This handles the case where CSV import left everyone as 'active'
    if (active.length > rosterSettings.maxStarters) {
      const sorted = [...active].sort((a, b) => (b.salary || 0) - (a.salary || 0));
      const starters = sorted.slice(0, rosterSettings.maxStarters);
      const overflow = sorted.slice(rosterSettings.maxStarters);
      active.length = 0;
      active.push(...starters);
      bench.push(...overflow);
    }

    return {
      startingPlayers: active,
      benchPlayers: bench,
      activePlayers: [...active, ...bench], // All cap-counting non-IR players
      irPlayers: ir,
      redshirtPlayers: redshirt,
      internationalPlayers: international,
    };
  }, [teamPlayers, rosterSettings.maxStarters]);

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

    // Sticky first apron: if already charged in DB, keep it; otherwise check current salary
    const firstApronFee = (teamFees?.firstApronFee && teamFees.firstApronFee > 0)
      ? teamFees.firstApronFee
      : (totalSalary > 195_000_000 ? 50 : 0);

    const franchiseTagDues = teamFees?.franchiseTagFees || 0;
    const redshirtDues = teamFees?.redshirtFees || 0;
    const activationDues = teamFees?.unredshirtFees || 0;

    // Second apron penalty: highest watermark — max of locked value vs current dynamic
    const lockedPenaltyDues = Math.max(teamFees?.secondApronPenalty || 0, penaltyDues);

    // Use the watermark overByM for display consistency
    const lockedOverByM = lockedPenaltyDues > 0 ? Math.ceil(lockedPenaltyDues / 2) : 0;
    const totalFees = franchiseTagDues + redshirtDues + activationDues + firstApronFee + lockedPenaltyDues;

    return {
      keepersCount: activePlayers.length,
      draftedCount: 0,
      redshirtsCount: redshirtPlayers.length,
      intStashCount: internationalPlayers.length,
      capUsed: totalSalary,
      capBase: baseCap,
      capTradeDelta: tradeDelta,
      capEffective,
      overSecondApronByM: lockedOverByM,
      penaltyDues: lockedPenaltyDues,
      franchiseTags: 0,
      franchiseTagDues,
      redshirtDues,
      firstApronFee: firstApronFee,
      activationDues,
      totalFees,
    };
  }, [activePlayers, irPlayers, redshirtPlayers, internationalPlayers, totalSalary, team, teamFees]);

  // Handler functions for roster management
  const handleActivateRedshirt = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = teamPlayers.find(p => p.id === playerId);
    if (!player) return;

    const confirmed = confirm(
      `Activate ${player.name} from redshirt?\n\nThis will add a $25 activation fee.\n\nContinue?`
    );

    if (!confirmed) return;

    optimisticUpdateSlot(playerId, 'active');

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: team.id,
        leagueId: league.id,
        toSlot: 'active',
      });

      if (!result.success) {
        optimisticUpdateSlot(playerId, 'redshirt');
        toast.error(result.error || 'Failed to activate redshirt');
        setProcessing(false);
        return;
      }

      // Apply activation fee
      const feesId = `${league.id}_${team.id}_${league.seasonYear}`;
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

      toast.success(`${player.name} activated from redshirt ($25 fee)`);
      setProcessing(false);
    } catch (error) {
      optimisticUpdateSlot(playerId, 'redshirt');
      logger.error('Error activating redshirt:', error);
      toast.error(`Error activating player: ${error}`);
      setProcessing(false);
    }
  };

  const handleDropPlayer = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = teamPlayers.find(p => p.id === playerId);
    if (!player) return;

    const slotLabel = player.slot === 'ir' ? 'IR' : 'active roster';
    const confirmed = confirm(`Drop ${player.name} from ${slotLabel}?`);

    if (!confirmed) return;

    optimisticRemovePlayer(playerId);

    try {
      setProcessing(true);

      const result = await dropPlayerFromTeam({
        playerId,
        teamId: team.id,
        leagueId: league.id,
      });

      if (!result.success) {
        queryClient.invalidateQueries({ queryKey: ['teamPlayers', league.id, team.id] });
        toast.error(result.error || 'Failed to drop player');
      } else {
        toast.success(`${player.name} dropped`);
      }
      setProcessing(false);
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', league.id, team.id] });
      logger.error('Error dropping player:', error);
      toast.error(`Error dropping player: ${error}`);
      setProcessing(false);
    }
  };

  const handleMoveToIR = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = teamPlayers.find(p => p.id === playerId);
    if (!player) return;

    if (irPlayers.length >= rosterSettings.maxIR) {
      setPlayerToMoveToIR(playerId);
      setSwappingIR(true);
      return;
    }

    const prevSlot = player.slot as PlayerSlot;
    optimisticUpdateSlot(playerId, 'ir');

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: team.id,
        leagueId: league.id,
        toSlot: 'ir',
      });

      if (!result.success) {
        optimisticUpdateSlot(playerId, prevSlot);
        toast.error(result.error || 'Failed to move to IR');
      } else {
        toast.success(`${player.name} moved to IR`);
      }
      setProcessing(false);
    } catch (error) {
      optimisticUpdateSlot(playerId, prevSlot);
      logger.error('Error moving to IR:', error);
      toast.error(`Error moving player to IR: ${error}`);
      setProcessing(false);
    }
  };

  const handleMoveToActive = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = teamPlayers.find(p => p.id === playerId);
    if (!player) return;

    optimisticUpdateSlot(playerId, 'active');

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: team.id,
        leagueId: league.id,
        toSlot: 'active',
      });

      if (!result.success) {
        optimisticUpdateSlot(playerId, 'ir');
        toast.error(result.error || 'Failed to move to active');
      } else {
        toast.success(`${player.name} activated from IR`);
      }
      setProcessing(false);
    } catch (error) {
      optimisticUpdateSlot(playerId, 'ir');
      logger.error('Error moving to active:', error);
      toast.error(`Error moving player to active: ${error}`);
      setProcessing(false);
    }
  };

  const handleSwapIRPlayer = async (playerToRemove: string, playerToAdd: string) => {
    if (!isOwner || processing) return;

    const removedPlayer = teamPlayers.find(p => p.id === playerToRemove);
    const addedPlayer = teamPlayers.find(p => p.id === playerToAdd);

    // Optimistic: swap both slots immediately
    optimisticUpdateSlot(playerToAdd, 'ir');
    optimisticUpdateSlot(playerToRemove, 'active');

    try {
      setProcessing(true);

      const result = await swapPlayerSlots({
        playerAId: playerToAdd,
        playerBId: playerToRemove,
        teamId: team.id,
        leagueId: league.id,
        playerASlot: 'ir',
        playerBSlot: 'active',
      });

      if (!result.success) {
        // Revert
        optimisticUpdateSlot(playerToAdd, 'active');
        optimisticUpdateSlot(playerToRemove, 'ir');
        toast.error(result.error || 'Failed to swap players');
      } else {
        toast.success(`Swapped ${addedPlayer?.name || 'player'} to IR, ${removedPlayer?.name || 'player'} to active`);
      }

      setSwappingIR(false);
      setPlayerToMoveToIR(null);
      setProcessing(false);
    } catch (error) {
      optimisticUpdateSlot(playerToAdd, 'active');
      optimisticUpdateSlot(playerToRemove, 'ir');
      logger.error('Error swapping IR player:', error);
      toast.error(`Error swapping players: ${error}`);
      setProcessing(false);
    }
  };

  const handleBenchPlayer = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = teamPlayers.find(p => p.id === playerId);
    optimisticUpdateSlot(playerId, 'bench');

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: team.id,
        leagueId: league.id,
        toSlot: 'bench',
      });

      if (!result.success) {
        optimisticUpdateSlot(playerId, 'active'); // revert
        toast.error(result.error || 'Failed to bench player');
      } else {
        toast.success(`${player?.name || 'Player'} moved to bench`);
      }
    } catch (error) {
      optimisticUpdateSlot(playerId, 'active'); // revert
      logger.error('Error benching player:', error);
      toast.error(`Error benching player: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleStartPlayer = async (playerId: string) => {
    if (!isOwner || processing) return;

    const player = teamPlayers.find(p => p.id === playerId);
    optimisticUpdateSlot(playerId, 'active');

    try {
      setProcessing(true);

      const result = await movePlayerSlot({
        playerId,
        teamId: team.id,
        leagueId: league.id,
        toSlot: 'active',
      });

      if (!result.success) {
        optimisticUpdateSlot(playerId, 'bench'); // revert
        toast.error(result.error || 'Failed to start player');
      } else {
        toast.success(`${player?.name || 'Player'} moved to starting lineup`);
      }
    } catch (error) {
      optimisticUpdateSlot(playerId, 'bench'); // revert
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
                onClick={() => handleDropPlayer(player.id)}
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

      {/* IR Swap Mode Banner */}
      {swappingIR && playerToMoveToIR && (
        <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="font-semibold text-blue-400">IR Swap Mode</div>
                <div className="text-sm text-gray-300">
                  IR is full ({rosterSettings.maxIR}/{rosterSettings.maxIR}). Select a player below to remove from IR and replace with {teamPlayers.find(p => p.id === playerToMoveToIR)?.name}.
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
                  onClick={() => setSelectedDate(todayET())}
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
                  {/* Starting Lineup */}
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

                  {/* Bench Players */}
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
                                onClick={() => handleDropPlayer(player.id)}
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

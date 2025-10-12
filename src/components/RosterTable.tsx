import { useState } from 'react';
import type { Player, RosterEntry, Decision, ProjectedStats, PreviousStats } from '../types';
import { PlayerModal } from './PlayerModal';

interface RosterTableProps {
  players: Player[];
  entries: RosterEntry[];
  onDecisionChange: (playerId: string, decision: Decision) => void;
  onUpdatePriority?: (playerId: string, direction: 'up' | 'down') => void;
  isLocked?: boolean;
  isOwner?: boolean;
  canViewDecisions?: boolean;
  projectedStats: Map<string, ProjectedStats>;
  previousStats: Map<string, PreviousStats>;
}

export function RosterTable({
  players,
  entries,
  onDecisionChange,
  onUpdatePriority,
  isLocked = false,
  isOwner = false,
  canViewDecisions = true,
  projectedStats,
  previousStats,
}: RosterTableProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number>(-1);

  const handlePlayerClick = (player: Player, index: number) => {
    setSelectedPlayer(player);
    setSelectedPlayerIndex(index);
  };

  const handleNextPlayer = () => {
    if (selectedPlayerIndex < players.length - 1) {
      const nextIndex = selectedPlayerIndex + 1;
      setSelectedPlayer(players[nextIndex]);
      setSelectedPlayerIndex(nextIndex);
    }
  };

  const handlePrevPlayer = () => {
    if (selectedPlayerIndex > 0) {
      const prevIndex = selectedPlayerIndex - 1;
      setSelectedPlayer(players[prevIndex]);
      setSelectedPlayerIndex(prevIndex);
    }
  };

  const handleCloseModal = () => {
    setSelectedPlayer(null);
    setSelectedPlayerIndex(-1);
  };

  const formatSalary = (salary: number) => {
    return `$${(salary / 1_000_000).toFixed(2)}M`;
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return '-';
    return num.toFixed(1);
  };

  const getEntryForPlayer = (playerId: string): RosterEntry | undefined => {
    return entries.find((e) => e.playerId === playerId);
  };

  // Helper to check if player has conflicts (same BASE round as others being KEPT)
  const hasConflict = (playerId: string): boolean => {
    const entry = getEntryForPlayer(playerId);
    if (!entry?.baseRound || entry.decision !== 'KEEP') return false;

    const sameBaseRoundKeepers = entries.filter(
      e => e.baseRound === entry.baseRound && e.decision === 'KEEP'
    );

    return sameBaseRoundKeepers.length > 1;
  };

  // Helper to check if player can move up/down (within same BASE round group of KEEPERS)
  const canMoveUp = (playerId: string): boolean => {
    const entry = getEntryForPlayer(playerId);
    if (!entry?.baseRound) return false;

    const sameBaseRoundKeepers = entries
      .filter(e => e.baseRound === entry.baseRound && e.decision === 'KEEP')
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return sameBaseRoundKeepers[0]?.playerId !== playerId;
  };

  const canMoveDown = (playerId: string): boolean => {
    const entry = getEntryForPlayer(playerId);
    if (!entry?.baseRound) return false;

    const sameBaseRoundKeepers = entries
      .filter(e => e.baseRound === entry.baseRound && e.decision === 'KEEP')
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return sameBaseRoundKeepers[sameBaseRoundKeepers.length - 1]?.playerId !== playerId;
  };

  const getRowClassName = (decision?: Decision, player?: Player) => {
    let baseClass = 'transition-all cursor-pointer hover:bg-gray-800/30 ';

    // Decision-based neon border
    if (decision === 'KEEP') {
      baseClass += 'border-l-4 border-l-green-400 shadow-[0_0_10px_rgba(74,222,128,0.3)] ';
    } else if (decision === 'REDSHIRT') {
      baseClass += 'border-l-4 border-l-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.3)] ';
    } else if (decision === 'INT_STASH') {
      baseClass += 'border-l-4 border-l-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)] ';
    } else if (decision === 'DROP') {
      baseClass += 'opacity-50 ';
    }

    // Additional status indicator (small right border if keeper already has left border)
    if (decision !== 'DROP') {
      if (player?.roster.onIR) {
        baseClass += 'border-r-2 border-r-red-400 ';
      } else if (player?.roster.intEligible || player?.roster.isInternationalStash) {
        baseClass += 'border-r-2 border-r-blue-300 ';
      } else if (player?.roster.isRookie) {
        baseClass += 'border-r-2 border-r-yellow-400 ';
      }
    } else {
      // For DROP, use left border for status
      if (player?.roster.onIR) {
        baseClass += 'border-l-2 border-l-red-400 ';
      } else if (player?.roster.intEligible || player?.roster.isInternationalStash) {
        baseClass += 'border-l-2 border-l-blue-300 ';
      } else if (player?.roster.isRookie) {
        baseClass += 'border-l-2 border-l-yellow-400 ';
      }
    }

    return baseClass;
  };

  return (
    <>
      <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
        {/* Mobile: Sticky first column with horizontal scroll */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#0a0a0a] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-r border-gray-800">
                    Player
                  </th>
                  {canViewDecisions && (
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-28">
                      Decision
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Salary
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Sal Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Base Rd
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Final Rd
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#121212] divide-y divide-gray-800">
                {players.map((player, index) => {
                  const entry = getEntryForPlayer(player.id);
                  const decision = entry?.decision || 'DROP';
                  const stats = projectedStats.get(player.fantraxId);

                  return (
                    <tr
                      key={player.id}
                      className={getRowClassName(decision, player)}
                      onClick={() => handlePlayerClick(player, index)}
                    >
                      <td className="sticky left-0 z-10 bg-[#121212] px-4 py-3 whitespace-nowrap border-r border-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-white">
                            {player.name}
                          </div>
                        </div>
                      </td>

                    {canViewDecisions && (
                      <td
                        className="px-2 py-3 whitespace-nowrap text-sm text-center w-28"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isLocked || !isOwner ? (
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                              decision === 'KEEP'
                                ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                                : decision === 'REDSHIRT'
                                ? 'bg-purple-400/20 text-purple-400 border border-purple-400/30'
                                : decision === 'INT_STASH'
                                ? 'bg-blue-400/20 text-blue-400 border border-blue-400/30'
                                : 'bg-gray-800 text-gray-400 border border-gray-700'
                            }`}
                          >
                            {decision}
                          </span>
                        ) : (
                          <select
                            value={decision}
                            onChange={(e) =>
                              onDecisionChange(
                                player.id,
                                e.target.value as Decision
                              )
                            }
                            className="block w-full rounded-md bg-[#0a0a0a] border-gray-700 text-white shadow-sm focus:border-green-400 focus:ring-green-400 text-sm"
                          >
                            <option value="DROP">Drop</option>
                            <option value="KEEP">Keep</option>
                            <option
                              value="REDSHIRT"
                              disabled={
                                !player.roster.isRookie ||
                                !player.roster.rookieDraftInfo?.redshirtEligible
                              }
                            >
                              Redshirt
                              {!player.roster.isRookie ||
                              !player.roster.rookieDraftInfo?.redshirtEligible
                                ? ' (N/A)'
                                : ''}
                            </option>
                            <option
                              value="INT_STASH"
                              disabled={
                                !player.roster.intEligible
                              }
                            >
                              Int Stash
                              {!player.roster.intEligible
                                ? ' (N/A)'
                                : ''}
                            </option>
                          </select>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                      {player.position}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white text-right font-medium">
                      {formatSalary(player.salary)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                      {formatNumber(stats?.score)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                      {formatNumber(stats?.salaryScore)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                      {entry?.baseRound || player.keeper?.derivedBaseRound || '-'}
                    </td>

                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-white text-center font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {/* Show reorder controls for players with same base round */}
                        {!isLocked && isOwner && onUpdatePriority && hasConflict(player.id) && (
                          <div className="flex flex-col gap-0">
                            <button
                              onClick={() => onUpdatePriority(player.id, 'up')}
                              disabled={!canMoveUp(player.id)}
                              className={`text-xs ${
                                canMoveUp(player.id)
                                  ? 'text-green-400 hover:text-green-300'
                                  : 'text-gray-600 cursor-not-allowed'
                              }`}
                              title="Move up (earlier next year)"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => onUpdatePriority(player.id, 'down')}
                              disabled={!canMoveDown(player.id)}
                              className={`text-xs ${
                                canMoveDown(player.id)
                                  ? 'text-green-400 hover:text-green-300'
                                  : 'text-gray-600 cursor-not-allowed'
                              }`}
                              title="Move down (later next year)"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                        <span>{entry?.keeperRound || '-'}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {players.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No players on roster
          </div>
        )}
      </div>

      <PlayerModal
        player={selectedPlayer}
        onClose={handleCloseModal}
        onNext={handleNextPlayer}
        onPrev={handlePrevPlayer}
        hasNext={selectedPlayerIndex < players.length - 1}
        hasPrev={selectedPlayerIndex > 0}
        projectedStats={selectedPlayer ? projectedStats.get(selectedPlayer.fantraxId) : undefined}
        previousStats={selectedPlayer ? previousStats.get(selectedPlayer.fantraxId) : undefined}
      />
    </>
  );
}

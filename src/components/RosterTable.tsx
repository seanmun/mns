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

  // Helper to check if player has conflicts (same keeperRound as others)
  const hasConflict = (playerId: string): boolean => {
    const entry = getEntryForPlayer(playerId);
    if (!entry?.keeperRound) return false;

    const sameRoundCount = entries.filter(
      e => e.keeperRound === entry.keeperRound && e.decision !== 'DROP'
    ).length;

    return sameRoundCount > 1;
  };

  // Helper to check if player can move up/down
  const canMoveUp = (playerId: string): boolean => {
    const entry = getEntryForPlayer(playerId);
    if (!entry?.keeperRound) return false;

    const sameRoundEntries = entries
      .filter(e => e.keeperRound === entry.keeperRound && e.decision !== 'DROP')
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return sameRoundEntries[0]?.playerId !== playerId;
  };

  const canMoveDown = (playerId: string): boolean => {
    const entry = getEntryForPlayer(playerId);
    if (!entry?.keeperRound) return false;

    const sameRoundEntries = entries
      .filter(e => e.keeperRound === entry.keeperRound && e.decision !== 'DROP')
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return sameRoundEntries[sameRoundEntries.length - 1]?.playerId !== playerId;
  };

  const getRowClassName = (decision?: Decision, player?: Player) => {
    let baseClass = 'transition-colors cursor-pointer hover:bg-gray-50 ';

    // Decision-based background color
    if (decision === 'KEEP') {
      baseClass += 'bg-green-50 ';
    } else if (decision === 'REDSHIRT') {
      baseClass += 'bg-red-50 ';
    } else if (decision === 'INT_STASH') {
      baseClass += 'bg-blue-50 ';
    } else if (decision === 'DROP') {
      baseClass += 'opacity-60 ';
    }

    // Status-based border color
    if (player?.roster.onIR) {
      baseClass += 'border-l-4 border-l-red-500 ';
    } else if (player?.roster.isInternationalStash) {
      baseClass += 'border-l-4 border-l-purple-500 ';
    } else if (player?.roster.isRookie) {
      baseClass += 'border-l-4 border-l-green-500 ';
    }

    return baseClass;
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile: Sticky first column with horizontal scroll */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sal Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Rd
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Rd
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Decision
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
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
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            {player.name}
                          </div>
                        </div>
                      </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {player.position}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatSalary(player.salary)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                      {formatNumber(stats?.score)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                      {formatNumber(stats?.salaryScore)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                      {entry?.baseRound || player.keeper?.derivedBaseRound || '-'}
                    </td>

                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {/* Show reorder controls only if: not locked, is owner, has callback, and has conflict */}
                        {!isLocked && isOwner && onUpdatePriority && hasConflict(player.id) && (
                          <div className="flex flex-col gap-0">
                            <button
                              onClick={() => onUpdatePriority(player.id, 'up')}
                              disabled={!canMoveUp(player.id)}
                              className={`text-xs ${
                                canMoveUp(player.id)
                                  ? 'text-blue-600 hover:text-blue-800'
                                  : 'text-gray-300 cursor-not-allowed'
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
                                  ? 'text-blue-600 hover:text-blue-800'
                                  : 'text-gray-300 cursor-not-allowed'
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

                    <td
                      className="px-4 py-3 whitespace-nowrap text-sm text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isLocked ? (
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            decision === 'KEEP'
                              ? 'bg-green-100 text-green-800'
                              : decision === 'REDSHIRT'
                              ? 'bg-blue-100 text-blue-800'
                              : decision === 'INT_STASH'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
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
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          disabled={isLocked}
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
                              !player.roster.isInternationalStash ||
                              !player.roster.rookieDraftInfo?.intEligible
                            }
                          >
                            Int Stash
                            {!player.roster.isInternationalStash ||
                            !player.roster.rookieDraftInfo?.intEligible
                              ? ' (N/A)'
                              : ''}
                          </option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {players.length === 0 && (
          <div className="text-center py-12 text-gray-500">
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

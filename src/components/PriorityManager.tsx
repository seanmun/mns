import { useState } from 'react';
import type { Player, RosterEntry } from '../types';

interface PriorityManagerProps {
  entries: RosterEntry[];
  players: Map<string, Player>;
  onUpdatePriorities: (updates: { playerId: string; priority: number }[]) => void;
}

export function PriorityManager({ entries, players, onUpdatePriorities }: PriorityManagerProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Find keepers and group by base round
  const keepers = entries.filter((e) => e.decision === 'KEEP' && e.baseRound !== undefined);

  const roundGroups = new Map<number, RosterEntry[]>();
  keepers.forEach((keeper) => {
    const round = keeper.baseRound!;
    if (!roundGroups.has(round)) {
      roundGroups.set(round, []);
    }
    roundGroups.get(round)!.push(keeper);
  });

  // Filter to only rounds with multiple players
  const conflictRounds = Array.from(roundGroups.entries())
    .filter(([_, group]) => group.length > 1)
    .sort(([a], [b]) => a - b);

  if (conflictRounds.length === 0) {
    return null;
  }

  const toggleExpanded = (round: number) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(round)) {
      newExpanded.delete(round);
    } else {
      newExpanded.add(round);
    }
    setExpanded(newExpanded);
  };

  const movePriority = (round: number, playerId: string, direction: 'up' | 'down') => {
    const group = roundGroups.get(round)!;

    // Sort by current priority
    const sorted = [...group].sort((a, b) => {
      const aPrio = a.priority ?? 999;
      const bPrio = b.priority ?? 999;
      return aPrio - bPrio;
    });

    const currentIndex = sorted.findIndex((e) => e.playerId === playerId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;

    // Swap the players
    [sorted[currentIndex], sorted[newIndex]] = [sorted[newIndex], sorted[currentIndex]];

    // Assign new priorities (0, 1, 2, ...)
    const updates = sorted.map((entry, idx) => ({
      playerId: entry.playerId,
      priority: idx,
    }));

    onUpdatePriorities(updates);
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-yellow-600 text-2xl">⚠️</div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Priority Manager
          </h3>
          <p className="text-sm text-gray-700">
            Multiple players share the same base keeper round. Use the arrows to choose who gets priority.
            <strong> This matters for next year's keeper values!</strong> Earlier rounds become better keeper rounds next season.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {conflictRounds.map(([round, group]) => {
          const isExpanded = expanded.has(round);

          // Sort group by priority for display
          const sortedGroup = [...group].sort((a, b) => {
            const aPrio = a.priority ?? 999;
            const bPrio = b.priority ?? 999;
            return aPrio - bPrio;
          });

          return (
            <div key={round} className="bg-white rounded border border-yellow-300">
              <button
                onClick={() => toggleExpanded(round)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">
                    Base Round {round}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({group.length} players)
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="border-t border-yellow-200 p-4">
                  <p className="text-xs text-gray-600 mb-3">
                    First player gets Round {round}, others stack to {round + 1}, {round + 2}, etc.
                  </p>
                  <div className="space-y-2">
                    {sortedGroup.map((entry, idx) => {
                      const player = players.get(entry.playerId);
                      if (!player) return null;

                      const finalRound = round + idx;

                      return (
                        <div
                          key={entry.playerId}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => movePriority(round, entry.playerId, 'up')}
                              disabled={idx === 0}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up (earlier round)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => movePriority(round, entry.playerId, 'down')}
                              disabled={idx === sortedGroup.length - 1}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down (later round)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>

                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{player.name}</div>
                            <div className="text-xs text-gray-500">
                              {player.position} • ${(player.salary / 1_000_000).toFixed(1)}M
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-600">
                              Final: Round {finalRound}
                            </div>
                            <div className="text-xs text-gray-500">
                              Next year: Round {finalRound - 1}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

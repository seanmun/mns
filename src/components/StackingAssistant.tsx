import { useState } from 'react';
import type { RosterEntry, Player } from '../types';

interface StackingAssistantProps {
  entries: RosterEntry[];
  players: Map<string, Player>;
  onAutoAssign: () => void;
  franchiseTagsRequired: number;
}

export function StackingAssistant({
  entries,
  players,
  onAutoAssign,
  franchiseTagsRequired,
}: StackingAssistantProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Analyze round occupancy
  const roundOccupancy = new Map<number, RosterEntry[]>();
  entries
    .filter((e) => e.decision === 'KEEP' && e.keeperRound)
    .forEach((entry) => {
      const round = entry.keeperRound!;
      if (!roundOccupancy.has(round)) {
        roundOccupancy.set(round, []);
      }
      roundOccupancy.get(round)!.push(entry);
    });

  // Find conflicts (rounds with >1 keeper)
  const conflicts = Array.from(roundOccupancy.entries())
    .filter(([_, entries]) => entries.length > 1)
    .sort(([a], [b]) => a - b);

  const hasConflicts = conflicts.length > 0;

  const handleAutoAssign = () => {
    if (franchiseTagsRequired > 0) {
      setShowConfirmation(true);
    } else {
      onAutoAssign();
    }
  };

  const confirmAutoAssign = () => {
    setShowConfirmation(false);
    onAutoAssign();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Keeper Round Stacking</h3>

      {/* Round occupancy grid */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-2">Round Occupancy (1-14)</div>
        <div className="grid grid-cols-14 gap-1">
          {Array.from({ length: 14 }, (_, i) => i + 1).map((round) => {
            const occupants = roundOccupancy.get(round) || [];
            const hasConflict = occupants.length > 1;

            return (
              <div
                key={round}
                className={`aspect-square rounded flex items-center justify-center text-xs font-medium border-2 ${
                  hasConflict
                    ? 'bg-red-100 border-red-500 text-red-700'
                    : occupants.length === 1
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
                title={
                  occupants.length > 0
                    ? occupants
                        .map((e) => players.get(e.playerId)?.name)
                        .join(', ')
                    : `Round ${round}`
                }
              >
                {round}
                {occupants.length > 1 && (
                  <span className="text-xs ml-0.5">×{occupants.length}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conflicts list */}
      {hasConflicts && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="font-semibold text-sm text-yellow-800 mb-2">
            ⚠️ Round Conflicts Detected
          </h4>
          <div className="space-y-2 text-sm">
            {conflicts.map(([round, entries]) => (
              <div key={round} className="flex items-start gap-2">
                <span className="font-medium text-yellow-700">
                  Round {round}:
                </span>
                <span className="text-yellow-900">
                  {entries.map((e) => players.get(e.playerId)?.name).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Franchise tag warning */}
      {franchiseTagsRequired > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-semibold text-sm text-blue-800 mb-2">
            💰 Franchise Tags Required
          </h4>
          <p className="text-sm text-blue-900">
            You have {franchiseTagsRequired} additional first-round keeper
            {franchiseTagsRequired > 1 ? 's' : ''}. Each requires a $15
            franchise tag fee.
          </p>
          <p className="text-sm font-medium text-blue-900 mt-2">
            Total franchise tag cost: $
            {franchiseTagsRequired * 15}
          </p>
        </div>
      )}

      {/* Auto-assign button */}
      <button
        onClick={handleAutoAssign}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
      >
        {hasConflicts ? 'Resolve Conflicts' : 'Auto-Assign Keeper Rounds'}
      </button>

      {/* Info text */}
      <p className="mt-3 text-xs text-gray-500">
        This will apply Bottom-of-Draft stacking (resolve conflicts by moving
        down 14→1) and Top-of-Draft rules (franchise tags for extra Round 1
        keepers).
      </p>

      {/* Confirmation modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Confirm Franchise Tags
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              This will assign {franchiseTagsRequired} franchise tag
              {franchiseTagsRequired > 1 ? 's' : ''}, adding $
              {franchiseTagsRequired * 15} to your fees.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAutoAssign}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

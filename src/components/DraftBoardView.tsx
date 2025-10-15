import type { Player, RosterEntry, DraftPick } from '../types';

interface DraftBoardViewProps {
  players: Player[];
  entries: RosterEntry[];
  draftedPicks?: DraftPick[];  // Draft picks with round info
}

export function DraftBoardView({ players, entries, draftedPicks = [] }: DraftBoardViewProps) {
  const playersMap = new Map(players.map(p => [p.id, p]));

  // Group keepers by their assigned keeper round
  const keepersByRound = new Map<number, RosterEntry[]>();
  entries
    .filter(e => e.decision === 'KEEP' && e.keeperRound)
    .forEach(entry => {
      const round = entry.keeperRound!;
      if (!keepersByRound.has(round)) {
        keepersByRound.set(round, []);
      }
      keepersByRound.get(round)!.push(entry);
    });

  // Group drafted players by round (only non-keeper picks)
  const draftedByRound = new Map<number, DraftPick[]>();
  draftedPicks
    .filter(pick => pick.playerId && !pick.isKeeperSlot)
    .forEach(pick => {
      if (!draftedByRound.has(pick.round)) {
        draftedByRound.set(pick.round, []);
      }
      draftedByRound.get(pick.round)!.push(pick);
    });

  // Get redshirts and int stash players
  const redshirts = entries.filter(e => e.decision === 'REDSHIRT');
  const intStash = entries.filter(e => e.decision === 'INT_STASH');

  // Create array of all 13 rounds
  const rounds = Array.from({ length: 13 }, (_, i) => i + 1);

  return (
    <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Draft Board</h2>
      <p className="text-sm text-gray-400 mb-6">
        Your draft picks by round. Keepers in green, drafted players in purple.
      </p>

      <div className="space-y-3">
        {rounds.map(round => {
          const keeper = keepersByRound.get(round)?.[0];
          const drafted = draftedByRound.get(round)?.[0];

          // Determine which takes priority (keeper over drafted)
          const hasKeeper = !!keeper;
          const hasDrafted = !!drafted;

          const keeperPlayer = keeper ? playersMap.get(keeper.playerId) : null;
          const draftedPlayer = drafted ? playersMap.get(drafted.playerId!) : null;

          return (
            <div
              key={round}
              className={`flex items-center gap-4 p-4 rounded-lg border ${
                hasKeeper
                  ? 'bg-green-400/5 border-green-400/30'
                  : hasDrafted
                  ? 'bg-purple-400/5 border-purple-400/30'
                  : 'bg-[#0a0a0a] border-gray-800'
              }`}
            >
              {/* Round Number */}
              <div className="flex-shrink-0 w-16">
                <div className={`text-center font-bold ${
                  hasKeeper ? 'text-green-400' : hasDrafted ? 'text-purple-400' : 'text-gray-500'
                }`}>
                  <div className="text-xs opacity-70">RD</div>
                  <div className="text-2xl">{round}</div>
                </div>
              </div>

              {/* Player Info or Empty Slot */}
              {hasKeeper && keeperPlayer ? (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white truncate">
                          {keeperPlayer.name}
                        </div>
                        <span className="text-xs px-1.5 py-0.5 bg-green-400/20 text-green-400 rounded">
                          Keeper
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {keeperPlayer.position} • {keeperPlayer.nbaTeam}
                        </span>
                        <span className="text-xs font-semibold text-green-400">
                          ${(keeperPlayer.salary / 1_000_000).toFixed(1)}M
                        </span>
                        {keeper.baseRound && keeper.baseRound !== round && (
                          <span className="text-xs text-gray-500">
                            (from R{keeper.baseRound})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : hasDrafted && draftedPlayer ? (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white truncate">
                          {draftedPlayer.name}
                        </div>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-400/20 text-purple-400 rounded">
                          Drafted
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {draftedPlayer.position} • {draftedPlayer.nbaTeam}
                        </span>
                        <span className="text-xs font-semibold text-purple-400">
                          ${(draftedPlayer.salary / 1_000_000).toFixed(1)}M
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 text-gray-500 text-sm">
                  Available
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Redshirts Section */}
      {redshirts.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-bold text-blue-400">Redshirts</h3>
            <span className="text-xs text-gray-500">({redshirts.length})</span>
          </div>
          <div className="space-y-2">
            {redshirts.map(entry => {
              const player = playersMap.get(entry.playerId);
              if (!player) return null;

              return (
                <div
                  key={entry.playerId}
                  className="flex items-center gap-4 p-3 rounded-lg bg-blue-400/5 border border-blue-400/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {player.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {player.position} • {player.nbaTeam}
                      </span>
                      <span className="text-xs font-semibold text-blue-400">
                        ${(player.salary / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* International Stash Section */}
      {intStash.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-bold text-purple-400">International Stash</h3>
            <span className="text-xs text-gray-500">({intStash.length})</span>
          </div>
          <div className="space-y-2">
            {intStash.map(entry => {
              const player = playersMap.get(entry.playerId);
              if (!player) return null;

              return (
                <div
                  key={entry.playerId}
                  className="flex items-center gap-4 p-3 rounded-lg bg-purple-400/5 border border-purple-400/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {player.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {player.position} • {player.nbaTeam}
                      </span>
                      <span className="text-xs font-semibold text-purple-400">
                        ${(player.salary / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-800">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Keepers</div>
            <div className="text-2xl font-bold text-green-400">
              {keepersByRound.size}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Drafted</div>
            <div className="text-2xl font-bold text-purple-400">
              {draftedByRound.size}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Available</div>
            <div className="text-2xl font-bold text-white">
              {13 - keepersByRound.size - draftedByRound.size}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

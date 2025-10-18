import type { Player, RosterEntry, PickAssignment } from '../types';

interface DraftBoardViewProps {
  players: Player[];
  entries: RosterEntry[];
  pickAssignments?: PickAssignment[];  // NEW: Pick assignments from pickAssignments collection
}

export function DraftBoardView({ players, entries, pickAssignments = [] }: DraftBoardViewProps) {
  const playersMap = new Map(players.map(p => [p.id, p]));

  // Group ALL picks by round from pickAssignments (source of truth)
  const picksByRound = new Map<number, PickAssignment[]>();
  pickAssignments.forEach(pick => {
    if (!picksByRound.has(pick.round)) {
      picksByRound.set(pick.round, []);
    }
    picksByRound.get(pick.round)!.push(pick);
  });

  // Get redshirts and int stash players
  const redshirts = entries.filter(e => e.decision === 'REDSHIRT');
  const intStash = entries.filter(e => e.decision === 'INT_STASH');

  // Only show rounds where team has picks
  const rounds = Array.from(picksByRound.keys()).sort((a, b) => a - b);

  return (
    <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Draft Board</h2>
      <p className="text-sm text-gray-400 mb-6">
        Your draft picks by round. Keepers in green, drafted players in purple.
      </p>

      <div className="space-y-3">
        {rounds.map(round => {
          const roundPicks = picksByRound.get(round) || [];

          return (
            <div key={round} className="space-y-2">
              {/* Show ALL picks in this round */}
              {roundPicks.map((pick, index) => {
                const player = playersMap.get(pick.playerId!);
                const isKeeper = pick.isKeeperSlot;

                return (
                  <div
                    key={`${round}-${index}`}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      isKeeper
                        ? 'bg-green-400/5 border-green-400/30'
                        : 'bg-purple-400/5 border-purple-400/30'
                    }`}
                  >
                    {/* Round Number (only show for first pick in round) */}
                    <div className="flex-shrink-0 w-16">
                      {index === 0 ? (
                        <div className={`text-center font-bold ${
                          isKeeper ? 'text-green-400' : 'text-purple-400'
                        }`}>
                          <div className="text-xs opacity-70">RD</div>
                          <div className="text-2xl">{round}</div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-600 text-xs">
                          {roundPicks.length > 1 && `+${index}`}
                        </div>
                      )}
                    </div>

                    {/* Player Info */}
                    {player ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-white truncate">
                                {player.name}
                              </div>
                              <span className={`text-xs px-1.5 py-0.5 ${
                                isKeeper
                                  ? 'bg-green-400/20 text-green-400'
                                  : 'bg-purple-400/20 text-purple-400'
                              } rounded`}>
                                {isKeeper ? 'Keeper' : 'Drafted'}
                              </span>
                              {pick.wasTraded && pick.originalTeamAbbrev && (
                                <span className="text-xs text-gray-500">
                                  (from {pick.originalTeamAbbrev})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">
                                {player.position} • {player.nbaTeam}
                              </span>
                              <span className={`text-xs font-semibold ${
                                isKeeper ? 'text-green-400' : 'text-purple-400'
                              }`}>
                                ${(player.salary / 1_000_000).toFixed(1)}M
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <span className="text-gray-500 text-sm">Available</span>
                        {pick.wasTraded && pick.originalTeamAbbrev && (
                          <span className="text-xs text-gray-500 ml-2">
                            (from {pick.originalTeamAbbrev})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
              {pickAssignments.filter(p => p.isKeeperSlot && p.playerId).length}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Drafted</div>
            <div className="text-2xl font-bold text-purple-400">
              {pickAssignments.filter(p => !p.isKeeperSlot && p.playerId).length}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Available</div>
            <div className="text-2xl font-bold text-white">
              {13 - picksByRound.size}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

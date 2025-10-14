import type { Player, WatchList } from '../types';

interface WatchListViewProps {
  watchList: WatchList | null;
  allPlayers: Player[];
  projectedStats: Map<string, any>;
}

export function WatchListView({ watchList, allPlayers, projectedStats }: WatchListViewProps) {
  // Get watched players
  const watchedPlayers = allPlayers.filter(player =>
    watchList?.playerIds.includes(player.fantraxId)
  );

  // Sort by projected score (highest first)
  const sortedWatchedPlayers = [...watchedPlayers].sort((a, b) => {
    const statsA = projectedStats.get(a.fantraxId);
    const statsB = projectedStats.get(b.fantraxId);
    const scoreA = statsA?.score ?? 0;
    const scoreB = statsB?.score ?? 0;
    return scoreB - scoreA;
  });

  return (
    <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 flex flex-col h-[600px]">
      <h2 className="text-xl font-bold text-white mb-4">⭐ Watch List</h2>
      <p className="text-sm text-gray-400 mb-6">
        Players you're tracking from the free agent pool
      </p>

      {sortedWatchedPlayers.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
          <div className="text-gray-400 text-sm">
            No players in your watch list yet
          </div>
          <div className="text-gray-500 text-xs mt-2">
            Click the star icon on players in the Free Agent Pool to add them here
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 mb-6">
            {sortedWatchedPlayers.map((player) => {
              const stats = projectedStats.get(player.fantraxId);

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-green-400/5 border border-green-400/30 hover:bg-green-400/10 transition-colors"
                >
                  {/* Rank/Score */}
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {stats?.score ? Math.round(stats.score) : '-'}
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">
                      {player.name}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-gray-400">
                        {player.position}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">
                        {player.nbaTeam}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-green-400 font-semibold">
                        ${(player.salary / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  </div>

                  {/* Key Stats */}
                  <div className="hidden sm:flex gap-4 text-xs">
                    <div className="text-center">
                      <div className="font-semibold text-white">
                        {stats?.points ? stats.points.toFixed(1) : '-'}
                      </div>
                      <div className="text-gray-500">PTS</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-white">
                        {stats?.rebounds ? stats.rebounds.toFixed(1) : '-'}
                      </div>
                      <div className="text-gray-500">REB</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-white">
                        {stats?.assists ? stats.assists.toFixed(1) : '-'}
                      </div>
                      <div className="text-gray-500">AST</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary - Fixed at bottom */}
          <div className="pt-6 border-t border-gray-800 flex-shrink-0">
            <div className="text-center">
              <div className="text-gray-400 text-sm">Players Watched</div>
              <div className="text-3xl font-bold text-green-400 mt-1">
                {sortedWatchedPlayers.length}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

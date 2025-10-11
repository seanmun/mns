import { useState } from 'react';
import type { Player, ProjectedStats, PreviousStats } from '../types';

interface PlayerModalProps {
  player: Player | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  projectedStats?: ProjectedStats;
  previousStats?: PreviousStats;
}

export function PlayerModal({
  player,
  onClose,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
  projectedStats,
  previousStats
}: PlayerModalProps) {
  const [statsTab, setStatsTab] = useState<'projected' | 'previous'>('projected');

  if (!player) return null;

  const formatSalary = (salary: number) => {
    return `$${(salary / 1_000_000).toFixed(2)}M`;
  };

  const formatStat = (stat: number | undefined) => {
    if (stat === undefined) return '-';
    return stat.toFixed(1);
  };

  const formatPercent = (percent: number | undefined) => {
    if (percent === undefined) return '-';
    return `${(percent * 100).toFixed(1)}%`;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{player.name}</h2>
              <p className="text-gray-500 mt-1">
                {player.position} · {player.nbaTeam}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Player Details */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Salary</div>
                <div className="text-lg font-semibold">{formatSalary(player.salary)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Position</div>
                <div className="text-lg font-semibold">{player.position}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">NBA Team</div>
                <div className="text-lg font-semibold">{player.nbaTeam}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Fantrax ID</div>
                <div className="text-lg font-semibold text-gray-600">{player.fantraxId}</div>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Status</h3>
            <div className="flex flex-wrap gap-2">
              {player.roster.isRookie && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Rookie
                </span>
              )}
              {player.roster.onIR && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  On IR
                </span>
              )}
              {player.roster.isInternationalStash && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  International Stash
                </span>
              )}
            </div>
          </div>

          {/* Keeper Info */}
          {player.keeper && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Keeper Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {player.keeper.priorYearRound && (
                  <div>
                    <div className="text-sm text-gray-500">Prior Year Round</div>
                    <div className="text-lg font-semibold">Round {player.keeper.priorYearRound}</div>
                  </div>
                )}
                {player.keeper.derivedBaseRound && (
                  <div>
                    <div className="text-sm text-gray-500">Base Keeper Round</div>
                    <div className="text-lg font-semibold">Round {player.keeper.derivedBaseRound}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rookie Draft Info */}
          {player.roster.rookieDraftInfo && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Rookie Draft Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Draft Position</div>
                  <div className="text-lg font-semibold">
                    Round {player.roster.rookieDraftInfo.round}, Pick {player.roster.rookieDraftInfo.pick}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Eligibility</div>
                  <div className="flex flex-col gap-1">
                    {player.roster.rookieDraftInfo.redshirtEligible && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                        Redshirt Eligible
                      </span>
                    )}
                    {player.roster.rookieDraftInfo.intEligible && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 w-fit">
                        Int Stash Eligible
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Section with Toggle */}
          {(projectedStats || previousStats) && (
            <div>
              {/* Key Stats (only for projected) */}
              {projectedStats && (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Fantasy Score</div>
                    <div className="text-lg font-bold text-blue-600">{formatStat(projectedStats.score)}</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Salary Score</div>
                    <div className="text-lg font-bold text-green-600">{formatStat(projectedStats.salaryScore)}</div>
                    <div className="text-xs text-gray-500">PPM</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Overall Rank</div>
                    <div className="text-lg font-bold text-purple-600">#{formatStat(projectedStats.rkOv)}</div>
                  </div>
                </div>
              )}

              {/* Tab Toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setStatsTab('projected')}
                  className={`flex-1 px-4 py-2 rounded font-medium ${
                    statsTab === 'projected'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  Projected 2025-26
                </button>
                <button
                  onClick={() => setStatsTab('previous')}
                  className={`flex-1 px-4 py-2 rounded font-medium ${
                    statsTab === 'previous'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  2024-25 Stats
                </button>
              </div>

              {/* Projected Stats */}
              {statsTab === 'projected' && projectedStats && (
                <div className="grid grid-cols-5 gap-2 text-sm">
                  {/* Row 1: PTS, REB, AST, ST, BLK */}
                  <div>
                    <div className="text-xs text-gray-500">PTS</div>
                    <div className="font-semibold">{formatStat(projectedStats.points)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">REB</div>
                    <div className="font-semibold">{formatStat(projectedStats.rebounds)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">AST</div>
                    <div className="font-semibold">{formatStat(projectedStats.assists)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ST</div>
                    <div className="font-semibold">{formatStat(projectedStats.steals)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">BLK</div>
                    <div className="font-semibold">{formatStat(projectedStats.blocks)}</div>
                  </div>
                  {/* Row 2: FG%, FT%, 3PM, A/TO */}
                  <div>
                    <div className="text-xs text-gray-500">FG%</div>
                    <div className="font-semibold">{formatPercent(projectedStats.fgPercent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">FT%</div>
                    <div className="font-semibold">{formatPercent(projectedStats.ftPercent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">3PM</div>
                    <div className="font-semibold">{formatStat(projectedStats.threePointMade)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">A/TO</div>
                    <div className="font-semibold">{formatStat(projectedStats.assistToTurnover)}</div>
                  </div>
                  <div></div> {/* Empty cell to maintain grid */}
                </div>
              )}

              {/* Previous Season Stats */}
              {statsTab === 'previous' && previousStats && (
                <div className="grid grid-cols-5 gap-2 text-sm">
                  {/* Row 1: PTS, REB, AST, ST, BLK */}
                  <div>
                    <div className="text-xs text-gray-500">PTS</div>
                    <div className="font-semibold">{formatStat(previousStats.points)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">REB</div>
                    <div className="font-semibold">{formatStat(previousStats.rebounds)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">AST</div>
                    <div className="font-semibold">{formatStat(previousStats.assists)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ST</div>
                    <div className="font-semibold">{formatStat(previousStats.steals)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">BLK</div>
                    <div className="font-semibold">{formatStat(previousStats.blocks)}</div>
                  </div>
                  {/* Row 2: FG%, FT%, 3PM, A/TO */}
                  <div>
                    <div className="text-xs text-gray-500">FG%</div>
                    <div className="font-semibold">{formatPercent(previousStats.fgPercent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">FT%</div>
                    <div className="font-semibold">{formatPercent(previousStats.ftPercent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">3PM</div>
                    <div className="font-semibold">{formatStat(previousStats.threePointMade)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">A/TO</div>
                    <div className="font-semibold">{formatStat(previousStats.assistToTurnover)}</div>
                  </div>
                  <div></div> {/* Empty cell to maintain grid */}
                </div>
              )}

              {/* No data messages */}
              {statsTab === 'projected' && !projectedStats && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No projected stats available
                </div>
              )}
              {statsTab === 'previous' && !previousStats && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No previous season stats available
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50">
          <div className="flex gap-3">
            {/* Previous Button */}
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className={`flex-1 px-4 py-2 rounded font-medium ${
                hasPrev
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              ‹‹ Prev
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium"
            >
              Close
            </button>

            {/* Next Button */}
            <button
              onClick={onNext}
              disabled={!hasNext}
              className={`flex-1 px-4 py-2 rounded font-medium ${
                hasNext
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Next ››
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

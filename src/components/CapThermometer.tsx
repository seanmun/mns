import { memo } from 'react';
import type { RosterSummary, LeagueCapSettings, LeagueFeeSettings } from '../types';

interface CapThermometerProps {
  summary: RosterSummary;
  maxKeepers?: number;
  isRegularSeason?: boolean;
  cap?: LeagueCapSettings;
  fees?: LeagueFeeSettings;
}

export const CapThermometer = memo(function CapThermometer({ summary, maxKeepers = 13, isRegularSeason = false, cap, fees }: CapThermometerProps) {
  const { capUsed, capEffective, overSecondApronByM, keepersCount } = summary;
  const firstApron = cap?.firstApron || 195_000_000;
  const secondApron = cap?.secondApron || 225_000_000;
  const max = cap?.max || 255_000_000;
  const firstApronFeeAmount = fees?.firstApronFee ?? 50;
  const penaltyRate = fees?.penaltyRatePerM ?? 2;
  const totalRosterSize = 13;  // Total roster spots (keepers + draft picks)

  // Hide apron markers if the league has no aprons (e.g. WNBA)
  const hasAprons = firstApron > 0 && secondApron > 0;

  // Calculate marker positions on the full scale
  const firstApronPercent = hasAprons ? (firstApron / max) * 100 : 0;
  const secondApronPercent = hasAprons ? (secondApron / max) * 100 : 0;
  const capUsedPercent = Math.min((capUsed / max) * 100, 100);

  const formatCap = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  const getBarColor = () => {
    if (hasAprons && capUsed > secondApron) return 'bg-orange-500';
    if (hasAprons && capUsed > firstApron) return 'bg-yellow-500';
    if (capUsed > max) return 'bg-red-500';
    return 'bg-green-500';
  };

  const isOverFirstApron = hasAprons && capUsed > firstApron;
  const isOverSecondApron = hasAprons && capUsed > secondApron;

  return (
    <div className="bg-[#121212] p-6 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold mb-4 text-white">Salary Cap Status</h3>

      {/* Salary cap scale */}
      <div className="mb-6 md:mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Cap Used: {formatCap(capUsed)}</span>
          <span>Max: {formatCap(max)}</span>
        </div>

        <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden">
          {/* Cap used bar */}
          <div
            className={`h-full ${getBarColor()} transition-all duration-300`}
            style={{ width: `${capUsedPercent}%` }}
          />

          {/* First apron marker */}
          {hasAprons && (
            <div
              className="absolute top-0 h-full w-0.5 bg-yellow-400"
              style={{ left: `${firstApronPercent}%` }}
              title={`First Apron: ${formatCap(firstApron)}`}
            />
          )}

          {/* Second apron marker */}
          {hasAprons && (
            <div
              className="absolute top-0 h-full w-0.5 bg-orange-400"
              style={{ left: `${secondApronPercent}%` }}
              title={`Second Apron: ${formatCap(secondApron)}`}
            />
          )}
        </div>

        <div className="relative text-xs text-gray-400 mt-1 h-8 md:h-4">
          <span className="absolute left-0">$0</span>
          {hasAprons && (
            <>
              {/* Mobile: Stack apron markers vertically */}
              <span className="absolute text-yellow-400 md:hidden" style={{ left: `${firstApronPercent}%`, transform: 'translateX(-50%)' }}>
                {formatCap(firstApron)}
              </span>
              <span className="absolute text-orange-400 md:hidden" style={{ left: `${secondApronPercent}%`, transform: 'translateX(-50%)', top: '13px' }}>
                {formatCap(secondApron)}
              </span>
              {/* Desktop: Show full labels side by side */}
              <span className="absolute text-yellow-400 hidden md:inline" style={{ left: `${firstApronPercent}%`, transform: 'translateX(-50%)' }}>
                {formatCap(firstApron)} (1st)
              </span>
              <span className="absolute text-orange-400 hidden md:inline" style={{ left: `${secondApronPercent}%`, transform: 'translateX(-50%)' }}>
                {formatCap(secondApron)} (2nd)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <div className="text-gray-400">Used</div>
          <div className="font-semibold text-lg text-white">{formatCap(capUsed)}</div>
        </div>

        <div>
          <div className="text-gray-400">{isRegularSeason ? 'Players' : 'Keepers'}</div>
          <div className="font-semibold text-lg text-white">
            {keepersCount} / {isRegularSeason ? totalRosterSize : maxKeepers}
          </div>
        </div>

        <div>
          <div className="text-gray-400">Remaining</div>
          <div className="font-semibold text-lg text-white">
            {formatCap(Math.max(0, capEffective - capUsed))}
          </div>
        </div>

        <div>
          <div className="text-gray-400">Over Base</div>
          <div
            className={`font-semibold text-lg ${
              overSecondApronByM > 0 ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {overSecondApronByM > 0
              ? `+${formatCap(overSecondApronByM * 1_000_000)}`
              : '-'}
          </div>
        </div>
      </div>

      {/* Average Salary Metrics */}
      <div className={`grid grid-cols-1 ${isRegularSeason ? '' : 'md:grid-cols-3'} gap-4 text-sm pt-4 border-t border-gray-800`}>
        <div>
          <div className="text-gray-400">{isRegularSeason ? 'Avg Salary Per Player' : 'Avg Salary Per Keeper'}</div>
          <div className="font-semibold text-lg text-green-400">
            {keepersCount > 0 ? formatCap(capUsed / keepersCount) : '-'}
          </div>
        </div>

        {!isRegularSeason && hasAprons && (
          <div>
            <div className="text-gray-400">Avg/Spot (Before 1st Apron)</div>
            <div className="font-semibold text-lg text-yellow-400">
              {(() => {
                const draftSpots = totalRosterSize - keepersCount;
                if (draftSpots <= 0) return '-';
                const roomToFirstApron = Math.max(0, firstApron - capUsed);
                return formatCap(roomToFirstApron / draftSpots);
              })()}
            </div>
          </div>
        )}

        {!isRegularSeason && hasAprons && (
          <div>
            <div className="text-gray-400">Avg/Spot (Before 2nd Apron)</div>
            <div className="font-semibold text-lg text-orange-400">
              {(() => {
                const draftSpots = totalRosterSize - keepersCount;
                if (draftSpots <= 0) return '-';
                const roomToSecondApron = Math.max(0, secondApron - capUsed);
                return formatCap(roomToSecondApron / draftSpots);
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Warning messages */}
      {isOverFirstApron && !isOverSecondApron && firstApronFeeAmount > 0 && (
        <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded text-sm text-yellow-400">
          First Apron: You are over {formatCap(firstApron)}. A one-time ${firstApronFeeAmount} fee applies.
        </div>
      )}

      {isOverSecondApron && penaltyRate > 0 && (
        <div className="mt-4 p-3 bg-orange-400/10 border border-orange-400/30 rounded text-sm text-orange-400">
          Second Apron Penalty: ${summary.penaltyDues} due (${overSecondApronByM}M over × ${penaltyRate}/M)
        </div>
      )}

      {!hasAprons && capUsed > max && (
        <div className="mt-4 p-3 bg-red-400/10 border border-red-400/30 rounded text-sm text-red-400">
          Over salary cap by {formatCap(capUsed - max)}
        </div>
      )}
    </div>
  );
});

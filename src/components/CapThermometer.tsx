import type { RosterSummary } from '../types';

interface CapThermometerProps {
  summary: RosterSummary;
  maxKeepers?: number;
}

export function CapThermometer({ summary, maxKeepers = 13 }: CapThermometerProps) {
  const { capUsed, capEffective, overSecondApronByM, keepersCount } = summary;
  const firstApron = 195_000_000;
  const secondApron = 225_000_000;
  const max = 255_000_000;

  // Calculate marker positions on the full scale (0 to 255M)
  const firstApronPercent = (firstApron / max) * 100;
  const secondApronPercent = (secondApron / max) * 100;
  const capUsedPercent = Math.min((capUsed / max) * 100, 100);

  const formatCap = (value: number) => {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  };

  const getBarColor = () => {
    if (capUsed > secondApron) return 'bg-orange-500';
    if (capUsed > firstApron) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const isOverFirstApron = capUsed > firstApron;
  const isOverSecondApron = capUsed > secondApron;

  return (
    <div className="bg-[#121212] p-6 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold mb-4 text-white">Salary Cap Status</h3>

      {/* Salary cap scale (0 to 250M) */}
      <div className="mb-6">
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

          {/* First apron marker (195M) */}
          <div
            className="absolute top-0 h-full w-0.5 bg-yellow-400"
            style={{ left: `${firstApronPercent}%` }}
            title="First Apron: $195M"
          />

          {/* Second apron marker (225M) */}
          <div
            className="absolute top-0 h-full w-0.5 bg-orange-400"
            style={{ left: `${secondApronPercent}%` }}
            title="Second Apron: $225M"
          />
        </div>

        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>$0M</span>
          <span className="text-yellow-400">$195M (1st Apron)</span>
          <span className="text-orange-400">$225M (2nd Apron)</span>
          <span>$255M</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <div className="text-gray-400">Used</div>
          <div className="font-semibold text-lg text-white">{formatCap(capUsed)}</div>
        </div>

        <div>
          <div className="text-gray-400">Keepers</div>
          <div className="font-semibold text-lg text-white">
            {keepersCount} / {maxKeepers}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pt-4 border-t border-gray-800">
        <div>
          <div className="text-gray-400">Avg Salary Per Keeper</div>
          <div className="font-semibold text-lg text-green-400">
            {keepersCount > 0 ? formatCap(capUsed / keepersCount) : '-'}
          </div>
        </div>

        <div>
          <div className="text-gray-400">Avg/Spot (Before 1st Apron)</div>
          <div className="font-semibold text-lg text-yellow-400">
            {keepersCount < maxKeepers
              ? formatCap(Math.max(0, firstApron - capUsed) / (maxKeepers - keepersCount))
              : '-'}
          </div>
        </div>

        <div>
          <div className="text-gray-400">Avg/Spot (Before 2nd Apron)</div>
          <div className="font-semibold text-lg text-orange-400">
            {keepersCount < maxKeepers
              ? formatCap(Math.max(0, secondApron - capUsed) / (maxKeepers - keepersCount))
              : '-'}
          </div>
        </div>
      </div>

      {/* Warning messages */}
      {isOverFirstApron && !isOverSecondApron && (
        <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded text-sm text-yellow-400">
          ⚠️ First Apron: You are over $195M. A one-time $50 fee applies. After payment, you can stay over $195M for the rest of the season.
        </div>
      )}

      {isOverSecondApron && (
        <div className="mt-4 p-3 bg-orange-400/10 border border-orange-400/30 rounded text-sm text-orange-400">
          ⚠️ Second Apron Penalty: ${summary.penaltyDues} due (${overSecondApronByM}M over × $2/M)
        </div>
      )}
    </div>
  );
}

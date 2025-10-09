import type { RosterSummary } from '../types';

interface CapThermometerProps {
  summary: RosterSummary;
}

export function CapThermometer({ summary }: CapThermometerProps) {
  const { capUsed, capEffective, capBase, overSecondApronByM } = summary;

  const floor = 170_000_000;
  const max = 250_000_000;

  // Calculate percentage of effective cap used (main progress bar)
  const usedPercent = Math.min((capUsed / capEffective) * 100, 100);

  // Calculate marker positions on the full scale (floor to max)
  const floorPercent = ((floor - floor) / (max - floor)) * 100;
  const basePercent = ((capBase - floor) / (max - floor)) * 100;
  const effectivePercent = ((capEffective - floor) / (max - floor)) * 100;
  const usedAbsolutePercent = Math.min(
    ((capUsed - floor) / (max - floor)) * 100,
    100
  );

  const formatCap = (value: number) => {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  };

  const getBarColor = () => {
    if (capUsed > capBase) return 'bg-red-500';
    if (capUsed > capEffective * 0.9) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Salary Cap Status</h3>

      {/* Main progress bar - percentage of effective cap used */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Cap Used</span>
          <span>{usedPercent.toFixed(1)}% of Effective Cap</span>
        </div>
        <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getBarColor()} transition-all duration-300`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>

      {/* Full scale reference bar */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">Full Scale ($170M - $250M)</div>
        <div className="relative h-4 bg-gray-100 rounded">
          {/* Used cap position on full scale */}
          <div
            className={`absolute h-full ${getBarColor()} opacity-50`}
            style={{ width: `${usedAbsolutePercent}%` }}
          />

          {/* Floor marker */}
          <div
            className="absolute h-full w-0.5 bg-blue-600"
            style={{ left: `${floorPercent}%` }}
            title="Floor: $170M"
          />

          {/* Base cap marker */}
          <div
            className="absolute h-full w-0.5 bg-gray-600"
            style={{ left: `${basePercent}%` }}
            title="Base: $210M"
          />

          {/* Effective cap marker */}
          {capEffective !== capBase && (
            <div
              className="absolute h-full w-0.5 bg-purple-600"
              style={{ left: `${effectivePercent}%` }}
              title={`Effective: ${formatCap(capEffective)}`}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>$170M</span>
          <span>$210M</span>
          <span>$250M</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Used</div>
          <div className="font-semibold text-lg">{formatCap(capUsed)}</div>
        </div>

        <div>
          <div className="text-gray-500">Effective Cap</div>
          <div className="font-semibold text-lg">{formatCap(capEffective)}</div>
        </div>

        <div>
          <div className="text-gray-500">Remaining</div>
          <div className="font-semibold text-lg">
            {formatCap(Math.max(0, capEffective - capUsed))}
          </div>
        </div>

        <div>
          <div className="text-gray-500">Over Base</div>
          <div
            className={`font-semibold text-lg ${
              overSecondApronByM > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {overSecondApronByM > 0
              ? `+${formatCap(overSecondApronByM * 1_000_000)}`
              : '-'}
          </div>
        </div>
      </div>

      {/* Warning messages */}
      {capUsed < floor && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ Warning: Below soft floor of {formatCap(floor)}. Ensure you have
          traded away cap space.
        </div>
      )}

      {overSecondApronByM > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          ⚠️ Second Apron Penalty: ${summary.penaltyDues} due (${overSecondApronByM}M over × $2/M)
        </div>
      )}
    </div>
  );
}

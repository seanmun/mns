import type { RosterSummary } from '../types';

interface CapThermometerProps {
  summary: RosterSummary;
}

export function CapThermometer({ summary }: CapThermometerProps) {
  const { capUsed, capEffective, overSecondApronByM } = summary;
  const firstApron = 170_000_000;
  const secondApron = 210_000_000;
  const max = 250_000_000;

  // Calculate marker positions on the full scale (0 to 250M)
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
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Salary Cap Status</h3>

      {/* Salary cap scale (0 to 250M) */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>Cap Used: {formatCap(capUsed)}</span>
          <span>Max: {formatCap(max)}</span>
        </div>

        <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
          {/* Cap used bar */}
          <div
            className={`h-full ${getBarColor()} transition-all duration-300`}
            style={{ width: `${capUsedPercent}%` }}
          />

          {/* First apron marker (170M) */}
          <div
            className="absolute top-0 h-full w-0.5 bg-yellow-600"
            style={{ left: `${firstApronPercent}%` }}
            title="First Apron: $170M"
          />

          {/* Second apron marker (210M) */}
          <div
            className="absolute top-0 h-full w-0.5 bg-orange-600"
            style={{ left: `${secondApronPercent}%` }}
            title="Second Apron: $210M"
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>$0M</span>
          <span className="text-yellow-600">$170M (1st Apron)</span>
          <span className="text-orange-600">$210M (2nd Apron)</span>
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
      {isOverFirstApron && !isOverSecondApron && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ First Apron: You are over $170M. A one-time $50 fee applies. After payment, you can stay over $170M for the rest of the season.
        </div>
      )}

      {isOverSecondApron && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
          ⚠️ Second Apron Penalty: ${summary.penaltyDues} due (${overSecondApronByM}M over × $2/M)
        </div>
      )}
    </div>
  );
}

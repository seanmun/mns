import type { SavedScenario } from '../types';

interface SavedScenariosProps {
  scenarios: SavedScenario[];
  onLoad: (scenario: SavedScenario) => void;
  onDelete?: (scenarioId: string) => void;
}

export function SavedScenarios({ scenarios, onLoad, onDelete }: SavedScenariosProps) {
  if (scenarios.length === 0) {
    return null;
  }

  const formatDate = (timestamp: number, savedBy?: string) => {
    const dateStr = new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    if (savedBy) {
      return `${dateStr} by ${savedBy}`;
    }
    return dateStr;
  };

  const formatCap = (value: number) => {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  };

  return (
    <div className="bg-[#121212] p-6 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4">
        Saved Scenarios ({scenarios.length})
      </h3>

      <div className="space-y-3">
        {scenarios.map((scenario) => (
          <div
            key={scenario.scenarioId}
            className="border border-gray-800 rounded-lg p-4 hover:border-green-400 transition-colors bg-[#0a0a0a]"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-white">{scenario.name}</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Saved {formatDate(scenario.timestamp, scenario.savedBy)}
                </p>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Keepers:</span>{' '}
                    <span className="font-medium text-white">{scenario.summary.keepersCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Redshirts:</span>{' '}
                    <span className="font-medium text-white">{scenario.summary.redshirtsCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cap Used:</span>{' '}
                    <span className="font-medium text-white">
                      {formatCap(scenario.summary.capUsed)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Fees:</span>{' '}
                    <span className="font-medium text-red-400">
                      ${scenario.summary.totalFees}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => onLoad(scenario)}
                  className="px-3 py-1 text-sm border-2 border-green-400 text-green-400 rounded hover:bg-green-400/10 hover:shadow-[0_0_10px_rgba(74,222,128,0.3)] transition-all cursor-pointer"
                  title="Load this scenario"
                >
                  Load
                </button>
                {onDelete && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete scenario "${scenario.name}"?`)) {
                        onDelete(scenario.scenarioId);
                      }
                    }}
                    className="px-3 py-1 text-sm border-2 border-red-400 text-red-400 rounded hover:bg-red-400/10 hover:shadow-[0_0_10px_rgba(248,113,113,0.3)] transition-all cursor-pointer"
                    title="Delete this scenario"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Saved Scenarios ({scenarios.length})
      </h3>

      <div className="space-y-3">
        {scenarios.map((scenario) => (
          <div
            key={scenario.scenarioId}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Saved {formatDate(scenario.timestamp, scenario.savedBy)}
                </p>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Keepers:</span>{' '}
                    <span className="font-medium">{scenario.summary.keepersCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Redshirts:</span>{' '}
                    <span className="font-medium">{scenario.summary.redshirtsCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cap Used:</span>{' '}
                    <span className="font-medium">
                      {formatCap(scenario.summary.capUsed)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Fees:</span>{' '}
                    <span className="font-medium text-red-600">
                      ${scenario.summary.totalFees}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => onLoad(scenario)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
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

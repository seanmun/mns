export function LeagueRules() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h3 className="text-lg font-bold text-gray-900">📜 League Rules</h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Keeper Rules */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Keeper Rules</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>Maximum of 8 keepers per team</li>
            <li>Keepers advance one round earlier each year they are kept</li>
            <li>Players kept in Round 1 become franchise tags ($15 fee)</li>
            <li>Players cannot be kept earlier than Round 1</li>
            <li>New players (not previously kept) default to Round 13</li>
          </ul>
        </div>

        {/* Salary Cap */}
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Salary Cap</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li><strong>Base Cap:</strong> $210M</li>
            <li><strong>Floor:</strong> $170M (First Apron)</li>
            <li><strong>Max Cap:</strong> $250M</li>
            <li><strong>Trade Limit:</strong> ±$40M from base</li>
            <li><strong>Second Apron Penalty:</strong> $2 per $1M over $210M</li>
            <li><strong>First Apron Fee:</strong> $50 if over $170M</li>
          </ul>
        </div>

        {/* Redshirt Rules */}
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Redshirt Rules</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>Rookie draft picks are eligible for redshirt in their first year</li>
            <li>Redshirted players do not count against keeper limit</li>
            <li>Redshirted players cannot be traded or dropped during season</li>
            <li><strong>Redshirt Fee:</strong> $10 per player</li>
            <li>After redshirt year, player can be kept at original draft round</li>
            <li>Can be activated mid-season for $25 fee</li>
          </ul>
        </div>

        {/* International Stash */}
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">International Stash</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>Players playing internationally can be stashed</li>
            <li>Stashed players do not count against keeper limit or cap</li>
            <li>Can be activated mid-season for $25 fee when they join NBA</li>
            <li>Stashed players can be kept at original draft round</li>
          </ul>
        </div>

        {/* Draft Rules */}
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Draft</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li><strong>Main Draft:</strong> 13 rounds, snake format</li>
            <li><strong>Rookie Draft:</strong> 2 rounds, snake format (held June 25th)</li>
            <li>Round 1 rookie picks can be kept in Round 11</li>
            <li>Round 2 rookie picks can be kept in Round 12</li>
          </ul>
        </div>

        {/* Fees */}
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">League Fees</h4>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li><strong>Entry Fee:</strong> $50 per team</li>
            <li><strong>Prize Structure:</strong> 50% / 30% / 20% (1st / 2nd / 3rd)</li>
            <li>Additional fees from penalties added to prize pool</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

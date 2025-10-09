
import type { Player, RosterEntry, Decision } from '../types';

interface RosterTableProps {
  players: Player[];
  entries: RosterEntry[];
  onDecisionChange: (playerId: string, decision: Decision) => void;
  isLocked?: boolean;
}

export function RosterTable({
  players,
  entries,
  onDecisionChange,
  isLocked = false,
}: RosterTableProps) {
  const formatSalary = (salary: number) => {
    return `$${(salary / 1_000_000).toFixed(2)}M`;
  };

  const getEntryForPlayer = (playerId: string): RosterEntry | undefined => {
    return entries.find((e) => e.playerId === playerId);
  };

  const getRowClassName = (decision?: Decision) => {
    if (decision === 'DROP') return 'bg-gray-100 opacity-60';
    if (decision === 'KEEP') return 'bg-green-50';
    if (decision === 'REDSHIRT') return 'bg-blue-50';
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pos
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                NBA Team
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Salary
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prior Rd
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Base Rd
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Final Rd
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Decision
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.map((player) => {
              const entry = getEntryForPlayer(player.id);
              const decision = entry?.decision || 'DROP';

              return (
                <tr
                  key={player.id}
                  className={`transition-colors ${getRowClassName(decision)}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                        </div>
                        {player.roster.isRookie && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Rookie
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {player.position}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {player.nbaTeam}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {formatSalary(player.salary)}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                    {player.keeper?.priorYearRound || '-'}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                    {entry?.baseRound || player.keeper?.derivedBaseRound || '-'}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center font-semibold">
                    {entry?.keeperRound || '-'}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {isLocked ? (
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          decision === 'KEEP'
                            ? 'bg-green-100 text-green-800'
                            : decision === 'REDSHIRT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {decision}
                      </span>
                    ) : (
                      <select
                        value={decision}
                        onChange={(e) =>
                          onDecisionChange(
                            player.id,
                            e.target.value as Decision
                          )
                        }
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        disabled={isLocked}
                      >
                        <option value="DROP">Drop</option>
                        <option value="KEEP">Keep</option>
                        <option
                          value="REDSHIRT"
                          disabled={
                            !player.roster.isRookie ||
                            !player.roster.rookieDraftInfo?.redshirtEligible
                          }
                        >
                          Redshirt
                          {!player.roster.isRookie ||
                          !player.roster.rookieDraftInfo?.redshirtEligible
                            ? ' (N/A)'
                            : ''}
                        </option>
                      </select>
                    )}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      {player.roster.onIR && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          IR
                        </span>
                      )}
                      {player.roster.isInternationalStash && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Intl
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {players.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No players on roster
        </div>
      )}
    </div>
  );
}

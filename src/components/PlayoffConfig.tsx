import { useEffect } from 'react';
import { computePlayoffDefaults, describePlayoffBracket } from '../lib/scheduleUtils';

interface PlayoffConfigProps {
  playoffTeams: number;
  playoffWeeks: number;
  playoffByeTeams: number;
  consolationWeeks: number;
  maxTeams: number;
  onChange: (field: string, value: number) => void;
}

export function PlayoffConfig({
  playoffTeams,
  playoffWeeks,
  playoffByeTeams,
  consolationWeeks,
  maxTeams,
  onChange,
}: PlayoffConfigProps) {
  // Auto-compute defaults when playoff teams changes
  useEffect(() => {
    if (playoffTeams >= 2) {
      const defaults = computePlayoffDefaults(playoffTeams);
      onChange('schedule.playoffWeeks', defaults.weeks);
      onChange('schedule.playoffByeTeams', defaults.byes);
    }
  }, [playoffTeams]);

  const rounds = describePlayoffBracket(playoffTeams, playoffWeeks, playoffByeTeams);
  const nonPlayoffTeams = maxTeams - playoffTeams;

  // Generate team count options (even numbers from 2 to maxTeams)
  const teamOptions: number[] = [];
  for (let i = 2; i <= Math.max(maxTeams, 2); i += 2) {
    teamOptions.push(i);
  }

  return (
    <div className="space-y-6">
      {/* Championship Bracket */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Championship Bracket</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Playoff Teams
            </label>
            <select
              value={playoffTeams}
              onChange={(e) => onChange('schedule.playoffTeams', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
            >
              <option value={0}>No Playoffs</option>
              {teamOptions.map(n => (
                <option key={n} value={n}>{n} teams</option>
              ))}
            </select>
          </div>

          {playoffTeams >= 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Playoff Weeks
                </label>
                <select
                  value={playoffWeeks}
                  onChange={(e) => onChange('schedule.playoffWeeks', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n} week{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  First-Round Byes
                </label>
                <select
                  value={playoffByeTeams}
                  onChange={(e) => onChange('schedule.playoffByeTeams', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                >
                  {Array.from({ length: Math.max(playoffTeams - 1, 1) }, (_, i) => i)
                    .filter(n => n % 2 === 0)
                    .map(n => (
                      <option key={n} value={n}>
                        {n === 0 ? 'None' : `${n} team${n !== 1 ? 's' : ''}`}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Bracket Preview */}
        {rounds.length > 0 && (
          <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4 mt-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Bracket Preview
            </h4>
            <div className="space-y-2">
              {rounds.map((round) => (
                <div key={round.round} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-purple-400 w-24 shrink-0">
                    {round.label}
                  </span>
                  <span className="text-xs text-gray-300">
                    {round.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Consolation Bracket */}
      {playoffTeams >= 2 && nonPlayoffTeams >= 2 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Consolation Bracket</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Consolation Weeks
              </label>
              <select
                value={consolationWeeks}
                onChange={(e) => onChange('schedule.consolationWeeks', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
              >
                <option value={0}>No Consolation</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} week{n !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-500 pb-2">
                {nonPlayoffTeams} non-playoff teams compete
              </p>
            </div>
          </div>

          {consolationWeeks > 0 && (
            <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4 mt-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Consolation Format
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-amber-400 w-24 shrink-0">Format</span>
                  <span className="text-xs text-gray-300">
                    {nonPlayoffTeams} teams, {consolationWeeks} weeks of category matchups
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-amber-400 w-24 shrink-0">Winner</span>
                  <span className="text-xs text-gray-300">
                    Most cumulative category wins earns best rookie draft odds
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

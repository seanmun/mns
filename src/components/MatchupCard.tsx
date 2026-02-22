import type { Matchup, Team, TeamRecord } from '../types';

interface MatchupCardProps {
  matchups: Matchup[];
  teams: Team[];
  records: Map<string, TeamRecord>;
  myTeamId?: string;
  currentWeek: number | null;
}

export function MatchupCard({ matchups, teams, records, myTeamId, currentWeek }: MatchupCardProps) {
  if (matchups.length === 0 || currentWeek === null) return null;

  const teamMap = new Map(teams.map(t => [t.id, t]));

  const formatRecord = (teamId: string): string => {
    const rec = records.get(teamId);
    if (!rec) return '0-0';
    return rec.ties > 0 ? `${rec.wins}-${rec.losses}-${rec.ties}` : `${rec.wins}-${rec.losses}`;
  };

  return (
    <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Week {currentWeek} Matchups</h2>
        <span className="text-xs text-gray-500">{matchups.length} matchups</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {matchups.map((matchup) => {
          const homeTeam = teamMap.get(matchup.homeTeamId);
          const awayTeam = teamMap.get(matchup.awayTeamId);
          const isMyMatchup = matchup.homeTeamId === myTeamId || matchup.awayTeamId === myTeamId;
          const hasScores = matchup.homeScore !== null && matchup.awayScore !== null;

          return (
            <div
              key={matchup.id}
              className={`rounded-lg p-3 border transition-all ${
                isMyMatchup
                  ? 'border-green-400/50 bg-green-400/5 shadow-[0_0_8px_rgba(74,222,128,0.15)]'
                  : 'border-gray-800 bg-[#0a0a0a]'
              }`}
            >
              {/* Away team */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-sm font-semibold truncate ${
                    matchup.awayTeamId === myTeamId ? 'text-green-400' : 'text-white'
                  }`}>
                    {awayTeam?.name || '???'}
                  </span>
                  <span className="text-xs text-gray-500">({formatRecord(matchup.awayTeamId)})</span>
                </div>
                <span className={`text-sm font-bold tabular-nums ml-2 ${
                  hasScores && matchup.awayScore! > matchup.homeScore! ? 'text-green-400' : 'text-gray-300'
                }`}>
                  {hasScores ? Math.round(matchup.awayScore!) : ''}
                </span>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600">{hasScores ? 'Final' : 'vs'}</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Home team */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-sm font-semibold truncate ${
                    matchup.homeTeamId === myTeamId ? 'text-green-400' : 'text-white'
                  }`}>
                    {homeTeam?.name || '???'}
                  </span>
                  <span className="text-xs text-gray-500">({formatRecord(matchup.homeTeamId)})</span>
                </div>
                <span className={`text-sm font-bold tabular-nums ml-2 ${
                  hasScores && matchup.homeScore! > matchup.awayScore! ? 'text-green-400' : 'text-gray-300'
                }`}>
                  {hasScores ? Math.round(matchup.homeScore!) : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

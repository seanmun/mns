import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { MATCHUP_CATEGORIES } from '../types';
import type { Matchup, Player, RegularSeasonRoster, ProjectedStats } from '../types';
import { mapMatchup, mapPlayer, mapRegularSeasonRoster } from '../lib/mappers';

type MatchupView = 'totals' | 'away' | 'home';
type DayView = 'week' | string; // 'week' for week totals, or 'YYYY-MM-DD' for a specific day

interface TeamInfo {
  id: string;
  name: string;
  owners: string[];
}

// Get the projected stat value for a category
function getStatValue(stats: ProjectedStats | undefined, category: string): number | null {
  if (!stats) return null;
  switch (category) {
    case 'FG%': return stats.fgPercent;
    case 'FT%': return stats.ftPercent;
    case 'PTS': return stats.points;
    case 'REB': return stats.rebounds;
    case 'AST': return stats.assists;
    case 'STL': return stats.steals;
    case 'BLK': return stats.blocks;
    case '3PM': return stats.threePointMade;
    case 'A/TO': return stats.assistToTurnover;
    default: return null;
  }
}

function formatStat(value: number | null, category: string): string {
  if (value === null) return '—';
  const isPercentage = category === 'FG%' || category === 'FT%';
  const isRatio = category === 'A/TO';
  if (isPercentage) return (value * 100).toFixed(1);
  if (isRatio) return value.toFixed(2);
  return value.toFixed(1);
}

// Helper: get all dates between start and end (inclusive), using actual DB dates
function getDatesInRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

// Truncate name for mobile
function truncateName(name: string, maxLen: number = 12): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + '...';
}

// Roster stats view component
function TeamRosterStats({
  roster,
  players,
  projectedStats,
  teamName,
  isMyTeam,
  weekDates,
}: {
  roster: RegularSeasonRoster | null;
  players: Map<string, Player>;
  projectedStats: Map<string, ProjectedStats>;
  teamName: string;
  isMyTeam: boolean;
  weekDates: string[]; // dates in this matchup week
}) {
  const [dayView, setDayView] = useState<DayView>('week');

  if (!roster) {
    return (
      <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6 text-center text-gray-500">
        No roster data available.
      </div>
    );
  }

  const benchedSet = new Set(roster.benchedPlayers);

  const starters = roster.activeRoster
    .filter(id => !benchedSet.has(id))
    .map(id => players.get(id))
    .filter((p): p is Player => p !== undefined);

  const benched = roster.activeRoster
    .filter(id => benchedSet.has(id))
    .map(id => players.get(id))
    .filter((p): p is Player => p !== undefined);

  // Calculate team totals for starters
  const starterTotals = MATCHUP_CATEGORIES.map(cat => {
    const isPercentage = cat === 'FG%' || cat === 'FT%';
    const isRatio = cat === 'A/TO';
    const values = starters
      .map(p => getStatValue(projectedStats.get(p.fantraxId), cat))
      .filter((v): v is number => v !== null);

    if (values.length === 0) return null;
    if (isPercentage || isRatio) {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    return values.reduce((a, b) => a + b, 0);
  });

  // Day navigation
  const currentDayIdx = dayView === 'week' ? -1 : weekDates.indexOf(dayView);
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = dayView === todayStr;

  const gridCols = 'grid-cols-[120px_36px_repeat(9,minmax(42px,1fr))]';

  const renderPlayerRow = (player: Player, isBenched: boolean) => {
    const stats = projectedStats.get(player.fantraxId);
    // For day view, show placeholder "—" since we don't have daily data yet
    const isDayView = dayView !== 'week';
    return (
      <div
        key={player.id}
        className={`grid ${gridCols} gap-1 py-2 border-b border-gray-800/50 text-xs ${
          isBenched ? 'opacity-40' : ''
        }`}
      >
        <div className="text-white font-medium truncate sticky left-0 bg-[#121212] z-10 px-3 flex items-center">
          <span className="sm:hidden">{truncateName(player.name)}</span>
          <span className="hidden sm:inline truncate">{player.name}</span>
        </div>
        <div className="text-gray-500 text-center">{player.position}</div>
        {MATCHUP_CATEGORIES.map(cat => (
          <div key={cat} className="text-gray-400 text-center tabular-nums">
            {isDayView ? '—' : formatStat(getStatValue(stats, cat), cat)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden mb-6">
      {/* Header + day nav */}
      <div className={`px-4 py-3 border-b border-gray-800 ${
        isMyTeam ? 'bg-green-400/5' : 'bg-[#0a0a0a]'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-sm font-bold ${isMyTeam ? 'text-green-400' : 'text-white'}`}>
              {teamName}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {starters.length} starters{benched.length > 0 ? ` · ${benched.length} benched` : ''}
            </span>
          </div>
        </div>

        {/* Day selector pills */}
        {weekDates.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setDayView('week')}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                dayView === 'week'
                  ? 'bg-green-400/20 text-green-400 font-medium'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Total
            </button>
            {weekDates.map(date => {
              const isPast = date < todayStr;
              const isCurrent = date === todayStr;
              const isFuture = date > todayStr;
              return (
                <button
                  key={date}
                  onClick={() => setDayView(date)}
                  className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                    dayView === date
                      ? 'bg-green-400/20 text-green-400 font-medium'
                      : isCurrent
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : isPast
                          ? 'bg-gray-800 text-gray-400 hover:text-white'
                          : 'bg-gray-800/50 text-gray-600'
                  }`}
                  disabled={isFuture}
                >
                  {formatDayLabel(date)}{isCurrent ? ' ·' : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day view label */}
      {dayView !== 'week' && (
        <div className="px-4 py-2 bg-[#0e0e0e] border-b border-gray-800/50 flex items-center justify-between">
          <button
            onClick={() => {
              if (currentDayIdx > 0) setDayView(weekDates[currentDayIdx - 1]);
              else setDayView('week');
            }}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            ←
          </button>
          <span className="text-xs text-gray-400">
            {formatDayLabel(dayView)}{isToday ? ' (Today)' : ''} — Stats coming soon
          </span>
          <button
            onClick={() => {
              if (currentDayIdx < weekDates.length - 1 && weekDates[currentDayIdx + 1] <= todayStr) {
                setDayView(weekDates[currentDayIdx + 1]);
              }
            }}
            disabled={currentDayIdx >= weekDates.length - 1 || weekDates[currentDayIdx + 1] > todayStr}
            className="text-xs text-gray-500 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>
      )}

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className={`grid ${gridCols} gap-1 py-2 bg-[#0a0a0a] border-b border-gray-800`}>
          <div className="text-xs text-gray-500 font-medium sticky left-0 bg-[#0a0a0a] z-10 px-3">Player</div>
          <div className="text-xs text-gray-500 font-medium text-center">POS</div>
          {MATCHUP_CATEGORIES.map(cat => (
            <div key={cat} className="text-xs text-gray-500 font-medium text-center">
              {cat}
            </div>
          ))}
        </div>

        {/* Starter rows */}
        {starters.map(p => renderPlayerRow(p, false))}

        {/* Totals row */}
        <div className={`grid ${gridCols} gap-1 py-2 bg-[#0a0a0a] border-t border-gray-700`}>
          <div className="text-xs font-bold text-white sticky left-0 bg-[#0a0a0a] z-10 px-3">Totals</div>
          <div />
          {starterTotals.map((val, i) => (
            <div key={MATCHUP_CATEGORIES[i]} className="text-xs text-white font-bold text-center tabular-nums">
              {dayView !== 'week' ? '—' : formatStat(val, MATCHUP_CATEGORIES[i])}
            </div>
          ))}
        </div>

        {/* Benched players */}
        {benched.length > 0 && (
          <>
            <div className="py-2 border-t border-gray-800">
              <span className="text-xs text-gray-600 uppercase tracking-wider sticky left-0 px-3">Bench</span>
            </div>
            {benched.map(p => renderPlayerRow(p, true))}
          </>
        )}
      </div>
    </div>
  );
}

export function MatchupDetail() {
  const { leagueId, matchupId } = useParams<{ leagueId: string; matchupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectedStats } = useProjectedStats();

  const [view, setView] = useState<MatchupView>('totals');
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [allMatchups, setAllMatchups] = useState<Matchup[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamInfo>>(new Map());
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [homeRoster, setHomeRoster] = useState<RegularSeasonRoster | null>(null);
  const [awayRoster, setAwayRoster] = useState<RegularSeasonRoster | null>(null);
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reset view when matchup changes
  useEffect(() => {
    setView('totals');
  }, [matchupId]);

  useEffect(() => {
    if (!leagueId || !matchupId) return;

    const fetchData = async () => {
      try {
        // Fetch the specific matchup
        const { data: matchupRow, error: matchupErr } = await supabase
          .from('league_matchups')
          .select('*')
          .eq('id', matchupId)
          .maybeSingle();

        if (matchupErr) throw matchupErr;
        if (!matchupRow) {
          setLoading(false);
          return;
        }

        const current = mapMatchup(matchupRow);
        setMatchup(current);

        // Fetch all matchups for this league+season (for week nav + other matchups)
        const { data: allData, error: allErr } = await supabase
          .from('league_matchups')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', current.seasonYear)
          .order('matchup_week', { ascending: true });

        if (allErr) throw allErr;
        setAllMatchups((allData || []).map(mapMatchup));

        // Fetch all teams in this league
        const { data: teamData, error: teamErr } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', leagueId);

        if (teamErr) throw teamErr;

        const teamMap = new Map<string, TeamInfo>();
        for (const row of teamData || []) {
          teamMap.set(row.id, {
            id: row.id,
            name: row.name,
            owners: row.owners || [],
          });
        }
        setTeams(teamMap);

        // Find user's team
        if (user?.email) {
          const myTeam = (teamData || []).find((t: any) =>
            (t.owners || []).includes(user.email)
          );
          if (myTeam) setMyTeamId(myTeam.id);
        }

        // Fetch both teams' rosters
        const homeRosterId = `${leagueId}_${current.homeTeamId}`;
        const awayRosterId = `${leagueId}_${current.awayTeamId}`;

        const [homeRes, awayRes] = await Promise.all([
          supabase.from('regular_season_rosters').select('*').eq('id', homeRosterId).maybeSingle(),
          supabase.from('regular_season_rosters').select('*').eq('id', awayRosterId).maybeSingle(),
        ]);

        if (homeRes.data) setHomeRoster(mapRegularSeasonRoster(homeRes.data));
        if (awayRes.data) setAwayRoster(mapRegularSeasonRoster(awayRes.data));

        // Fetch league weeks to get date range for this matchup week
        const { data: weekData } = await supabase
          .from('league_weeks')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', current.seasonYear)
          .eq('matchup_week', current.matchupWeek)
          .order('week_number', { ascending: true });

        if (weekData && weekData.length > 0) {
          // Combine all weeks in this matchup period to get the full date range
          const startDate = weekData[0].start_date;
          const endDate = weekData[weekData.length - 1].end_date;
          setWeekDates(getDatesInRange(startDate, endDate));
        }

        // Fetch all players in this league
        const { data: playerData, error: playerErr } = await supabase
          .from('players')
          .select('*')
          .eq('league_id', leagueId);

        if (playerErr) throw playerErr;

        const playerMap = new Map<string, Player>();
        for (const row of playerData || []) {
          playerMap.set(row.id, mapPlayer(row));
        }
        setPlayers(playerMap);
      } catch (err) {
        console.error('Error fetching matchup detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, matchupId, user?.email]);

  // Other matchups this same week
  const weekMatchups = useMemo(() => {
    if (!matchup) return [];
    return allMatchups.filter(
      m => m.matchupWeek === matchup.matchupWeek && m.id !== matchup.id
    );
  }, [allMatchups, matchup]);

  // Week navigation — find distinct weeks and prev/next
  const { prevWeekMatchupId, nextWeekMatchupId, currentMatchupNum, totalMatchups } = useMemo(() => {
    if (!matchup) return { prevWeekMatchupId: null, nextWeekMatchupId: null, currentMatchupNum: 0, totalMatchups: 0 };

    const weeks = [...new Set(allMatchups.map(m => m.matchupWeek))].sort((a, b) => a - b);
    const currentIdx = weeks.indexOf(matchup.matchupWeek);

    const findMatchupInWeek = (week: number): string | null => {
      const sameTeams = allMatchups.find(
        m => m.matchupWeek === week &&
          (m.homeTeamId === matchup.homeTeamId || m.awayTeamId === matchup.homeTeamId ||
           m.homeTeamId === matchup.awayTeamId || m.awayTeamId === matchup.awayTeamId)
      );
      if (sameTeams) return sameTeams.id;
      const first = allMatchups.find(m => m.matchupWeek === week);
      return first?.id || null;
    };

    return {
      prevWeekMatchupId: currentIdx > 0 ? findMatchupInWeek(weeks[currentIdx - 1]) : null,
      nextWeekMatchupId: currentIdx < weeks.length - 1 ? findMatchupInWeek(weeks[currentIdx + 1]) : null,
      currentMatchupNum: currentIdx + 1,
      totalMatchups: weeks.length,
    };
  }, [allMatchups, matchup]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent" />
          <div className="mt-4 text-gray-400">Loading matchup...</div>
        </div>
      </div>
    );
  }

  if (!matchup) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-gray-400 py-12">
            Matchup not found.
          </div>
        </div>
      </div>
    );
  }

  const homeTeam = teams.get(matchup.homeTeamId);
  const awayTeam = teams.get(matchup.awayTeamId);
  const isMyMatchup = matchup.homeTeamId === myTeamId || matchup.awayTeamId === myTeamId;

  // Placeholder category data — all zeros for now
  const categoryData = MATCHUP_CATEGORIES.map(cat => {
    const isPercentage = cat === 'FG%' || cat === 'FT%';
    const isRatio = cat === 'A/TO';
    return {
      name: cat,
      homeValue: isPercentage || isRatio ? '—' : '0',
      awayValue: isPercentage || isRatio ? '—' : '0',
      homeWins: false,
      awayWins: false,
      tie: false,
    };
  });

  const homeWins = categoryData.filter(c => c.homeWins).length;
  const awayWins = categoryData.filter(c => c.awayWins).length;
  const ties = categoryData.filter(c => c.tie).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => prevWeekMatchupId && navigate(`/league/${leagueId}/matchup/${prevWeekMatchupId}`)}
            disabled={!prevWeekMatchupId}
            className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Matchup {currentMatchupNum}{totalMatchups > 0 ? ` of ${totalMatchups}` : ''}
          </span>
          <button
            onClick={() => nextWeekMatchupId && navigate(`/league/${leagueId}/matchup/${nextWeekMatchupId}`)}
            disabled={!nextWeekMatchupId}
            className="text-sm text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Matchup Header — clickable team names */}
        <div className={`rounded-lg border p-6 mb-6 ${
          isMyMatchup
            ? 'border-green-400/50 bg-green-400/5'
            : 'border-gray-800 bg-[#121212]'
        }`}>
          <h1 className="text-center text-gray-400 text-sm font-medium mb-4">
            Matchup {currentMatchupNum}
          </h1>

          {/* Clickable team names + vs */}
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Away team — clickable */}
            <button
              onClick={() => setView(view === 'away' ? 'totals' : 'away')}
              className="text-center flex-1 group"
            >
              <div className={`text-lg sm:text-xl font-bold truncate transition-colors ${
                view === 'away'
                  ? 'text-green-400'
                  : matchup.awayTeamId === myTeamId
                    ? 'text-green-400/70 group-hover:text-green-400'
                    : 'text-white/70 group-hover:text-white'
              }`}>
                {awayTeam?.name || '???'}
              </div>
              <div className={`h-0.5 mt-1 mx-auto rounded transition-all ${
                view === 'away' ? 'bg-green-400 w-full' : 'bg-transparent w-0'
              }`} />
            </button>

            {/* VS — clickable for totals */}
            <button
              onClick={() => setView('totals')}
              className={`text-sm font-medium transition-colors ${
                view === 'totals' ? 'text-white' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              vs
            </button>

            {/* Home team — clickable */}
            <button
              onClick={() => setView(view === 'home' ? 'totals' : 'home')}
              className="text-center flex-1 group"
            >
              <div className={`text-lg sm:text-xl font-bold truncate transition-colors ${
                view === 'home'
                  ? 'text-green-400'
                  : matchup.homeTeamId === myTeamId
                    ? 'text-green-400/70 group-hover:text-green-400'
                    : 'text-white/70 group-hover:text-white'
              }`}>
                {homeTeam?.name || '???'}
              </div>
              <div className={`h-0.5 mt-1 mx-auto rounded transition-all ${
                view === 'home' ? 'bg-green-400 w-full' : 'bg-transparent w-0'
              }`} />
            </button>
          </div>

          {/* Category score */}
          <div className="text-center mt-4">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Category Score</span>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              {awayWins}-{homeWins}{ties > 0 ? `-${ties}` : ''}
            </div>
          </div>
        </div>

        {/* View-dependent content */}
        {view === 'totals' && (
          <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden mb-6">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_1fr] bg-[#0a0a0a] border-b border-gray-800 px-4 py-3">
              <div className={`text-xs font-medium uppercase tracking-wider text-center ${
                matchup.awayTeamId === myTeamId ? 'text-green-400' : 'text-gray-400'
              }`}>
                {awayTeam?.name || 'Away'}
              </div>
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wider text-center px-4">
                Cat
              </div>
              <div className={`text-xs font-medium uppercase tracking-wider text-center ${
                matchup.homeTeamId === myTeamId ? 'text-green-400' : 'text-gray-400'
              }`}>
                {homeTeam?.name || 'Home'}
              </div>
            </div>

            {/* Category rows */}
            {categoryData.map((cat, i) => (
              <div
                key={cat.name}
                className={`grid grid-cols-[1fr_auto_1fr] px-4 py-3 ${
                  i < categoryData.length - 1 ? 'border-b border-gray-800/50' : ''
                }`}
              >
                <div className={`text-sm text-center tabular-nums ${
                  cat.awayWins ? 'text-green-400 font-bold' : 'text-gray-500'
                }`}>
                  {cat.awayValue}
                </div>
                <div className="text-sm font-medium text-gray-300 text-center px-4 min-w-[60px]">
                  {cat.name}
                </div>
                <div className={`text-sm text-center tabular-nums ${
                  cat.homeWins ? 'text-green-400 font-bold' : 'text-gray-500'
                }`}>
                  {cat.homeValue}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'away' && (
          <TeamRosterStats
            roster={awayRoster}
            players={players}
            projectedStats={projectedStats}
            teamName={awayTeam?.name || 'Away Team'}
            isMyTeam={matchup.awayTeamId === myTeamId}
            weekDates={weekDates}
          />
        )}

        {view === 'home' && (
          <TeamRosterStats
            roster={homeRoster}
            players={players}
            projectedStats={projectedStats}
            teamName={homeTeam?.name || 'Home Team'}
            isMyTeam={matchup.homeTeamId === myTeamId}
            weekDates={weekDates}
          />
        )}

        {/* Other matchups this week */}
        {weekMatchups.length > 0 && (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
              Other Matchup {currentMatchupNum} Games
            </h2>
            <div className="space-y-3">
              {weekMatchups.map(m => {
                const home = teams.get(m.homeTeamId);
                const away = teams.get(m.awayTeamId);
                const isMine = m.homeTeamId === myTeamId || m.awayTeamId === myTeamId;
                return (
                  <Link
                    key={m.id}
                    to={`/league/${leagueId}/matchup/${m.id}`}
                    className={`flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0 hover:bg-white/5 rounded px-2 -mx-2 transition-colors ${
                      isMine ? 'text-green-400' : ''
                    }`}
                  >
                    <span className={`text-sm truncate flex-1 ${isMine ? 'text-green-400' : 'text-white'}`}>
                      {away?.name || '???'}
                    </span>
                    <span className="text-xs text-gray-600 mx-3">vs</span>
                    <span className={`text-sm truncate flex-1 text-right ${isMine ? 'text-green-400' : 'text-white'}`}>
                      {home?.name || '???'}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

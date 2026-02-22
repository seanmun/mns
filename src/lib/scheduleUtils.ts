import type { LeagueWeek, LeagueSchedule } from '../types';

/**
 * Given an array of league weeks and today's date,
 * returns the current week number (1-based), or null if
 * the season hasn't started or has ended.
 */
export function getCurrentWeek(
  weeks: LeagueWeek[],
  today: Date = new Date()
): number | null {
  if (weeks.length === 0) return null;

  const todayStr = today.toISOString().split('T')[0];

  for (const week of weeks) {
    if (todayStr >= week.startDate && todayStr <= week.endDate) {
      return week.weekNumber;
    }
  }

  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const firstWeek = sorted[0];
  const lastWeek = sorted[sorted.length - 1];

  if (todayStr < firstWeek.startDate) return null;
  if (todayStr > lastWeek.endDate) return lastWeek.weekNumber;

  return null;
}

/**
 * Checks if the trade deadline has passed.
 */
export function isTradeDeadlinePassed(
  schedule: LeagueSchedule | undefined,
  today: Date = new Date()
): boolean {
  if (!schedule?.tradeDeadlineDate) return false;
  const todayStr = today.toISOString().split('T')[0];
  return todayStr > schedule.tradeDeadlineDate;
}

/**
 * Format a countdown string from today to the target date.
 * Returns "X days", "X weeks", "Today", or "Passed".
 */
export function formatCountdown(
  targetDate: string,
  now: Date = new Date()
): string {
  const target = new Date(targetDate + 'T23:59:59');
  const diffMs = target.getTime() - now.getTime();

  if (diffMs < 0) return 'Passed';

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }

  const months = Math.floor(diffDays / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

/**
 * Generate week date ranges from schedule config.
 * Each week starts Monday, ends Sunday (7 days).
 */
export function generateWeeks(
  leagueId: string,
  seasonYear: number,
  numWeeks: number,
  seasonStartDate: string,
  tradeDeadlineWeek: number,
  combinedWeeks: CombinedWeekConfig[] = [],
  playoffConfig?: { weeks: number; consolationWeeks?: number }
): Array<{
  id: string;
  league_id: string;
  season_year: number;
  week_number: number;
  matchup_week: number;
  start_date: string;
  end_date: string;
  is_trade_deadline_week: boolean;
  label: string | null;
}> {
  // Build a lookup: calendar week → { matchupWeek, label }
  const combinedMap = new Map<number, { matchupWeek: number; label: string }>();
  for (const cw of combinedWeeks) {
    for (const wn of cw.calendarWeeks) {
      combinedMap.set(wn, { matchupWeek: cw.calendarWeeks[0], label: cw.label });
    }
  }

  const weeks = [];
  const start = new Date(seasonStartDate + 'T00:00:00');

  for (let i = 0; i < numWeeks; i++) {
    const weekNum = i + 1;
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + i * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const combined = combinedMap.get(weekNum);

    weeks.push({
      id: `${leagueId}_week_${weekNum}`,
      league_id: leagueId,
      season_year: seasonYear,
      week_number: weekNum,
      matchup_week: combined ? combined.matchupWeek : weekNum,
      start_date: weekStart.toISOString().split('T')[0],
      end_date: weekEnd.toISOString().split('T')[0],
      is_trade_deadline_week: weekNum === tradeDeadlineWeek,
      label: combined ? combined.label : null,
    });
  }

  // Append post-season weeks (playoffs + consolation)
  if (playoffConfig && playoffConfig.weeks > 0) {
    const consolationWeeks = playoffConfig.consolationWeeks || 0;
    const postSeasonWeeks = Math.max(playoffConfig.weeks, consolationWeeks);

    const playoffLabels = ['Round 1', 'Quarterfinals', 'Semifinals', 'Finals'];
    const labels = playoffLabels.slice(Math.max(0, playoffLabels.length - playoffConfig.weeks));

    for (let p = 0; p < postSeasonWeeks; p++) {
      const weekNum = numWeeks + p + 1;
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (numWeeks + p) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const isPlayoffWeek = p < playoffConfig.weeks;
      const isConsolationWeek = p < consolationWeeks;

      let label: string;
      if (isPlayoffWeek && isConsolationWeek) {
        label = labels[p] || 'Playoffs';
      } else if (isPlayoffWeek) {
        label = labels[p] || 'Playoffs';
      } else {
        label = 'Consolation';
      }

      weeks.push({
        id: `${leagueId}_week_${weekNum}`,
        league_id: leagueId,
        season_year: seasonYear,
        week_number: weekNum,
        matchup_week: weekNum,
        start_date: weekStart.toISOString().split('T')[0],
        end_date: weekEnd.toISOString().split('T')[0],
        is_trade_deadline_week: false,
        label,
      });
    }
  }

  return weeks;
}

/**
 * Compute smart playoff defaults from number of playoff teams.
 */
export function computePlayoffDefaults(playoffTeams: number): { weeks: number; byes: number } {
  if (playoffTeams <= 1) return { weeks: 0, byes: 0 };
  const weeks = Math.ceil(Math.log2(playoffTeams));
  const bracketSize = Math.pow(2, weeks); // next power of 2
  const byes = bracketSize - playoffTeams;
  return { weeks, byes };
}

/**
 * Describe the playoff bracket rounds for display.
 */
export interface PlayoffRound {
  round: number;
  label: string;
  matchupCount: number;
  description: string;
}

export function describePlayoffBracket(
  playoffTeams: number,
  playoffWeeks: number,
  byeTeams: number
): PlayoffRound[] {
  if (playoffTeams <= 1 || playoffWeeks <= 0) return [];

  const roundLabels = ['Round 1', 'Quarterfinals', 'Semifinals', 'Finals'];
  // Use the last N labels (e.g., 3 weeks → Quarterfinals, Semis, Finals)
  const labels = roundLabels.slice(Math.max(0, roundLabels.length - playoffWeeks));

  const rounds: PlayoffRound[] = [];
  let teamsRemaining = playoffTeams;

  for (let i = 0; i < playoffWeeks; i++) {
    const isFirstRound = i === 0;
    const isFinals = i === playoffWeeks - 1;
    const activeTeams = isFirstRound ? teamsRemaining - byeTeams : teamsRemaining;
    const matchups = Math.floor(activeTeams / 2);

    let description = '';
    if (isFinals) {
      description = 'Winner vs Winner';
    } else if (isFirstRound && byeTeams > 0) {
      const firstSeed = 1;
      const lastSeed = playoffTeams;
      const matchupDescs: string[] = [];
      for (let m = 0; m < matchups; m++) {
        const high = byeTeams + m + 1;
        const low = lastSeed - m;
        matchupDescs.push(`#${high} vs #${low}`);
      }
      description = matchupDescs.join(', ') + ` (seeds ${firstSeed}-${byeTeams} bye)`;
    } else if (isFirstRound) {
      const matchupDescs: string[] = [];
      for (let m = 0; m < matchups; m++) {
        const high = m + 1;
        const low = playoffTeams - m;
        matchupDescs.push(`#${high} vs #${low}`);
      }
      description = matchupDescs.join(', ');
    } else {
      description = `${matchups} matchup${matchups !== 1 ? 's' : ''} (winners advance)`;
    }

    rounds.push({
      round: i + 1,
      label: labels[i] || `Round ${i + 1}`,
      matchupCount: matchups,
      description,
    });

    teamsRemaining = (isFirstRound ? byeTeams : 0) + matchups;
  }

  return rounds;
}

/** Config for combined weeks (e.g., All-Star break spans 2 calendar weeks = 1 matchup) */
export interface CombinedWeekConfig {
  calendarWeeks: number[];  // e.g., [11, 12] — these calendar weeks share one matchup
  label: string;            // e.g., "All-Star", "IST"
}

/** Result of analyzing an uploaded NBA schedule */
export interface ScheduleAnalysis {
  seasonStartDate: string;        // Suggested Monday start (ISO date)
  seasonEndDate: string;          // Last game date
  totalGames: number;
  suggestedNumWeeks: number;
  cupKnockoutWeeks: number[] | null;  // Calendar week numbers with Dec cup games
  allStarWeeks: number[] | null;      // Calendar weeks spanning All-Star break
  firstWeekShort: boolean;            // True if week 1 has < 60% of average game count
}

/**
 * Analyze an uploaded NBA schedule to auto-detect:
 * - Cup knockout weeks (December cup games)
 * - All-Star break (longest gap of 4+ days with no games, Jan–Mar)
 * - Short first week (significantly fewer games than average)
 */
export function analyzeSchedule(
  games: Array<{ game_date: string; is_cup_game: boolean }>
): ScheduleAnalysis {
  if (games.length === 0) {
    return {
      seasonStartDate: '',
      seasonEndDate: '',
      totalGames: 0,
      suggestedNumWeeks: 0,
      cupKnockoutWeeks: null,
      allStarWeeks: null,
      firstWeekShort: false,
    };
  }

  const sorted = [...games].sort((a, b) => a.game_date.localeCompare(b.game_date));
  const firstGameDate = sorted[0].game_date;
  const lastGameDate = sorted[sorted.length - 1].game_date;

  // Find the Monday on or before the first game
  const firstDate = new Date(firstGameDate + 'T00:00:00');
  const dayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const seasonStart = new Date(firstDate);
  seasonStart.setDate(firstDate.getDate() + mondayOffset);
  const seasonStartDate = seasonStart.toISOString().split('T')[0];

  // Week number for a given date (1-based, relative to season start Monday)
  function weekNum(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00');
    const diff = d.getTime() - seasonStart.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  // Suggested num weeks: from seasonStart Monday to last Sunday
  const lastDate = new Date(lastGameDate + 'T00:00:00');
  const lastDayOfWeek = lastDate.getDay();
  const sundayOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const lastSunday = new Date(lastDate);
  lastSunday.setDate(lastDate.getDate() + sundayOffset);
  const suggestedNumWeeks = Math.round(
    (lastSunday.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  // Count games per week
  const gamesPerWeek = new Map<number, number>();
  for (const game of sorted) {
    const w = weekNum(game.game_date);
    gamesPerWeek.set(w, (gamesPerWeek.get(w) || 0) + 1);
  }
  const weekCounts = [...gamesPerWeek.values()];
  const avgGames = weekCounts.reduce((a, b) => a + b, 0) / weekCounts.length;

  // First week short if it has < 60% of average games
  const week1Games = gamesPerWeek.get(1) || 0;
  const firstWeekShort = week1Games < avgGames * 0.6;

  // Cup knockout weeks: cup games in December (QF, SF, Championship)
  const decCupGames = sorted.filter(g => {
    const month = parseInt(g.game_date.split('-')[1]);
    return g.is_cup_game && month === 12;
  });
  let cupKnockoutWeeks: number[] | null = null;
  if (decCupGames.length > 0) {
    const weekSet = new Set(decCupGames.map(g => weekNum(g.game_date)));
    cupKnockoutWeeks = [...weekSet].sort((a, b) => a - b);
  }

  // All-Star break: longest gap of 4+ days with no games between Jan and Mar
  const allDates = [...new Set(sorted.map(g => g.game_date))].sort();
  let longestGap: { start: string; end: string; days: number } | null = null;

  for (let i = 0; i < allDates.length - 1; i++) {
    const curr = new Date(allDates[i] + 'T00:00:00');
    const next = new Date(allDates[i + 1] + 'T00:00:00');
    const month = curr.getMonth() + 1;

    // Only look in Jan–Mar range
    if (month < 1 || month > 3) continue;

    const gapDays = Math.round((next.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000));
    if (gapDays >= 4 && (!longestGap || gapDays > longestGap.days)) {
      longestGap = { start: allDates[i], end: allDates[i + 1], days: gapDays };
    }
  }

  let allStarWeeks: number[] | null = null;
  if (longestGap) {
    const w1 = weekNum(longestGap.start);
    const w2 = weekNum(longestGap.end);
    allStarWeeks = w1 === w2 ? [w1] : Array.from({ length: w2 - w1 + 1 }, (_, i) => w1 + i);
  }

  return {
    seasonStartDate,
    seasonEndDate: lastGameDate,
    totalGames: sorted.length,
    suggestedNumWeeks,
    cupKnockoutWeeks,
    allStarWeeks,
    firstWeekShort,
  };
}

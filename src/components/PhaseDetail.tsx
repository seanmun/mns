import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { League, LeagueWeek } from '../types';
import { getCurrentWeek, formatCountdown, isTradeDeadlinePassed } from '../lib/scheduleUtils';

interface PhaseDetailProps {
  league: League;
}

export function PhaseDetail({ league }: PhaseDetailProps) {
  const [weeks, setWeeks] = useState<LeagueWeek[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (league.leaguePhase !== 'regular_season' || !league.schedule?.numWeeks) return;

    const fetchWeeks = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('league_weeks')
        .select('*')
        .eq('league_id', league.id)
        .eq('season_year', league.seasonYear)
        .order('week_number', { ascending: true });

      if (!error && data) {
        setWeeks(data.map(row => ({
          id: row.id,
          leagueId: row.league_id,
          seasonYear: row.season_year,
          weekNumber: row.week_number,
          matchupWeek: row.matchup_week ?? row.week_number,
          startDate: row.start_date,
          endDate: row.end_date,
          isTradeDeadlineWeek: row.is_trade_deadline_week,
          label: row.label || undefined,
        })));
      }
      setLoading(false);
    };

    fetchWeeks();
  }, [league.id, league.leaguePhase, league.seasonYear, league.schedule?.numWeeks]);

  switch (league.leaguePhase) {
    case 'keeper_season':
      return <KeeperSeasonDetail league={league} />;
    case 'draft':
      return <DraftDetail league={league} />;
    case 'regular_season':
      return <RegularSeasonDetail league={league} weeks={weeks} loading={loading} />;
    case 'playoffs':
      return <PlaceholderDetail label="Playoffs in progress" />;
    case 'champion':
      return <PlaceholderDetail label="Champion crowned" />;
    case 'rookie_draft':
      return <PlaceholderDetail label="Rookie Draft" />;
    default:
      return null;
  }
}

function KeeperSeasonDetail({ league }: { league: League }) {
  const keeperLock = league.deadlines?.keepersLockAt;
  const redshirtLock = league.deadlines?.redshirtLockAt;

  if (!keeperLock && !redshirtLock) return null;

  return (
    <div className="flex flex-wrap gap-4 text-sm mt-3">
      {keeperLock && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Keepers lock:</span>
          <span className="text-green-400 font-medium">
            {formatCountdown(keeperLock.split('T')[0])}
          </span>
        </div>
      )}
      {redshirtLock && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Redshirts lock:</span>
          <span className="text-yellow-400 font-medium">
            {formatCountdown(redshirtLock.split('T')[0])}
          </span>
        </div>
      )}
    </div>
  );
}

function DraftDetail({ league }: { league: League }) {
  const draftAt = league.deadlines?.draftAt;

  if (!draftAt) return null;

  return (
    <div className="flex items-center gap-2 text-sm mt-3">
      <span className="text-gray-500">Draft:</span>
      <span className="text-purple-400 font-medium">
        {formatCountdown(draftAt.split('T')[0])}
      </span>
    </div>
  );
}

function RegularSeasonDetail({
  league,
  weeks,
  loading,
}: {
  league: League;
  weeks: LeagueWeek[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-sm text-gray-500 mt-3">Loading schedule...</div>;
  }

  if (weeks.length === 0) {
    return (
      <div className="text-sm text-gray-500 mt-3">
        No schedule configured. Commissioner can set this in League Settings.
      </div>
    );
  }

  const currentWeek = getCurrentWeek(weeks);
  const deadlinePassed = isTradeDeadlinePassed(league.schedule);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm text-gray-400">
          {currentWeek
            ? `Week ${currentWeek} of ${weeks.length}`
            : `${weeks.length} week season`}
        </span>
        {league.schedule?.tradeDeadlineDate && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              deadlinePassed
                ? 'text-red-400 border-red-400/30 bg-red-400/10'
                : 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
            }`}
          >
            Trade Deadline: {deadlinePassed ? 'Passed' : formatCountdown(league.schedule.tradeDeadlineDate)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {weeks.map((week, idx) => {
          const isCurrent = week.weekNumber === currentWeek;
          const isPast = currentWeek !== null && week.weekNumber < currentWeek;
          const isDeadline = week.isTradeDeadlineWeek;
          const isCombined = week.matchupWeek !== week.weekNumber || !!week.label;
          const numRegular = league.schedule?.numWeeks ?? weeks.length;
          const isPostSeason = week.weekNumber > numRegular;
          const prevWeek = idx > 0 ? weeks[idx - 1] : null;
          const isFirstPostSeason = isPostSeason && prevWeek && prevWeek.weekNumber <= numRegular;

          return (
            <div key={week.id} className="flex items-center gap-1">
              {isFirstPostSeason && (
                <span className="text-gray-600 text-sm font-bold mx-1 flex-shrink-0">|</span>
              )}
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all cursor-default ${
                  isCurrent
                    ? 'bg-green-400 text-black font-bold shadow-[0_0_8px_rgba(74,222,128,0.4)]'
                    : isPostSeason
                      ? 'bg-purple-400/10 text-purple-400 border border-purple-400/30'
                      : isPast
                        ? 'bg-gray-800 text-gray-500'
                        : 'bg-gray-900 text-gray-600 border border-gray-800'
                } ${isDeadline && !isCurrent ? 'ring-1 ring-red-400/50' : ''} ${
                  isCombined && !isCurrent && !isPostSeason ? 'ring-1 ring-orange-400/40' : ''
                }`}
                title={`${isPostSeason ? (week.label || 'Playoff') : `Week ${week.weekNumber}`}: ${week.startDate} – ${week.endDate}${
                  isDeadline ? ' (Trade Deadline)' : ''
                }${week.label ? ` [${week.label}]` : ''
                }${week.matchupWeek !== week.weekNumber ? ` (combined with Week ${week.matchupWeek})` : ''}`}
              >
                {isPostSeason ? (week.label?.[0] || 'P') : week.weekNumber}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderDetail({ label }: { label: string }) {
  return (
    <div className="text-sm text-gray-500 italic mt-3">
      {label}
    </div>
  );
}

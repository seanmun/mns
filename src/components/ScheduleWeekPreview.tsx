import { useMemo } from 'react';
import { generateWeeks } from '../lib/scheduleUtils';
import type { CombinedWeekConfig } from '../lib/scheduleUtils';

interface ScheduleWeekPreviewProps {
  numWeeks: number;
  seasonStartDate: string;
  tradeDeadlineWeek: number;
  combinedWeeks: CombinedWeekConfig[];
  playoffWeeks: number;
  consolationWeeks: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ScheduleWeekPreview({
  numWeeks,
  seasonStartDate,
  tradeDeadlineWeek,
  combinedWeeks,
  playoffWeeks,
  consolationWeeks,
}: ScheduleWeekPreviewProps) {
  const weeks = useMemo(() => {
    if (!seasonStartDate || numWeeks <= 0) return [];
    const hasPostSeason = playoffWeeks > 0 || consolationWeeks > 0;
    return generateWeeks(
      '__preview',
      0,
      numWeeks,
      seasonStartDate,
      tradeDeadlineWeek,
      combinedWeeks,
      hasPostSeason ? { weeks: playoffWeeks, consolationWeeks } : undefined
    );
  }, [numWeeks, seasonStartDate, tradeDeadlineWeek, combinedWeeks, playoffWeeks, consolationWeeks]);

  if (!seasonStartDate) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        Set a season start date to preview the week schedule.
      </p>
    );
  }

  if (weeks.length === 0) return null;

  // Group by matchup_week to detect combined weeks
  const matchupWeekGroups = new Map<number, typeof weeks>();
  for (const w of weeks) {
    const group = matchupWeekGroups.get(w.matchup_week) || [];
    group.push(w);
    matchupWeekGroups.set(w.matchup_week, group);
  }

  // Build display tiles from matchup week groups
  const tiles: Array<{
    matchupWeek: number;
    weekNumbers: number[];
    startDate: string;
    endDate: string;
    label: string | null;
    isTradeDeadline: boolean;
    isPlayoff: boolean;
    isConsolation: boolean;
    isCombined: boolean;
  }> = [];

  for (const [mw, group] of matchupWeekGroups) {
    const sorted = group.sort((a, b) => a.week_number - b.week_number);
    const postSeasonIdx = mw - numWeeks; // 1-based index into post-season
    const isPostSeason = mw > numWeeks;
    tiles.push({
      matchupWeek: mw,
      weekNumbers: sorted.map(w => w.week_number),
      startDate: sorted[0].start_date,
      endDate: sorted[sorted.length - 1].end_date,
      label: sorted[0].label,
      isTradeDeadline: sorted.some(w => w.is_trade_deadline_week),
      isPlayoff: isPostSeason && postSeasonIdx <= playoffWeeks,
      isConsolation: isPostSeason && postSeasonIdx <= consolationWeeks,
      isCombined: sorted.length > 1,
    });
  }

  const regularTiles = tiles.filter(t => !t.isPlayoff && !t.isConsolation);
  const postSeasonTiles = tiles.filter(t => t.isPlayoff || t.isConsolation);

  const renderTile = (tile: typeof tiles[0]) => {
    let borderClass = 'border-gray-700';
    let bgClass = 'bg-[#0a0a0a]';

    if (tile.isPlayoff && tile.isConsolation) {
      borderClass = 'border-purple-400/50';
      bgClass = 'bg-purple-400/5';
    } else if (tile.isPlayoff) {
      borderClass = 'border-purple-400/50';
      bgClass = 'bg-purple-400/5';
    } else if (tile.isConsolation) {
      borderClass = 'border-amber-400/50';
      bgClass = 'bg-amber-400/5';
    } else if (tile.isCombined) {
      borderClass = 'border-orange-400/50';
      bgClass = 'bg-orange-400/5';
    }

    if (tile.isTradeDeadline) {
      borderClass = 'border-red-400/50';
      bgClass = tile.isCombined ? 'bg-orange-400/5' : 'bg-red-400/5';
    }

    return (
      <div
        key={tile.matchupWeek}
        className={`rounded-md border p-1.5 text-center ${borderClass} ${bgClass}`}
      >
        <div className="text-xs font-bold text-white">
          {tile.isPlayoff || tile.isConsolation
            ? (tile.label || 'PO')
            : `Wk ${tile.matchupWeek}`}
        </div>
        <div className="text-[10px] text-gray-400 leading-tight">
          {formatDate(tile.startDate)}
        </div>
        {tile.isCombined && (
          <div className="text-[9px] text-orange-400/70 leading-tight">
            {tile.weekNumbers.length}wk
          </div>
        )}
        {tile.label && !tile.isPlayoff && !tile.isConsolation && (
          <div className="text-[9px] text-orange-400/70 leading-tight truncate">
            {tile.label}
          </div>
        )}
        {tile.isConsolation && tile.isPlayoff && (
          <div className="text-[9px] text-amber-400/70 leading-tight">+Con</div>
        )}
        {tile.isTradeDeadline && (
          <div className="text-[9px] text-red-400/70 leading-tight">TDL</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {regularTiles.map(renderTile)}
      </div>

      {postSeasonTiles.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 border-t border-gray-700" />
            <span className="text-gray-500 text-xs font-bold tracking-wider">POSTSEASON</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {postSeasonTiles.map(renderTile)}
          </div>
        </>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-gray-700 bg-[#0a0a0a]" /> Regular
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-orange-400/50 bg-orange-400/5" /> Combined
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-red-400/50 bg-red-400/5" /> Trade Deadline
        </span>
        {playoffWeeks > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-purple-400/50 bg-purple-400/5" /> Playoffs
          </span>
        )}
        {consolationWeeks > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-amber-400/50 bg-amber-400/5" /> Consolation
          </span>
        )}
      </div>
    </div>
  );
}

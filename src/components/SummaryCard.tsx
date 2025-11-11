
import type { RosterSummary } from '../types';
import { CAP_CONSTANTS } from '../types';

interface SummaryCardProps {
  summary: RosterSummary;
  maxKeepers?: number;
  isRegularSeason?: boolean;
}

export function SummaryCard({ summary, maxKeepers = 8, isRegularSeason = false }: SummaryCardProps) {
  const formatMoney = (cents: number) => `$${cents.toFixed(0)}`;

  return (
    <div className="bg-[#121212] p-6 rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold mb-4 text-white">Roster Summary and Fees</h3>

      {/* Counts */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Roster</span>
          <span
            className={`font-semibold ${
              summary.keepersCount + summary.draftedCount > 13 ? 'text-red-400' : 'text-white'
            }`}
          >
            {summary.keepersCount + summary.draftedCount} / 13
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Redshirts</span>
          <span className="font-semibold text-white">{summary.redshirtsCount}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Int Stash</span>
          <span className="font-semibold text-white">{summary.intStashCount}</span>
        </div>
      </div>

      {/* Fees breakdown */}
      <div className="border-t border-gray-800 pt-4">
        <h4 className="font-semibold text-sm text-gray-300 mb-3">Fees Due</h4>

        <div className="space-y-2 text-sm">
          {/* Buy-in fee (always shown) */}
          <div className="flex justify-between">
            <span className="text-gray-400">Buy-in Fee</span>
            <span className="font-medium text-white">$50</span>
          </div>

          {summary.franchiseTagDues > 0 && (
            <div>
              <div className="flex justify-between">
                <span className="text-gray-400">
                  {summary.franchiseTags > 0
                    ? `Franchise Tags (${summary.franchiseTags} × $${CAP_CONSTANTS.FRANCHISE_TAG_FEE})`
                    : 'Franchise Tags'
                  }
                </span>
                <span className="font-medium text-white">
                  {formatMoney(summary.franchiseTagDues)}
                </span>
              </div>
              {!isRegularSeason && (
                <div className="text-xs text-gray-500 mt-1 italic">
                  Additional 1st round keepers beyond the first
                </div>
              )}
            </div>
          )}

          {summary.redshirtsCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">
                Redshirts ({summary.redshirtsCount} × $
                {CAP_CONSTANTS.REDSHIRT_FEE})
              </span>
              <span className="font-medium text-white">
                {formatMoney(summary.redshirtDues)}
              </span>
            </div>
          )}

          {summary.firstApronFee > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">
                First Apron Fee (one-time)
              </span>
              <span className="font-medium text-yellow-400">
                {formatMoney(summary.firstApronFee)}
              </span>
            </div>
          )}

          {summary.penaltyDues > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">
                Second Apron ({summary.overSecondApronByM}M × $
                {CAP_CONSTANTS.PENALTY_RATE_PER_M}/M)
              </span>
              <span className="font-medium text-orange-400">
                {formatMoney(summary.penaltyDues)}
              </span>
            </div>
          )}

          <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between font-semibold">
            <span className="text-white">Total Fees</span>
            <span
              className={summary.totalFees + 50 > 0 ? 'text-green-400' : 'text-white'}
            >
              {formatMoney(summary.totalFees + 50)}
            </span>
          </div>
        </div>
      </div>

      {/* Validation warnings - only show for keeper phase, not regular season */}
      {!isRegularSeason && (
        <>
          {summary.keepersCount > maxKeepers && (
            <div className="mt-4 p-3 bg-red-400/10 border border-red-400/30 rounded text-sm text-red-400">
              ⚠️ Too many keepers. Remove{' '}
              {summary.keepersCount - maxKeepers} keeper(s) before submitting.
            </div>
          )}

          {summary.keepersCount === 0 && summary.redshirtsCount === 0 && summary.intStashCount === 0 && (
            <div className="mt-4 p-3 bg-blue-400/10 border border-blue-400/30 rounded text-sm text-blue-400">
              ℹ️ No keepers, redshirts, or int stash selected. This is allowed but unusual.
            </div>
          )}
        </>
      )}
    </div>
  );
}

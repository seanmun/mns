
import type { RosterSummary } from '../types';
import { CAP_CONSTANTS } from '../types';

interface SummaryCardProps {
  summary: RosterSummary;
  maxKeepers?: number;
}

export function SummaryCard({ summary, maxKeepers = 8 }: SummaryCardProps) {
  const formatMoney = (cents: number) => `$${cents.toFixed(0)}`;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Roster Summary and Fees</h3>

      {/* Counts */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Keepers</span>
          <span
            className={`font-semibold ${
              summary.keepersCount > maxKeepers ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {summary.keepersCount} / {maxKeepers}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Redshirts</span>
          <span className="font-semibold">{summary.redshirtsCount}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Int Stash</span>
          <span className="font-semibold">{summary.intStashCount}</span>
        </div>
      </div>

      {/* Fees breakdown */}
      <div className="border-t pt-4">
        <h4 className="font-semibold text-sm text-gray-700 mb-3">Fees Due</h4>

        <div className="space-y-2 text-sm">
          {/* Buy-in fee (always shown) */}
          <div className="flex justify-between">
            <span className="text-gray-600">Buy-in Fee</span>
            <span className="font-medium">$50</span>
          </div>

          {summary.franchiseTags > 0 && (
            <div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Franchise Tags ({summary.franchiseTags} × $
                  {CAP_CONSTANTS.FRANCHISE_TAG_FEE})
                </span>
                <span className="font-medium">
                  {formatMoney(summary.franchiseTagDues)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 italic">
                Additional 1st round keepers beyond the first
              </div>
            </div>
          )}

          {summary.redshirtsCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                Redshirts ({summary.redshirtsCount} × $
                {CAP_CONSTANTS.REDSHIRT_FEE})
              </span>
              <span className="font-medium">
                {formatMoney(summary.redshirtDues)}
              </span>
            </div>
          )}

          {summary.firstApronFee > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                First Apron Fee (one-time)
              </span>
              <span className="font-medium text-yellow-600">
                {formatMoney(summary.firstApronFee)}
              </span>
            </div>
          )}

          {summary.penaltyDues > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                Second Apron ({summary.overSecondApronByM}M × $
                {CAP_CONSTANTS.PENALTY_RATE_PER_M}/M)
              </span>
              <span className="font-medium text-orange-600">
                {formatMoney(summary.penaltyDues)}
              </span>
            </div>
          )}

          <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
            <span>Total Fees</span>
            <span
              className={summary.totalFees + 50 > 0 ? 'text-red-600' : 'text-gray-900'}
            >
              {formatMoney(summary.totalFees + 50)}
            </span>
          </div>
        </div>
      </div>

      {/* Validation warnings */}
      {summary.keepersCount > maxKeepers && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          ⚠️ Too many keepers. Remove{' '}
          {summary.keepersCount - maxKeepers} keeper(s) before submitting.
        </div>
      )}

      {summary.keepersCount === 0 && summary.redshirtsCount === 0 && summary.intStashCount === 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          ℹ️ No keepers, redshirts, or int stash selected. This is allowed but unusual.
        </div>
      )}
    </div>
  );
}

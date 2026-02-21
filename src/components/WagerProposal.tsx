import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Wager } from '../types';

interface WagerProposalProps {
  wager: Wager;
  userEmail: string;
  isOpponent: boolean; // Is the current user the opponent who needs to respond?
}

export function WagerProposal({ wager, userEmail, isOpponent }: WagerProposalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!isOpponent || wager.status !== 'pending') return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('wagers')
        .update({
          status: 'accepted',
          responded_at: Date.now(),
          responded_by: userEmail,
          updated_at: Date.now(),
        })
        .eq('id', wager.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error accepting wager:', error);
      alert('Failed to accept wager. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!isOpponent || wager.status !== 'pending') return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('wagers')
        .update({
          status: 'declined',
          responded_at: Date.now(),
          responded_by: userEmail,
          updated_at: Date.now(),
        })
        .eq('id', wager.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error declining wager:', error);
      alert('Failed to decline wager. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isPending = wager.status === 'pending';
  const isUnread = isOpponent && isPending;

  return (
    <div className={`bg-[#121212] rounded-lg border overflow-hidden transition-colors ${
      isUnread ? 'border-green-400/50 shadow-[0_0_15px_rgba(74,222,128,0.3)]' : 'border-gray-800'
    }`}>
      {/* Wager Header - Clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 border-b border-gray-800 hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {/* Unread Indicator */}
          {isUnread && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          )}

          {/* Icon */}
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-xl">💰</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold truncate ${isUnread ? 'text-white' : 'text-gray-400'}`}>
                Wager Proposal {isOpponent ? 'from' : 'to'} {isOpponent ? wager.proposerName : wager.opponentName}
              </h3>
              {isUnread && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-400 text-black">
                  NEW
                </span>
              )}
              {wager.status === 'accepted' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-400/20 text-green-400 border border-green-400/30">
                  ACCEPTED
                </span>
              )}
              {wager.status === 'declined' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-400/20 text-red-400 border border-red-400/30">
                  DECLINED
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm truncate">${wager.amount.toFixed(2)} • {wager.description.substring(0, 50)}...</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {new Date(wager.proposedAt).toLocaleDateString()}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Wager Content - Expandable */}
      {isExpanded && (
        <div className="px-6 py-6 space-y-6">
          {/* Wager Details */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Wager Details</h4>
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                <p className="text-white text-lg">{wager.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                <div className="text-xs text-gray-400 mb-1">Amount</div>
                <div className="text-2xl font-bold text-green-400">${wager.amount.toFixed(2)}</div>
              </div>

              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                <div className="text-xs text-gray-400 mb-1">Settlement Date</div>
                <div className="text-lg font-semibold text-white">{formatDate(wager.settlementDate)}</div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-2">Parties</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{wager.proposerName}</div>
                  <div className="text-xs text-gray-500">Proposer</div>
                </div>
                <div className="text-gray-500">vs</div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{wager.opponentName}</div>
                  <div className="text-xs text-gray-500">Opponent</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - Only show if user is opponent and wager is pending */}
          {isOpponent && isPending && (
            <div className="flex gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={handleDecline}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-red-400/10 text-red-400 border border-red-400/30 rounded-lg font-semibold hover:bg-red-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Decline'}
              </button>
              <button
                onClick={handleAccept}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-green-400 text-black rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Accept Wager'}
              </button>
            </div>
          )}

          {/* Status Message for non-pending wagers */}
          {!isPending && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 text-center">
                {wager.status === 'accepted' && 'This wager has been accepted and is now live.'}
                {wager.status === 'declined' && 'This wager proposal was declined.'}
                {wager.status === 'settled' && 'This wager has been settled.'}
              </p>
            </div>
          )}

          {/* Status Message for proposer */}
          {!isOpponent && isPending && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 text-center">
                Waiting for {wager.opponentName} to respond to your proposal.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

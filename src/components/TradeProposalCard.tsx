import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { executeTrade } from '../lib/tradeExecution';
import type { TradeProposal, TradeProposalResponse, TradeAsset } from '../types';

interface TradeProposalCardProps {
  proposal: TradeProposal;
  responses: TradeProposalResponse[];
  userTeamId: string | null;
  userEmail: string;
  onTradeExecuted?: () => void;
}

export function TradeProposalCard({
  proposal,
  responses,
  userTeamId,
  userEmail,
  onTradeExecuted,
}: TradeProposalCardProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myResponse = responses.find(r => r.teamId === userTeamId);
  const needsMyResponse = myResponse?.status === 'pending';
  const isExpired = proposal.expiresAt ? Date.now() > proposal.expiresAt : false;
  const isPending = proposal.status === 'pending' && !isExpired;
  const isUnread = needsMyResponse && isPending;

  // Group assets by source team
  const assetsByTeam = new Map<string, TradeAsset[]>();
  for (const asset of proposal.assets) {
    const key = asset.fromTeamId;
    const existing = assetsByTeam.get(key) || [];
    existing.push(asset);
    assetsByTeam.set(key, existing);
  }

  // Get unique team names involved
  const teamNames = new Map<string, string>();
  for (const asset of proposal.assets) {
    teamNames.set(asset.fromTeamId, asset.fromTeamName);
    teamNames.set(asset.toTeamId, asset.toTeamName);
  }

  const handleAccept = async () => {
    if (!myResponse || !isPending) return;
    setIsSubmitting(true);
    try {
      // Update this team's response
      const { error } = await supabase
        .from('trade_proposal_responses')
        .update({
          status: 'accepted',
          responded_by: userEmail,
          responded_at: new Date().toISOString(),
        })
        .eq('id', myResponse.id);

      if (error) throw error;

      // Check if all teams have now accepted
      const { data: allResponses, error: fetchErr } = await supabase
        .from('trade_proposal_responses')
        .select('*')
        .eq('proposal_id', proposal.id);

      if (fetchErr) throw fetchErr;

      const allAccepted = (allResponses || []).every((r: any) => r.status === 'accepted');

      if (allAccepted) {
        // Auto-execute the trade
        const result = await executeTrade({
          proposalId: proposal.id,
          assets: proposal.assets.map(a => ({
            type: a.type,
            id: a.id,
            fromTeamId: a.fromTeamId,
            toTeamId: a.toTeamId,
          })),
          leagueId: proposal.leagueId,
          executedBy: userEmail,
        });

        if (!result.success) {
          toast.error(`Trade execution failed: ${result.error}`);
        } else {
          toast.success('Trade executed successfully!');
          onTradeExecuted?.();
        }
      } else {
        toast.success('Trade accepted. Waiting for other teams to respond.');
      }

      // Invalidate cache so UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['tradeProposals', proposal.leagueId] });
    } catch (err) {
      logger.error('Error accepting trade:', err);
      toast.error('Failed to accept trade. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!myResponse || !isPending) return;
    setIsSubmitting(true);
    try {
      // Update this team's response
      const { error: respErr } = await supabase
        .from('trade_proposal_responses')
        .update({
          status: 'rejected',
          responded_by: userEmail,
          responded_at: new Date().toISOString(),
        })
        .eq('id', myResponse.id);

      if (respErr) throw respErr;

      // Mark the entire proposal as rejected
      const { error: propErr } = await supabase
        .from('trade_proposals')
        .update({ status: 'rejected' })
        .eq('id', proposal.id);

      if (propErr) throw propErr;

      toast.success('Trade rejected.');
      // Invalidate cache so UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['tradeProposals', proposal.leagueId] });
    } catch (err) {
      logger.error('Error rejecting trade:', err);
      toast.error('Failed to reject trade. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSalary = (salary: number) => `$${(salary / 1_000_000).toFixed(2)}M`;

  const statusBadge = () => {
    if (isExpired && proposal.status === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-400/20 text-gray-400 border border-gray-400/30">
          EXPIRED
        </span>
      );
    }
    switch (proposal.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
            PENDING
          </span>
        );
      case 'executed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-400/20 text-green-400 border border-green-400/30">
            EXECUTED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-400/20 text-red-400 border border-red-400/30">
            REJECTED
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-400/20 text-gray-400 border border-gray-400/30">
            CANCELLED
          </span>
        );
      default:
        return null;
    }
  };

  const teamsCount = teamNames.size;
  const proposerName = teamNames.get(proposal.proposedByTeamId) || 'Unknown';

  return (
    <div className={`bg-[#121212] rounded-lg border overflow-hidden transition-colors ${
      isUnread ? 'border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'border-gray-800'
    }`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 border-b border-gray-800 hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isUnread && (
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          )}

          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center">
            <span className="text-lg">&#8644;</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold truncate ${isUnread ? 'text-white' : 'text-gray-400'}`}>
                {teamsCount}-team trade by {proposerName}
              </h3>
              {isUnread && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-400 text-black">
                  NEW
                </span>
              )}
              {statusBadge()}
            </div>
            <p className="text-gray-500 text-sm truncate">
              {proposal.assets.length} asset{proposal.assets.length !== 1 ? 's' : ''} involved
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {new Date(proposal.createdAt).toLocaleDateString()}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 py-6 space-y-6">
          {/* Trade Details grouped by team */}
          {Array.from(assetsByTeam.entries()).map(([fromTeamId, assets]) => (
            <div key={fromTeamId} className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-400">
                {teamNames.get(fromTeamId)} sends:
              </h4>
              <div className="space-y-1">
                {assets.map((asset, i) => (
                  <div key={i} className="bg-[#0a0a0a] rounded-lg p-3 border border-gray-800 flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-2 ${
                        asset.type === 'keeper' ? 'bg-green-400/20 text-green-400' :
                        asset.type === 'redshirt' ? 'bg-yellow-400/20 text-yellow-400' :
                        asset.type === 'int_stash' ? 'bg-blue-400/20 text-blue-400' :
                        'bg-purple-400/20 text-purple-400'
                      }`}>
                        {asset.type === 'int_stash' ? 'STASH' : asset.type === 'rookie_pick' ? 'PICK' : asset.type.toUpperCase()}
                      </span>
                      <span className="text-white">{asset.displayName}</span>
                      {asset.salary > 0 && (
                        <span className="text-gray-500 ml-2 text-sm">{formatSalary(asset.salary)}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      <span className="text-gray-600">to</span>{' '}
                      <span className="text-white">{asset.toTeamName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Note from proposer */}
          {proposal.note && (
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Note</div>
              <p className="text-white text-sm">{proposal.note}</p>
            </div>
          )}

          {/* Response Status */}
          <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-400 mb-3">Team Responses</div>
            <div className="space-y-2">
              {responses.map(resp => (
                <div key={resp.teamId} className="flex items-center justify-between">
                  <span className="text-white text-sm">{resp.teamName}</span>
                  <span className={`text-sm font-medium ${
                    resp.status === 'accepted' ? 'text-green-400' :
                    resp.status === 'rejected' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {resp.status === 'accepted' ? '✓ Accepted' :
                     resp.status === 'rejected' ? '✕ Rejected' :
                     '⏳ Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Expiration notice */}
          {proposal.expiresAt && isPending && (
            <p className="text-xs text-gray-500 text-center">
              Expires {new Date(proposal.expiresAt).toLocaleDateString()} at{' '}
              {new Date(proposal.expiresAt).toLocaleTimeString()}
            </p>
          )}

          {/* Action Buttons */}
          {needsMyResponse && isPending && (
            <div className="flex gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={handleReject}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-red-400/10 text-red-400 border border-red-400/30 rounded-lg font-semibold hover:bg-red-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={handleAccept}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-cyan-400 text-black rounded-lg font-semibold hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Accept Trade'}
              </button>
            </div>
          )}

          {/* Status messages */}
          {proposal.status === 'executed' && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-green-400 text-center">
                This trade has been executed.
              </p>
            </div>
          )}
          {proposal.status === 'rejected' && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-red-400 text-center">
                This trade proposal was rejected.
              </p>
            </div>
          )}
          {isExpired && proposal.status === 'pending' && (
            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 text-center">
                This trade proposal has expired.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

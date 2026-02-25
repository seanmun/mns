import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapTradeProposal, mapTradeResponse } from '../lib/mappers';
import type { TradeProposal, TradeProposalResponse } from '../types';

export function useTradeProposals(leagueId?: string, teamId?: string) {
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['tradeProposals', leagueId],
    queryFn: async () => {
      // Fetch proposals
      const { data: proposalRows, error: propErr } = await supabase
        .from('trade_proposals')
        .select('*')
        .eq('league_id', leagueId!)
        .order('created_at', { ascending: false });

      if (propErr) throw propErr;

      const allProposals = (proposalRows || []).map(mapTradeProposal);

      // Fetch responses for all proposals
      let respMap = new Map<string, TradeProposalResponse[]>();
      if (allProposals.length > 0) {
        const proposalIds = allProposals.map(p => p.id);
        const { data: responseRows, error: respErr } = await supabase
          .from('trade_proposal_responses')
          .select('*')
          .in('proposal_id', proposalIds);

        if (respErr) throw respErr;

        for (const row of responseRows || []) {
          const resp = mapTradeResponse(row);
          const existing = respMap.get(resp.proposalId) || [];
          existing.push(resp);
          respMap.set(resp.proposalId, existing);
        }
      }

      return { proposals: allProposals, responses: respMap };
    },
    enabled: !!leagueId,
  });

  // Client-side filter to proposals involving this team
  const proposals = useMemo(() => {
    const all = data?.proposals || [];
    if (teamId) {
      return all.filter((p: TradeProposal) => p.involvedTeamIds.includes(teamId));
    }
    return all;
  }, [data?.proposals, teamId]);

  const responses = data?.responses || new Map<string, TradeProposalResponse[]>();

  // Realtime subscription — invalidate on changes
  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`trade-proposals-${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_proposals',
        filter: `league_id=eq.${leagueId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['tradeProposals', leagueId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_proposal_responses',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['tradeProposals', leagueId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, queryClient]);

  return { proposals, responses, loading };
}

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TradeProposal, TradeProposalResponse } from '../types';

function mapProposal(row: any): TradeProposal {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    proposedByTeamId: row.proposed_by_team_id,
    proposedByEmail: row.proposed_by_email,
    status: row.status,
    assets: row.assets || [],
    involvedTeamIds: row.involved_team_ids || [],
    note: row.note || undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
    executedAt: row.executed_at ? new Date(row.executed_at).getTime() : undefined,
    executedBy: row.executed_by || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapResponse(row: any): TradeProposalResponse {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    teamId: row.team_id,
    teamName: row.team_name,
    status: row.status,
    respondedBy: row.responded_by || undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function useTradeProposals(leagueId?: string, teamId?: string) {
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [responses, setResponses] = useState<Map<string, TradeProposalResponse[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch proposals
        const { data: proposalRows, error: propErr } = await supabase
          .from('trade_proposals')
          .select('*')
          .eq('league_id', leagueId)
          .order('created_at', { ascending: false });

        if (propErr) throw propErr;

        let mapped = (proposalRows || []).map(mapProposal);

        // Client-side filter to proposals involving this team
        if (teamId) {
          mapped = mapped.filter(p => p.involvedTeamIds.includes(teamId));
        }

        setProposals(mapped);

        // Fetch responses for all proposals
        if (mapped.length > 0) {
          const proposalIds = mapped.map(p => p.id);
          const { data: responseRows, error: respErr } = await supabase
            .from('trade_proposal_responses')
            .select('*')
            .in('proposal_id', proposalIds);

          if (respErr) throw respErr;

          const respMap = new Map<string, TradeProposalResponse[]>();
          for (const row of responseRows || []) {
            const resp = mapResponse(row);
            const existing = respMap.get(resp.proposalId) || [];
            existing.push(resp);
            respMap.set(resp.proposalId, existing);
          }
          setResponses(respMap);
        } else {
          setResponses(new Map());
        }
      } catch (err) {
        console.error('Error fetching trade proposals:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Realtime subscription for proposals
    const channel = supabase
      .channel(`trade-proposals-${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_proposals',
        filter: `league_id=eq.${leagueId}`,
      }, () => {
        fetchData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_proposal_responses',
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, teamId]);

  return { proposals, responses, loading };
}

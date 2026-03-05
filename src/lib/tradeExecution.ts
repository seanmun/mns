import { supabase } from './supabase';
import { logger } from './logger';

interface TradeAssetPayload {
  type: 'keeper' | 'redshirt' | 'int_stash' | 'rookie_pick';
  id: string;
  fromTeamId: string;
  toTeamId: string;
}

/**
 * Execute a trade atomically via a database stored procedure.
 * All verification, asset transfers, roster updates, and conflict
 * cancellation happen in a single PostgreSQL transaction.
 *
 * The stored procedure (execute_trade in 00023_execute_trade.sql):
 * 1. Locks and verifies the proposal is still pending
 * 2. Locks and verifies ownership of all players and picks (SELECT FOR UPDATE)
 * 3. Updates keeper roster entries (rosters.entries JSONB)
 * 4. Transfers players (players.team_id + slot)
 * 5. Transfers rookie picks (rookie_draft_picks.current_owner)
 * 6. Cancels any conflicting pending proposals
 * 7. Marks the proposal as executed
 *
 * If any step fails, the entire transaction rolls back — no partial trades.
 */
export async function executeTrade(params: {
  proposalId: string;
  assets: TradeAssetPayload[];
  leagueId: string;
  executedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  const { proposalId, assets, leagueId, executedBy } = params;

  try {
    const { data, error } = await supabase.rpc('execute_trade', {
      p_proposal_id: proposalId,
      p_league_id: leagueId,
      p_assets: assets,
      p_executed_by: executedBy,
    });

    if (error) {
      logger.error('Trade execution RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; cancelled_proposals?: number };

    if (!result.success) {
      logger.error('Trade execution failed:', result.error);
      return { success: false, error: result.error };
    }

    if (result.cancelled_proposals && result.cancelled_proposals > 0) {
      logger.info(`Trade executed. Cancelled ${result.cancelled_proposals} conflicting proposal(s).`);
    }

    return { success: true };
  } catch (err) {
    logger.error('Trade execution error:', err);
    return { success: false, error: 'Unexpected error during trade execution' };
  }
}

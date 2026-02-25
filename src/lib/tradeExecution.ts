import { supabase } from './supabase';
import { logger } from './logger';
import { transferPlayer } from './rosterOps';
import type { PlayerSlot } from '../types';

interface TradeAssetPayload {
  type: 'keeper' | 'redshirt' | 'int_stash' | 'rookie_pick';
  id: string;
  fromTeamId: string;
  toTeamId: string;
}

/**
 * Execute a trade: move players between teams and update rookie pick ownership.
 * Called when all owners accept a trade proposal.
 *
 * Safety checks:
 * - Verifies proposal is still pending (prevents double-execution)
 * - Verifies every player still belongs to the sending team (prevents conflicts)
 * - Verifies every rookie pick still belongs to the sending team
 * - Cancels any other pending proposals involving the same assets
 *
 * Steps:
 * 1. Validate proposal status and asset ownership
 * 2. For each team, compute roster entry changes (remove outgoing, add incoming)
 * 3. Update roster entries in the `rosters` table
 * 4. Update `players.team_id` + `players.slot` for traded players
 * 5. Update `rookie_draft_picks.current_owner` for traded picks
 * 6. Cancel conflicting pending proposals
 * 7. Mark the proposal as 'executed'
 */
export async function executeTrade(params: {
  proposalId: string;
  assets: TradeAssetPayload[];
  leagueId: string;
  executedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  const { proposalId, assets, leagueId, executedBy } = params;

  try {
    // Guard: check proposal is still pending
    const { data: proposal, error: fetchErr } = await supabase
      .from('trade_proposals')
      .select('status')
      .eq('id', proposalId)
      .single();

    if (fetchErr) return { success: false, error: 'Could not fetch proposal' };
    if (proposal.status !== 'pending') {
      return { success: false, error: `Proposal is already ${proposal.status}` };
    }

    // Separate player assets from pick assets
    const playerAssets = assets.filter(a => a.type !== 'rookie_pick');
    const pickAssets = assets.filter(a => a.type === 'rookie_pick');

    // --- OWNERSHIP VALIDATION ---
    // Verify every player still belongs to the sending team
    if (playerAssets.length > 0) {
      const playerIds = playerAssets.map(a => a.id);
      const { data: playerRows, error: playerErr } = await supabase
        .from('players')
        .select('id, team_id, name')
        .in('id', playerIds);

      if (playerErr) return { success: false, error: 'Could not verify player ownership' };

      for (const asset of playerAssets) {
        const player = (playerRows || []).find((p: any) => p.id === asset.id);
        if (!player) {
          return { success: false, error: `Player ${asset.id} not found` };
        }
        if (player.team_id !== asset.fromTeamId) {
          return {
            success: false,
            error: `${player.name} no longer belongs to the sending team. They may have been moved by another trade.`,
          };
        }
      }
    }

    // Verify every rookie pick still belongs to the sending team
    if (pickAssets.length > 0) {
      const pickIds = pickAssets.map(a => a.id);
      const { data: pickRows, error: pickErr } = await supabase
        .from('rookie_draft_picks')
        .select('id, current_owner')
        .in('id', pickIds);

      if (pickErr) return { success: false, error: 'Could not verify pick ownership' };

      for (const asset of pickAssets) {
        const pick = (pickRows || []).find((p: any) => p.id === asset.id);
        if (!pick) {
          return { success: false, error: `Draft pick ${asset.id} not found` };
        }
        if (pick.current_owner !== asset.fromTeamId) {
          return {
            success: false,
            error: `Draft pick ${asset.id} no longer belongs to the sending team. It may have been moved by another trade.`,
          };
        }
      }
    }

    // --- ROSTER ENTRY UPDATES ---
    const teamIds = new Set<string>();
    for (const asset of assets) {
      teamIds.add(asset.fromTeamId);
      teamIds.add(asset.toTeamId);
    }

    // Load current rosters (keeper entries) for involved teams
    const rosterIds = Array.from(teamIds).map(tid => `${leagueId}_${tid}`);
    const { data: rosterRows, error: rosterErr } = await supabase
      .from('rosters')
      .select('*')
      .in('id', rosterIds);

    if (rosterErr) return { success: false, error: 'Could not load rosters' };

    const rosterMap = new Map<string, any>();
    for (const row of rosterRows || []) {
      rosterMap.set(row.team_id, row);
    }

    // Build updates per team for keeper roster entries
    const teamUpdates = new Map<string, {
      toRemove: Set<string>;
      toAdd: Array<{ playerId: string; decision: string }>;
    }>();

    for (const tid of teamIds) {
      teamUpdates.set(tid, { toRemove: new Set(), toAdd: [] });
    }

    for (const asset of playerAssets) {
      const fromUp = teamUpdates.get(asset.fromTeamId)!;
      const toUp = teamUpdates.get(asset.toTeamId)!;

      fromUp.toRemove.add(asset.id);
      toUp.toAdd.push({
        playerId: asset.id,
        decision: asset.type === 'redshirt' ? 'REDSHIRT'
          : asset.type === 'int_stash' ? 'INT_STASH'
          : 'KEEP',
      });
    }

    // Apply roster entry changes and save
    for (const [teamId, updates] of teamUpdates.entries()) {
      const rosterRow = rosterMap.get(teamId);
      if (!rosterRow) continue;

      const entries = [...(rosterRow.entries || [])];
      const filtered = entries.filter((e: any) => !updates.toRemove.has(e.playerId));

      for (const add of updates.toAdd) {
        filtered.push({
          playerId: add.playerId,
          decision: add.decision,
          baseRound: 13,
        });
      }

      const rosterId = `${leagueId}_${teamId}`;
      const { error: upErr } = await supabase
        .from('rosters')
        .update({ entries: filtered })
        .eq('id', rosterId);

      if (upErr) {
        logger.error(`Failed to update roster for ${teamId}:`, upErr);
        return { success: false, error: `Failed to update roster for team ${teamId}` };
      }
    }

    // --- TRANSFER PLAYERS (updates players.team_id + players.slot) ---
    for (const asset of playerAssets) {
      const toSlot: PlayerSlot = asset.type === 'redshirt' ? 'redshirt'
        : asset.type === 'int_stash' ? 'international'
        : 'active';

      const transferResult = await transferPlayer({
        playerId: asset.id,
        fromTeamId: asset.fromTeamId,
        toTeamId: asset.toTeamId,
        leagueId,
        toSlot,
      });

      if (!transferResult.success) {
        logger.error(`Failed to transfer player ${asset.id}: ${transferResult.error}`);
      }
    }

    // Update rookie pick ownership
    for (const asset of pickAssets) {
      const { error } = await supabase
        .from('rookie_draft_picks')
        .update({ current_owner: asset.toTeamId })
        .eq('id', asset.id);

      if (error) {
        logger.error(`Failed to update rookie pick ${asset.id}:`, error);
      }
    }

    // --- CANCEL CONFLICTING PROPOSALS ---
    const allAssetIds = assets.map(a => a.id);
    const { data: conflicting } = await supabase
      .from('trade_proposals')
      .select('id, assets')
      .eq('league_id', leagueId)
      .eq('status', 'pending')
      .neq('id', proposalId);

    if (conflicting && conflicting.length > 0) {
      const toCancel: string[] = [];
      for (const other of conflicting) {
        const otherAssetIds = (other.assets || []).map((a: any) => a.id);
        const hasConflict = otherAssetIds.some((id: string) => allAssetIds.includes(id));
        if (hasConflict) {
          toCancel.push(other.id);
        }
      }
      if (toCancel.length > 0) {
        const { error: cancelErr } = await supabase
          .from('trade_proposals')
          .update({ status: 'cancelled' })
          .in('id', toCancel);

        if (cancelErr) {
          logger.error('Failed to cancel conflicting proposals:', cancelErr);
        } else {
          logger.info(`Cancelled ${toCancel.length} conflicting proposal(s) after trade execution`);
        }
      }
    }

    // Mark proposal as executed
    const { error: execErr } = await supabase
      .from('trade_proposals')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        executed_by: executedBy,
      })
      .eq('id', proposalId);

    if (execErr) {
      logger.error('Failed to mark proposal as executed:', execErr);
    }

    return { success: true };
  } catch (err) {
    logger.error('Trade execution error:', err);
    return { success: false, error: 'Unexpected error during trade execution' };
  }
}

import { supabase } from './supabase';

interface TradeAssetPayload {
  type: 'keeper' | 'redshirt' | 'int_stash' | 'rookie_pick';
  id: string;
  fromTeamId: string;
  toTeamId: string;
}

/**
 * Execute a trade: move players between rosters and update rookie pick ownership.
 * Called when all owners accept a trade proposal.
 *
 * Steps:
 * 1. For each team, compute roster entry changes (remove outgoing, add incoming)
 * 2. Update roster entries in the `rosters` table
 * 3. Update `players.team_id` for traded players
 * 4. Update `rookie_draft_picks.current_owner` for traded picks
 * 5. Mark the proposal as 'executed'
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

    // Collect all involved team IDs
    const teamIds = new Set<string>();
    for (const asset of assets) {
      teamIds.add(asset.fromTeamId);
      teamIds.add(asset.toTeamId);
    }

    // Load current rosters for involved teams
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

    // Group player assets by team
    const playerAssets = assets.filter(a => a.type !== 'rookie_pick');

    // Build updates per team
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

      // Remove outgoing
      const filtered = entries.filter((e: any) => !updates.toRemove.has(e.playerId));

      // Add incoming
      for (const add of updates.toAdd) {
        filtered.push({
          playerId: add.playerId,
          decision: add.decision,
          baseRound: 13,
        });
      }

      // Update roster
      const rosterId = `${leagueId}_${teamId}`;
      const { error: upErr } = await supabase
        .from('rosters')
        .update({ entries: filtered })
        .eq('id', rosterId);

      if (upErr) {
        console.error(`Failed to update roster for ${teamId}:`, upErr);
        return { success: false, error: `Failed to update roster for team ${teamId}` };
      }
    }

    // Update players.team_id for traded players
    for (const asset of playerAssets) {
      const { error } = await supabase
        .from('players')
        .update({ team_id: asset.toTeamId })
        .eq('id', asset.id);

      if (error) {
        console.error(`Failed to update player ${asset.id}:`, error);
      }
    }

    // Update rookie pick ownership
    for (const asset of assets.filter(a => a.type === 'rookie_pick')) {
      const { error } = await supabase
        .from('rookie_draft_picks')
        .update({ current_owner: asset.toTeamId })
        .eq('id', asset.id);

      if (error) {
        console.error(`Failed to update rookie pick ${asset.id}:`, error);
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
      console.error('Failed to mark proposal as executed:', execErr);
    }

    return { success: true };
  } catch (err) {
    console.error('Trade execution error:', err);
    return { success: false, error: 'Unexpected error during trade execution' };
  }
}

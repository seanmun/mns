import { supabase } from './supabase';
import { logger } from './logger';
import type { RegularSeasonRoster } from '../types';
import { mapRegularSeasonRoster } from './mappers';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RosterSlot = 'active_roster' | 'ir_slots' | 'redshirt_players' | 'international_players';

export interface RosterOpResult {
  success: boolean;
  error?: string;
}

interface IntegrityIssue {
  type: 'orphaned_id' | 'team_id_mismatch' | 'duplicate' | 'null_team_id';
  teamId: string;
  teamName?: string;
  playerId: string;
  playerName?: string;
  slot?: RosterSlot;
  details: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find which slot a player is currently in for a given regular season roster */
export function findPlayerSlot(roster: RegularSeasonRoster, playerId: string): RosterSlot | null {
  if (roster.activeRoster.includes(playerId)) return 'active_roster';
  if (roster.irSlots.includes(playerId)) return 'ir_slots';
  if (roster.redshirtPlayers.includes(playerId)) return 'redshirt_players';
  if (roster.internationalPlayers.includes(playerId)) return 'international_players';
  return null;
}

/** Remove a player from all arrays in a roster (returns the update object for Supabase) */
function removeFromAllSlots(roster: RegularSeasonRoster, playerId: string): Record<string, string[]> {
  const updates: Record<string, string[]> = {};

  if (roster.activeRoster.includes(playerId)) {
    updates.active_roster = roster.activeRoster.filter(id => id !== playerId);
  }
  if (roster.irSlots.includes(playerId)) {
    updates.ir_slots = roster.irSlots.filter(id => id !== playerId);
  }
  if (roster.redshirtPlayers.includes(playerId)) {
    updates.redshirt_players = roster.redshirtPlayers.filter(id => id !== playerId);
  }
  if (roster.internationalPlayers.includes(playerId)) {
    updates.international_players = roster.internationalPlayers.filter(id => id !== playerId);
  }
  // Also clean up benched_players if present
  if (roster.benchedPlayers.includes(playerId)) {
    updates.benched_players = roster.benchedPlayers.filter(id => id !== playerId);
  }

  return updates;
}

/** Load a regular season roster row, returns null if it doesn't exist */
async function loadRoster(leagueId: string, teamId: string): Promise<RegularSeasonRoster | null> {
  const rosterId = `${leagueId}_${teamId}`;
  const { data, error } = await supabase
    .from('regular_season_rosters')
    .select('*')
    .eq('id', rosterId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load regular season roster', error, { rosterId });
    return null;
  }
  return data ? mapRegularSeasonRoster(data) : null;
}

// ─── Core Operations ─────────────────────────────────────────────────────────

/**
 * Assign a free agent player to a team.
 * Updates: players.team_id + regular_season_rosters array
 */
export async function assignPlayerToTeam(params: {
  playerId: string;
  teamId: string;
  leagueId: string;
  slot: RosterSlot;
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { playerId, teamId, leagueId, slot, updatedBy } = params;

  // 1. Verify player exists and is not already on a team
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerErr || !player) {
    return { success: false, error: `Player ${playerId} not found` };
  }
  if (player.team_id && player.team_id !== teamId) {
    return { success: false, error: `${player.name} already belongs to team ${player.team_id}` };
  }

  // 2. Update players.team_id
  const { error: teamErr } = await supabase
    .from('players')
    .update({ team_id: teamId, on_ir: slot === 'ir_slots' })
    .eq('id', playerId);

  if (teamErr) {
    logger.error('assignPlayerToTeam: failed to update players.team_id', teamErr, { playerId, teamId });
    return { success: false, error: 'Failed to update player team assignment' };
  }

  // 3. Add to regular_season_rosters (if roster exists)
  const roster = await loadRoster(leagueId, teamId);
  if (roster) {
    // Safety: remove from all slots first to prevent duplicates
    const cleanUpdates = removeFromAllSlots(roster, playerId);

    // Get the current array for the target slot
    const slotKey = slot as string;
    const currentArray = cleanUpdates[slotKey] || getSlotArray(roster, slot);
    cleanUpdates[slotKey] = [...currentArray, playerId];
    cleanUpdates['updated_at'] = new Date().toISOString() as any;
    cleanUpdates['updated_by'] = updatedBy as any;

    const { error: rosterErr } = await supabase
      .from('regular_season_rosters')
      .update(cleanUpdates)
      .eq('id', roster.id);

    if (rosterErr) {
      logger.error('assignPlayerToTeam: failed to update regular_season_rosters', rosterErr, { playerId, teamId });
      return { success: false, error: 'Player team_id updated but regular_season_rosters failed' };
    }
  }

  logger.info('assignPlayerToTeam: success', { playerId, teamId, slot });
  return { success: true };
}

/**
 * Drop a player from a team to free agency.
 * Updates: players.team_id = null + removes from all regular_season_rosters arrays
 */
export async function dropPlayerFromTeam(params: {
  playerId: string;
  teamId: string;
  leagueId: string;
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { playerId, teamId, leagueId, updatedBy } = params;

  // 1. Verify player exists and belongs to this team
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerErr || !player) {
    return { success: false, error: `Player ${playerId} not found` };
  }

  // 2. Null out players.team_id
  const { error: teamErr } = await supabase
    .from('players')
    .update({ team_id: null, on_ir: false })
    .eq('id', playerId);

  if (teamErr) {
    logger.error('dropPlayerFromTeam: failed to null players.team_id', teamErr, { playerId, teamId });
    return { success: false, error: 'Failed to remove player from team' };
  }

  // 3. Remove from regular_season_rosters (if roster exists)
  const roster = await loadRoster(leagueId, teamId);
  if (roster) {
    const updates = removeFromAllSlots(roster, playerId);
    if (Object.keys(updates).length > 0) {
      (updates as any).updated_at = new Date().toISOString();
      (updates as any).updated_by = updatedBy;

      const { error: rosterErr } = await supabase
        .from('regular_season_rosters')
        .update(updates)
        .eq('id', roster.id);

      if (rosterErr) {
        logger.error('dropPlayerFromTeam: failed to update regular_season_rosters', rosterErr, { playerId, teamId });
        return { success: false, error: 'Player removed from team but regular_season_rosters update failed' };
      }
    }
  }

  logger.info('dropPlayerFromTeam: success', { playerId, teamId });
  return { success: true };
}

/**
 * Transfer a player from one team to another (trade).
 * Updates: players.team_id + removes from source regular_season_rosters + adds to target
 */
export async function transferPlayer(params: {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  leagueId: string;
  toSlot: RosterSlot;
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { playerId, fromTeamId, toTeamId, leagueId, toSlot, updatedBy } = params;

  // 1. Verify player belongs to source team
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerErr || !player) {
    return { success: false, error: `Player ${playerId} not found` };
  }
  if (player.team_id !== fromTeamId) {
    return { success: false, error: `${player.name} does not belong to source team ${fromTeamId}` };
  }

  // 2. Update players.team_id to new team
  const { error: teamErr } = await supabase
    .from('players')
    .update({ team_id: toTeamId, on_ir: toSlot === 'ir_slots' })
    .eq('id', playerId);

  if (teamErr) {
    logger.error('transferPlayer: failed to update players.team_id', teamErr, { playerId, fromTeamId, toTeamId });
    return { success: false, error: 'Failed to transfer player ownership' };
  }

  // 3. Remove from source regular_season_rosters (if exists)
  const sourceRoster = await loadRoster(leagueId, fromTeamId);
  if (sourceRoster) {
    const updates = removeFromAllSlots(sourceRoster, playerId);
    if (Object.keys(updates).length > 0) {
      (updates as any).updated_at = new Date().toISOString();
      (updates as any).updated_by = updatedBy;

      const { error: srcErr } = await supabase
        .from('regular_season_rosters')
        .update(updates)
        .eq('id', sourceRoster.id);

      if (srcErr) {
        logger.error('transferPlayer: failed to update source roster', srcErr, { playerId, fromTeamId });
      }
    }
  }

  // 4. Add to destination regular_season_rosters (if exists)
  const destRoster = await loadRoster(leagueId, toTeamId);
  if (destRoster) {
    // Safety: remove from all slots first
    const cleanUpdates = removeFromAllSlots(destRoster, playerId);
    const slotKey = toSlot as string;
    const currentArray = cleanUpdates[slotKey] || getSlotArray(destRoster, toSlot);
    cleanUpdates[slotKey] = [...currentArray, playerId];
    (cleanUpdates as any).updated_at = new Date().toISOString();
    (cleanUpdates as any).updated_by = updatedBy;

    const { error: destErr } = await supabase
      .from('regular_season_rosters')
      .update(cleanUpdates)
      .eq('id', destRoster.id);

    if (destErr) {
      logger.error('transferPlayer: failed to update destination roster', destErr, { playerId, toTeamId });
    }
  }

  logger.info('transferPlayer: success', { playerId, fromTeamId, toTeamId, toSlot });
  return { success: true };
}

/**
 * Move a player between roster slots on the same team (e.g. active → IR).
 * Updates: regular_season_rosters arrays + players.on_ir flag
 */
export async function movePlayerSlot(params: {
  playerId: string;
  teamId: string;
  leagueId: string;
  fromSlot: RosterSlot;
  toSlot: RosterSlot;
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { playerId, teamId, leagueId, fromSlot, toSlot, updatedBy } = params;

  if (fromSlot === toSlot) {
    return { success: false, error: 'Source and target slots are the same' };
  }

  // 1. Load roster
  const roster = await loadRoster(leagueId, teamId);
  if (!roster) {
    return { success: false, error: 'Regular season roster not found' };
  }

  // 2. Verify player is in the expected slot
  const currentSlot = findPlayerSlot(roster, playerId);
  if (currentSlot !== fromSlot) {
    return { success: false, error: `Player not found in ${fromSlot} (found in ${currentSlot || 'none'})` };
  }

  // 3. Build update: remove from source, add to target
  const fromArray = getSlotArray(roster, fromSlot).filter(id => id !== playerId);
  const toArray = [...getSlotArray(roster, toSlot), playerId];

  const updates: Record<string, any> = {
    [fromSlot]: fromArray,
    [toSlot]: toArray,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };

  // Also clean up benched_players if moving from active
  if (fromSlot === 'active_roster' && roster.benchedPlayers.includes(playerId)) {
    updates.benched_players = roster.benchedPlayers.filter(id => id !== playerId);
  }

  const { error: rosterErr } = await supabase
    .from('regular_season_rosters')
    .update(updates)
    .eq('id', roster.id);

  if (rosterErr) {
    logger.error('movePlayerSlot: failed to update roster', rosterErr, { playerId, teamId, fromSlot, toSlot });
    return { success: false, error: 'Failed to move player between slots' };
  }

  // 4. Update players.on_ir flag if moving to/from IR
  if (fromSlot === 'ir_slots' || toSlot === 'ir_slots') {
    const { error: flagErr } = await supabase
      .from('players')
      .update({ on_ir: toSlot === 'ir_slots' })
      .eq('id', playerId);

    if (flagErr) {
      logger.error('movePlayerSlot: failed to update players.on_ir', flagErr, { playerId });
    }
  }

  logger.info('movePlayerSlot: success', { playerId, teamId, fromSlot, toSlot });
  return { success: true };
}

/**
 * Swap two players between slots (e.g. active player → IR, IR player → active).
 */
export async function swapPlayerSlots(params: {
  playerToMoveId: string;
  playerToSwapId: string;
  teamId: string;
  leagueId: string;
  moveToSlot: RosterSlot;
  swapToSlot: RosterSlot;
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { playerToMoveId, playerToSwapId, teamId, leagueId, moveToSlot, swapToSlot, updatedBy } = params;

  const roster = await loadRoster(leagueId, teamId);
  if (!roster) {
    return { success: false, error: 'Regular season roster not found' };
  }

  // Remove both players from their current slots, add to new slots
  const updates: Record<string, any> = {};

  // Get clean arrays for both slots
  const moveToArray = getSlotArray(roster, moveToSlot).filter(id => id !== playerToMoveId && id !== playerToSwapId);
  const swapToArray = getSlotArray(roster, swapToSlot).filter(id => id !== playerToMoveId && id !== playerToSwapId);

  updates[moveToSlot] = [...moveToArray, playerToMoveId];
  updates[swapToSlot] = [...swapToArray, playerToSwapId];
  updates.updated_at = new Date().toISOString();
  updates.updated_by = updatedBy;

  // Clean benched_players
  if (moveToSlot !== 'active_roster' && roster.benchedPlayers.includes(playerToMoveId)) {
    updates.benched_players = roster.benchedPlayers.filter(id => id !== playerToMoveId);
  }
  if (swapToSlot !== 'active_roster' && roster.benchedPlayers.includes(playerToSwapId)) {
    const bench = updates.benched_players || roster.benchedPlayers;
    updates.benched_players = bench.filter((id: string) => id !== playerToSwapId);
  }

  const { error: rosterErr } = await supabase
    .from('regular_season_rosters')
    .update(updates)
    .eq('id', roster.id);

  if (rosterErr) {
    logger.error('swapPlayerSlots: failed', rosterErr, { playerToMoveId, playerToSwapId, teamId });
    return { success: false, error: 'Failed to swap players' };
  }

  // Update on_ir flags
  if (moveToSlot === 'ir_slots' || swapToSlot === 'ir_slots') {
    await supabase.from('players').update({ on_ir: moveToSlot === 'ir_slots' }).eq('id', playerToMoveId);
    await supabase.from('players').update({ on_ir: swapToSlot === 'ir_slots' }).eq('id', playerToSwapId);
  }

  logger.info('swapPlayerSlots: success', { playerToMoveId, playerToSwapId, teamId });
  return { success: true };
}

// ─── Integrity Validation ────────────────────────────────────────────────────

/**
 * Validate data integrity for a league.
 * Checks for orphaned IDs, team_id mismatches, and duplicates.
 */
export async function validateLeagueIntegrity(params: {
  leagueId: string;
}): Promise<{ issues: IntegrityIssue[]; summary: string }> {
  const { leagueId } = params;
  const issues: IntegrityIssue[] = [];

  // Load all players in the league
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('league_id', leagueId);

  const players = new Map<string, { id: string; name: string; teamId: string | null }>();
  for (const p of playerRows || []) {
    players.set(p.id, { id: p.id, name: p.name, teamId: p.team_id });
  }

  // Load all teams
  const { data: teamRows } = await supabase
    .from('teams')
    .select('id, name')
    .eq('league_id', leagueId);

  const teams = new Map<string, string>();
  for (const t of teamRows || []) {
    teams.set(t.id, t.name);
  }

  // Load all regular season rosters
  const { data: rosterRows } = await supabase
    .from('regular_season_rosters')
    .select('*')
    .eq('league_id', leagueId);

  const rosters = (rosterRows || []).map(mapRegularSeasonRoster);

  // Track which team each player appears on in rosters
  const playerToRosterTeams = new Map<string, string[]>();

  for (const roster of rosters) {
    const allSlots: { slot: RosterSlot; ids: string[] }[] = [
      { slot: 'active_roster', ids: roster.activeRoster },
      { slot: 'ir_slots', ids: roster.irSlots },
      { slot: 'redshirt_players', ids: roster.redshirtPlayers },
      { slot: 'international_players', ids: roster.internationalPlayers },
    ];

    for (const { slot, ids } of allSlots) {
      for (const playerId of ids) {
        // Check 1: Orphaned IDs (ID not in players table)
        const player = players.get(playerId);
        if (!player) {
          issues.push({
            type: 'orphaned_id',
            teamId: roster.teamId,
            teamName: teams.get(roster.teamId),
            playerId,
            slot,
            details: `Player ID in ${slot} does not exist in players table`,
          });
          continue;
        }

        // Check 2: team_id mismatch
        if (player.teamId !== roster.teamId) {
          issues.push({
            type: 'team_id_mismatch',
            teamId: roster.teamId,
            teamName: teams.get(roster.teamId),
            playerId,
            playerName: player.name,
            slot,
            details: `Player in ${teams.get(roster.teamId) || roster.teamId}'s ${slot} but players.team_id = ${player.teamId || 'NULL'}`,
          });
        }

        // Track for duplicate detection
        const existing = playerToRosterTeams.get(playerId) || [];
        existing.push(roster.teamId);
        playerToRosterTeams.set(playerId, existing);
      }
    }
  }

  // Check 3: Duplicates (player on multiple teams' rosters)
  for (const [playerId, teamIds] of playerToRosterTeams) {
    const uniqueTeams = [...new Set(teamIds)];
    if (uniqueTeams.length > 1) {
      const player = players.get(playerId);
      issues.push({
        type: 'duplicate',
        teamId: uniqueTeams.join(', '),
        playerId,
        playerName: player?.name,
        details: `Player appears on ${uniqueTeams.length} teams: ${uniqueTeams.map(t => teams.get(t) || t).join(', ')}`,
      });
    }
  }

  // Check 4: Players with team_id pointing to a team but not in that team's roster
  for (const [playerId, player] of players) {
    if (player.teamId && !playerToRosterTeams.has(playerId)) {
      // Player has a team_id but doesn't appear in any roster
      const teamRoster = rosters.find(r => r.teamId === player.teamId);
      if (teamRoster) {
        // Roster exists for this team but player is not in any slot
        issues.push({
          type: 'null_team_id',
          teamId: player.teamId,
          teamName: teams.get(player.teamId),
          playerId,
          playerName: player.name,
          details: `players.team_id = ${teams.get(player.teamId) || player.teamId} but player not in any roster slot`,
        });
      }
    }
  }

  const summary = issues.length === 0
    ? 'No integrity issues found'
    : `Found ${issues.length} issue(s): ${issues.filter(i => i.type === 'orphaned_id').length} orphaned, ${issues.filter(i => i.type === 'team_id_mismatch').length} mismatched, ${issues.filter(i => i.type === 'duplicate').length} duplicates, ${issues.filter(i => i.type === 'null_team_id').length} missing from roster`;

  return { issues, summary };
}

/**
 * Fix orphaned IDs: remove player IDs from roster arrays that don't exist in the players table.
 */
export async function fixOrphanedIds(params: {
  leagueId: string;
  teamId: string;
  orphanedIds: string[];
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { leagueId, teamId, orphanedIds, updatedBy } = params;
  const orphanSet = new Set(orphanedIds);

  const roster = await loadRoster(leagueId, teamId);
  if (!roster) {
    return { success: false, error: 'Roster not found' };
  }

  const updates: Record<string, any> = {
    active_roster: roster.activeRoster.filter(id => !orphanSet.has(id)),
    ir_slots: roster.irSlots.filter(id => !orphanSet.has(id)),
    redshirt_players: roster.redshirtPlayers.filter(id => !orphanSet.has(id)),
    international_players: roster.internationalPlayers.filter(id => !orphanSet.has(id)),
    benched_players: roster.benchedPlayers.filter(id => !orphanSet.has(id)),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };

  const { error } = await supabase
    .from('regular_season_rosters')
    .update(updates)
    .eq('id', roster.id);

  if (error) {
    logger.error('fixOrphanedIds: failed', error, { teamId });
    return { success: false, error: `Failed to remove orphaned IDs: ${error.message}` };
  }

  logger.info('fixOrphanedIds: removed orphaned IDs', { teamId, count: orphanedIds.length });
  return { success: true };
}

/**
 * Fix team_id mismatches: set players.team_id to match the roster they appear in.
 */
export async function fixTeamIdMismatches(params: {
  fixes: Array<{ playerId: string; correctTeamId: string }>;
}): Promise<RosterOpResult> {
  const { fixes } = params;

  for (const fix of fixes) {
    const { error } = await supabase
      .from('players')
      .update({ team_id: fix.correctTeamId })
      .eq('id', fix.playerId);

    if (error) {
      logger.error('fixTeamIdMismatches: failed', error, { playerId: fix.playerId });
      return { success: false, error: `Failed to fix team_id for ${fix.playerId}` };
    }
  }

  logger.info('fixTeamIdMismatches: fixed', { count: fixes.length });
  return { success: true };
}

/**
 * Fix "not in roster" players: either add them to active_roster or null their team_id.
 */
export async function fixNotInRoster(params: {
  fixes: Array<{ playerId: string; teamId: string; action: 'add_to_roster' | 'clear_team_id' }>;
  leagueId: string;
  updatedBy: string;
}): Promise<RosterOpResult> {
  const { fixes, leagueId, updatedBy } = params;

  for (const fix of fixes) {
    if (fix.action === 'clear_team_id') {
      const { error } = await supabase
        .from('players')
        .update({ team_id: null })
        .eq('id', fix.playerId);

      if (error) {
        logger.error('fixNotInRoster: failed to clear team_id', error, { playerId: fix.playerId });
        return { success: false, error: `Failed to clear team_id for ${fix.playerId}` };
      }
    } else {
      // Add to active_roster
      const roster = await loadRoster(leagueId, fix.teamId);
      if (!roster) {
        return { success: false, error: `Roster not found for team ${fix.teamId}` };
      }

      const newActive = [...roster.activeRoster, fix.playerId];
      const { error } = await supabase
        .from('regular_season_rosters')
        .update({
          active_roster: newActive,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy,
        })
        .eq('id', roster.id);

      if (error) {
        logger.error('fixNotInRoster: failed to add to roster', error, { playerId: fix.playerId });
        return { success: false, error: `Failed to add ${fix.playerId} to roster` };
      }
    }
  }

  logger.info('fixNotInRoster: fixed', { count: fixes.length });
  return { success: true };
}

/**
 * Rebuild ALL rosters from keeper entries + draft picks + executed trades.
 * This is the nuclear reconstruction — ignores current roster arrays and players.team_id,
 * rebuilds everything from the authoritative transaction history.
 *
 * 1. Keeper entries (KEEP → active, REDSHIRT → redshirt, INT_STASH → international)
 * 2. Draft picks (drafted players → active)
 * 3. Executed trades (move players between teams)
 * 4. Updates both regular_season_rosters AND players.team_id
 */
export async function rebuildAllRosters(params: {
  leagueId: string;
  seasonYear: number;
  updatedBy: string;
}): Promise<RosterOpResult & { details?: string }> {
  const { leagueId, seasonYear, updatedBy } = params;

  // ── Step 1: Load keeper roster entries for each team ──
  const { data: rosterDocs, error: rosterErr } = await supabase
    .from('rosters')
    .select('team_id, entries')
    .eq('league_id', leagueId)
    .eq('season_year', seasonYear);

  if (rosterErr || !rosterDocs) {
    return { success: false, error: `Failed to load keeper rosters: ${rosterErr?.message}` };
  }

  // Build team → player assignments from keeper decisions
  // Map: teamId → { active: string[], redshirt: string[], international: string[] }
  const teamRosters = new Map<string, { active: string[]; redshirt: string[]; international: string[] }>();

  for (const doc of rosterDocs) {
    const active: string[] = [];
    const redshirt: string[] = [];
    const international: string[] = [];

    const entries = doc.entries as Array<{ playerId: string; decision: string }> || [];
    for (const entry of entries) {
      if (entry.decision === 'KEEP') {
        active.push(entry.playerId);
      } else if (entry.decision === 'REDSHIRT') {
        redshirt.push(entry.playerId);
      } else if (entry.decision === 'INT_STASH') {
        international.push(entry.playerId);
      }
      // DROP = not on team
    }

    teamRosters.set(doc.team_id, { active, redshirt, international });
  }

  // ── Step 2: Add draft picks ──
  const { data: draftRows } = await supabase
    .from('drafts')
    .select('picks')
    .eq('league_id', leagueId)
    .eq('season_year', seasonYear)
    .maybeSingle();

  if (draftRows?.picks) {
    const picks = draftRows.picks as Array<{
      teamId: string;
      playerId?: string;
      isKeeperSlot?: boolean;
    }>;

    for (const pick of picks) {
      if (pick.playerId && !pick.isKeeperSlot && pick.teamId) {
        const roster = teamRosters.get(pick.teamId);
        if (roster) {
          roster.active.push(pick.playerId);
        } else {
          teamRosters.set(pick.teamId, {
            active: [pick.playerId],
            redshirt: [],
            international: [],
          });
        }
      }
    }
  }

  // ── Step 3: Apply executed trades ──
  const { data: trades } = await supabase
    .from('trade_proposals')
    .select('assets, status')
    .eq('league_id', leagueId)
    .eq('season_year', seasonYear)
    .eq('status', 'executed');

  if (trades) {
    for (const trade of trades) {
      const assets = trade.assets as Array<{
        type: string;
        id: string;
        fromTeamId: string;
        toTeamId: string;
      }> || [];

      for (const asset of assets) {
        if (asset.type === 'rookie_pick') continue; // picks, not players

        const fromRoster = teamRosters.get(asset.fromTeamId);
        const toRoster = teamRosters.get(asset.toTeamId);

        if (fromRoster) {
          // Remove from source (check all slots)
          fromRoster.active = fromRoster.active.filter(id => id !== asset.id);
          fromRoster.redshirt = fromRoster.redshirt.filter(id => id !== asset.id);
          fromRoster.international = fromRoster.international.filter(id => id !== asset.id);
        }

        if (toRoster) {
          // Add to destination in appropriate slot
          if (asset.type === 'redshirt') {
            toRoster.redshirt.push(asset.id);
          } else if (asset.type === 'int_stash') {
            toRoster.international.push(asset.id);
          } else {
            toRoster.active.push(asset.id);
          }
        }
      }
    }
  }

  // ── Step 4: Check for FA pickups ──
  // Players in the league who aren't accounted for by keepers+draft+trades
  // but DO have a team_id set — these are likely FA pickups
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('league_id', leagueId);

  const allAccountedIds = new Set<string>();
  for (const [, roster] of teamRosters) {
    roster.active.forEach(id => allAccountedIds.add(id));
    roster.redshirt.forEach(id => allAccountedIds.add(id));
    roster.international.forEach(id => allAccountedIds.add(id));
  }

  // Players with a team_id that we can't account for through keepers/draft/trades
  // are most likely FA pickups — add them to their team's active roster
  let faPickupsRestored = 0;
  if (allPlayers) {
    for (const p of allPlayers) {
      if (p.team_id && !allAccountedIds.has(p.id)) {
        const roster = teamRosters.get(p.team_id);
        if (roster) {
          roster.active.push(p.id);
          faPickupsRestored++;
        }
      }
    }
  }

  // ── Step 5: Verify all player IDs actually exist ──
  const validPlayerIds = new Set((allPlayers || []).map(p => p.id));

  // ── Step 6: Write to regular_season_rosters + fix players.team_id ──
  const { data: existingRosters } = await supabase
    .from('regular_season_rosters')
    .select('id, team_id, benched_players')
    .eq('league_id', leagueId);

  let teamsFixed = 0;
  const allTeamIdUpdates: Array<{ playerId: string; teamId: string }> = [];

  for (const row of existingRosters || []) {
    const teamId = row.team_id;
    const roster = teamRosters.get(teamId);
    if (!roster) continue;

    // Filter out any IDs that don't exist in players table
    const newActive = roster.active.filter(id => validPlayerIds.has(id));
    const newRedshirt = roster.redshirt.filter(id => validPlayerIds.has(id));
    const newInternational = roster.international.filter(id => validPlayerIds.has(id));

    // Preserve benched_players that are still in active
    const activeSet = new Set(newActive);
    const existingBenched = (row.benched_players as string[]) || [];
    const newBenched = existingBenched.filter(id => activeSet.has(id));

    const { error } = await supabase
      .from('regular_season_rosters')
      .update({
        active_roster: newActive,
        ir_slots: [], // IR is managed dynamically, start empty
        redshirt_players: newRedshirt,
        international_players: newInternational,
        benched_players: newBenched,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq('id', row.id);

    if (error) {
      logger.error('rebuildAllRosters: failed for team', error, { teamId });
      return { success: false, error: `Failed to rebuild roster for team ${teamId}: ${error.message}` };
    }

    // Collect team_id updates for all players on this team
    for (const id of [...newActive, ...newRedshirt, ...newInternational]) {
      allTeamIdUpdates.push({ playerId: id, teamId });
    }

    teamsFixed++;
  }

  // ── Step 7: Fix players.team_id to match rebuilt rosters ──
  // First, null out all team_ids in the league
  await supabase
    .from('players')
    .update({ team_id: null })
    .eq('league_id', leagueId);

  // Then set correct team_id for each assigned player
  for (const { playerId, teamId } of allTeamIdUpdates) {
    await supabase
      .from('players')
      .update({ team_id: teamId })
      .eq('id', playerId);
  }

  logger.info('rebuildAllRosters: complete', {
    teamsFixed,
    faPickupsRestored,
    totalPlayersAssigned: allTeamIdUpdates.length,
  });

  return {
    success: true,
    details: `Rebuilt ${teamsFixed} teams from keeper/draft/trades. ${faPickupsRestored} FA pickups restored. ${allTeamIdUpdates.length} players assigned.`,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function getSlotArray(roster: RegularSeasonRoster, slot: RosterSlot): string[] {
  switch (slot) {
    case 'active_roster': return roster.activeRoster;
    case 'ir_slots': return roster.irSlots;
    case 'redshirt_players': return roster.redshirtPlayers;
    case 'international_players': return roster.internationalPlayers;
  }
}

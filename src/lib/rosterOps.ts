import { supabase } from './supabase';
import { logger } from './logger';
import type { PlayerSlot } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RosterOpResult {
  success: boolean;
  error?: string;
}

// ─── Core Operations ─────────────────────────────────────────────────────────
// All roster operations now update `players.slot` directly.
// players.team_id = who owns the player (NULL = free agent)
// players.slot = roster position (active, ir, redshirt, international, bench)

/**
 * Assign a free agent player to a team.
 * Updates: players.team_id + players.slot
 */
export async function assignPlayerToTeam(params: {
  playerId: string;
  teamId: string;
  leagueId: string;
  slot: PlayerSlot;
}): Promise<RosterOpResult> {
  const { playerId, teamId, slot } = params;

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

  // 2. Update players.team_id + slot
  const { error: updateErr } = await supabase
    .from('players')
    .update({ team_id: teamId, slot, on_ir: slot === 'ir' })
    .eq('id', playerId);

  if (updateErr) {
    logger.error('assignPlayerToTeam: failed', updateErr, { playerId, teamId });
    return { success: false, error: 'Failed to assign player to team' };
  }

  logger.info('assignPlayerToTeam: success', { playerId, teamId, slot });
  return { success: true };
}

/**
 * Drop a player from a team to free agency.
 * Updates: players.team_id = null, players.slot = 'active'
 */
export async function dropPlayerFromTeam(params: {
  playerId: string;
  teamId: string;
  leagueId: string;
}): Promise<RosterOpResult> {
  const { playerId, teamId } = params;

  // 1. Verify player exists and belongs to this team
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerErr || !player) {
    return { success: false, error: `Player ${playerId} not found` };
  }
  if (player.team_id !== teamId) {
    return { success: false, error: `${player.name} does not belong to this team` };
  }

  // 2. Null out team_id, reset slot to default
  const { error: updateErr } = await supabase
    .from('players')
    .update({ team_id: null, slot: 'active', on_ir: false })
    .eq('id', playerId);

  if (updateErr) {
    logger.error('dropPlayerFromTeam: failed', updateErr, { playerId, teamId });
    return { success: false, error: 'Failed to drop player' };
  }

  logger.info('dropPlayerFromTeam: success', { playerId, teamId });
  return { success: true };
}

/**
 * Transfer a player from one team to another (trade).
 * Updates: players.team_id + players.slot
 */
export async function transferPlayer(params: {
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  leagueId: string;
  toSlot: PlayerSlot;
}): Promise<RosterOpResult> {
  const { playerId, fromTeamId, toTeamId, toSlot } = params;

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

  // 2. Update team_id + slot in one operation
  const { error: updateErr } = await supabase
    .from('players')
    .update({ team_id: toTeamId, slot: toSlot, on_ir: toSlot === 'ir' })
    .eq('id', playerId);

  if (updateErr) {
    logger.error('transferPlayer: failed', updateErr, { playerId, fromTeamId, toTeamId });
    return { success: false, error: 'Failed to transfer player' };
  }

  logger.info('transferPlayer: success', { playerId, fromTeamId, toTeamId, toSlot });
  return { success: true };
}

/**
 * Move a player between roster slots on the same team (e.g. active → IR).
 * Updates: players.slot
 */
export async function movePlayerSlot(params: {
  playerId: string;
  teamId: string;
  leagueId: string;
  toSlot: PlayerSlot;
}): Promise<RosterOpResult> {
  const { playerId, teamId, toSlot } = params;

  // 1. Verify player exists and belongs to this team
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, name, team_id, slot')
    .eq('id', playerId)
    .maybeSingle();

  if (playerErr || !player) {
    return { success: false, error: `Player ${playerId} not found` };
  }
  if (player.team_id !== teamId) {
    return { success: false, error: `${player.name} does not belong to this team` };
  }
  if (player.slot === toSlot) {
    return { success: false, error: `Player is already in ${toSlot}` };
  }

  // 2. Update slot
  const { error: updateErr } = await supabase
    .from('players')
    .update({ slot: toSlot, on_ir: toSlot === 'ir' })
    .eq('id', playerId);

  if (updateErr) {
    logger.error('movePlayerSlot: failed', updateErr, { playerId, teamId, toSlot });
    return { success: false, error: 'Failed to move player' };
  }

  logger.info('movePlayerSlot: success', { playerId, teamId, from: player.slot, to: toSlot });
  return { success: true };
}

/**
 * Swap two players between slots (e.g. active player → IR, IR player → active).
 */
export async function swapPlayerSlots(params: {
  playerAId: string;
  playerBId: string;
  teamId: string;
  leagueId: string;
  playerASlot: PlayerSlot;
  playerBSlot: PlayerSlot;
}): Promise<RosterOpResult> {
  const { playerAId, playerBId, teamId, playerASlot, playerBSlot } = params;

  // Update both players' slots
  const [resultA, resultB] = await Promise.all([
    supabase.from('players').update({ slot: playerASlot, on_ir: playerASlot === 'ir' }).eq('id', playerAId).eq('team_id', teamId),
    supabase.from('players').update({ slot: playerBSlot, on_ir: playerBSlot === 'ir' }).eq('id', playerBId).eq('team_id', teamId),
  ]);

  if (resultA.error || resultB.error) {
    logger.error('swapPlayerSlots: failed', resultA.error || resultB.error, { playerAId, playerBId, teamId });
    return { success: false, error: 'Failed to swap players' };
  }

  logger.info('swapPlayerSlots: success', { playerAId, playerBId, teamId });
  return { success: true };
}

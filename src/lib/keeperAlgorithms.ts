import type { Player, RosterEntry, RosterSummary } from '../types';

/**
 * Derives the base keeper round for a player before stacking is applied
 */
export function baseKeeperRound(player: Player): number | null {
  // Handle rookies with draft info
  if (player.roster.isRookie && player.roster.rookieDraftInfo) {
    const { round, pick } = player.roster.rookieDraftInfo;

    if (round === 1) {
      if (pick >= 1 && pick <= 3) return 5;
      if (pick >= 4 && pick <= 6) return 6;
      if (pick >= 7 && pick <= 9) return 7;
      if (pick >= 10 && pick <= 12) return 8;
    }

    if (round === 2 || round === 3) return 14;
  }

  // Handle returning players with prior year keeper info
  if (player.keeper?.priorYearRound) {
    return Math.max(1, player.keeper.priorYearRound - 1);
  }

  return null; // Requires admin attention
}

interface StackingResult {
  entries: RosterEntry[];
  franchiseTags: number;
}

/**
 * Applies Bottom-of-Draft and Top-of-Draft stacking rules to keeper rounds
 *
 * Key Rules:
 * 1. Players with earlier base rounds have priority over later base rounds
 * 2. When multiple players have the same base round, they stack sequentially
 * 3. Franchise-tagged Round 1 keepers must go AFTER all higher base round players (2-14)
 * 4. Only one Round-1 keeper is free; extras need franchise tags ($15 each)
 */
export function stackKeeperRounds(entries: RosterEntry[]): StackingResult {
  // Only process KEEP entries with baseRound defined
  const keepers = entries.filter(
    (e) => e.decision === "KEEP" && e.baseRound !== undefined
  );

  // Separate Round 1 keepers from others
  const round1Keepers = keepers.filter((k) => k.baseRound === 1);
  const otherKeepers = keepers.filter((k) => k.baseRound !== 1);

  let franchiseTags = 0;
  const occupiedRounds = new Set<number>();

  // STEP 1: Handle Round 1 keepers (franchise tag logic)
  if (round1Keepers.length > 0) {
    // First Round 1 keeper is free and gets Round 1
    const [firstR1Keeper, ...extraR1Keepers] = round1Keepers;
    firstR1Keeper.keeperRound = 1;
    occupiedRounds.add(1);

    // Extra Round 1 keepers need franchise tags and will be placed AFTER all base round 2-14 players
    franchiseTags = extraR1Keepers.length;

    // STEP 2: Assign rounds to base round 2-14 keepers first (they have priority over franchise-tagged R1)
    // Sort by base round, then by order in original array (for same base round players)
    otherKeepers.sort((a, b) => a.baseRound! - b.baseRound!);

    for (const keeper of otherKeepers) {
      let targetRound = keeper.baseRound!;

      // Find next available round starting from their base round
      while (occupiedRounds.has(targetRound) && targetRound <= 14) {
        targetRound++;
      }

      if (targetRound <= 14) {
        keeper.keeperRound = targetRound;
        occupiedRounds.add(targetRound);
      } else {
        // Should not happen with max 8 keepers
        keeper.keeperRound = 14;
      }
    }

    // STEP 3: Now place franchise-tagged Round 1 keepers AFTER all other keepers
    for (const extraKeeper of extraR1Keepers) {
      let targetRound = 2; // Start from round 2

      // Find next available round after all base round 2+ keepers
      while (occupiedRounds.has(targetRound) && targetRound <= 14) {
        targetRound++;
      }

      if (targetRound <= 14) {
        extraKeeper.keeperRound = targetRound;
        occupiedRounds.add(targetRound);
      } else {
        // Edge case: all rounds are full
        extraKeeper.keeperRound = 14;
      }
    }
  } else {
    // No Round 1 keepers - just assign other keepers normally
    otherKeepers.sort((a, b) => a.baseRound! - b.baseRound!);

    for (const keeper of otherKeepers) {
      let targetRound = keeper.baseRound!;

      while (occupiedRounds.has(targetRound) && targetRound <= 14) {
        targetRound++;
      }

      if (targetRound <= 14) {
        keeper.keeperRound = targetRound;
        occupiedRounds.add(targetRound);
      } else {
        keeper.keeperRound = 14;
      }
    }
  }

  // Clear keeperRound for non-KEEP entries (REDSHIRT and INT_STASH don't use keeper rounds)
  entries.forEach((entry) => {
    if (entry.decision !== "KEEP") {
      entry.keeperRound = undefined;
    }
  });

  return { entries, franchiseTags };
}

interface ComputeSummaryParams {
  entries: RosterEntry[];
  allPlayers: Map<string, Player>;
  baseCap?: number;
  tradeDelta: number;
  penaltyStart?: number;
  penaltyRatePerM?: number;
  redshirtFee?: number;
  franchiseTagFee?: number;
  franchiseTags: number;
}

/**
 * Computes the roster summary including cap usage, penalties, and fees
 */
export function computeSummary(params: ComputeSummaryParams): RosterSummary {
  const {
    entries,
    allPlayers,
    baseCap = 210_000_000,
    tradeDelta,
    penaltyStart = 210_000_000,
    penaltyRatePerM = 2,
    redshirtFee = 10,
    franchiseTagFee = 15,
    franchiseTags,
  } = params;

  // Get kept, redshirted, and int stash player IDs
  const keptIds = entries
    .filter((e) => e.decision === "KEEP")
    .map((e) => e.playerId);

  const redshirtIds = entries
    .filter((e) => e.decision === "REDSHIRT")
    .map((e) => e.playerId);

  const intStashIds = entries
    .filter((e) => e.decision === "INT_STASH")
    .map((e) => e.playerId);

  // Calculate cap used (only KEEP decisions count)
  const capUsed = keptIds.reduce((sum, playerId) => {
    const player = allPlayers.get(playerId);
    return sum + (player?.salary || 0);
  }, 0);

  // Calculate effective cap (base + trade delta, clamped to 170M-250M)
  const capEffective = Math.max(
    170_000_000,
    Math.min(250_000_000, baseCap + tradeDelta)
  );

  // Calculate second apron penalty
  const overBy = Math.max(0, capUsed - penaltyStart);
  const overByM = Math.ceil(overBy / 1_000_000);
  const penaltyDues = overByM * penaltyRatePerM;

  // Calculate franchise tag dues
  const franchiseTagDues = franchiseTags * franchiseTagFee;

  // Calculate redshirt dues
  const redshirtDues = redshirtIds.length * redshirtFee;

  // Calculate first apron fee ($50 if over 170M)
  const firstApronFee = capUsed > 170_000_000 ? 50 : 0;

  // Total fees
  const totalFees = penaltyDues + franchiseTagDues + redshirtDues + firstApronFee;

  return {
    keepersCount: keptIds.length,
    redshirtsCount: redshirtIds.length,
    intStashCount: intStashIds.length,
    capUsed,
    capBase: baseCap,
    capTradeDelta: tradeDelta,
    capEffective,
    overSecondApronByM: overByM,
    penaltyDues,
    franchiseTags,
    franchiseTagDues,
    redshirtDues,
    firstApronFee,
    activationDues: 0, // Not calculated in MVP (future use)
    totalFees,
  };
}

/**
 * Validates a roster before submission
 */
export interface ValidationError {
  type: 'error' | 'warning';
  field: string;
  message: string;
  playerId?: string;
}

export function validateRoster(
  entries: RosterEntry[],
  allPlayers: Map<string, Player>,
  maxKeepers: number = 8
): ValidationError[] {
  const errors: ValidationError[] = [];

  const keepers = entries.filter((e) => e.decision === "KEEP");
  const redshirts = entries.filter((e) => e.decision === "REDSHIRT");
  const intStashes = entries.filter((e) => e.decision === "INT_STASH");

  // Check keeper count
  if (keepers.length > maxKeepers) {
    errors.push({
      type: 'error',
      field: 'keepersCount',
      message: `Cannot keep more than ${maxKeepers} players. You have ${keepers.length} keepers.`,
    });
  }

  // Check redshirt eligibility
  redshirts.forEach((entry) => {
    const player = allPlayers.get(entry.playerId);
    if (player && player.roster.rookieDraftInfo) {
      if (!player.roster.rookieDraftInfo.redshirtEligible) {
        errors.push({
          type: 'error',
          field: 'redshirtEligibility',
          message: `${player.name} is not eligible for redshirt.`,
          playerId: player.id,
        });
      }
    } else if (player && !player.roster.isRookie) {
      errors.push({
        type: 'error',
        field: 'redshirtEligibility',
        message: `${player.name} is not a rookie and cannot be redshirted.`,
        playerId: player.id,
      });
    }
  });

  // Check int stash eligibility
  intStashes.forEach((entry) => {
    const player = allPlayers.get(entry.playerId);
    if (player && player.roster.rookieDraftInfo) {
      if (!player.roster.rookieDraftInfo.intEligible) {
        errors.push({
          type: 'error',
          field: 'intStashEligibility',
          message: `${player.name} is not eligible for international stash.`,
          playerId: player.id,
        });
      }
    } else if (player && !player.roster.isInternationalStash) {
      errors.push({
        type: 'error',
        field: 'intStashEligibility',
        message: `${player.name} is not an international stash player.`,
        playerId: player.id,
      });
    }
  });

  // Check for unresolved round collisions
  const roundCounts = new Map<number, number>();
  keepers.forEach((keeper) => {
    if (keeper.keeperRound) {
      const count = roundCounts.get(keeper.keeperRound) || 0;
      roundCounts.set(keeper.keeperRound, count + 1);
    }
  });

  roundCounts.forEach((count, round) => {
    if (count > 1) {
      errors.push({
        type: 'error',
        field: 'roundCollisions',
        message: `Round ${round} has ${count} keepers. Please resolve using the Stacking Assistant.`,
      });
    }
  });

  // Check for keepers without assigned rounds
  keepers.forEach((keeper) => {
    const player = allPlayers.get(keeper.playerId);
    if (!keeper.keeperRound && player) {
      errors.push({
        type: 'warning',
        field: 'missingRounds',
        message: `${player.name} is marked as KEEP but has no keeper round assigned.`,
        playerId: player.id,
      });
    }
  });

  return errors;
}

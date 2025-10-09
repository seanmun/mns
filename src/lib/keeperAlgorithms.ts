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
 * Bottom-of-Draft: If multiple keepers share a round, assign unique rounds
 * working downward from Round 14 to 1
 *
 * Top-of-Draft: Only one Round-1 keeper is free. Additional Round-1 keepers
 * require franchise tags ($15 each) and are assigned to next available rounds
 */
export function stackKeeperRounds(entries: RosterEntry[]): StackingResult {
  // Only process KEEP entries with baseRound defined
  const keepers = entries.filter(
    (e) => e.decision === "KEEP" && e.baseRound !== undefined
  );

  // Track which rounds are occupied
  const occupiedRounds = new Set<number>();

  // Group keepers by their base round
  const roundGroups = new Map<number, RosterEntry[]>();
  keepers.forEach((keeper) => {
    const round = keeper.baseRound!;
    if (!roundGroups.has(round)) {
      roundGroups.set(round, []);
    }
    roundGroups.get(round)!.push(keeper);
  });

  // STACKING ALGORITHM (Process Rounds 1 → 14)
  // Process from top-of-draft to bottom to ensure higher-value keepers
  // maintain priority and don't get pushed behind lower-value keepers
  for (let round = 1; round <= 14; round++) {
    const group = roundGroups.get(round) || [];

    for (let i = 0; i < group.length; i++) {
      let targetRound = round;

      // Find next available round moving forward (towards Round 14)
      // First keeper in this round gets the original round, others stack forward
      // This ensures a Round 1 keeper never falls behind a Round 2+ keeper
      while (occupiedRounds.has(targetRound) && targetRound <= 14) {
        targetRound++;
      }

      if (targetRound <= 14) {
        group[i].keeperRound = targetRound;
        occupiedRounds.add(targetRound);
      } else {
        // All rounds 1-14 are full - shouldn't happen with max 8 keepers
        // Assign to Round 14 anyway (admin review needed)
        group[i].keeperRound = 14;
      }
    }
  }

  // TOP-OF-DRAFT STACKING (Round 1 special handling)
  // Only one Round-1 keeper is free; extras need franchise tags
  const round1Keepers = keepers.filter((k) => k.baseRound === 1);
  let franchiseTags = 0;

  if (round1Keepers.length > 1) {
    // First keeper stays at Round 1 (free)
    const [firstKeeper, ...extraKeepers] = round1Keepers;

    // Lock Round 1 for the first keeper
    occupiedRounds.clear();
    occupiedRounds.add(1);
    firstKeeper.keeperRound = 1;

    // Re-populate occupied rounds from all other keepers
    keepers.forEach((k) => {
      if (k !== firstKeeper && k.keeperRound && k.keeperRound !== 1) {
        occupiedRounds.add(k.keeperRound);
      }
    });

    // Move extra Round-1 keepers to next available rounds
    // Each requires a franchise tag
    for (const extraKeeper of extraKeepers) {
      let targetRound = 2;

      // Find next available round (2 → 14)
      while (occupiedRounds.has(targetRound) && targetRound <= 14) {
        targetRound++;
      }

      if (targetRound <= 14) {
        extraKeeper.keeperRound = targetRound;
        occupiedRounds.add(targetRound);
        franchiseTags++;
      } else {
        // Edge case: all rounds are full
        // Assign to Round 14 anyway (admin review needed)
        extraKeeper.keeperRound = 14;
        franchiseTags++;
      }
    }
  }

  // Clear keeperRound for non-KEEP entries
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

  // Get kept and redshirted player IDs
  const keptIds = entries
    .filter((e) => e.decision === "KEEP")
    .map((e) => e.playerId);

  const redshirtIds = entries
    .filter((e) => e.decision === "REDSHIRT")
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

  // Total fees
  const totalFees = penaltyDues + franchiseTagDues + redshirtDues;

  return {
    keepersCount: keptIds.length,
    redshirtsCount: redshirtIds.length,
    capUsed,
    capBase: baseCap,
    capTradeDelta: tradeDelta,
    capEffective,
    overSecondApronByM: overByM,
    penaltyDues,
    franchiseTags,
    franchiseTagDues,
    redshirtDues,
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

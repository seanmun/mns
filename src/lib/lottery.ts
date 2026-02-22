import type { Prospect } from '../types';

/**
 * NBA Draft Lottery engine — based on TrustThePick.com rules.
 *
 * Uses 14 ping-pong balls creating 1,001 four-number combinations.
 * One combination (11-12-13-14) is excluded, leaving 1,000 to distribute.
 * For leagues with fewer than 14 teams, use the first N entries and
 * redraw if an unassigned combination is drawn.
 */

// Official NBA lottery combination counts (worst → best record)
const NBA_LOTTERY_COMBINATIONS = [
  140, // 1st worst — 14.0%
  140, // 2nd worst — 14.0%
  140, // 3rd worst — 14.0%
  125, // 4th worst — 12.5%
  105, // 5th worst — 10.5%
   90, // 6th worst —  9.0%
   75, // 7th worst —  7.5%
   60, // 8th worst —  6.0%
   45, // 9th worst —  4.5%
   30, // 10th worst — 3.0%
   20, // 11th worst — 2.0%
   15, // 12th worst — 1.5%
   10, // 13th worst — 1.0%
    5, // 14th worst — 0.5%
];

export interface TeamStanding {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
}

export interface LotteryOdds {
  team: TeamStanding;
  combinations: number;
  pctFirstPick: number;
}

export interface LotteryResult {
  pick: number;
  teamId: string;
  teamName: string;
  isLotteryWinner: boolean; // true if picked in the lottery draw (picks 1-4)
  originalPosition: number; // where they were ranked before lottery (1 = worst)
  movement: number; // positive = moved up, negative = dropped
}

export interface MockPick {
  pick: number;
  teamId: string;
  teamName: string;
  prospect: Prospect;
  wasExpected: boolean; // true if prospect went at their consensus rank
}

/**
 * Determine how many prize payout spots exist (teams "in the money").
 * Based on the prize zone logic from LeagueHome.
 */
export function getPrizeSpots(totalPrizePool: number, totalCollected: number): number {
  if (totalPrizePool < totalCollected) {
    // Boiler Room — pool declined
    return totalPrizePool < 300 ? 1 : 2;
  }
  if (totalPrizePool >= 10000) {
    // Bernie Zone — top 3 paid (4th-12th splits are too thin to count as "in the money")
    return 3;
  }
  // Gordon Gekko Zone — top 3 paid
  return 3;
}

/**
 * Get lottery-eligible teams (exclude "in the money" teams).
 * Takes teams sorted best-to-worst by record.
 * Returns lottery teams sorted WORST-to-best (for lottery assignment).
 */
export function getLotteryTeams(
  rankedTeams: TeamStanding[],
  prizeSpots: number
): { lotteryTeams: TeamStanding[]; moneyTeams: TeamStanding[] } {
  // rankedTeams is sorted best-to-worst
  const moneyTeams = rankedTeams.slice(0, prizeSpots);
  const lotteryTeams = rankedTeams.slice(prizeSpots).reverse(); // worst first
  return { lotteryTeams, moneyTeams };
}

/**
 * Get lottery odds for each team.
 */
export function getLotteryOdds(lotteryTeams: TeamStanding[]): LotteryOdds[] {
  const n = Math.min(lotteryTeams.length, NBA_LOTTERY_COMBINATIONS.length);
  const combos = NBA_LOTTERY_COMBINATIONS.slice(0, n);
  const totalCombos = combos.reduce((a, b) => a + b, 0);

  return lotteryTeams.slice(0, n).map((team, i) => ({
    team,
    combinations: combos[i],
    pctFirstPick: (combos[i] / totalCombos) * 100,
  }));
}

/**
 * Run the NBA Draft Lottery.
 * Draws 4 picks (or fewer if < 4 teams), assigns remaining lottery teams by inverse record,
 * then appends money teams at the end (worst money team first, best team picks last).
 */
export function runLottery(
  lotteryTeams: TeamStanding[],
  moneyTeams: TeamStanding[] = []
): LotteryResult[] {
  const n = Math.min(lotteryTeams.length, NBA_LOTTERY_COMBINATIONS.length);
  const combos = NBA_LOTTERY_COMBINATIONS.slice(0, n);
  const totalCombos = combos.reduce((a, b) => a + b, 0);

  const lotteryDraws = Math.min(4, n);
  const drawnTeamIndices = new Set<number>();
  const results: LotteryResult[] = [];

  // Draw lottery picks (1 through 4)
  for (let pick = 1; pick <= lotteryDraws; pick++) {
    let drawn = -1;
    while (drawn === -1 || drawnTeamIndices.has(drawn)) {
      const rand = Math.floor(Math.random() * totalCombos);
      let cumulative = 0;
      for (let i = 0; i < n; i++) {
        cumulative += combos[i];
        if (rand < cumulative) {
          drawn = i;
          break;
        }
      }
    }
    drawnTeamIndices.add(drawn);
    const team = lotteryTeams[drawn];
    results.push({
      pick,
      teamId: team.teamId,
      teamName: team.teamName,
      isLotteryWinner: true,
      originalPosition: drawn + 1,
      movement: (drawn + 1) - pick,
    });
  }

  // Remaining lottery picks assigned by inverse record (worst first, skipping drawn teams)
  let pickNum = lotteryDraws + 1;
  for (let i = 0; i < n; i++) {
    if (drawnTeamIndices.has(i)) continue;
    const team = lotteryTeams[i];
    results.push({
      pick: pickNum,
      teamId: team.teamId,
      teamName: team.teamName,
      isLotteryWinner: false,
      originalPosition: i + 1,
      movement: (i + 1) - pickNum,
    });
    pickNum++;
  }

  // Money teams pick last, ordered worst-to-best (reverse of the best-first moneyTeams array)
  const moneyReversed = [...moneyTeams].reverse();
  for (const team of moneyReversed) {
    results.push({
      pick: pickNum,
      teamId: team.teamId,
      teamName: team.teamName,
      isLotteryWinner: false,
      originalPosition: pickNum, // expected position = their pick
      movement: 0,
    });
    pickNum++;
  }

  return results.sort((a, b) => a.pick - b.pick);
}

/**
 * Sigma controls how much variance each pick slot has.
 * Lower sigma = tighter (best available almost always picked).
 * Higher sigma = more chaos (reaches and slides).
 *
 * Pick 1 (sigma≈0.6): best available ~80%, ±1 spot ~95%
 * Pick 6 (sigma≈1.3): best available ~45%, top 2 ~77%
 * Pick 12 (sigma≈2.5): much flatter, real variance
 */
function pickSigma(slot: number, total: number): number {
  if (total <= 1) return 0.5;
  const minSigma = 0.6;
  const maxSigma = 2.5;
  const t = (slot - 1) / (total - 1);
  return minSigma + t * (maxSigma - minSigma);
}

/**
 * Run the mock draft, assigning prospects to picks with weighted randomness.
 *
 * Uses a Gaussian distribution based on position in the remaining prospect pool.
 * The best available prospect always has the highest weight. Top picks are very
 * stable (a #2 prospect essentially can't fall past pick 4-5), while later picks
 * have realistic variance with reaches and slides.
 */
export function runMockDraft(
  pickOrder: LotteryResult[],
  prospects: Prospect[]
): MockPick[] {
  const numPicks = pickOrder.length;
  // Take only the top N prospects (ranked by their consensus rank)
  const available = [...prospects]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, Math.max(numPicks, prospects.length));

  const remaining = [...available];
  const results: MockPick[] = [];

  for (let i = 0; i < numPicks && remaining.length > 0; i++) {
    const slot = i + 1;

    // Sort remaining by rank (best first)
    remaining.sort((a, b) => a.rank - b.rank);

    const sigma = pickSigma(slot, numPicks);

    // Weight by position in remaining pool (position 0 = best available = highest weight)
    // Gaussian: e^(-(pos^2) / (2 * sigma^2))
    const twoSigmaSq = 2 * sigma * sigma;
    const weights = remaining.map((_, idx) =>
      Math.exp(-(idx * idx) / twoSigmaSq)
    );

    // Normalize weights
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalized = weights.map(w => w / totalWeight);

    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;
    let selectedIdx = 0;
    for (let j = 0; j < normalized.length; j++) {
      cumulative += normalized[j];
      if (rand < cumulative) {
        selectedIdx = j;
        break;
      }
    }

    const selected = remaining[selectedIdx];
    results.push({
      pick: pickOrder[i].pick,
      teamId: pickOrder[i].teamId,
      teamName: pickOrder[i].teamName,
      prospect: selected,
      wasExpected: selected.rank === slot,
    });

    remaining.splice(selectedIdx, 1);
  }

  return results;
}

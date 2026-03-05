import { stackKeeperRounds, computeSummary } from './keeperAlgorithms';
import type { RosterEntry, Player, RosterSummary, Decision, LeagueCapSettings, LeagueFeeSettings } from '../types';
import { NBA_CAP_DEFAULTS, NBA_FEE_DEFAULTS } from '../types';

export interface TradeAssetForCap {
  type: 'keeper' | 'redshirt' | 'int_stash' | 'rookie_pick';
  id: string;
  salary: number;
  fromTeamId: string;
  toTeamId: string;
}

export interface TeamCapImpact {
  teamId: string;
  teamName: string;
  before: RosterSummary;
  after: RosterSummary;
  salaryIn: number;
  salaryOut: number;
  warnings: string[];
}

/**
 * Compute cap impact of a proposed trade for all involved teams.
 * Pure function — no side effects, no DB calls.
 */
export function computeTradeCapImpact(params: {
  assets: TradeAssetForCap[];
  rosters: Map<string, RosterEntry[]>;
  players: Map<string, Player>;
  tradeDelta: Map<string, number>;
  teamNames: Map<string, string>;
  cap?: LeagueCapSettings;
  fees?: LeagueFeeSettings;
}): TeamCapImpact[] {
  const { assets, rosters, players, tradeDelta, teamNames, cap, fees } = params;

  // Find all involved teams
  const involvedTeamIds = new Set<string>();
  for (const asset of assets) {
    involvedTeamIds.add(asset.fromTeamId);
    involvedTeamIds.add(asset.toTeamId);
  }

  const results: TeamCapImpact[] = [];

  for (const teamId of involvedTeamIds) {
    const teamName = teamNames.get(teamId) || teamId;
    const currentEntries = rosters.get(teamId) || [];
    const delta = tradeDelta.get(teamId) || 0;

    // Compute BEFORE summary
    const beforeEntries = [...currentEntries];
    const beforeStacked = stackKeeperRounds(
      beforeEntries.filter(e => e.decision === 'KEEP')
    );
    const beforeSummary = computeSummary({
      entries: beforeEntries,
      allPlayers: players,
      tradeDelta: delta,
      franchiseTags: beforeStacked.franchiseTags,
    });

    // Build AFTER entries: remove outgoing, add incoming
    const outgoingIds = new Set(
      assets.filter(a => a.fromTeamId === teamId && a.type !== 'rookie_pick')
        .map(a => a.id)
    );
    const incoming = assets.filter(a => a.toTeamId === teamId && a.type !== 'rookie_pick');

    const afterEntries = currentEntries.filter(e => !outgoingIds.has(e.playerId));

    // Add incoming players with appropriate decision
    for (const asset of incoming) {
      const decision: Decision =
        asset.type === 'redshirt' ? 'REDSHIRT' :
        asset.type === 'int_stash' ? 'INT_STASH' :
        'KEEP';

      afterEntries.push({
        playerId: asset.id,
        decision,
        baseRound: 13,
      });
    }

    const afterStacked = stackKeeperRounds(
      afterEntries.filter(e => e.decision === 'KEEP')
    );
    const afterSummary = computeSummary({
      entries: afterEntries,
      allPlayers: players,
      tradeDelta: delta,
      franchiseTags: afterStacked.franchiseTags,
    });

    // Compute salary movement
    const salaryOut = assets
      .filter(a => a.fromTeamId === teamId && a.type !== 'rookie_pick')
      .reduce((sum, a) => sum + a.salary, 0);
    const salaryIn = assets
      .filter(a => a.toTeamId === teamId && a.type !== 'rookie_pick')
      .reduce((sum, a) => sum + a.salary, 0);

    // Generate warnings using league-specific cap/fee settings
    const warnings: string[] = [];
    const firstApron = cap?.firstApron ?? NBA_CAP_DEFAULTS.firstApron;
    const secondApron = cap?.secondApron ?? NBA_CAP_DEFAULTS.secondApron;
    const hardCap = cap?.max ?? NBA_CAP_DEFAULTS.max;
    const apronFee = fees?.firstApronFee ?? NBA_FEE_DEFAULTS.firstApronFee;
    const penaltyRate = fees?.penaltyRatePerM ?? NBA_FEE_DEFAULTS.penaltyRatePerM;
    const hasAprons = firstApron > 0 && secondApron > 0;

    const fmtCap = (v: number) => `$${Math.round(v / 1_000_000)}M`;

    if (hasAprons) {
      if (afterSummary.capUsed > firstApron && beforeSummary.capUsed <= firstApron) {
        warnings.push(`Crosses first apron (${fmtCap(firstApron)}) — $${apronFee} one-time fee`);
      }
      if (afterSummary.capUsed > secondApron && beforeSummary.capUsed <= secondApron) {
        warnings.push(`Crosses second apron (${fmtCap(secondApron)}) — $${penaltyRate}/M penalty applies`);
      }
      if (afterSummary.capUsed > secondApron && beforeSummary.capUsed > secondApron) {
        const beforeOver = Math.ceil((beforeSummary.capUsed - secondApron) / 1_000_000);
        const afterOver = Math.ceil((afterSummary.capUsed - secondApron) / 1_000_000);
        if (afterOver > beforeOver) {
          warnings.push(`Increases second apron penalty from $${beforeOver * penaltyRate} to $${afterOver * penaltyRate}`);
        }
      }
    }
    if (afterSummary.capUsed > hardCap) {
      warnings.push(`Exceeds hard cap ceiling (${fmtCap(hardCap)})`);
    }

    results.push({
      teamId,
      teamName,
      before: beforeSummary,
      after: afterSummary,
      salaryIn,
      salaryOut,
      warnings,
    });
  }

  return results;
}

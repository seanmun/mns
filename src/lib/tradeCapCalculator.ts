import { stackKeeperRounds, computeSummary } from './keeperAlgorithms';
import type { RosterEntry, Player, RosterSummary, Decision } from '../types';

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
}): TeamCapImpact[] {
  const { assets, rosters, players, tradeDelta, teamNames } = params;

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

    // Generate warnings
    const warnings: string[] = [];
    const FIRST_APRON = 195_000_000;
    const SECOND_APRON = 225_000_000;

    if (afterSummary.capUsed > FIRST_APRON && beforeSummary.capUsed <= FIRST_APRON) {
      warnings.push('Crosses first apron ($195M) — $50 one-time fee');
    }
    if (afterSummary.capUsed > SECOND_APRON && beforeSummary.capUsed <= SECOND_APRON) {
      warnings.push(`Crosses second apron ($225M) — $2/M penalty applies`);
    }
    if (afterSummary.capUsed > SECOND_APRON && beforeSummary.capUsed > SECOND_APRON) {
      const beforeOver = Math.ceil((beforeSummary.capUsed - SECOND_APRON) / 1_000_000);
      const afterOver = Math.ceil((afterSummary.capUsed - SECOND_APRON) / 1_000_000);
      if (afterOver > beforeOver) {
        warnings.push(`Increases second apron penalty from $${beforeOver * 2} to $${afterOver * 2}`);
      }
    }
    if (afterSummary.capUsed > 255_000_000) {
      warnings.push('Exceeds hard cap ceiling ($255M)');
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

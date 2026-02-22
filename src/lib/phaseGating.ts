import type { LeaguePhase } from '../types';
import { LEAGUE_PHASE_ORDER } from '../types';

export function isPhaseComplete(current: LeaguePhase | undefined, phase: LeaguePhase): boolean {
  if (!current) return false;
  return LEAGUE_PHASE_ORDER.indexOf(current) > LEAGUE_PHASE_ORDER.indexOf(phase);
}

export function isPhaseActive(current: LeaguePhase | undefined, phase: LeaguePhase): boolean {
  return current === phase;
}

export function getNextPhase(current: LeaguePhase): LeaguePhase | null {
  const idx = LEAGUE_PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx === LEAGUE_PHASE_ORDER.length - 1) return null;
  return LEAGUE_PHASE_ORDER[idx + 1];
}

export type Feature =
  | 'keeper_editing'
  | 'draft_board'
  | 'roster_moves'
  | 'free_agents'
  | 'wagers'
  | 'rookie_draft'
  | 'trade_proposals';

const FEATURE_PHASES: Record<Feature, LeaguePhase[]> = {
  keeper_editing: ['keeper_season'],
  draft_board: ['draft'],
  roster_moves: ['regular_season', 'playoffs'],
  free_agents: ['regular_season', 'playoffs'],
  wagers: ['keeper_season', 'draft', 'regular_season', 'playoffs', 'champion', 'rookie_draft'],
  rookie_draft: ['rookie_draft'],
  trade_proposals: ['keeper_season', 'draft', 'regular_season', 'champion', 'rookie_draft'],
};

export function isFeatureEnabled(phase: LeaguePhase | undefined, feature: Feature): boolean {
  if (!phase) return false;
  return FEATURE_PHASES[feature].includes(phase);
}

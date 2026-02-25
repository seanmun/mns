import type {
  League, Team, Player, RosterDoc, Matchup, TeamFees, Draft,
  RegularSeasonRoster, WatchList, ProjectedStats, PreviousStats,
  Wager, TradeProposal, TradeProposalResponse, DailyLineup, NBAGame,
  PickAssignment, KeeperFees, DraftHistory, Prospect,
} from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';

// ─── League ───────────────────────────────────────────────────────────────────

export function mapLeague(row: any): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines || {},
    cap: row.cap || {},
    schedule: row.schedule || undefined,
    keepersLocked: row.keepers_locked || false,
    draftStatus: row.draft_status || undefined,
    seasonStatus: row.season_status || undefined,
    seasonStartedAt: row.season_started_at ? new Date(row.season_started_at).getTime() : undefined,
    seasonStartedBy: row.season_started_by || undefined,
    commissionerId: row.commissioner_id || undefined,
    leaguePhase: row.league_phase || 'keeper_season',
    scoringMode: row.scoring_mode || 'category_record',
    roster: row.roster || DEFAULT_ROSTER_SETTINGS,
  };
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export function mapTeam(row: any): Team {
  return {
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    abbrev: row.abbrev,
    owners: row.owners || [],
    ownerNames: row.owner_names || [],
    telegramUsername: row.telegram_username || undefined,
    capAdjustments: row.cap_adjustments || { tradeDelta: 0 },
    settings: row.settings || { maxKeepers: 8 },
    banners: row.banners || [],
  };
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function mapPlayer(row: any): Player {
  return {
    id: row.id,
    fantraxId: row.fantrax_id,
    name: row.name,
    position: row.position,
    salary: row.salary,
    nbaTeam: row.nba_team,
    slot: row.slot || 'active',
    roster: {
      leagueId: row.league_id,
      teamId: row.team_id,
      onIR: row.on_ir,
      isRookie: row.is_rookie,
      isInternationalStash: row.is_international_stash,
      intEligible: row.int_eligible,
      rookieDraftInfo: row.rookie_draft_info || undefined,
    },
    keeper: row.keeper_prior_year_round != null || row.keeper_derived_base_round != null
      ? {
          priorYearRound: row.keeper_prior_year_round || undefined,
          derivedBaseRound: row.keeper_derived_base_round || undefined,
        }
      : undefined,
  };
}

// ─── Roster ───────────────────────────────────────────────────────────────────

export function mapRoster(row: any): RosterDoc {
  return {
    id: row.id,
    teamId: row.team_id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    entries: row.entries || [],
    summary: row.summary || {},
    status: row.status,
    savedScenarios: row.saved_scenarios || [],
  };
}

// ─── Draft ────────────────────────────────────────────────────────────────────

export function mapDraft(row: any): Draft {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    status: row.status,
    draftOrder: row.draft_order || [],
    currentPick: row.current_pick || undefined,
    picks: row.picks || [],
    settings: row.settings || { allowAdminOverride: true, isTestDraft: false },
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
  };
}

// ─── Matchup ──────────────────────────────────────────────────────────────────

export function mapMatchup(row: any): Matchup {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    matchupWeek: row.matchup_week,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score != null ? Number(row.home_score) : null,
    awayScore: row.away_score != null ? Number(row.away_score) : null,
  };
}

// ─── Team Fees ────────────────────────────────────────────────────────────────

export function mapTeamFees(row: any): TeamFees {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    seasonYear: row.season_year,
    franchiseTagFees: Number(row.franchise_tag_fees) || 0,
    redshirtFees: Number(row.redshirt_fees) || 0,
    firstApronFee: Number(row.first_apron_fee) || 0,
    secondApronPenalty: Number(row.second_apron_penalty) || 0,
    unredshirtFees: Number(row.unredshirt_fees) || 0,
    feesLocked: row.fees_locked || false,
    lockedAt: row.locked_at ? new Date(row.locked_at).getTime() : undefined,
    totalFees: Number(row.total_fees) || 0,
    feeTransactions: row.fee_transactions || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Regular Season Roster ────────────────────────────────────────────────────

export function mapRegularSeasonRoster(row: any): RegularSeasonRoster {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    seasonYear: row.season_year,
    activeRoster: row.active_roster || [],
    irSlots: row.ir_slots || [],
    redshirtPlayers: row.redshirt_players || [],
    internationalPlayers: row.international_players || [],
    benchedPlayers: row.benched_players || [],
    isLegalRoster: row.is_legal_roster ?? true,
    lastUpdated: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    updatedBy: row.updated_by || '',
  };
}

// ─── Watch List ───────────────────────────────────────────────────────────────

export function mapWatchList(row: any): WatchList {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    playerIds: row.player_ids || [],
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// ─── Projected Stats ──────────────────────────────────────────────────────────

export function mapProjectedStats(row: any): ProjectedStats {
  return {
    fantraxId: row.fantrax_id,
    name: row.name,
    nbaTeam: row.nba_team,
    position: row.position,
    rkOv: Number(row.rk_ov) || 0,
    age: Number(row.age) || 0,
    salary: Number(row.salary) || 0,
    score: Number(row.score) || 0,
    adp: Number(row.adp) || 0,
    fgPercent: Number(row.fg_percent) || 0,
    threePointMade: Number(row.three_point_made) || 0,
    ftPercent: Number(row.ft_percent) || 0,
    points: Number(row.points) || 0,
    rebounds: Number(row.rebounds) || 0,
    assists: Number(row.assists) || 0,
    steals: Number(row.steals) || 0,
    blocks: Number(row.blocks) || 0,
    assistToTurnover: Number(row.assist_to_turnover) || 0,
    salaryScore: Number(row.salary_score) || 0,
    seasonYear: row.season_year || '',
  };
}

// ─── Previous Stats ───────────────────────────────────────────────────────────

export function mapPreviousStats(row: any): PreviousStats {
  return {
    fantraxId: row.fantrax_id,
    name: row.name,
    nbaTeam: row.nba_team,
    position: row.position,
    fgPercent: Number(row.fg_percent) || 0,
    threePointMade: Number(row.three_point_made) || 0,
    ftPercent: Number(row.ft_percent) || 0,
    points: Number(row.points) || 0,
    rebounds: Number(row.rebounds) || 0,
    assists: Number(row.assists) || 0,
    steals: Number(row.steals) || 0,
    blocks: Number(row.blocks) || 0,
    assistToTurnover: Number(row.assist_to_turnover) || 0,
    seasonYear: row.season_year || '',
  };
}

// ─── Wager ────────────────────────────────────────────────────────────────────

export function mapWager(row: any): Wager {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    proposerId: row.proposer_id,
    proposerName: row.proposer_name,
    opponentId: row.opponent_id,
    opponentName: row.opponent_name,
    description: row.description,
    amount: Number(row.amount) || 0,
    settlementDate: row.settlement_date,
    status: row.status,
    proposedAt: new Date(row.proposed_at).getTime(),
    proposedBy: row.proposed_by,
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
    respondedBy: row.responded_by || undefined,
    settledAt: row.settled_at ? new Date(row.settled_at).getTime() : undefined,
    winnerId: row.winner_id || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Trade Proposal ───────────────────────────────────────────────────────────

export function mapTradeProposal(row: any): TradeProposal {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    proposedByTeamId: row.proposed_by_team_id,
    proposedByEmail: row.proposed_by_email,
    status: row.status,
    assets: row.assets || [],
    involvedTeamIds: row.involved_team_ids || [],
    note: row.note || undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
    executedAt: row.executed_at ? new Date(row.executed_at).getTime() : undefined,
    executedBy: row.executed_by || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function mapTradeResponse(row: any): TradeProposalResponse {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    teamId: row.team_id,
    teamName: row.team_name,
    status: row.status,
    respondedBy: row.responded_by || undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Daily Lineup ─────────────────────────────────────────────────────────────

export function mapDailyLineup(row: any): DailyLineup {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    gameDate: row.game_date,
    activePlayerIds: row.active_player_ids || [],
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    updatedBy: row.updated_by || '',
  };
}

// ─── NBA Game ─────────────────────────────────────────────────────────────────

export function mapNBAGame(row: any): NBAGame {
  return {
    id: row.id,
    seasonYear: row.season_year,
    gameDate: row.game_date,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    isCupGame: row.is_cup_game || false,
    notes: row.notes || null,
  };
}

// ─── Pick Assignment ──────────────────────────────────────────────────────────

export function mapPickAssignment(row: any): PickAssignment {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    round: row.round,
    pickInRound: row.pick_in_round,
    overallPick: row.overall_pick,
    currentTeamId: row.current_team_id,
    originalTeamId: row.original_team_id,
    originalTeamName: row.original_team_name,
    originalTeamAbbrev: row.original_team_abbrev,
    playerId: row.player_id || null,
    playerName: row.player_name || null,
    isKeeperSlot: row.is_keeper_slot || false,
    pickedAt: row.picked_at ? new Date(row.picked_at).getTime() : null,
    pickedBy: row.picked_by || null,
    wasTraded: row.was_traded || false,
    tradeHistory: row.trade_history || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Keeper Fees ──────────────────────────────────────────────────────────────

export function mapKeeperFees(row: any): KeeperFees {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamId: row.team_id,
    seasonYear: row.season_year,
    franchiseTagFees: Number(row.franchise_tag_fees) || 0,
    redshirtFees: Number(row.redshirt_fees) || 0,
    franchiseTagCount: Number(row.franchise_tag_count) || 0,
    redshirtCount: Number(row.redshirt_count) || 0,
    lockedAt: new Date(row.locked_at).getTime(),
    lockedBy: row.locked_by,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Draft History ────────────────────────────────────────────────────────────

export function mapDraftHistory(row: any): DraftHistory {
  return {
    id: row.id,
    leagueId: row.league_id,
    seasonYear: row.season_year,
    picks: row.picks || [],
    keepers: row.keepers || [],
    redshirtPlayers: row.redshirt_players || [],
    internationalPlayers: row.international_players || [],
    completedAt: new Date(row.completed_at).getTime(),
    completedBy: row.completed_by,
  };
}

// ─── Prospect ─────────────────────────────────────────────────────────────────

export function mapProspect(row: any): Prospect {
  return {
    id: row.id,
    rank: row.rank,
    player: row.player,
    school: row.school,
    year: row.year,
    position: row.position,
    positionRank: row.position_rank,
    height: row.height,
    weight: row.weight,
    age: row.age || undefined,
    hometown: row.hometown || undefined,
    highSchool: row.high_school || undefined,
    draftYear: row.draft_year || undefined,
    draftProjection: row.draft_projection || undefined,
    scoutingReport: row.scouting_report || undefined,
    strengths: row.strengths || undefined,
    weaknesses: row.weaknesses || undefined,
    playerComparison: row.player_comparison || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

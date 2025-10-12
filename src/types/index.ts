// Core decision type
export type Decision = "KEEP" | "DROP" | "REDSHIRT" | "INT_STASH";
export type RosterStatus = "draft" | "submitted" | "adminLocked";

// League configuration
export interface LeagueCapSettings {
  floor: number;           // 170M
  base: number;            // 210M
  tradeLimit: number;      // ±40M
  max: number;             // 250M
  penaltyStart: number;    // 210M
  penaltyRatePerM: number; // $2 per $1M
}

export interface LeagueDeadlines {
  keepersLockAt: string;   // ISO timestamp
  redshirtLockAt: string;  // ISO timestamp
  draftAt: string;         // ISO timestamp
}

export interface League {
  id: string;
  name: string;
  seasonYear: number;
  deadlines: LeagueDeadlines;
  cap: LeagueCapSettings;
}

// Team
export interface TeamCapAdjustments {
  tradeDelta: number;  // -40M to +40M
}

export interface Team {
  id: string;
  leagueId: string;
  name: string;
  abbrev: string;
  owners: string[];  // email addresses
  ownerNames?: string[];  // owner display names
  capAdjustments: TeamCapAdjustments;
  settings: {
    maxKeepers: number;  // typically 8
  };
  banners?: number[];  // Championship years (e.g., [2024, 2023])
}

// Player
export interface RookieDraftInfo {
  round: 1 | 2 | 3;
  pick: number;  // 1-12
  redshirtEligible: boolean;
  redshirtedLastYear?: boolean;
  intEligible: boolean;
}

export interface PlayerRoster {
  leagueId: string;
  teamId: string | null;
  onIR: boolean;
  isRookie: boolean;
  isInternationalStash: boolean;
  rookieDraftInfo?: RookieDraftInfo;
}

export interface PlayerKeeper {
  priorYearRound?: number;     // 1-14
  derivedBaseRound?: number;   // 1-14, computed from rules
}

export interface Player {
  id: string;
  fantraxId: string;
  name: string;
  position: string;
  salary: number;
  nbaTeam: string;
  roster: PlayerRoster;
  keeper?: PlayerKeeper;
}

// Roster
export interface RosterEntry {
  playerId: string;
  decision: Decision;
  locked?: boolean;
  keeperRound?: number;  // final after stacking (1-14)
  baseRound?: number;    // pre-stacking (1-14)
  priority?: number;     // user-defined priority for same base round (lower = earlier)
  notes?: string;
}

export interface RosterSummary {
  keepersCount: number;
  redshirtsCount: number;
  intStashCount: number;
  capUsed: number;
  capBase: number;
  capTradeDelta: number;
  capEffective: number;         // base + tradeDelta (clamped 170-250M)
  overSecondApronByM: number;   // max(0, (capUsed - 210M)/1M)
  penaltyDues: number;          // ceil(overByM) * 2
  franchiseTags: number;
  franchiseTagDues: number;     // $15 * tags
  redshirtDues: number;         // $10 * count
  firstApronFee: number;        // $50 if over 170M
  activationDues: number;       // future charges (not applied now)
  totalFees: number;            // sum of all dues
}

export interface SavedScenario {
  scenarioId: string;
  name: string;
  timestamp: number;
  savedBy?: string;  // email of user who saved this scenario
  entries: RosterEntry[];
  summary: RosterSummary;
}

export interface RosterDoc {
  id: string;  // {leagueId}_{teamId}
  teamId: string;
  leagueId: string;
  seasonYear: number;
  entries: RosterEntry[];
  summary: RosterSummary;
  status: RosterStatus;
  savedScenarios?: SavedScenario[];
}

// Constants
export const CAP_CONSTANTS = {
  FLOOR: 170_000_000,
  BASE: 210_000_000,
  TRADE_LIMIT: 40_000_000,
  MAX: 250_000_000,
  FIRST_APRON: 170_000_000,
  SECOND_APRON: 210_000_000,
  FIRST_APRON_FEE: 50,
  PENALTY_START: 210_000_000,
  PENALTY_RATE_PER_M: 2,
  REDSHIRT_FEE: 10,
  FRANCHISE_TAG_FEE: 15,
  IN_SEASON_ACTIVATION_FEE: 25,
} as const;

// CSV Import types
export interface CSVPlayerRow {
  name: string;
  fantraxId: string;
  position: string;
  salary: number;
  teamOwnerEmail?: string;
  keeperPriorRound?: number;
  rookieRound?: number;
  rookiePick?: number;
  isInternational?: boolean;
  onIR?: boolean;
}

// Projected Stats
export interface ProjectedStats {
  fantraxId: string;      // Document ID (matches player.fantraxId)
  name: string;
  nbaTeam: string;
  position: string;
  rkOv: number;           // Overall rank
  age: number;
  salary: number;
  score: number;          // Fantasy score
  adp: number;            // ADP
  fgPercent: number;      // FG%
  threePointMade: number; // 3PM
  ftPercent: number;      // FT%
  points: number;         // PTS
  rebounds: number;       // REB
  assists: number;        // AST
  steals: number;         // ST
  blocks: number;         // BLK
  assistToTurnover: number; // A/TO
  salaryScore: number;    // Points per million (PPM)
  seasonYear: string;     // "2025-26"
}

// Previous Season Stats (2024-25)
export interface PreviousStats {
  fantraxId: string;      // Document ID (matches player.fantraxId)
  name: string;
  nbaTeam: string;
  position: string;
  fgPercent: number;      // FG%
  threePointMade: number; // 3PM
  ftPercent: number;      // FT%
  points: number;         // PTS
  rebounds: number;       // REB
  assists: number;        // AST
  steals: number;         // ST
  blocks: number;         // BLK
  assistToTurnover: number; // A/TO
  seasonYear: string;     // "2024-25"
}

// User roles
export type UserRole = "owner" | "admin";

export interface UserClaims {
  role: UserRole;
  leagueIds: string[];
  teamIds: string[];
}

// Core decision type
export type Decision = "KEEP" | "DROP" | "REDSHIRT" | "INT_STASH";
export type RosterStatus = "draft" | "submitted" | "adminLocked";

// League configuration
export interface LeagueCapSettings {
  floor: number;           // 170M
  base: number;            // 225M (second apron is the base cap)
  tradeLimit: number;      // ±40M
  max: number;             // 255M
  firstApron: number;      // 195M (triggers $50 fee)
  secondApron: number;     // 225M (base cap, triggers $2/M penalty if exceeded)
  penaltyStart: number;    // 225M (second apron)
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
  keepersLocked?: boolean;  // When true, rosters are locked and visible to all
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
  telegramUsername?: string;  // Telegram @username for draft notifications
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
}

export interface PlayerRoster {
  leagueId: string;
  teamId: string | null;
  onIR: boolean;
  isRookie: boolean;
  isInternationalStash: boolean;
  intEligible: boolean;
  rookieDraftInfo?: RookieDraftInfo;
}

export interface PlayerKeeper {
  priorYearRound?: number;     // 1-13
  derivedBaseRound?: number;   // 1-13, computed from rules
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
  keeperRound?: number;  // final after stacking (1-13)
  baseRound?: number;    // pre-stacking (1-13)
  priority?: number;     // user-defined priority for same base round (lower = earlier)
  notes?: string;
}

export interface RosterSummary {
  keepersCount: number;
  draftedCount: number;         // players drafted in live draft
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
  id: string;  // {leagueId}_{teamId}_{seasonYear} (e.g., mns2026_lakers_2025)
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
  BASE: 225_000_000,  // Second apron is the base cap
  TRADE_LIMIT: 40_000_000,
  MAX: 255_000_000,
  FIRST_APRON: 195_000_000,
  SECOND_APRON: 225_000_000,
  FIRST_APRON_FEE: 50,
  PENALTY_START: 225_000_000,
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

// Watchlist (team-based, shared by all co-owners)
export interface WatchList {
  id: string;                 // Document ID
  leagueId: string;
  teamId: string;
  playerIds: string[];        // Array of player fantraxIds
  updatedAt: number;          // Timestamp
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

// Draft types
export type DraftStatus = "setup" | "in_progress" | "paused" | "completed";

export interface DraftPick {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  playerId?: string;          // Set when pick is made
  playerName?: string;        // Set when pick is made
  isKeeperSlot: boolean;
  pickedAt?: number;          // Timestamp when pick was made
  pickedBy?: string;          // Email of user who made the pick
}

export interface DraftCurrentPick {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  startedAt: number;          // Timestamp
}

export interface DraftSettings {
  allowAdminOverride: boolean;
  isTestDraft: boolean;  // If true, only admins can see the draft
}

export interface Draft {
  id: string;                 // Document ID
  leagueId: string;
  seasonYear: number;
  status: DraftStatus;
  draftOrder: string[];       // Array of team IDs in draft order
  currentPick?: DraftCurrentPick;
  picks: DraftPick[];         // All picks (including keepers and future picks)
  settings: DraftSettings;
  createdAt: number;
  createdBy: string;          // Admin email who created draft
  startedAt?: number;
  completedAt?: number;
}

// Pick Assignment (new schema - each pick is independent document)
export interface PickAssignment {
  id: string;                    // e.g., "mns2026_2026_pick_4"
  leagueId: string;
  seasonYear: number;

  // Pick position
  round: number;
  pickInRound: number;
  overallPick: number;

  // Ownership (can change via trade)
  currentTeamId: string;
  originalTeamId: string;
  originalTeamName: string;
  originalTeamAbbrev: string;

  // Player assignment (can change during draft)
  playerId: string | null;
  playerName: string | null;

  // Metadata
  isKeeperSlot: boolean;
  pickedAt: number | null;
  pickedBy: string | null;

  // Trade tracking
  wasTraded: boolean;
  tradeHistory: Array<{
    from: string;
    to: string;
    tradedAt: number | null;
  }>;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// Keeper Fees (locked in after keeper submission - one-time fees)
export interface KeeperFees {
  id: string;                    // e.g., "mns2026_woods_2026"
  leagueId: string;
  teamId: string;
  seasonYear: number;

  // One-time keeper-phase fees (locked in when keepers submitted)
  franchiseTagFees: number;      // $15 per extra Round 1 keeper
  redshirtFees: number;          // $10 per redshirted rookie

  // Breakdown
  franchiseTagCount: number;     // Number of franchise tags used
  redshirtCount: number;         // Number of redshirts

  // Metadata
  lockedAt: number;              // Timestamp when fees were locked
  lockedBy: string;              // Admin who locked keepers

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// User roles
export type UserRole = "owner" | "admin";

export interface UserClaims {
  role: UserRole;
  leagueIds: string[];
  teamIds: string[];
}

// Portfolio (prize pool tracking)
export interface Portfolio {
  id: string;                    // Same as leagueId
  leagueId: string;
  walletAddress: string;         // EVM address (e.g., "0x...")
  usdInvested: number;           // Total USD invested in wallet
  lastUpdated: number;           // Timestamp of last blockchain fetch
  cachedEthBalance?: number;     // Cached ETH balance
  cachedUsdValue?: number;       // Cached USD value of wallet
  cachedEthPrice?: number;       // Cached ETH/USD price
}

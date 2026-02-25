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

export interface LeagueSchedule {
  numWeeks: number;              // Total weeks in regular season (e.g., 24)
  seasonStartDate: string;       // ISO date (Monday of week 1)
  tradeDeadlineWeek: number;     // Week number when trade deadline occurs
  tradeDeadlineDate: string;     // ISO date of trade deadline
  playoffTeams?: number;         // Even number, 2 to league size
  playoffWeeks?: number;         // Number of playoff rounds (2, 3, or 4)
  playoffByeTeams?: number;      // Seeds that skip round 1
  consolationWeeks?: number;     // Weeks for consolation bracket (non-playoff teams, best cat record wins top rookie draft odds)
}

export interface LeagueWeek {
  id: string;
  leagueId: string;
  seasonYear: number;
  weekNumber: number;
  matchupWeek: number;           // Which matchup period this week belongs to (same = combined)
  startDate: string;
  endDate: string;
  isTradeDeadlineWeek: boolean;
  label?: string;                // Optional label (e.g., "All-Star", "IST")
}

export interface Matchup {
  id: string;
  leagueId: string;
  seasonYear: number;
  matchupWeek: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
}

export type ScoringMode = 'matchup_record' | 'category_record';

export const MATCHUP_CATEGORIES = [
  'FG%', 'FT%', 'PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'A/TO',
] as const;

export type MatchupCategory = typeof MATCHUP_CATEGORIES[number];

export interface LeagueRosterSettings {
  maxActive: number;       // default 13 — max players on active roster
  maxStarters: number;     // default 10 — max that can start (rest must bench)
  maxIR: number;           // default 2  — IR slots
}

export const DEFAULT_ROSTER_SETTINGS: LeagueRosterSettings = {
  maxActive: 13,
  maxStarters: 10,
  maxIR: 2,
};

export interface League {
  id: string;
  name: string;
  seasonYear: number;
  deadlines: LeagueDeadlines;
  cap: LeagueCapSettings;
  schedule?: LeagueSchedule;   // Season schedule config (weeks, trade deadline)
  keepersLocked?: boolean;  // When true, rosters are locked and visible to all
  leaguePhase: LeaguePhase;  // Current phase of the league lifecycle
  draftStatus?: DraftStatus;  // DEPRECATED — kept for migration, use leaguePhase
  seasonStatus?: SeasonStatus;  // DEPRECATED — kept for migration, use leaguePhase
  seasonStartedAt?: number;  // Timestamp when season was started
  seasonStartedBy?: string;  // Admin who started the season
  commissionerId?: string;   // UUID of the league's commissioner (auto-set on creation)
  scoringMode: ScoringMode;  // How W-L-T records are computed
  roster: LeagueRosterSettings;  // Roster slot limits
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

export type PlayerSlot = 'active' | 'ir' | 'redshirt' | 'international' | 'bench';

export interface Player {
  id: string;
  fantraxId: string;
  name: string;
  position: string;
  salary: number;
  nbaTeam: string;
  slot: PlayerSlot;
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

// League phases (linear progression)
export type LeaguePhase = 'keeper_season' | 'draft' | 'regular_season' | 'playoffs' | 'champion' | 'rookie_draft';

export const LEAGUE_PHASE_ORDER: LeaguePhase[] = [
  'keeper_season', 'draft', 'regular_season', 'playoffs', 'champion', 'rookie_draft',
];

export const LEAGUE_PHASE_LABELS: Record<LeaguePhase, string> = {
  keeper_season: 'Keeper Season',
  draft: 'Draft',
  regular_season: 'Regular Season',
  playoffs: 'Playoffs',
  champion: 'Champion',
  rookie_draft: 'Rookie Draft',
};

// Draft types
export type DraftStatus = "setup" | "in_progress" | "paused" | "completed";
export type SeasonStatus = "pre_season" | "active" | "completed";

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

// Draft History (archive of completed draft)
export interface DraftHistoryPick {
  overallPick: number;
  round: number;
  pickInRound: number;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  playerId: string;
  playerName: string;
  salary: number;
  nextYearKeeperRound: number;  // round - 1, minimum 1
}

export interface DraftHistoryKeeper {
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  playerId: string;
  playerName: string;
  salary: number;
  baseRound: number;
  keeperRound: number;  // Round they were kept in this draft
  nextYearKeeperRound: number;  // keeperRound - 1, minimum 1
}

export interface DraftHistoryPlayer {
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  playerId: string;
  playerName: string;
}

export interface DraftHistory {
  id: string;  // {leagueId}_{year}
  leagueId: string;
  seasonYear: number;
  picks: DraftHistoryPick[];
  keepers: DraftHistoryKeeper[];
  redshirtPlayers: DraftHistoryPlayer[];
  internationalPlayers: DraftHistoryPlayer[];
  completedAt: number;
  completedBy: string;  // Admin email
}

// Regular Season Roster
export interface RegularSeasonRoster {
  id: string;  // {leagueId}_{teamId}
  leagueId: string;
  teamId: string;
  seasonYear: number;
  activeRoster: string[];  // Player IDs - no max, but warn if > 13
  irSlots: string[];  // Player IDs - max 2
  redshirtPlayers: string[];  // Player IDs - unlimited, doesn't count toward salary
  internationalPlayers: string[];  // Player IDs - unlimited, doesn't count toward salary
  benchedPlayers: string[];  // Player IDs currently benched (subset of activeRoster)
  isLegalRoster: boolean;  // false if activeRoster.length > 13
  lastUpdated: number;
  updatedBy: string;  // Email of user who made last update
}

// Daily Lineup (10 active players per team per game date)
export interface DailyLineup {
  id: string;  // {leagueId}_{teamId}_{YYYY-MM-DD}
  leagueId: string;
  teamId: string;
  gameDate: string;  // "YYYY-MM-DD"
  activePlayerIds: string[];  // up to 10 player IDs
  updatedAt: number;
  updatedBy: string;
}

// NBA Game (from the games table)
export interface NBAGame {
  id: string;
  seasonYear: number;
  gameDate: string;  // "YYYY-MM-DD"
  awayTeam: string;  // 3-letter abbreviation
  homeTeam: string;
  isCupGame: boolean;
  notes: string | null;
}

// Game info for a specific player's NBA team on a specific date
export interface PlayerGameInfo {
  opponent: string;  // 3-letter abbreviation
  isHome: boolean;
  isCupGame: boolean;
}

// Team Fees (tracked per season)
export interface FeeTransaction {
  type: 'franchise' | 'redshirt' | 'firstApron' | 'secondApron' | 'unredshirt';
  amount: number;
  timestamp: number;
  triggeredBy: string;  // User email
  note?: string;
}

export interface TeamFees {
  id: string;  // {leagueId}_{teamId}_{seasonYear}
  leagueId: string;
  teamId: string;
  seasonYear: number;

  // Pre-draft fees (locked at draft completion)
  franchiseTagFees: number;  // $15 per franchise tag
  redshirtFees: number;  // $10 per redshirt

  // Season fees (locked when admin clicks "Start Season")
  firstApronFee: number;  // $50 if salary > 195M
  secondApronPenalty: number;  // $2/M over 225M
  unredshirtFees: number;  // $25 per unredshirt action (cumulative)

  // Status
  feesLocked: boolean;  // false until "Start Season" clicked
  lockedAt?: number;

  totalFees: number;
  feeTransactions: FeeTransaction[];

  createdAt: number;
  updatedAt: number;
}

// Wagers
export type WagerStatus = 'pending' | 'accepted' | 'declined' | 'live' | 'settled';

export interface Wager {
  id: string;  // Auto-generated Firestore ID
  leagueId: string;
  seasonYear: number;

  // Parties
  proposerId: string;  // Team ID
  proposerName: string;  // Team name
  opponentId: string;  // Team ID
  opponentName: string;  // Team name

  // Wager details
  description: string;  // What the wager is about
  amount: number;  // Dollar amount
  settlementDate: string;  // ISO date string

  // Status
  status: WagerStatus;
  proposedAt: number;  // Timestamp
  proposedBy: string;  // User email who created it
  respondedAt?: number;  // Timestamp when accepted/declined
  respondedBy?: string;  // User email who responded
  settledAt?: number;  // Timestamp when settled
  winnerId?: string;  // Team ID of winner (set when settled)

  createdAt: number;
  updatedAt: number;
}

// Trade Machine
export type TradeAssetType = 'keeper' | 'redshirt' | 'int_stash' | 'rookie_pick';
export type TradeProposalStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired' | 'executed';
export type TradeResponseStatus = 'pending' | 'accepted' | 'rejected';

export interface TradeAsset {
  type: TradeAssetType;
  id: string;
  displayName: string;
  salary: number;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
}

export interface TradeProposal {
  id: string;
  leagueId: string;
  seasonYear: number;
  proposedByTeamId: string;
  proposedByEmail: string;
  status: TradeProposalStatus;
  assets: TradeAsset[];
  involvedTeamIds: string[];
  note?: string;
  expiresAt?: number;
  executedAt?: number;
  executedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TradeProposalResponse {
  id: string;
  proposalId: string;
  teamId: string;
  teamName: string;
  status: TradeResponseStatus;
  respondedBy?: string;
  respondedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Prospects
export interface Prospect {
  id: string;  // Auto-generated or derived ID
  rank: number;  // Overall prospect ranking
  player: string;  // Player name
  school: string;  // College/University
  year: string;  // Class year (Fr, So, Jr, Sr)
  position: string;  // Position (PG, SG, SF, PF, C)
  positionRank: number;  // Rank within position
  height: string;  // Height (e.g., "6-7")
  weight: number;  // Weight in pounds

  // Optional additional fields
  age?: number;
  hometown?: string;
  highSchool?: string;

  // Draft info
  draftYear?: number;  // Expected draft year
  draftProjection?: string;  // Lottery, First Round, Second Round, etc.

  // Scouting
  scoutingReport?: string;
  strengths?: string[];
  weaknesses?: string[];
  playerComparison?: string;  // NBA player comparison

  createdAt: number;
  updatedAt: number;
}

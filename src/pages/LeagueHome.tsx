import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, fetchAllRows } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fetchWalletData } from '../lib/blockchain';
import { useWagers } from '../hooks/useWagers';
import { useMatchups } from '../hooks/useMatchups';
import { ProposeWagerModal } from '../components/ProposeWagerModal';
import { MatchupCard } from '../components/MatchupCard';
import { getCurrentWeek } from '../lib/scheduleUtils';
import type { Team, League, Player, Portfolio, RegularSeasonRoster, TeamFees, LeagueWeek } from '../types';
import { LEAGUE_PHASE_LABELS, LEAGUE_PHASE_ORDER, DEFAULT_ROSTER_SETTINGS } from '../types';
import type { LeaguePhase } from '../types';
import { isPhaseComplete } from '../lib/phaseGating';
import { PhaseDetail } from '../components/PhaseDetail';

// Helper function to determine prize pool zone and calculate payouts
function calculatePrizePayouts(totalPrizePool: number, totalCollected: number) {
  // Boiler Room Zone - prize pool declined
  if (totalPrizePool < totalCollected) {
    if (totalPrizePool < 300) {
      return {
        zone: 'boilerRoom',
        zoneName: 'Boiler Room Zone',
        zoneDescription: 'Prize pool below $300',
        emoji: '📉',
        image: '/prizePool/boilerRoom.webp',
        bgGradient: 'from-gray-700 via-gray-800 to-gray-900',
        payouts: [
          { place: '1st', percentage: 100, amount: totalPrizePool }
        ]
      };
    } else {
      return {
        zone: 'boilerRoom',
        zoneName: 'Boiler Room Zone',
        zoneDescription: 'Prize pool declined below initial investment',
        emoji: '📉',
        image: '/prizePool/boilerRoom.webp',
        bgGradient: 'from-gray-700 via-gray-800 to-gray-900',
        payouts: [
          { place: '1st', percentage: 80, amount: totalPrizePool * 0.8 },
          { place: '2nd', percentage: 20, amount: totalPrizePool * 0.2 }
        ]
      };
    }
  }

  // Bernie Zone - prize pool $10,000+
  if (totalPrizePool >= 10000) {
    return {
      zone: 'bernieSanders',
      zoneName: 'Bernie Zone',
      zoneDescription: 'Prize pool $10,000+',
      emoji: '🚀',
      image: '/prizePool/bernieOnceAgain.webp',
      bgGradient: 'from-purple-400 via-purple-500 to-purple-600',
      payouts: [
        { place: '1st', percentage: 40, amount: totalPrizePool * 0.40 },
        { place: '2nd', percentage: 15, amount: totalPrizePool * 0.15 },
        { place: '3rd', percentage: 9, amount: totalPrizePool * 0.09 },
        { place: '4th-12th', percentage: 36, amount: totalPrizePool * 0.36, note: '(4% each)' }
      ]
    };
  }

  // Gordon Gekko Zone - prize pool grew
  return {
    zone: 'gordonGekko',
    zoneName: 'Gordon Gekko Zone',
    zoneDescription: 'Prize pool grew above initial investment',
    emoji: '💹',
    image: '/icons/mnsPal.webp',
    bgGradient: 'from-green-400 via-green-500 to-emerald-600',
    payouts: [
      { place: '1st', percentage: 70, amount: totalPrizePool * 0.70 },
      { place: '2nd', percentage: 20, amount: totalPrizePool * 0.20 },
      { place: '3rd', percentage: 10, amount: totalPrizePool * 0.10 }
    ]
  };
}

export function LeagueHome() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalKeeperFees, setTotalKeeperFees] = useState<number>(0);
  const [feeBreakdown, setFeeBreakdown] = useState({
    penaltyDues: 0,
    franchiseTagDues: 0,
    redshirtDues: 0,
    activationDues: 0,
    firstApronFee: 0
  });
  const [currentSeason, setCurrentSeason] = useState<number>(2025);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([2025]);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);
  const [teamSalaries, setTeamSalaries] = useState<Map<string, number>>(new Map());
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [showPortfolioDetails, setShowPortfolioDetails] = useState(false);
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [isWagerModalOpen, setIsWagerModalOpen] = useState(false);

  // Fetch accepted wagers (live wagers)
  const { wagers: liveWagers } = useWagers({
    leagueId,
    status: 'accepted',
    includeAll: true,
  });

  // Fetch matchups for the season (W-L records + current week display)
  const { matchups: allMatchups, records: teamRecords } = useMatchups({
    leagueId,
    seasonYear: league?.seasonYear,
    scoringMode: league?.scoringMode,
  });

  const [leagueWeeks, setLeagueWeeks] = useState<LeagueWeek[]>([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (seasonDropdownRef.current && !seasonDropdownRef.current.contains(event.target as Node)) {
        setIsSeasonDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to map a Supabase player row to the Player type
  const mapPlayer = (row: any): Player => ({
    id: row.id,
    fantraxId: row.fantrax_id,
    name: row.name,
    position: row.position,
    salary: row.salary,
    nbaTeam: row.nba_team,
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
      ? { priorYearRound: row.keeper_prior_year_round || undefined, derivedBaseRound: row.keeper_derived_base_round || undefined }
      : undefined,
  });

  // Helper to map a Supabase team row to the Team type
  const mapTeamRow = (row: any): Team => ({
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    abbrev: row.abbrev,
    owners: row.owners,
    ownerNames: row.owner_names,
    telegramUsername: row.telegram_username,
    capAdjustments: row.cap_adjustments || { tradeDelta: 0 },
    settings: row.settings || { maxKeepers: 8 },
    banners: row.banners,
  });

  // Helper to map a Supabase league row to the League type
  const mapLeagueRow = (row: any): League => ({
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines,
    cap: row.cap,
    schedule: row.schedule || undefined,
    keepersLocked: row.keepers_locked,
    draftStatus: row.draft_status,
    seasonStatus: row.season_status,
    seasonStartedAt: row.season_started_at,
    seasonStartedBy: row.season_started_by,
    leaguePhase: row.league_phase || 'keeper_season',
    scoringMode: row.scoring_mode || 'category_record',
    roster: row.roster || DEFAULT_ROSTER_SETTINGS,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!leagueId || !user?.email) return;

      try {
        // Fetch league data
        const { data: leagueRow, error: leagueError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (leagueError || !leagueRow) {
          setLoading(false);
          return;
        }

        const leagueData = mapLeagueRow(leagueRow);
        setLeague(leagueData);
        setCurrentSeason(leagueData.seasonYear);

        // For now, just show current season. TODO: Query Supabase for all available seasons
        setAvailableSeasons([leagueData.seasonYear]);

        // Fetch all teams in this league
        const { data: teamRows, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', leagueId);

        if (teamError) throw teamError;

        const teamData = (teamRows || []).map(mapTeamRow);
        setTeams(teamData);

        // Load all players for salary lookups (paginated past 1000-row limit)
        const playerRows = await fetchAllRows('players');

        const playersMap = new Map<string, Player>();
        playerRows.forEach((row: any) => {
          const player = mapPlayer(row);
          playersMap.set(player.id, player);
        });

        // Load regular season rosters and calculate salaries
        const { data: rosterRows, error: rosterError } = await supabase
          .from('regular_season_rosters')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', leagueData.seasonYear);

        if (rosterError) throw rosterError;

        const salariesMap = new Map<string, number>();
        (rosterRows || []).forEach((row: any) => {
          const roster: RegularSeasonRoster = {
            id: row.id,
            leagueId: row.league_id,
            teamId: row.team_id,
            seasonYear: row.season_year,
            activeRoster: row.active_roster || [],
            irSlots: row.ir_slots || [],
            redshirtPlayers: row.redshirt_players || [],
            internationalPlayers: row.international_players || [],
            benchedPlayers: row.benched_players || [],
            isLegalRoster: row.is_legal_roster,
            lastUpdated: row.last_updated,
            updatedBy: row.updated_by,
          };

          // Calculate salary from active roster + IR (redshirts and int stash don't count)
          const activeSalary = roster.activeRoster.reduce((sum, playerId) => {
            const player = playersMap.get(playerId);
            return sum + (player?.salary || 0);
          }, 0);

          const irSalary = roster.irSlots.reduce((sum, playerId) => {
            const player = playersMap.get(playerId);
            return sum + (player?.salary || 0);
          }, 0);

          salariesMap.set(roster.teamId, activeSalary + irSalary);
        });

        setTeamSalaries(salariesMap);

        // Load team fees
        const { data: feeRows, error: feeError } = await supabase
          .from('team_fees')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', leagueData.seasonYear);

        if (feeError) throw feeError;

        let franchiseTagDues = 0;
        let redshirtDues = 0;
        let activationDues = 0;
        let firstApronFees = 0;
        let secondApronPenalties = 0;

        (feeRows || []).forEach((row: any) => {
          const fees: TeamFees = {
            id: row.id,
            leagueId: row.league_id,
            teamId: row.team_id,
            seasonYear: row.season_year,
            franchiseTagFees: row.franchise_tag_fees || 0,
            redshirtFees: row.redshirt_fees || 0,
            firstApronFee: row.first_apron_fee || 0,
            secondApronPenalty: row.second_apron_penalty || 0,
            unredshirtFees: row.unredshirt_fees || 0,
            feesLocked: row.fees_locked,
            lockedAt: row.locked_at,
            totalFees: row.total_fees || 0,
            feeTransactions: row.fee_transactions || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
          franchiseTagDues += fees.franchiseTagFees || 0;
          redshirtDues += fees.redshirtFees || 0;
          activationDues += fees.unredshirtFees || 0;

          // Only count apron fees if they're locked (season started)
          if (fees.feesLocked) {
            firstApronFees += fees.firstApronFee || 0;
            secondApronPenalties += fees.secondApronPenalty || 0;
          } else {
            // Calculate potential fees if not locked yet
            const teamSalary = salariesMap.get(fees.teamId) || 0;
            if (teamSalary > 195_000_000) {
              firstApronFees += 50;
            }
            if (teamSalary > 225_000_000) {
              const overByM = Math.ceil((teamSalary - 225_000_000) / 1_000_000);
              secondApronPenalties += overByM * 2;
            }
          }
        });

        // Total fees = all fees combined
        const totalPrizeFees = franchiseTagDues + redshirtDues + activationDues + firstApronFees + secondApronPenalties;
        setTotalKeeperFees(totalPrizeFees);
        setFeeBreakdown({
          penaltyDues: secondApronPenalties,
          franchiseTagDues,
          redshirtDues,
          activationDues,
          firstApronFee: firstApronFees
        });

        // Find user's team
        const userTeam = teamData.find((team) => team.owners.includes(user.email || ''));
        setMyTeam(userTeam || null);

        // Load portfolio data
        await loadPortfolioData();

        // Fetch league weeks for current week calculation
        const { data: weekRows } = await supabase
          .from('league_weeks')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', leagueData.seasonYear)
          .order('week_number', { ascending: true });

        if (weekRows) {
          setLeagueWeeks(weekRows.map((row: any) => ({
            id: row.id,
            leagueId: row.league_id,
            seasonYear: row.season_year,
            weekNumber: row.week_number,
            matchupWeek: row.matchup_week ?? row.week_number,
            startDate: row.start_date,
            endDate: row.end_date,
            isTradeDeadlineWeek: row.is_trade_deadline_week,
            label: row.label || undefined,
          })));
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching league data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, user]);

  const loadPortfolioData = async () => {
    if (!leagueId) return;

    try {
      const { data: portfolioRow, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', leagueId)
        .single();

      if (error || !portfolioRow) {
        setPortfolio(null);
        return;
      }

      const portfolioData: Portfolio = {
        id: portfolioRow.id,
        leagueId: portfolioRow.league_id,
        walletAddress: portfolioRow.wallet_address,
        usdInvested: portfolioRow.usd_invested,
        lastUpdated: portfolioRow.last_updated,
        cachedEthBalance: portfolioRow.cached_eth_balance,
        cachedUsdValue: portfolioRow.cached_usd_value,
        cachedEthPrice: portfolioRow.cached_eth_price,
      };

      // Check if cache is older than 1 hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const needsRefresh = !portfolioData.lastUpdated || portfolioData.lastUpdated < oneHourAgo;

      if (needsRefresh && portfolioData.walletAddress) {
        // Fetch fresh data from blockchain
        await refreshPortfolioData(portfolioData);
      } else {
        // Use cached data
        setPortfolio(portfolioData);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  };

  const refreshPortfolioData = async (portfolioData: Portfolio) => {
    setPortfolioLoading(true);
    try {
      const walletData = await fetchWalletData(portfolioData.walletAddress);

      const updatedPortfolio: Portfolio = {
        ...portfolioData,
        cachedEthBalance: walletData.ethBalance,
        cachedEthPrice: walletData.ethPrice,
        cachedUsdValue: walletData.usdValue,
        lastUpdated: walletData.timestamp,
      };

      // Save updated data to Supabase
      await supabase
        .from('portfolios')
        .update({
          cached_eth_balance: updatedPortfolio.cachedEthBalance,
          cached_eth_price: updatedPortfolio.cachedEthPrice,
          cached_usd_value: updatedPortfolio.cachedUsdValue,
          last_updated: new Date(updatedPortfolio.lastUpdated).toISOString(),
        })
        .eq('id', leagueId!);
      setPortfolio(updatedPortfolio);
    } catch (error) {
      console.error('Error refreshing portfolio data:', error);
      // Fallback to cached data
      setPortfolio(portfolioData);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handleTeamClick = (teamId: string) => {
    navigate(`/league/${leagueId}/team/${teamId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Season Switcher */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{league?.name || 'Money Never Sleeps'}</h1>

            {/* Season Switcher Dropdown */}
            <div className="relative" ref={seasonDropdownRef}>
              <button
                onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1 bg-[#121212] border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg font-bold text-green-400">
                  {currentSeason}-{(currentSeason + 1) % 100}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isSeasonDropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Season Dropdown */}
              {isSeasonDropdownOpen && (
                <div className="absolute left-0 mt-2 w-40 bg-[#121212] rounded-lg shadow-lg border border-gray-800 py-1 z-50">
                  <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider">
                    Seasons
                  </div>
                  {availableSeasons
                    .sort((a, b) => b - a) // Sort newest first
                    .map((season) => (
                      <button
                        key={season}
                        onClick={() => {
                          setCurrentSeason(season);
                          setIsSeasonDropdownOpen(false);
                          // TODO: Reload data for selected season
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          currentSeason === season
                            ? 'bg-gray-800 text-green-400'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                        disabled={season !== league?.seasonYear}
                      >
                        <span>
                          {season}-{(season + 1) % 100}
                          {season !== league?.seasonYear && ' (Past)'}
                        </span>
                        {currentSeason === season && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          {currentSeason !== league?.seasonYear ? (
            <p className="text-gray-400 mt-1">Viewing past season data (read-only).</p>
          ) : (
            <>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {LEAGUE_PHASE_ORDER.map((phase: LeaguePhase, idx: number) => {
                  const isCurrent = league?.leaguePhase === phase;
                  const isComplete = isPhaseComplete(league?.leaguePhase, phase);
                  return (
                    <div key={phase} className="flex items-center gap-1">
                      {idx > 0 && (
                        <div className={`w-4 h-px ${isComplete || isCurrent ? 'bg-green-400/40' : 'bg-gray-700'}`} />
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                          isCurrent
                            ? 'bg-green-400/20 text-green-400 border border-green-400/50 shadow-[0_0_8px_rgba(74,222,128,0.3)]'
                            : isComplete
                              ? 'bg-gray-800 text-gray-500 border border-gray-700'
                              : 'bg-gray-900 text-gray-600 border border-gray-800'
                        }`}
                      >
                        {LEAGUE_PHASE_LABELS[phase]}
                      </span>
                    </div>
                  );
                })}
              </div>
              {league && <PhaseDetail league={league} />}
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-6">
            {/* Current Week Matchups */}
            {league?.leaguePhase === 'regular_season' && (() => {
              const weekNum = getCurrentWeek(leagueWeeks);
              const matchupWeek = weekNum
                ? leagueWeeks.find(w => w.weekNumber === weekNum)?.matchupWeek ?? weekNum
                : null;
              const weekMatchups = allMatchups.filter(m => m.matchupWeek === matchupWeek);
              return weekMatchups.length > 0 ? (
                <MatchupCard
                  matchups={weekMatchups}
                  teams={teams}
                  records={teamRecords}
                  myTeamId={myTeam?.id}
                  currentWeek={matchupWeek}
                />
              ) : null;
            })()}
            {/* Portfolio Section */}
            {portfolio && portfolio.walletAddress && portfolio.cachedUsdValue !== undefined && (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
                {/* Total Prize Pool Value - Front and Center */}
                <div className="bg-gradient-to-r from-green-400/10 to-purple-400/10 rounded-lg p-6 border border-green-400/30 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Portfolio Tracker</h2>
                    <button
                      onClick={() => refreshPortfolioData(portfolio)}
                      disabled={portfolioLoading}
                      className="px-3 py-1 text-xs bg-green-400/20 text-green-400 border border-green-400/30 rounded hover:bg-green-400/30 disabled:opacity-50 transition-colors"
                    >
                      {portfolioLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">Total Prize Pool Value</div>
                    <div className="text-5xl font-bold text-green-400 mb-3">
                      ${(portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)).toFixed(2)}
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Return</div>
                        <div className={`text-2xl font-bold ${
                          (portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) > (teams.length * 50 + totalKeeperFees)
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {((portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) > (teams.length * 50 + totalKeeperFees) ? '+' : '')}
                          ${((portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) - (teams.length * 50 + totalKeeperFees)).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Return %</div>
                        <div className={`text-2xl font-bold ${
                          (portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) > (teams.length * 50 + totalKeeperFees)
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {(((portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) / (teams.length * 50 + totalKeeperFees) - 1) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Show Details Toggle */}
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowPortfolioDetails(!showPortfolioDetails)}
                      className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
                    >
                      <span>{showPortfolioDetails ? 'Hide' : 'Show'} Details</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${showPortfolioDetails ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Portfolio Details Dropdown */}
                {showPortfolioDetails && (
                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                        <div className="text-xs text-gray-400 mb-1">Total Collected</div>
                        <div className="text-2xl font-bold text-white">${teams.length * 50 + totalKeeperFees}</div>
                      </div>
                      <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                        <div className="text-xs text-gray-400 mb-1">USD Invested</div>
                        <div className="text-2xl font-bold text-yellow-400">${portfolio.usdInvested}</div>
                      </div>
                      <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                        <div className="text-xs text-gray-400 mb-1">Cash on Hand</div>
                        <div className="text-2xl font-bold text-blue-400">${teams.length * 50 + totalKeeperFees - portfolio.usdInvested}</div>
                      </div>
                      <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                        <div className="text-xs text-gray-400 mb-1">Wallet Value</div>
                        <div className="text-2xl font-bold text-purple-400">${portfolio.cachedUsdValue.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 mt-1">{portfolio.cachedEthBalance?.toFixed(4)} ETH</div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 text-center">
                      Last updated: {portfolio.lastUpdated ? new Date(portfolio.lastUpdated).toLocaleString() : 'Never'}
                    </div>

                    {/* Fee Breakdown Accordion */}
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <button
                        onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
                        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity text-gray-400 hover:text-white"
                      >
                        <span className="text-sm font-semibold">Fee & Penalty Breakdown</span>
                        <svg
                          className={`w-5 h-5 transition-transform ${showFeeBreakdown ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showFeeBreakdown && (
                        <div className="mt-3 text-xs space-y-2 text-gray-400">
                          <div className="flex justify-between">
                            <span>Base Entry Fees ({teams.length} × $50)</span>
                            <span className="font-semibold text-white">${teams.length * 50}</span>
                          </div>
                          {feeBreakdown.firstApronFee > 0 && (
                            <div className="flex justify-between">
                              <span>First Apron Fees ($50 over $195M)</span>
                              <span className="font-semibold text-white">${feeBreakdown.firstApronFee}</span>
                            </div>
                          )}
                          {feeBreakdown.penaltyDues > 0 && (
                            <div className="flex justify-between">
                              <span>Second Apron Penalties ($2/M over $225M)</span>
                              <span className="font-semibold text-white">${feeBreakdown.penaltyDues}</span>
                            </div>
                          )}
                          {feeBreakdown.franchiseTagDues > 0 && (
                            <div className="flex justify-between">
                              <span>Franchise Tag Fees ($15 each)</span>
                              <span className="font-semibold text-white">${feeBreakdown.franchiseTagDues}</span>
                            </div>
                          )}
                          {feeBreakdown.redshirtDues > 0 && (
                            <div className="flex justify-between">
                              <span>Redshirt Fees ($10 each)</span>
                              <span className="font-semibold text-white">${feeBreakdown.redshirtDues}</span>
                            </div>
                          )}
                          {feeBreakdown.activationDues > 0 && (
                            <div className="flex justify-between">
                              <span>Redshirt Activation Fees ($25 each)</span>
                              <span className="font-semibold text-white">${feeBreakdown.activationDues}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 mt-2 border-t border-gray-700 font-bold text-white">
                            <span>Total Collected</span>
                            <span>${teams.length * 50 + totalKeeperFees}</span>
                          </div>
                          {portfolio && (
                            <div className={`flex justify-between font-semibold ${
                              (portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) > (teams.length * 50 + totalKeeperFees)
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}>
                              <span>Gain/Loss</span>
                              <span>
                                {(portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) > (teams.length * 50 + totalKeeperFees) ? '+' : ''}
                                ${((portfolio.cachedUsdValue + (teams.length * 50 + totalKeeperFees - portfolio.usdInvested)) - (teams.length * 50 + totalKeeperFees)).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prize Pool Section */}
            {(() => {
              const totalCollected = teams.length * 50 + totalKeeperFees;
              const totalPrizePool = portfolio?.cachedUsdValue
                ? portfolio.cachedUsdValue + (totalCollected - portfolio.usdInvested)
                : totalCollected;
              const prizeInfo = calculatePrizePayouts(totalPrizePool, totalCollected);

              return (
                <div className="bg-[#121212] rounded-lg border border-gray-800">
                  <div className="p-6">
                    {/* Header with Image and Payouts */}
                    <div className="flex flex-col md:flex-row items-start gap-6">
                      {/* Zone Info and Payouts - 50% width on desktop, full on mobile, comes first on mobile */}
                      <div className="w-full md:w-1/2 flex flex-col order-1 md:order-2">
                        <div className="mb-4">
                          <h2 className="text-xl font-bold text-white mb-2">{prizeInfo.zoneName}</h2>
                          <p className="text-sm text-gray-400">{prizeInfo.zoneDescription}</p>
                        </div>

                        {/* Payout Breakdown */}
                        <div className="space-y-3 flex-1">
                          {prizeInfo.payouts.map((payout, idx) => (
                            <div
                              key={idx}
                              className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {payout.place} {payout.note || ''}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">{payout.percentage}%</div>
                                </div>
                                <div className={`text-2xl md:text-3xl font-bold ${
                                  idx === 0 ? 'text-green-400' :
                                  idx === 1 ? 'text-purple-400' :
                                  idx === 2 ? 'text-pink-400' :
                                  'text-blue-400'
                                }`}>
                                  ${payout.amount.toFixed(0)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Image - 50% width on desktop, full on mobile, comes second on mobile */}
                      <div className="w-full md:w-1/2 order-2 md:order-1">
                        <img
                          src={prizeInfo.image}
                          alt={prizeInfo.zoneName}
                          className="w-full h-auto rounded-lg object-contain bg-[#0a0a0a]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Live Wagers Section */}
            {liveWagers.length > 0 && (
              <div className="bg-[#121212] rounded-lg border border-gray-800">
                <div className="p-6 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">Live Wagers</h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Accepted wagers between teams
                      </p>
                    </div>
                    {myTeam && (
                      <button
                        onClick={() => setIsWagerModalOpen(true)}
                        className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                      >
                        Propose Wager
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-800">
                  {liveWagers.map((wager) => (
                    <div key={wager.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <img src="/icons/money-icon.webp" alt="Wager" className="w-5 h-5 rounded-full" />
                            <span className="text-sm font-semibold text-white">
                              {wager.proposerName} vs {wager.opponentName}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-400/20 text-green-400 border border-green-400/30">
                              ${wager.amount.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">{wager.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Settlement: {new Date(wager.settlementDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Propose Wager Button (when no live wagers) */}
            {liveWagers.length === 0 && myTeam && (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
                <div className="text-center">
                  <img src="/icons/money-icon.webp" alt="Wager" className="w-16 h-16 rounded-full mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-2">No Live Wagers</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Challenge another team to a friendly wager
                  </p>
                  <button
                    onClick={() => setIsWagerModalOpen(true)}
                    className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                  >
                    Propose Wager
                  </button>
                </div>
              </div>
            )}

            {/* Standings Section */}
            <div className="bg-[#121212] rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold text-white">Standings</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {league?.scoringMode === 'category_record' ? 'Category record' : 'Matchup record'} rankings
                </p>
              </div>
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-[2.5rem_1fr_6rem_4rem_6rem] px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <span>#</span>
                <span>Team</span>
                <span className="text-center">Record</span>
                <span className="text-center">Pct</span>
                <span className="text-right">Salary</span>
              </div>
              <div className="divide-y divide-gray-800">
                {[...teams]
                  .sort((a, b) => {
                    const recA = teamRecords.get(a.id);
                    const recB = teamRecords.get(b.id);
                    const totalA = (recA?.wins || 0) + (recA?.losses || 0) + (recA?.ties || 0);
                    const totalB = (recB?.wins || 0) + (recB?.losses || 0) + (recB?.ties || 0);
                    const pctA = totalA > 0 ? (recA!.wins + (recA!.ties * 0.5)) / totalA : 0;
                    const pctB = totalB > 0 ? (recB!.wins + (recB!.ties * 0.5)) / totalB : 0;
                    if (pctB !== pctA) return pctB - pctA;
                    return (recB?.wins || 0) - (recA?.wins || 0);
                  })
                  .map((team, idx) => {
                  const totalSalary = teamSalaries.get(team.id) || 0;
                  const firstApron = 195_000_000;
                  const isOverApron = totalSalary > firstApron;
                  const record = teamRecords.get(team.id);
                  const wins = record?.wins || 0;
                  const losses = record?.losses || 0;
                  const ties = record?.ties || 0;
                  const total = wins + losses + ties;
                  const pct = total > 0 ? ((wins + ties * 0.5) / total) : 0;
                  const rank = idx + 1;
                  const isMyTeam = team.id === myTeam?.id;

                  return (
                    <button
                      key={team.id}
                      onClick={() => handleTeamClick(team.id)}
                      className={`w-full px-6 py-3 flex items-center sm:grid sm:grid-cols-[2.5rem_1fr_6rem_4rem_6rem] gap-2 hover:bg-gray-800/50 transition-colors text-left ${isMyTeam ? 'bg-green-400/5' : ''}`}
                    >
                      {/* Rank */}
                      <span className={`text-lg font-bold ${rank <= 3 ? 'text-green-400' : rank <= 6 ? 'text-gray-300' : 'text-gray-500'}`}>
                        {rank}
                      </span>

                      {/* Team name + owner */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">
                          {team.name}
                          {isMyTeam && <span className="ml-2 text-xs text-green-400/70">(You)</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {team.ownerNames?.[0] || team.abbrev}
                        </div>
                      </div>

                      {/* Record */}
                      <div className="text-center">
                        <span className="text-sm font-semibold text-white">
                          {wins}-{losses}{ties > 0 ? `-${ties}` : ''}
                        </span>
                      </div>

                      {/* Win Pct */}
                      <div className="hidden sm:block text-center">
                        <span className="text-sm text-gray-400">{total > 0 ? pct.toFixed(3).replace(/^0/, '') : '-'}</span>
                      </div>

                      {/* Salary */}
                      <div className="hidden sm:block text-right">
                        <span className={`text-sm ${isOverApron ? 'text-yellow-400' : 'text-gray-400'}`}>
                          ${(totalSalary / 1_000_000).toFixed(1)}M
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

      </div>

      {/* Propose Wager Modal */}
      {myTeam && user && (
        <ProposeWagerModal
          isOpen={isWagerModalOpen}
          onClose={() => setIsWagerModalOpen(false)}
          leagueId={leagueId!}
          seasonYear={league?.seasonYear || 2025}
          myTeam={myTeam}
          allTeams={teams}
          userEmail={user.email || ''}
        />
      )}
    </div>
  );
}

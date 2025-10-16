import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Team, League, RosterDoc, Draft, Player } from '../types';

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
    firstApronFee: 0
  });
  const [currentSeason, setCurrentSeason] = useState<number>(2025);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([2025]);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);
  const [teamSalaries, setTeamSalaries] = useState<Map<string, number>>(new Map());

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

  useEffect(() => {
    const fetchData = async () => {
      if (!leagueId || !user?.email) return;

      try {
        // Fetch league data
        const leagueDoc = await getDocs(
          query(collection(db, 'leagues'), where('__name__', '==', leagueId))
        );

        if (leagueDoc.empty) {
          setLoading(false);
          return;
        }

        const leagueData = { id: leagueDoc.docs[0].id, ...leagueDoc.docs[0].data() } as League;
        setLeague(leagueData);
        setCurrentSeason(leagueData.seasonYear);

        // For now, just show current season. TODO: Query Firestore for all available seasons
        setAvailableSeasons([leagueData.seasonYear]);

        // Fetch all teams in this league
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('leagueId', '==', leagueId));
        const snapshot = await getDocs(q);

        const teamData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Team[];

        setTeams(teamData);

        // Fetch roster status and calculate total keeper fees
        const rostersMap = new Map<string, RosterDoc>();
        let totalFees = 0;
        let penaltyDues = 0;
        let franchiseTagDues = 0;
        let redshirtDues = 0;
        let firstApronFee = 0;

        // NOTE: Roster document IDs are stored as {leagueId}_{teamId} WITHOUT year suffix
        // For 2025-2026 season, IDs are like: "XPL9dJv8BTFNAMlrNBpJ_8RmmV46iLVXcRQ3ltJuW"
        // If roster format changes in future seasons to include year, update this line
        await Promise.all(
          teamData.map(async (team) => {
            const rosterDocId = `${leagueId}_${team.id}`;
            const rosterDoc = await getDoc(doc(db, 'rosters', rosterDocId));
            console.log('[LeagueHome] Looking for roster:', rosterDocId, 'exists:', rosterDoc.exists());
            if (rosterDoc.exists()) {
              const rosterData = { id: rosterDoc.id, ...rosterDoc.data() } as RosterDoc;
              rostersMap.set(team.id, rosterData);
              console.log('[LeagueHome] Roster status:', rosterData.status, 'summary exists:', !!rosterData.summary);

              if (rosterData.status === 'submitted') {
                // Add team's total fees to prize pool
                if (rosterData.summary) {
                  console.log('[LeagueHome] Adding fees from', team.name, ':', {
                    totalFees: rosterData.summary.totalFees,
                    franchiseTagDues: rosterData.summary.franchiseTagDues,
                    redshirtDues: rosterData.summary.redshirtDues
                  });
                  totalFees += rosterData.summary.totalFees || 0;
                  penaltyDues += rosterData.summary.penaltyDues || 0;
                  franchiseTagDues += rosterData.summary.franchiseTagDues || 0;
                  redshirtDues += rosterData.summary.redshirtDues || 0;
                  firstApronFee += rosterData.summary.firstApronFee || 0;
                }
              }
            }
          })
        );
        console.log('[LeagueHome] Total keeper fees:', totalFees, 'Breakdown:', { penaltyDues, franchiseTagDues, redshirtDues, firstApronFee });
        setTotalKeeperFees(totalFees);
        setFeeBreakdown({ penaltyDues, franchiseTagDues, redshirtDues, firstApronFee });

        // Simple approach: sum all player salaries from draft picks
        const draftId = `${leagueId}_${leagueData.seasonYear}`;
        const draftDoc = await getDoc(doc(db, 'drafts', draftId));

        if (draftDoc.exists()) {
          const draft = draftDoc.data() as Draft;

          // Load all players to get salaries
          const playersSnap = await getDocs(collection(db, 'players'));
          const playersMap = new Map<string, Player>();
          playersSnap.docs.forEach(doc => {
            const player = { id: doc.id, ...doc.data() } as Player;
            playersMap.set(player.id, player);
          });

          // Calculate total salary per team from their draft picks
          const salariesMap = new Map<string, number>();
          teamData.forEach(team => {
            // Get all picks for this team that have a player assigned
            const teamPicks = draft.picks.filter(pick =>
              pick.teamId === team.id && pick.playerId && pick.pickedAt
            );

            // Sum up the salaries
            const totalSalary = teamPicks.reduce((sum, pick) => {
              const player = playersMap.get(pick.playerId!);
              return sum + (player?.salary || 0);
            }, 0);

            salariesMap.set(team.id, totalSalary);
          });

          setTeamSalaries(salariesMap);
        }

        // Find user's team
        const userTeam = teamData.find((team) => team.owners.includes(user.email || ''));
        setMyTeam(userTeam || null);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching league data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, user]);

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
          <p className="text-gray-400 mt-1">
            {currentSeason === league?.seasonYear
              ? 'Welcome back! Manage your team and prepare for the draft.'
              : 'Viewing past season data (read-only).'
            }
          </p>
        </div>

        {/* Mobile: Cards in 2x2 grid */}
        <div className="lg:hidden grid grid-cols-2 gap-4 mb-6">
          {/* My Team Card */}
          {myTeam ? (
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-bold text-white mb-1">{myTeam.name}</h3>
              <p className="text-xs text-gray-400 mb-3">{myTeam.abbrev}</p>
              <button
                onClick={() => navigate(`/league/${leagueId}/team/${myTeam.id}`)}
                className="w-full border-2 border-green-400 text-green-400 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all cursor-pointer"
              >
                Manage Roster
              </button>
            </div>
          ) : (
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-bold text-white mb-2">My Team</h3>
              <p className="text-xs text-gray-400">Not assigned</p>
            </div>
          )}

          {/* Draft Card */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/draft-icon.png" alt="Draft" className="w-5 h-5 rounded-full" />
              <h3 className="text-sm font-bold text-white">Draft</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">In Progress</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/draft`)}
              className="w-full border-2 border-purple-400 text-purple-400 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-purple-400/10 hover:shadow-[0_0_15px_rgba(192,132,252,0.5)] transition-all cursor-pointer"
            >
              View Draft
            </button>
          </div>

          {/* Free Agent Pool Card */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/baseketball-icon.png" alt="Basketball" className="w-5 h-5 rounded-full" />
              <h3 className="text-sm font-bold text-white">Free Agent Pool</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Browse available players</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/free-agents`)}
              className="w-full border-2 border-pink-400 text-pink-400 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-pink-400/10 hover:shadow-[0_0_15px_rgba(244,114,182,0.5)] transition-all cursor-pointer"
            >
              View Pool
            </button>
          </div>

          {/* Rookie Draft Card */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/rookie-icon.png" alt="Rookie Draft" className="w-5 h-5 rounded-full" />
              <h3 className="text-sm font-bold text-white">Rookie Draft</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">June 25, 2025</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/rookie-draft`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
            >
              View Results
            </button>
          </div>

          {/* Rules Card */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/rules-icon.png" alt="Rules" className="w-5 h-5 rounded-full" />
              <h3 className="text-sm font-bold text-white">Rules</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">League guidelines</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/rules`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
            >
              View Rules
            </button>
          </div>

          {/* Reigning Champion Card */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/trophy-icon.png" alt="Trophy" className="w-5 h-5 rounded-full" />
              <h3 className="text-sm font-bold text-white">Champion</h3>
            </div>
            <p className="text-base font-semibold text-yellow-400 mb-3">Kirbiak</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/record-book`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Record Book
            </button>
          </div>
        </div>

        {/* Desktop & Mobile: Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prize Pool Section */}
            <div className="bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-black border border-green-300">
              <div className="flex items-center gap-3 mb-2">
                <img src="/icons/money-icon.png" alt="Money" className="w-8 h-8 rounded-full" />
                <h2 className="text-xl font-bold">Prize Pool</h2>
              </div>
              <div className="text-4xl font-bold mb-4">${teams.length * 50 + totalKeeperFees}</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-[#0a0a0a] rounded p-3 border border-green-400/30">
                  <div className="font-semibold text-green-400">1st Place</div>
                  <div className="text-2xl font-bold text-green-400">${((teams.length * 50 + totalKeeperFees) * 0.5).toFixed(0)}</div>
                </div>
                <div className="bg-[#0a0a0a] rounded p-3 border border-purple-400/30">
                  <div className="font-semibold text-purple-400">2nd Place</div>
                  <div className="text-2xl font-bold text-purple-400">${((teams.length * 50 + totalKeeperFees) * 0.3).toFixed(0)}</div>
                </div>
                <div className="bg-[#0a0a0a] rounded p-3 border border-pink-400/30">
                  <div className="font-semibold text-pink-400">3rd Place</div>
                  <div className="text-2xl font-bold text-pink-400">${((teams.length * 50 + totalKeeperFees) * 0.2).toFixed(0)}</div>
                </div>
              </div>
              {totalKeeperFees > 0 && (
                <div className="mt-4 pt-4 border-t border-black/20">
                  <div className="text-xs space-y-1 text-black/70">
                    <div className="flex justify-between">
                      <span>Base Entry Fees (12 × $50)</span>
                      <span className="font-semibold">${teams.length * 50}</span>
                    </div>
                    {feeBreakdown.firstApronFee > 0 && (
                      <div className="flex justify-between">
                        <span>First Apron Fees ($50 over $195M)</span>
                        <span className="font-semibold">${feeBreakdown.firstApronFee}</span>
                      </div>
                    )}
                    {feeBreakdown.penaltyDues > 0 && (
                      <div className="flex justify-between">
                        <span>Second Apron Penalties ($2/M over $225M)</span>
                        <span className="font-semibold">${feeBreakdown.penaltyDues}</span>
                      </div>
                    )}
                    {feeBreakdown.franchiseTagDues > 0 && (
                      <div className="flex justify-between">
                        <span>Franchise Tag Fees ($15 each)</span>
                        <span className="font-semibold">${feeBreakdown.franchiseTagDues}</span>
                      </div>
                    )}
                    {feeBreakdown.redshirtDues > 0 && (
                      <div className="flex justify-between">
                        <span>Redshirt Fees ($10 each)</span>
                        <span className="font-semibold">${feeBreakdown.redshirtDues}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-black/20 font-bold text-black">
                      <span>Total Prize Pool</span>
                      <span>${teams.length * 50 + totalKeeperFees}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* All Teams Section */}
            <div className="bg-[#121212] rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold text-white">All Teams</h2>
                <p className="text-sm text-gray-400 mt-1">
                  View team rosters and keeper selections.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {teams.map((team) => {
                  const totalSalary = teamSalaries.get(team.id) || 0;
                  const firstApron = 195_000_000;
                  const isOverApron = totalSalary > firstApron;

                  return (
                    <button
                      key={team.id}
                      onClick={() => handleTeamClick(team.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors text-left"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-white">{team.name}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Total Salary: <span className={isOverApron ? 'text-yellow-400' : 'text-green-400'}>${(totalSalary / 1_000_000).toFixed(1)}M</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-green-400/10 text-green-400 border border-green-400/30">
                          View Team
                        </span>
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Cards (Desktop only) */}
          <div className="hidden lg:block space-y-6">
            {/* My Team Card */}
            {myTeam ? (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-2">{myTeam.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{myTeam.abbrev}</p>
                <button
                  onClick={() => navigate(`/league/${leagueId}/team/${myTeam.id}`)}
                  className="w-full border-2 border-green-400 text-green-400 px-4 py-3 rounded-lg font-semibold hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all cursor-pointer"
                >
                  Manage Roster
                </button>
                <div className="mt-4 text-sm text-gray-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Max Keepers:</span>
                    <span className="font-semibold text-white">{myTeam.settings.maxKeepers}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
                <h3 className="text-lg font-bold text-white mb-4">My Team</h3>
                <p className="text-sm text-gray-400">You are not assigned to a team in this league.</p>
              </div>
            )}

            {/* Draft Card */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/draft-icon.png" alt="Draft" className="w-6 h-6 rounded-full" />
                <h3 className="text-lg font-bold text-white">Draft</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                In Progress
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/draft`)}
                className="w-full border-2 border-purple-400 text-purple-400 px-4 py-2 rounded-lg font-semibold hover:bg-purple-400/10 hover:shadow-[0_0_15px_rgba(192,132,252,0.5)] transition-all cursor-pointer"
              >
                View Draft
              </button>
            </div>

            {/* Free Agent Pool Card */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/baseketball-icon.png" alt="Basketball" className="w-6 h-6 rounded-full" />
                <h3 className="text-lg font-bold text-white">Free Agent Pool</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Browse available players and plan your draft strategy.
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/free-agents`)}
                className="w-full border-2 border-pink-400 text-pink-400 px-4 py-2 rounded-lg font-semibold hover:bg-pink-400/10 hover:shadow-[0_0_15px_rgba(244,114,182,0.5)] transition-all cursor-pointer"
              >
                View Pool
              </button>
            </div>

            {/* Rookie Draft Card */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/rookie-icon.png" alt="Rookie Draft" className="w-6 h-6 rounded-full" />
                <h3 className="text-lg font-bold text-white">Rookie Draft</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                June 25, 2025 results
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/rookie-draft`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors cursor-pointer"
              >
                View Results
              </button>
            </div>

            {/* Rules Card */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/rules-icon.png" alt="Rules" className="w-6 h-6 rounded-full" />
                <h3 className="text-lg font-bold text-white">Rules</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                League guidelines and policies
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/rules`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors cursor-pointer"
              >
                View Rules
              </button>
            </div>

            {/* Reigning Champion Card */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/trophy-icon.png" alt="Trophy" className="w-6 h-6 rounded-full" />
                <h3 className="text-lg font-bold text-white">Reigning Champion</h3>
              </div>
              <p className="text-xl font-semibold text-yellow-400 mb-4">Kirbiak</p>
              <button
                onClick={() => navigate(`/league/${leagueId}/record-book`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Record Book
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

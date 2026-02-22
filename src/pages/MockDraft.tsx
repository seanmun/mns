import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMatchups } from '../hooks/useMatchups';
import {
  getLotteryTeams,
  getLotteryOdds,
  getPrizeSpots,
  runLottery,
  runMockDraft,
} from '../lib/lottery';
import type { TeamStanding, LotteryOdds, LotteryResult, MockPick } from '../lib/lottery';
import type { Team, League, Prospect } from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';

type Phase = 'odds' | 'lottery' | 'draft';

interface RookiePickTrade {
  originalTeam: string;
  originalTeamName: string;
  currentOwner: string;
}

interface EnrichedLotteryResult extends LotteryResult {
  viaTeamName?: string;
  originalTeamId?: string;
}

interface EnrichedMockPick extends MockPick {
  viaTeamName?: string;
}

export function MockDraft() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('odds');
  const [lotteryResults, setLotteryResults] = useState<EnrichedLotteryResult[]>([]);
  const [mockPicks, setMockPicks] = useState<EnrichedMockPick[]>([]);
  const [rookiePickTrades, setRookiePickTrades] = useState<Map<string, RookiePickTrade>>(new Map());

  // Fetch matchups for W-L records
  const { records: teamRecords } = useMatchups({
    leagueId,
    seasonYear: league?.seasonYear,
    scoringMode: league?.scoringMode,
  });

  // Load data
  useEffect(() => {
    if (!leagueId) return;

    const fetchData = async () => {
      try {
        const [leagueRes, teamsRes, prospectsRes, rookiePicksRes] = await Promise.all([
          supabase.from('leagues').select('*').eq('id', leagueId).single(),
          supabase.from('teams').select('*').eq('league_id', leagueId),
          supabase.from('prospects').select('*').order('rank', { ascending: true }),
          supabase.from('rookie_draft_picks').select('*').eq('league_id', leagueId).eq('round', 1),
        ]);

        if (leagueRes.data) {
          setLeague({
            id: leagueRes.data.id,
            name: leagueRes.data.name,
            seasonYear: leagueRes.data.season_year,
            deadlines: leagueRes.data.deadlines,
            cap: leagueRes.data.cap,
            schedule: leagueRes.data.schedule || undefined,
            keepersLocked: leagueRes.data.keepers_locked,
            draftStatus: leagueRes.data.draft_status,
            seasonStatus: leagueRes.data.season_status,
            seasonStartedAt: leagueRes.data.season_started_at,
            seasonStartedBy: leagueRes.data.season_started_by,
            leaguePhase: leagueRes.data.league_phase || 'keeper_season',
            scoringMode: leagueRes.data.scoring_mode || 'category_record',
            roster: leagueRes.data.roster || DEFAULT_ROSTER_SETTINGS,
          });
        }

        if (teamsRes.data) {
          setTeams(teamsRes.data.map((row: any) => ({
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
          })));
        }

        if (prospectsRes.data) {
          setProspects(prospectsRes.data.map((row: any) => ({
            id: row.id,
            rank: row.rank,
            player: row.player,
            school: row.school,
            position: row.position,
            positionRank: row.position_rank,
            year: row.year,
            height: row.height,
            weight: row.weight,
            highSchool: row.high_school,
            draftProjection: row.draft_projection,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
          })));
        }

        // Build rookie pick trade map for the upcoming draft year
        if (rookiePicksRes.data) {
          const draftYear = leagueRes.data?.season_year ? leagueRes.data.season_year + 1 : 2026;
          const tradeMap = new Map<string, RookiePickTrade>();
          for (const p of rookiePicksRes.data) {
            if (p.year === draftYear) {
              tradeMap.set(p.original_team, {
                originalTeam: p.original_team,
                originalTeamName: p.original_team_name,
                currentOwner: p.current_owner,
              });
            }
          }
          setRookiePickTrades(tradeMap);
        }
      } catch (err) {
        console.error('Error loading mock draft data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId]);

  // Build standings from team records
  const standings: TeamStanding[] = useMemo(() => {
    return [...teams]
      .map((team) => {
        const rec = teamRecords.get(team.id);
        const wins = rec?.wins || 0;
        const losses = rec?.losses || 0;
        const ties = rec?.ties || 0;
        const total = wins + losses + ties;
        return {
          teamId: team.id,
          teamName: team.name,
          wins,
          losses,
          ties,
          pct: total > 0 ? (wins + ties * 0.5) / total : 0,
        };
      })
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct; // best first
        return b.wins - a.wins;
      });
  }, [teams, teamRecords]);

  // Determine prize spots and lottery teams
  const prizeSpots = useMemo(() => {
    // Simplified: use 3 as default (Gordon Gekko zone)
    // In a real scenario we'd compute from portfolio data
    return getPrizeSpots(1000, 600);
  }, []);

  const { lotteryTeams, moneyTeams } = useMemo(
    () => getLotteryTeams(standings, prizeSpots),
    [standings, prizeSpots]
  );

  const odds: LotteryOdds[] = useMemo(
    () => getLotteryOdds(lotteryTeams),
    [lotteryTeams]
  );

  // Apply rookie pick trades to lottery results
  const applyTrades = (results: LotteryResult[]): EnrichedLotteryResult[] => {
    return results.map(result => {
      const trade = rookiePickTrades.get(result.teamId);
      if (trade && trade.currentOwner !== trade.originalTeam) {
        const ownerTeam = teams.find(t => t.id === trade.currentOwner);
        return {
          ...result,
          originalTeamId: result.teamId,
          viaTeamName: result.teamName,
          teamId: trade.currentOwner,
          teamName: ownerTeam?.name || 'Unknown',
        };
      }
      return result;
    });
  };

  const handleRunLottery = () => {
    const results = runLottery(lotteryTeams, moneyTeams);
    const enriched = applyTrades(results);
    setLotteryResults(enriched);
    setPhase('lottery');
  };

  const handleRunMockDraft = () => {
    const picks = runMockDraft(lotteryResults, prospects);
    const enrichedPicks: EnrichedMockPick[] = picks.map(pick => {
      const lr = lotteryResults.find(r => r.pick === pick.pick);
      return {
        ...pick,
        viaTeamName: lr?.viaTeamName,
      };
    });
    setMockPicks(enrichedPicks);
    setPhase('draft');
  };

  const handleResimulate = () => {
    setPhase('odds');
    setLotteryResults([]);
    setMockPicks([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent" />
            <div className="mt-4 text-gray-400">Loading mock draft data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Mock Draft Simulator</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Powered by{' '}
            <a
              href="https://www.trustthepick.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 font-semibold hover:text-green-300 transition-colors"
            >
              TrustThePick.com
            </a>
            {' '}&middot;{' '}
            <button
              onClick={() => navigate(`/league/${leagueId}/prospects`)}
              className="text-gray-400 hover:text-white underline"
            >
              View Prospects
            </button>
          </p>
        </div>

        {/* Money Teams Banner */}
        {moneyTeams.length > 0 && (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-yellow-400">In The Money</span>
              <span className="text-xs text-gray-500">(excluded from lottery)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {moneyTeams.map((t, i) => (
                <span
                  key={t.teamId}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                >
                  #{i + 1} {t.teamName}
                  <span className="text-yellow-400/60 ml-1">
                    ({t.wins}-{t.losses}{t.ties > 0 ? `-${t.ties}` : ''})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Phase 1: Lottery Odds Table */}
        {phase === 'odds' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">Lottery Odds</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {lotteryTeams.length} teams competing for the top {Math.min(4, lotteryTeams.length)} picks
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0a0a0a] border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Record</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Combos</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">#1 Pick Odds</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Odds Bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {odds.map((entry, i) => (
                      <tr key={entry.team.teamId} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-gray-400">{i + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-white">{entry.team.teamName}</span>
                          {(() => {
                            const trade = rookiePickTrades.get(entry.team.teamId);
                            if (trade && trade.currentOwner !== trade.originalTeam) {
                              const ownerTeam = teams.find(t => t.id === trade.currentOwner);
                              return (
                                <div className="text-xs text-yellow-400 mt-0.5">
                                  Pick owned by {ownerTeam?.name || 'Unknown'}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-300">
                            {entry.team.wins}-{entry.team.losses}{entry.team.ties > 0 ? `-${entry.team.ties}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-400">{entry.combinations}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-green-400">{entry.pctFirstPick.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-gray-800 rounded-full h-2 max-w-[120px]">
                            <div
                              className="bg-green-400 h-2 rounded-full transition-all"
                              style={{ width: `${entry.pctFirstPick}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">How It Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                <div>
                  <span className="text-white font-semibold">1. Lottery Draw</span>
                  <p className="mt-1">14 ping-pong balls create 1,000 combinations. Top {Math.min(4, lotteryTeams.length)} picks drawn randomly based on odds.</p>
                </div>
                <div>
                  <span className="text-white font-semibold">2. Remaining Picks</span>
                  <p className="mt-1">Picks {Math.min(5, lotteryTeams.length)}+ assigned by inverse record (worst teams pick next).</p>
                </div>
                <div>
                  <span className="text-white font-semibold">3. Mock Draft</span>
                  <p className="mt-1">Top prospects slotted with weighted randomness — top picks stable, later picks get chaotic.</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleRunLottery}
                disabled={lotteryTeams.length === 0}
                className="px-8 py-4 bg-green-400 text-black font-bold text-lg rounded-lg hover:bg-green-300 hover:shadow-[0_0_20px_rgba(74,222,128,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run Lottery
              </button>
            </div>
          </div>
        )}

        {/* Phase 2: Lottery Results */}
        {phase === 'lottery' && (
          <div className="space-y-6">
            {/* Top 4 Picks — Hero Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lotteryResults.slice(0, Math.min(4, lotteryResults.length)).map((result) => {
                const movedUp = result.movement > 0;
                return (
                  <div
                    key={result.pick}
                    className={`rounded-lg border p-5 text-center ${
                      result.pick === 1
                        ? 'border-yellow-400/50 bg-yellow-400/10'
                        : 'border-gray-700 bg-[#121212]'
                    }`}
                  >
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pick</div>
                    <div className={`text-4xl font-black mb-2 ${
                      result.pick === 1 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      #{result.pick}
                    </div>
                    <div className="text-sm font-bold text-white mb-1">{result.teamName}</div>
                    {result.viaTeamName && (
                      <div className="text-xs text-yellow-400 mb-1">via {result.viaTeamName}</div>
                    )}
                    {result.movement !== 0 && (
                      <div className={`text-xs font-semibold ${movedUp ? 'text-green-400' : 'text-red-400'}`}>
                        {movedUp ? `+${result.movement}` : result.movement} from #{result.originalPosition}
                      </div>
                    )}
                    {result.movement === 0 && (
                      <div className="text-xs text-gray-500">Expected position</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Full Pick Order Table */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">Full Draft Order</h2>
              </div>
              <div className="divide-y divide-gray-800">
                {lotteryResults.map((result) => {
                  const isMoneyTeam = moneyTeams.some(t => t.teamId === (result.originalTeamId || result.teamId));
                  return (
                    <div
                      key={result.pick}
                      className={`px-4 py-3 flex items-center gap-4 ${
                        result.isLotteryWinner ? 'bg-green-400/5' : isMoneyTeam ? 'bg-yellow-400/5' : ''
                      }`}
                    >
                      <span className={`text-lg font-black w-8 ${
                        result.pick <= 4 ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {result.pick}
                      </span>
                      <span className="text-sm font-semibold text-white flex-1">
                        {result.teamName}
                        {result.viaTeamName && (
                          <span className="text-xs text-yellow-400 font-normal ml-1.5">via {result.viaTeamName}</span>
                        )}
                      </span>
                      {result.isLotteryWinner && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/20 text-green-400 border border-green-400/30">
                          LOTTERY
                        </span>
                      )}
                      {isMoneyTeam && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                          MONEY
                        </span>
                      )}
                      {result.viaTeamName && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-400 border border-purple-400/30">
                          TRADED
                        </span>
                      )}
                      {result.movement !== 0 && !isMoneyTeam && (
                        <span className={`text-xs font-semibold ${
                          result.movement > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {result.movement > 0 ? `+${result.movement}` : result.movement}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleResimulate}
                className="px-6 py-3 bg-gray-800 text-gray-200 font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                Re-draw Lottery
              </button>
              <button
                onClick={handleRunMockDraft}
                className="px-8 py-3 bg-green-400 text-black font-bold rounded-lg hover:bg-green-300 hover:shadow-[0_0_20px_rgba(74,222,128,0.5)] transition-all"
              >
                Continue to Mock Draft
              </button>
            </div>
          </div>
        )}

        {/* Phase 3: Mock Draft Board */}
        {phase === 'draft' && (
          <div className="space-y-6">
            <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">First Round Mock Draft</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Prospects assigned with weighted randomness — top picks are stable, later picks get chaotic
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0a0a0a] border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pick</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Prospect</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">School</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Pos</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Consensus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {mockPicks.map((pick) => {
                      const diff = pick.prospect.rank - pick.pick;
                      const isReach = diff > 0; // drafted higher than consensus
                      return (
                        <tr
                          key={pick.pick}
                          className={`transition-colors ${
                            pick.wasExpected
                              ? 'hover:bg-[#1a1a1a]'
                              : isReach
                                ? 'bg-orange-400/5 hover:bg-orange-400/10'
                                : 'bg-blue-400/5 hover:bg-blue-400/10'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              pick.pick <= 4
                                ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                                : 'bg-gray-800 text-gray-400'
                            }`}>
                              {pick.pick}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-white">{pick.teamName}</span>
                            {pick.viaTeamName && (
                              <div className="text-xs text-yellow-400">via {pick.viaTeamName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-white">
                              {pick.prospect.player}
                            </div>
                            {pick.prospect.draftProjection && (
                              <div className="text-xs text-gray-500">{pick.prospect.draftProjection}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-300">{pick.prospect.school}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-400/20 text-blue-400 border border-blue-400/30">
                              {pick.prospect.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pick.wasExpected ? (
                              <span className="text-xs text-gray-500">#{pick.prospect.rank}</span>
                            ) : isReach ? (
                              <span className="text-xs font-semibold text-orange-400">
                                #{pick.prospect.rank} (+{diff})
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-blue-400">
                                #{pick.prospect.rank} ({diff})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-orange-400/10 border border-orange-400/30" />
                Reach (drafted above consensus)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-400/10 border border-blue-400/30" />
                Slide (fell below consensus)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-yellow-400/10 border border-yellow-400/30" />
                Traded pick
              </span>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleResimulate}
                className="px-8 py-3 bg-green-400 text-black font-bold rounded-lg hover:bg-green-300 hover:shadow-[0_0_20px_rgba(74,222,128,0.5)] transition-all"
              >
                Re-simulate
              </button>
              <button
                onClick={() => navigate(`/league/${leagueId}/prospects`)}
                className="px-6 py-3 bg-gray-800 text-gray-200 font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                View Prospects
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

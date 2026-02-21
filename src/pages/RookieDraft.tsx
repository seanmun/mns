import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Player, Team } from '../types';

// Map Supabase flat row to nested Player type
function mapPlayer(row: any): Player {
  return {
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
      ? {
          priorYearRound: row.keeper_prior_year_round || undefined,
          derivedBaseRound: row.keeper_derived_base_round || undefined,
        }
      : undefined,
  };
}

// Map Supabase snake_case row to camelCase Team type
function mapTeam(row: any): Team {
  return {
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    abbrev: row.abbrev,
    owners: row.owners || [],
    ownerNames: row.owner_names || undefined,
    telegramUsername: row.telegram_username || undefined,
    capAdjustments: row.cap_adjustments || { tradeDelta: 0 },
    settings: row.settings || { maxKeepers: 8 },
    banners: row.banners || undefined,
  };
}

interface RookiePick {
  player: Player;
  team: Team;
  round: number;
  pick: number;
  overallPick: number;
}

export function RookieDraft() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [picks, setPicks] = useState<RookiePick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!leagueId) return;

      try {
        // Fetch teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', leagueId);

        if (teamsError) throw teamsError;
        const teams = (teamsData || []).map(mapTeam);

        // Fetch rookie players in this league
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('league_id', leagueId)
          .eq('is_rookie', true);

        if (playersError) throw playersError;

        const rookiePlayers = (playersData || [])
          .map(mapPlayer)
          .filter((player: Player) => player.roster?.rookieDraftInfo);

        // Build picks array with team info
        const picksData: RookiePick[] = rookiePlayers
          .map((player) => {
            const team = teams.find((t) => t.id === player.roster.teamId);
            if (!team || !player.roster.rookieDraftInfo) return null;

            const { round, pick } = player.roster.rookieDraftInfo;
            const overallPick = (round - 1) * teams.length + pick;

            return {
              player,
              team,
              round,
              pick,
              overallPick,
            };
          })
          .filter(Boolean) as RookiePick[];

        // Sort by overall pick
        picksData.sort((a, b) => a.overallPick - b.overallPick);

        setPicks(picksData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching rookie draft data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Group picks by round
  const round1 = picks.filter((p) => p.round === 1);
  const round2 = picks.filter((p) => p.round === 2);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <img src="/icons/rookie-icon.webp" alt="Rookie" className="w-8 h-8 rounded-full" />
            Rookie Draft Results
          </h1>
          <p className="text-gray-400 mt-1">June 25, 2025</p>
        </div>

        {/* Draft Picks */}
        <div className="space-y-6">
          {/* Round 1 */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Round 1</h2>
            </div>
            <div className="p-6">
              {round1.length === 0 ? (
                <div className="text-center text-gray-400 py-4">No picks available</div>
              ) : (
                <div className="space-y-2">
                  {round1.map((pick) => (
                    <div
                      key={pick.player.id}
                      className="flex items-center justify-between py-3 px-4 rounded bg-[#0a0a0a] border border-gray-800 hover:border-green-400 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-green-400 w-10">
                          {pick.overallPick}.
                        </span>
                        <div>
                          <div className="font-semibold text-white text-lg">{pick.player.name}</div>
                          <div className="text-sm text-gray-400">
                            {pick.player.position} • {pick.player.nbaTeam} • ${(pick.player.salary / 1_000_000).toFixed(1)}M
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold text-white">{pick.team.name}</div>
                        <div className="text-sm text-gray-400">{pick.team.abbrev}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Round 2 */}
          {round2.length > 0 && (
            <div className="bg-[#121212] rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold text-white">Round 2</h2>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  {round2.map((pick) => (
                    <div
                      key={pick.player.id}
                      className="flex items-center justify-between py-3 px-4 rounded bg-[#0a0a0a] border border-gray-800 hover:border-green-400 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-green-400 w-10">
                          {pick.overallPick}.
                        </span>
                        <div>
                          <div className="font-semibold text-white text-lg">{pick.player.name}</div>
                          <div className="text-sm text-gray-400">
                            {pick.player.position} • {pick.player.nbaTeam} • ${(pick.player.salary / 1_000_000).toFixed(1)}M
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold text-white">{pick.team.name}</div>
                        <div className="text-sm text-gray-400">{pick.team.abbrev}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rules Section */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Rookie Draft Rules</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Draft Pick Keeper Rules</h3>
                <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                  <li><strong className="text-green-400">Round 1 picks:</strong> Can be kept in Round 11</li>
                  <li><strong className="text-green-400">Round 2 picks:</strong> Can be kept in Round 12</li>
                  <li>Draft picks advance one round earlier each year they are kept</li>
                  <li>Players cannot be kept earlier than Round 1</li>
                </ul>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-lg font-semibold text-white mb-3">Redshirt Rules</h3>
                <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                  <li>Rookie draft picks are eligible for redshirt in their first year</li>
                  <li>Redshirted players do not count against your keeper limit</li>
                  <li>Redshirted players cannot be traded or dropped during the season</li>
                  <li><strong className="text-green-400">Redshirt fee:</strong> $10 per player</li>
                  <li>After redshirt year, player can be kept at original draft round</li>
                  <li><strong className="text-green-400">Activation fee:</strong> $25 to activate mid-season</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

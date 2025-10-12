import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Player, Team } from '../types';

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
        const teamsRef = collection(db, 'teams');
        const teamsQuery = query(teamsRef, where('leagueId', '==', leagueId));
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsData = teamsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Team[];

        // Fetch rookie picks
        const playersRef = collection(db, 'players');
        const playersQuery = query(
          playersRef,
          where('roster.leagueId', '==', leagueId),
          where('roster.isRookie', '==', true)
        );
        const snapshot = await getDocs(playersQuery);

        const rookiePlayers = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((player: any) => player.roster?.rookieDraftInfo) as Player[];

        // Build picks array with team info
        const picksData: RookiePick[] = rookiePlayers
          .map((player) => {
            const team = teamsData.find((t) => t.id === player.roster.teamId);
            if (!team || !player.roster.rookieDraftInfo) return null;

            const { round, pick } = player.roster.rookieDraftInfo;
            const overallPick = (round - 1) * teamsData.length + pick;

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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Group picks by round
  const round1 = picks.filter((p) => p.round === 1);
  const round2 = picks.filter((p) => p.round === 2);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🎯 Rookie Draft Results</h1>
          <p className="text-gray-500 mt-1">June 25, 2025</p>
        </div>

        {/* Draft Picks */}
        <div className="space-y-6">
          {/* Round 1 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Round 1</h2>
            </div>
            <div className="p-6">
              {round1.length === 0 ? (
                <div className="text-center text-gray-500 py-4">No picks available</div>
              ) : (
                <div className="space-y-2">
                  {round1.map((pick) => (
                    <div
                      key={pick.player.id}
                      className="flex items-center justify-between py-3 px-4 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-gray-500 w-10">
                          {pick.overallPick}.
                        </span>
                        <div>
                          <div className="font-semibold text-gray-900 text-lg">{pick.player.name}</div>
                          <div className="text-sm text-gray-500">
                            {pick.player.position} • {pick.player.nbaTeam} • ${(pick.player.salary / 1_000_000).toFixed(1)}M
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold text-gray-900">{pick.team.name}</div>
                        <div className="text-sm text-gray-500">{pick.team.abbrev}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Round 2 */}
          {round2.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Round 2</h2>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  {round2.map((pick) => (
                    <div
                      key={pick.player.id}
                      className="flex items-center justify-between py-3 px-4 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-gray-500 w-10">
                          {pick.overallPick}.
                        </span>
                        <div>
                          <div className="font-semibold text-gray-900 text-lg">{pick.player.name}</div>
                          <div className="text-sm text-gray-500">
                            {pick.player.position} • {pick.player.nbaTeam} • ${(pick.player.salary / 1_000_000).toFixed(1)}M
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold text-gray-900">{pick.team.name}</div>
                        <div className="text-sm text-gray-500">{pick.team.abbrev}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rules Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Rookie Draft Rules</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Draft Pick Keeper Rules</h3>
                <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                  <li>Round 1 picks: Can be kept in Round 11</li>
                  <li>Round 2 picks: Can be kept in Round 12</li>
                  <li>Draft picks advance one round earlier each year they are kept</li>
                  <li>Players cannot be kept earlier than Round 1</li>
                </ul>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Redshirt Rules</h3>
                <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                  <li>Rookie draft picks are eligible for redshirt in their first year</li>
                  <li>Redshirted players do not count against your keeper limit</li>
                  <li>Redshirted players cannot be traded or dropped during the season</li>
                  <li>Redshirt fee: $10 per player</li>
                  <li>After redshirt year, player can be kept at original draft round</li>
                  <li>Can be activated mid-season for $25 fee</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

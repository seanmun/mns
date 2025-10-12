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

interface RookieDraftResultsProps {
  leagueId: string;
  teams: Team[];
}

export function RookieDraftResults({ leagueId, teams }: RookieDraftResultsProps) {
  const [picks, setPicks] = useState<RookiePick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRookiePicks = async () => {
      try {
        // Query players with rookie draft info
        const playersRef = collection(db, 'players');
        const q = query(
          playersRef,
          where('roster.leagueId', '==', leagueId),
          where('roster.isRookie', '==', true)
        );
        const snapshot = await getDocs(q);

        const rookiePlayers = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((player: any) => player.roster?.rookieDraftInfo) as Player[];

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
        console.error('Error fetching rookie draft picks:', error);
        setLoading(false);
      }
    };

    if (teams.length > 0) {
      fetchRookiePicks();
    }
  }, [leagueId, teams]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Rookie Draft Results</h3>
        <div className="text-center text-gray-500 py-4">Loading...</div>
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Rookie Draft Results</h3>
        <div className="text-center text-gray-500 py-4">No rookie draft results available.</div>
      </div>
    );
  }

  // Group picks by round
  const round1 = picks.filter((p) => p.round === 1);
  const round2 = picks.filter((p) => p.round === 2);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h3 className="text-lg font-bold text-gray-900">🎯 Rookie Draft Results</h3>
        <p className="text-sm text-gray-500 mt-1">June 25, 2025</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Round 1 */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Round 1</h4>
          <div className="space-y-2">
            {round1.map((pick) => (
              <div
                key={pick.player.id}
                className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-500 w-8">
                    {pick.overallPick}.
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">{pick.player.name}</div>
                    <div className="text-xs text-gray-500">
                      {pick.player.position} • {pick.player.nbaTeam}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{pick.team.abbrev}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Round 2 */}
        {round2.length > 0 && (
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-3">Round 2</h4>
            <div className="space-y-2">
              {round2.map((pick) => (
                <div
                  key={pick.player.id}
                  className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-500 w-8">
                      {pick.overallPick}.
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{pick.player.name}</div>
                      <div className="text-xs text-gray-500">
                        {pick.player.position} • {pick.player.nbaTeam}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{pick.team.abbrev}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules Section */}
        <div className="border-t pt-6 space-y-4">
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-2">Draft Pick Keeper Rules</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Round 1 picks: Can be kept in Round 11</li>
              <li>Round 2 picks: Can be kept in Round 12</li>
              <li>Draft picks advance one round earlier each year they are kept</li>
              <li>Players cannot be kept earlier than Round 1</li>
            </ul>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-2">Redshirt Rules</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Rookie draft picks are eligible for redshirt in their first year</li>
              <li>Redshirted players do not count against your keeper limit</li>
              <li>Redshirted players cannot be traded or dropped during the season</li>
              <li>Redshirt fee: $10 per player</li>
              <li>After redshirt year, player can be kept at original draft round</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

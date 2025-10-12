import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useProjectedStats } from '../hooks/useProjectedStats';
import type { Player } from '../types';

export function FreeAgents() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const { projectedStats } = useProjectedStats();

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!leagueId) return;

      try {
        // Fetch all players in the league
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('leagueId', '==', leagueId));
        const snapshot = await getDocs(q);

        const playerData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Player[];

        setAllPlayers(playerData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching players:', error);
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [leagueId]);

  // Filter out players that are on teams (have a teamId)
  const freeAgents = useMemo(() => {
    const agents = allPlayers.filter(player => !player.roster.teamId);

    // Sort by projected score (highest first)
    return agents.sort((a, b) => {
      const scoreA = projectedStats.get(a.fantraxId)?.score ?? 0;
      const scoreB = projectedStats.get(b.fantraxId)?.score ?? 0;
      return scoreB - scoreA;
    });
  }, [allPlayers, projectedStats]);

  const formatSalary = (salary: number) => {
    return `$${(salary / 1_000_000).toFixed(2)}M`;
  };

  const formatStat = (stat: number | undefined) => {
    if (stat === undefined) return '-';
    return stat.toFixed(1);
  };

  const formatPercent = (percent: number | undefined) => {
    if (percent === undefined) return '-';
    return `${(percent * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Free Agent Pool</h1>
          <p className="text-gray-500 mt-1">
            {freeAgents.length} available players sorted by projected fantasy score
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PTS
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    REB
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AST
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ST
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    BLK
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FG%
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FT%
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    3PM
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {freeAgents.map((player) => {
                  const stats = projectedStats.get(player.fantraxId);

                  return (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {player.nbaTeam}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {player.position}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatSalary(player.salary)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center font-semibold">
                        {formatStat(stats?.score)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatStat(stats?.points)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatStat(stats?.rebounds)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatStat(stats?.assists)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatStat(stats?.steals)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatStat(stats?.blocks)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatPercent(stats?.fgPercent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatPercent(stats?.ftPercent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatStat(stats?.threePointMade)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

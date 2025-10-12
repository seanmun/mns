import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { usePreviousStats } from '../hooks/usePreviousStats';
import { PlayerModal } from '../components/PlayerModal';
import type { Player } from '../types';

export function FreeAgents() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number>(-1);
  const { projectedStats } = useProjectedStats();
  const { previousStats } = usePreviousStats();

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!leagueId) return;

      try {
        // Fetch all players where roster.leagueId matches
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('roster.leagueId', '==', leagueId));
        const snapshot = await getDocs(q);

        const playerData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Player[];

        console.log('All players fetched:', playerData.length);
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
    console.log('Filtering free agents from', allPlayers.length, 'players');
    const agents = allPlayers.filter(player => {
      const isFreeAgent = !player.roster.teamId;
      console.log(player.name, 'teamId:', player.roster.teamId, 'isFreeAgent:', isFreeAgent);
      return isFreeAgent;
    });

    console.log('Free agents found:', agents.length);

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
                    <div className="flex items-center justify-center gap-1">
                      Score
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
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
                {freeAgents.map((player, index) => {
                  const stats = projectedStats.get(player.fantraxId);

                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedPlayer(player);
                        setSelectedPlayerIndex(index);
                      }}
                    >
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

      {/* Player Modal */}
      <PlayerModal
        player={selectedPlayer}
        onClose={() => {
          setSelectedPlayer(null);
          setSelectedPlayerIndex(-1);
        }}
        onNext={() => {
          if (selectedPlayerIndex < freeAgents.length - 1) {
            const nextIndex = selectedPlayerIndex + 1;
            setSelectedPlayer(freeAgents[nextIndex]);
            setSelectedPlayerIndex(nextIndex);
          }
        }}
        onPrev={() => {
          if (selectedPlayerIndex > 0) {
            const prevIndex = selectedPlayerIndex - 1;
            setSelectedPlayer(freeAgents[prevIndex]);
            setSelectedPlayerIndex(prevIndex);
          }
        }}
        hasNext={selectedPlayerIndex < freeAgents.length - 1}
        hasPrev={selectedPlayerIndex > 0}
        projectedStats={selectedPlayer ? projectedStats.get(selectedPlayer.fantraxId) : undefined}
        previousStats={selectedPlayer ? previousStats.get(selectedPlayer.fantraxId) : undefined}
      />
    </div>
  );
}

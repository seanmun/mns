import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { usePreviousStats } from '../hooks/usePreviousStats';
import { PlayerModal } from '../components/PlayerModal';
import type { Player } from '../types';

type SortColumn = 'score' | 'salary' | 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'fgPercent' | 'ftPercent' | 'threePointMade';

export function FreeAgents() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number>(-1);
  const [sortColumn, setSortColumn] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { projectedStats } = useProjectedStats();
  const { previousStats } = usePreviousStats();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

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
    const agents = allPlayers.filter(player => !player.roster.teamId);

    // Sort by selected column
    return agents.sort((a, b) => {
      let valueA: number;
      let valueB: number;

      if (sortColumn === 'salary') {
        valueA = a.salary;
        valueB = b.salary;
      } else {
        const statsA = projectedStats.get(a.fantraxId);
        const statsB = projectedStats.get(b.fantraxId);

        switch (sortColumn) {
          case 'score':
            valueA = statsA?.score ?? 0;
            valueB = statsB?.score ?? 0;
            break;
          case 'points':
            valueA = statsA?.points ?? 0;
            valueB = statsB?.points ?? 0;
            break;
          case 'rebounds':
            valueA = statsA?.rebounds ?? 0;
            valueB = statsB?.rebounds ?? 0;
            break;
          case 'assists':
            valueA = statsA?.assists ?? 0;
            valueB = statsB?.assists ?? 0;
            break;
          case 'steals':
            valueA = statsA?.steals ?? 0;
            valueB = statsB?.steals ?? 0;
            break;
          case 'blocks':
            valueA = statsA?.blocks ?? 0;
            valueB = statsB?.blocks ?? 0;
            break;
          case 'fgPercent':
            valueA = statsA?.fgPercent ?? 0;
            valueB = statsB?.fgPercent ?? 0;
            break;
          case 'ftPercent':
            valueA = statsA?.ftPercent ?? 0;
            valueB = statsB?.ftPercent ?? 0;
            break;
          case 'threePointMade':
            valueA = statsA?.threePointMade ?? 0;
            valueB = statsB?.threePointMade ?? 0;
            break;
          default:
            valueA = 0;
            valueB = 0;
        }
      }

      return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [allPlayers, projectedStats, sortColumn, sortDirection]);

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

  const renderSortHeader = (label: string, column: SortColumn, align: 'left' | 'center' | 'right' = 'center') => {
    const isActive = sortColumn === column;
    const alignClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

    return (
      <th
        className={`px-4 py-3 text-${align} text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors`}
        onClick={() => handleSort(column)}
      >
        <div className={`flex items-center gap-1 ${alignClass}`}>
          {label}
          {isActive && (
            <svg
              className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </th>
    );
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Free Agent Pool</h1>
          <p className="text-gray-400 mt-1">
            {freeAgents.length} available players sorted by projected fantasy score
          </p>
        </div>

        {/* Table */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#0a0a0a] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-r border-gray-800">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Pos
                  </th>
                  {renderSortHeader('Salary', 'salary', 'right')}
                  {renderSortHeader('Score', 'score')}
                  {renderSortHeader('PTS', 'points')}
                  {renderSortHeader('REB', 'rebounds')}
                  {renderSortHeader('AST', 'assists')}
                  {renderSortHeader('ST', 'steals')}
                  {renderSortHeader('BLK', 'blocks')}
                  {renderSortHeader('FG%', 'fgPercent')}
                  {renderSortHeader('FT%', 'ftPercent')}
                  {renderSortHeader('3PM', 'threePointMade')}
                </tr>
              </thead>
              <tbody className="bg-[#121212] divide-y divide-gray-800">
                {freeAgents.map((player, index) => {
                  const stats = projectedStats.get(player.fantraxId);

                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedPlayer(player);
                        setSelectedPlayerIndex(index);
                      }}
                    >
                      <td className="sticky left-0 z-10 bg-[#121212] px-4 py-3 whitespace-nowrap border-r border-gray-800">
                        <div className="text-sm font-medium text-white">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {player.nbaTeam}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {player.position}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-white text-right font-medium">
                        {formatSalary(player.salary)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-400 text-center font-semibold">
                        {formatStat(stats?.score)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.points)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.rebounds)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.assists)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.steals)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatStat(stats?.blocks)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatPercent(stats?.fgPercent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                        {formatPercent(stats?.ftPercent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
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

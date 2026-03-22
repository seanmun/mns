import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLeague } from '../contexts/LeagueContext';
import { mapDraftHistory } from '../lib/mappers';
import type { DraftHistory as DraftHistoryType, DraftHistoryPick, DraftHistoryPlayer } from '../types';

interface BoardPick {
  overallPick: number;
  round: number;
  pickInRound: number;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  playerId: string;
  playerName: string;
  salary: number;
}

export function DraftHistory() {
  const { currentLeagueId } = useLeague();
  const [histories, setHistories] = useState<DraftHistoryType[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchHistory = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('draft_history')
        .select('*')
        .eq('league_id', currentLeagueId)
        .order('season_year', { ascending: false });

      if (!error && data) {
        const mapped = data.map(mapDraftHistory);
        setHistories(mapped);
        if (mapped.length > 0) {
          setSelectedYear(mapped[0].seasonYear);
        }
      }
      setLoading(false);
    };

    fetchHistory();
  }, [currentLeagueId]);

  const current = useMemo(
    () => histories.find(h => h.seasonYear === selectedYear) ?? null,
    [histories, selectedYear]
  );

  // Only show actual drafted picks (keepers are not part of the draft board)
  const allPicks = useMemo(() => {
    if (!current) return [];

    return current.picks.map((p: DraftHistoryPick) => ({
      overallPick: p.overallPick,
      round: p.round,
      pickInRound: p.pickInRound,
      teamId: p.teamId,
      teamName: p.teamName,
      teamAbbrev: p.teamAbbrev,
      playerId: p.playerId,
      playerName: p.playerName,
      salary: p.salary,
    })).sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.pickInRound - b.pickInRound;
    });
  }, [current]);

  // Group by round
  const rounds = useMemo(() => {
    const map = new Map<number, BoardPick[]>();
    for (const pick of allPicks) {
      if (!map.has(pick.round)) map.set(pick.round, []);
      map.get(pick.round)!.push(pick);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [allPicks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mns-dark py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent" />
            <div className="mt-4 text-gray-400">Loading draft history...</div>
          </div>
        </div>
      </div>
    );
  }

  if (histories.length === 0) {
    return (
      <div className="min-h-screen bg-mns-dark py-6 sm:py-8 pb-24 lg:pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Draft History</h1>
          <div className="bg-mns-card rounded-lg border border-gray-800 p-8 text-center">
            <p className="text-gray-400">No draft history available yet.</p>
            <p className="text-sm text-gray-500 mt-2">Draft results will appear here after a draft is completed and archived.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mns-dark py-6 sm:py-8 pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header + Year Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Draft History</h1>
          {histories.length > 1 && (
            <div className="flex gap-2">
              {histories.map(h => (
                <button
                  key={h.seasonYear}
                  onClick={() => setSelectedYear(h.seasonYear)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    selectedYear === h.seasonYear
                      ? 'bg-green-400 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {h.seasonYear}
                </button>
              ))}
            </div>
          )}
        </div>

        {current && (
          <>
            {/* Draft Board by Round */}
            <div className="space-y-4">
              {rounds.map(([round, picks]) => (
                <div key={round} className="bg-mns-card rounded-lg border border-gray-800 overflow-hidden">
                  <div className="px-4 sm:px-6 py-3 border-b border-gray-800 bg-mns-dark">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Round {round}</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {picks.map((pick, i) => (
                      <div
                        key={`${pick.round}-${pick.pickInRound}-${pick.playerId}-${i}`}
                        className="px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4"
                      >
                        {/* Pick number */}
                        <span className="text-xs sm:text-sm font-bold text-gray-500 w-6 sm:w-8 text-right shrink-0">
                          {pick.overallPick || '—'}
                        </span>

                        {/* Team */}
                        <span className="text-xs sm:text-sm font-semibold text-gray-400 w-10 sm:w-14 shrink-0">
                          {pick.teamAbbrev}
                        </span>

                        {/* Player */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-white truncate block">{pick.playerName}</span>
                          <span className="text-[10px] sm:hidden text-gray-500">
                            {pick.salary > 0 && `$${(pick.salary / 1_000_000).toFixed(1)}M`}
                          </span>
                        </div>

                        {/* Salary — hidden on mobile (shown inline above) */}
                        <span className="hidden sm:block text-sm text-gray-400 w-20 text-right">
                          {pick.salary > 0 ? `$${(pick.salary / 1_000_000).toFixed(1)}M` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Redshirts */}
            {current.redshirtPlayers.length > 0 && (
              <div className="mt-6 bg-mns-card rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 border-b border-gray-800 bg-mns-dark">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Redshirt Players</h2>
                </div>
                <div className="divide-y divide-gray-800">
                  {current.redshirtPlayers.map((p: DraftHistoryPlayer) => (
                    <div key={p.playerId} className="px-4 sm:px-6 py-3 flex items-center gap-3">
                      <span className="text-xs sm:text-sm font-semibold text-gray-400 w-10 sm:w-14 shrink-0">{p.teamAbbrev}</span>
                      <span className="text-sm text-white flex-1">{p.playerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* International Stashes */}
            {current.internationalPlayers.length > 0 && (
              <div className="mt-4 bg-mns-card rounded-lg border border-gray-800 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 border-b border-gray-800 bg-mns-dark">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">International Stashes</h2>
                </div>
                <div className="divide-y divide-gray-800">
                  {current.internationalPlayers.map((p: DraftHistoryPlayer) => (
                    <div key={p.playerId} className="px-4 sm:px-6 py-3 flex items-center gap-3">
                      <span className="text-xs sm:text-sm font-semibold text-gray-400 w-10 sm:w-14 shrink-0">{p.teamAbbrev}</span>
                      <span className="text-sm text-white flex-1">{p.playerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

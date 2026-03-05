import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { useLeague } from '../contexts/LeagueContext';
import { WNBA_ABBREV_TO_NAME } from '../lib/wnbaTeams';
import type { WNBAScrapedPlayer } from '../types';

// --- Helpers ---

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .trim();
}

interface ExistingPlayer {
  id: string;
  name: string;
  team_id: string | null;
  league_id: string | null;
}

// --- Types ---

type Phase = 'idle' | 'scraping' | 'review' | 'importing';
type Filter = 'all' | 'new' | 'updated' | 'fuzzy';
type PlayerStatus = 'new' | 'updated' | 'fuzzy_match';
type SortKey = 'name' | 'salary' | 'ppg' | 'confidence';

interface ScrapeResponse {
  players: WNBAScrapedPlayer[];
  totalCount: number;
  sourceStatus: {
    herhoopstats: string;
    balldontlie: string;
    hhsError?: string | null;
    bdlError?: string | null;
  };
  scrapedAt: string;
}

export function AdminWNBAScraper() {
  const navigate = useNavigate();
  const isSiteAdmin = useIsSiteAdmin();
  const { currentLeagueId } = useLeague();

  const [phase, setPhase] = useState<Phase>('idle');
  const [scrapeData, setScrapeData] = useState<ScrapeResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [existingPlayers, setExistingPlayers] = useState<Map<string, ExistingPlayer>>(new Map());
  const [existingCount, setExistingCount] = useState(0);
  const [fuzzyMatches, setFuzzyMatches] = useState<Map<string, ExistingPlayer>>(new Map());
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('salary');
  const [sortAsc, setSortAsc] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Load existing WNBA players (IDs + names for fuzzy matching)
  useEffect(() => {
    async function load() {
      const { data, count } = await supabase
        .from('players')
        .select('id, name, team_id, league_id', { count: 'exact' })
        .eq('sport', 'wnba');
      setExistingCount(count || 0);
      if (data) {
        setExistingIds(new Set(data.map(p => p.id)));
        const map = new Map<string, ExistingPlayer>();
        for (const p of data) map.set(p.id, p as ExistingPlayer);
        setExistingPlayers(map);
      }
    }
    load();
  }, []);

  const getPlayerStatus = useCallback((slug: string): PlayerStatus => {
    if (existingIds.has(`wnba-${slug}`)) return 'updated';
    if (fuzzyMatches.has(slug)) return 'fuzzy_match';
    return 'new';
  }, [existingIds, fuzzyMatches]);

  const handleScrape = async () => {
    setPhase('scraping');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'scrape-wnba-players'
      );
      if (fnError) throw new Error(fnError.message);
      const scraped = data as ScrapeResponse;
      setScrapeData(scraped);

      // Build normalized name → existing player lookup for fuzzy matching
      const nameToExisting = new Map<string, ExistingPlayer>();
      for (const [, p] of existingPlayers) {
        nameToExisting.set(normalizeName(p.name), p);
      }

      // Find fuzzy matches for players without exact ID match
      const fuzzy = new Map<string, ExistingPlayer>();
      for (const p of scraped.players) {
        const id = `wnba-${p.slug}`;
        if (!existingIds.has(id)) {
          const norm = normalizeName(p.name);
          const match = nameToExisting.get(norm);
          if (match) {
            fuzzy.set(p.slug, match);
          }
        }
      }
      setFuzzyMatches(fuzzy);

      // Auto-select new + updated; fuzzy matches need manual review
      const autoSelected = new Set<string>();
      for (const p of scraped.players) {
        if (!fuzzy.has(p.slug)) {
          autoSelected.add(p.slug);
        }
      }
      setSelected(autoSelected);
      setPhase('review');
    } catch (err: any) {
      setError(err.message || 'Scrape failed');
      setPhase('idle');
    }
  };

  const handleImport = async () => {
    if (!scrapeData) return;
    const toImport = scrapeData.players.filter(p => selected.has(p.slug));
    setPhase('importing');
    setImportProgress({ done: 0, total: toImport.length });

    let done = 0;
    const batchSize = 20;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);

      const newRows: Record<string, unknown>[] = [];
      const updateRows: Record<string, unknown>[] = [];
      const fuzzyUpdates: { existingId: string; data: Record<string, unknown> }[] = [];
      const statsRows: Record<string, unknown>[] = [];

      for (const p of batch) {
        const id = `wnba-${p.slug}`;
        const status = getPlayerStatus(p.slug);

        if (status === 'updated') {
          // Safe update: NEVER touch team_id, league_id, slot, on_ir
          updateRows.push({
            id,
            name: p.name,
            salary: p.salary,
            position: p.position || 'G/F',
            nba_team: p.team,
            sport: 'wnba',
          });
        } else if (status === 'fuzzy_match') {
          // Update the matched existing player (not create a duplicate)
          const match = fuzzyMatches.get(p.slug);
          if (match) {
            fuzzyUpdates.push({
              existingId: match.id,
              data: {
                name: p.name,
                salary: p.salary,
                position: p.position || 'G/F',
                nba_team: p.team,
              },
            });
          }
        } else {
          // New player: full insert
          newRows.push({
            id,
            fantrax_id: id,
            name: p.name,
            position: p.position || 'G/F',
            salary: p.salary,
            nba_team: p.team,
            sport: 'wnba',
            league_id: currentLeagueId,
            team_id: null,
            on_ir: false,
            is_rookie: false,
            is_international_stash: false,
            int_eligible: false,
            slot: 'active',
          });
        }

        // Collect stats for previous_stats table
        if (p.stats) {
          const statsId = status === 'fuzzy_match'
            ? (fuzzyMatches.get(p.slug)?.id || id)
            : id;
          statsRows.push({
            fantrax_id: statsId,
            name: p.name,
            nba_team: p.team,
            position: p.position || 'G/F',
            fg_percent: p.stats.fgPercent || null,
            three_point_made: p.stats.threePercent || null,
            ft_percent: p.stats.ftPercent || null,
            points: p.stats.pointsPerGame || null,
            rebounds: p.stats.reboundsPerGame || null,
            assists: p.stats.assistsPerGame || null,
            steals: p.stats.stealsPerGame || null,
            blocks: p.stats.blocksPerGame || null,
            season_year: '2025',
          });
        }
      }

      // 1. Insert new players
      if (newRows.length > 0) {
        const { error: insertErr } = await supabase
          .from('players')
          .insert(newRows);
        if (insertErr) {
          setError(`Insert error: ${insertErr.message}`);
          setPhase('review');
          return;
        }
      }

      // 2. Safe-update existing players (only safe fields, never team_id/league_id/slot)
      if (updateRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('players')
          .upsert(updateRows, { onConflict: 'id' });
        if (upsertErr) {
          setError(`Update error: ${upsertErr.message}`);
          setPhase('review');
          return;
        }
      }

      // 3. Fuzzy match updates (individual updates to matched existing player IDs)
      for (const { existingId, data } of fuzzyUpdates) {
        const { error: fuzzyErr } = await supabase
          .from('players')
          .update(data)
          .eq('id', existingId);
        if (fuzzyErr) {
          setError(`Fuzzy update error for ${existingId}: ${fuzzyErr.message}`);
          setPhase('review');
          return;
        }
      }

      // 4. Save 2024 season stats to previous_stats
      if (statsRows.length > 0) {
        const { error: statsErr } = await supabase
          .from('previous_stats')
          .upsert(statsRows, { onConflict: 'fantrax_id' });
        if (statsErr) {
          console.warn('Stats save warning:', statsErr.message);
        }
      }

      done += batch.length;
      setImportProgress({ done, total: toImport.length });
    }

    // Refresh existing players
    const { data: refreshed, count } = await supabase
      .from('players')
      .select('id, name, team_id, league_id', { count: 'exact' })
      .eq('sport', 'wnba');
    setExistingCount(count || 0);
    if (refreshed) {
      setExistingIds(new Set(refreshed.map(p => p.id)));
      const map = new Map<string, ExistingPlayer>();
      for (const p of refreshed) map.set(p.id, p as ExistingPlayer);
      setExistingPlayers(map);
    }
    setFuzzyMatches(new Map());
    setPhase('idle');
    setScrapeData(null);
  };

  const toggleAll = () => {
    if (!scrapeData) return;
    const filtered = getFilteredPlayers();
    const allSelected = filtered.every(p => selected.has(p.slug));
    const next = new Set(selected);
    for (const p of filtered) {
      if (allSelected) next.delete(p.slug);
      else next.add(p.slug);
    }
    setSelected(next);
  };

  const toggleOne = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const getFilteredPlayers = useCallback((): WNBAScrapedPlayer[] => {
    if (!scrapeData) return [];
    let list = scrapeData.players;
    if (filter === 'new') list = list.filter(p => getPlayerStatus(p.slug) === 'new');
    if (filter === 'updated') list = list.filter(p => getPlayerStatus(p.slug) === 'updated');
    if (filter === 'fuzzy') list = list.filter(p => getPlayerStatus(p.slug) === 'fuzzy_match');

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'salary': cmp = (a.salary || 0) - (b.salary || 0); break;
        case 'ppg': cmp = (a.stats?.pointsPerGame || 0) - (b.stats?.pointsPerGame || 0); break;
        case 'confidence': cmp = a.confidence - b.confidence; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [scrapeData, filter, sortKey, sortAsc, getPlayerStatus]);

  if (!isSiteAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">Site admin permissions required.</p>
        </div>
      </div>
    );
  }

  const filteredPlayers = getFilteredPlayers();
  const newCount = scrapeData?.players.filter(p => getPlayerStatus(p.slug) === 'new').length || 0;
  const updatedCount = scrapeData?.players.filter(p => getPlayerStatus(p.slug) === 'updated').length || 0;
  const fuzzyCount = scrapeData?.players.filter(p => getPlayerStatus(p.slug) === 'fuzzy_match').length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/site-admin')}
          className="text-sm text-gray-500 hover:text-purple-400 mb-3 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Site Admin
        </button>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">WNBA Player Scraper</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
            Admin
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Scrape WNBA player data from Her Hoop Stats + BallDontLie. Safe re-scrape preserves roster assignments.
        </p>
      </div>

      {/* Stats bar */}
      <div className={`grid gap-3 grid-cols-2 ${scrapeData ? 'sm:grid-cols-5' : 'sm:grid-cols-2'} mb-6`}>
        <div className="bg-mns-card border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">In Database</p>
          <p className="text-xl font-bold text-white mt-1">{existingCount}</p>
        </div>
        {scrapeData && (
          <>
            <div className="bg-mns-card border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Scraped</p>
              <p className="text-xl font-bold text-white mt-1">{scrapeData.totalCount}</p>
            </div>
            <div className="bg-mns-card border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">New</p>
              <p className="text-xl font-bold text-green-400 mt-1">{newCount}</p>
            </div>
            <div className="bg-mns-card border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Updated</p>
              <p className="text-xl font-bold text-yellow-400 mt-1">{updatedCount}</p>
            </div>
            {fuzzyCount > 0 && (
              <div className="bg-mns-card border border-orange-500/30 rounded-lg p-4">
                <p className="text-xs text-orange-400 uppercase tracking-wider">Fuzzy Match</p>
                <p className="text-xl font-bold text-orange-400 mt-1">{fuzzyCount}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fuzzy match warning banner */}
      {fuzzyCount > 0 && phase === 'review' && (
        <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 mb-4 text-sm">
          <p className="text-orange-400 font-medium">
            {fuzzyCount} player(s) matched existing DB entries by name but with different IDs.
          </p>
          <p className="text-orange-400/70 mt-1">
            Review these carefully. Selecting a fuzzy match will update the existing player&apos;s salary and position without creating a duplicate.
          </p>
        </div>
      )}

      {/* Source status */}
      {scrapeData?.sourceStatus && (
        <div className="flex gap-4 mb-4 text-xs">
          <span className={scrapeData.sourceStatus.herhoopstats === 'ok' ? 'text-green-400' : 'text-red-400'}>
            Her Hoop Stats: {scrapeData.sourceStatus.herhoopstats}
          </span>
          <span className={scrapeData.sourceStatus.balldontlie === 'ok' ? 'text-green-400' : 'text-yellow-400'}>
            BallDontLie: {scrapeData.sourceStatus.balldontlie}
            {scrapeData.sourceStatus.balldontlie === 'failed' && ' (no API key?)'}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Action buttons */}
      {phase === 'idle' && (
        <button
          onClick={handleScrape}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {existingCount > 0 ? 'Re-scrape WNBA Players' : 'Scrape WNBA Players'}
        </button>
      )}

      {phase === 'scraping' && (
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Scraping sources... this may take 10-20 seconds.
        </div>
      )}

      {phase === 'importing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            Importing {importProgress.done} / {importProgress.total} players...
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all"
              style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Review table */}
      {phase === 'review' && scrapeData && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-mns-card border border-gray-800 rounded-lg p-0.5">
              {([
                { key: 'all' as Filter, label: `All (${scrapeData.totalCount})` },
                { key: 'new' as Filter, label: `New (${newCount})` },
                { key: 'updated' as Filter, label: `Updated (${updatedCount})` },
                ...(fuzzyCount > 0 ? [{ key: 'fuzzy' as Filter, label: `Fuzzy (${fuzzyCount})` }] : []),
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    filter === f.key
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={toggleAll}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              {filteredPlayers.every(p => selected.has(p.slug)) ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex-1" />
            <span className="text-xs text-gray-500">{selected.size} selected</span>
            {!currentLeagueId && (
              <span className="text-xs text-red-400">No league selected — select a league first</span>
            )}
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || !currentLeagueId}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import Selected ({selected.size})
            </button>
            <button
              onClick={() => { setPhase('idle'); setScrapeData(null); setFuzzyMatches(new Map()); }}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg"
            >
              Cancel
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-mns-dark border-b border-gray-800">
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={filteredPlayers.length > 0 && filteredPlayers.every(p => selected.has(p.slug))}
                      onChange={toggleAll}
                      className="accent-purple-500"
                    />
                  </th>
                  <SortHeader label="Player" sortKey="name" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Team</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Pos</th>
                  <SortHeader label="Salary" sortKey="salary" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortHeader label="PPG" sortKey="ppg" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">RPG</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">APG</th>
                  <SortHeader label="Conf" sortKey="confidence" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(p => {
                  const status = getPlayerStatus(p.slug);
                  const fuzzyMatch = fuzzyMatches.get(p.slug);
                  return (
                    <tr
                      key={p.slug}
                      className={`border-b border-gray-800/50 hover:bg-mns-hover transition-colors ${
                        status === 'fuzzy_match' ? 'bg-orange-900/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.slug)}
                          onChange={() => toggleOne(p.slug)}
                          className="accent-purple-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-white font-medium whitespace-nowrap">{p.name}</div>
                        {fuzzyMatch && (
                          <div className="text-xs text-orange-400 mt-0.5">
                            Matches: {fuzzyMatch.name} ({fuzzyMatch.id})
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-400" title={WNBA_ABBREV_TO_NAME[p.team] || p.team}>
                        {p.team}
                      </td>
                      <td className="px-3 py-2 text-gray-400">{p.position || '\u2014'}</td>
                      <td className="px-3 py-2 text-gray-300 font-mono">
                        {p.salary ? `$${p.salary.toLocaleString()}` : '$0'}
                      </td>
                      <td className="px-3 py-2 text-gray-300 font-mono">
                        {p.stats?.pointsPerGame?.toFixed(1) || '\u2014'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono">
                        {p.stats?.reboundsPerGame?.toFixed(1) || '\u2014'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono">
                        {p.stats?.assistsPerGame?.toFixed(1) || '\u2014'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${
                          p.confidence >= 1 ? 'text-green-400' :
                          p.confidence >= 0.75 ? 'text-yellow-400' : 'text-gray-500'
                        }`}>
                          {p.confidence.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          status === 'new'
                            ? 'bg-green-900/40 text-green-400'
                            : status === 'fuzzy_match'
                              ? 'bg-orange-900/40 text-orange-400'
                              : 'bg-yellow-900/40 text-yellow-400'
                        }`}>
                          {status === 'new' ? 'new' : status === 'fuzzy_match' ? 'match?' : 'update'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, sortKey, current, asc, onSort }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-3 py-2 text-left text-gray-500 font-medium cursor-pointer hover:text-gray-300 select-none"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && <span className="ml-1">{asc ? '\u25B2' : '\u25BC'}</span>}
    </th>
  );
}

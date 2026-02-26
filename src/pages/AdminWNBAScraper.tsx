import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { WNBA_ABBREV_TO_NAME } from '../lib/wnbaTeams';
import type { WNBAScrapedPlayer } from '../types';

type Phase = 'idle' | 'scraping' | 'review' | 'importing';
type Filter = 'all' | 'new' | 'updated';
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

  const [phase, setPhase] = useState<Phase>('idle');
  const [scrapeData, setScrapeData] = useState<ScrapeResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [existingCount, setExistingCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('salary');
  const [sortAsc, setSortAsc] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Load existing WNBA player count and IDs
  useEffect(() => {
    async function load() {
      const { data, count } = await supabase
        .from('players')
        .select('id', { count: 'exact' })
        .eq('sport', 'wnba');
      setExistingCount(count || 0);
      if (data) setExistingIds(new Set(data.map(p => p.id)));
    }
    load();
  }, []);

  const getPlayerStatus = useCallback((slug: string): 'new' | 'updated' => {
    return existingIds.has(`wnba-${slug}`) ? 'updated' : 'new';
  }, [existingIds]);

  const handleScrape = async () => {
    setPhase('scraping');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'scrape-wnba-players'
      );
      if (fnError) throw new Error(fnError.message);
      setScrapeData(data as ScrapeResponse);
      // Auto-select new players
      const newSelected = new Set<string>();
      for (const p of (data as ScrapeResponse).players) {
        if (getPlayerStatus(p.slug) === 'new') {
          newSelected.add(p.slug);
        }
      }
      setSelected(newSelected);
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
      const rows = batch.map(p => ({
        id: `wnba-${p.slug}`,
        fantrax_id: `wnba-${p.slug}`,
        name: p.name,
        position: p.position || 'G/F',
        salary: p.salary,
        nba_team: p.team,
        sport: 'wnba',
        league_id: null,
        team_id: null,
        on_ir: false,
        is_rookie: false,
        is_international_stash: false,
        int_eligible: false,
        slot: 'active',
      }));

      const { error: upsertError } = await supabase
        .from('players')
        .upsert(rows, { onConflict: 'id' });

      if (upsertError) {
        setError(`Import error: ${upsertError.message}`);
        setPhase('review');
        return;
      }
      done += batch.length;
      setImportProgress({ done, total: toImport.length });
    }

    // Refresh existing count
    const { count } = await supabase
      .from('players')
      .select('id', { count: 'exact' })
      .eq('sport', 'wnba');
    setExistingCount(count || 0);
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
          Scrape WNBA player data from Her Hoop Stats + BallDontLie for import.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
        <div className="bg-[#121212] border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">In Database</p>
          <p className="text-xl font-bold text-white mt-1">{existingCount}</p>
        </div>
        {scrapeData && (
          <>
            <div className="bg-[#121212] border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Scraped</p>
              <p className="text-xl font-bold text-white mt-1">{scrapeData.totalCount}</p>
            </div>
            <div className="bg-[#121212] border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">New</p>
              <p className="text-xl font-bold text-green-400 mt-1">{newCount}</p>
            </div>
            <div className="bg-[#121212] border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Updated</p>
              <p className="text-xl font-bold text-yellow-400 mt-1">{updatedCount}</p>
            </div>
          </>
        )}
      </div>

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
          Scrape WNBA Players
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
              style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Review table */}
      {phase === 'review' && scrapeData && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-[#121212] border border-gray-800 rounded-lg p-0.5">
              {(['all', 'new', 'updated'] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    filter === f
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? `All (${scrapeData.totalCount})` : f === 'new' ? `New (${newCount})` : `Updated (${updatedCount})`}
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
            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import Selected ({selected.size})
            </button>
            <button
              onClick={() => { setPhase('idle'); setScrapeData(null); }}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg"
            >
              Cancel
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a0a0a] border-b border-gray-800">
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
                  return (
                    <tr
                      key={p.slug}
                      className="border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.slug)}
                          onChange={() => toggleOne(p.slug)}
                          className="accent-purple-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 text-gray-400" title={WNBA_ABBREV_TO_NAME[p.team] || p.team}>
                        {p.team}
                      </td>
                      <td className="px-3 py-2 text-gray-400">{p.position || '—'}</td>
                      <td className="px-3 py-2 text-gray-300 font-mono">
                        {p.salary ? `$${p.salary.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-300 font-mono">
                        {p.stats?.pointsPerGame?.toFixed(1) || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono">
                        {p.stats?.reboundsPerGame?.toFixed(1) || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono">
                        {p.stats?.assistsPerGame?.toFixed(1) || '—'}
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
                            : 'bg-yellow-900/40 text-yellow-400'
                        }`}>
                          {status}
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

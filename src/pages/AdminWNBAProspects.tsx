import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';

interface ScrapedProspect {
  rank: number;
  name: string;
  position: string;
  school: string;
  height: string;
  age: number | null;
  stats: {
    pointsPerGame: number;
    reboundsPerGame: number;
    assistsPerGame: number;
    blocksPerGame: number;
    stealsPerGame: number;
  } | null;
  slug: string;
  draftYear: number;
}

interface ScrapeResponse {
  prospects: ScrapedProspect[];
  totalCount: number;
  source: string;
  scrapedAt: string;
}

type Phase = 'idle' | 'scraping' | 'review' | 'importing';
type SortKey = 'rank' | 'name' | 'ppg' | 'school';

export function AdminWNBAProspects() {
  const navigate = useNavigate();
  const isSiteAdmin = useIsSiteAdmin();

  const [phase, setPhase] = useState<Phase>('idle');
  const [scrapeData, setScrapeData] = useState<ScrapeResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());
  const [existingCount, setExistingCount] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Load existing WNBA prospect count
  useEffect(() => {
    async function load() {
      const { data, count } = await supabase
        .from('prospects')
        .select('player', { count: 'exact' })
        .eq('sport', 'wnba');
      setExistingCount(count || 0);
      if (data) {
        const slugs = new Set(data.map((p: { player: string }) =>
          p.player.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        ));
        setExistingSlugs(slugs);
      }
    }
    load();
  }, []);

  const getStatus = useCallback((slug: string): 'new' | 'existing' => {
    return existingSlugs.has(slug) ? 'existing' : 'new';
  }, [existingSlugs]);

  const handleScrape = async () => {
    setPhase('scraping');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'scrape-wnba-prospects'
      );
      if (fnError) throw new Error(fnError.message);
      setScrapeData(data as ScrapeResponse);
      // Auto-select all prospects
      const allSelected = new Set<string>();
      for (const p of (data as ScrapeResponse).prospects) {
        allSelected.add(p.slug);
      }
      setSelected(allSelected);
      setPhase('review');
    } catch (err: any) {
      setError(err.message || 'Scrape failed');
      setPhase('idle');
    }
  };

  const handleImport = async () => {
    if (!scrapeData) return;
    const toImport = scrapeData.prospects.filter(p => selected.has(p.slug));
    setPhase('importing');
    setImportProgress({ done: 0, total: toImport.length });

    let done = 0;
    const batchSize = 20;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);
      const rows = batch.map(p => ({
        rank: p.rank,
        player: p.name,
        school: p.school,
        year: '',
        position: p.position || '',
        position_rank: null,
        height: p.height || null,
        weight: null,
        age: p.age ? Math.round(p.age) : null,
        draft_year: p.draftYear,
        draft_projection: p.rank <= 5 ? 'Lottery' : p.rank <= 12 ? 'First Round' : p.rank <= 24 ? 'Second Round' : 'Late Pick',
        sport: 'wnba',
      }));

      // Delete existing entries for these players first (upsert by player name)
      const names = batch.map(p => p.name);
      await supabase
        .from('prospects')
        .delete()
        .eq('sport', 'wnba')
        .in('player', names);

      const { error: insertError } = await supabase
        .from('prospects')
        .insert(rows);

      if (insertError) {
        setError(`Import error: ${insertError.message}`);
        setPhase('review');
        return;
      }
      done += batch.length;
      setImportProgress({ done, total: toImport.length });
    }

    // Refresh existing count
    const { count } = await supabase
      .from('prospects')
      .select('player', { count: 'exact' })
      .eq('sport', 'wnba');
    setExistingCount(count || 0);
    setPhase('idle');
    setScrapeData(null);
  };

  const toggleAll = () => {
    if (!scrapeData) return;
    const all = scrapeData.prospects;
    const allSelected = all.every(p => selected.has(p.slug));
    const next = new Set(selected);
    for (const p of all) {
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
    else { setSortKey(key); setSortAsc(key === 'rank'); }
  };

  const getSortedProspects = useCallback((): ScrapedProspect[] => {
    if (!scrapeData) return [];
    const sorted = [...scrapeData.prospects].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'rank': cmp = a.rank - b.rank; break;
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'ppg': cmp = (a.stats?.pointsPerGame || 0) - (b.stats?.pointsPerGame || 0); break;
        case 'school': cmp = a.school.localeCompare(b.school); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [scrapeData, sortKey, sortAsc]);

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

  const sortedProspects = getSortedProspects();
  const newCount = scrapeData?.prospects.filter(p => getStatus(p.slug) === 'new').length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/site-admin')}
          className="text-sm text-gray-500 hover:text-orange-400 mb-3 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Site Admin
        </button>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">WNBA Prospect Scraper</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
            Admin
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Scrape 2026 WNBA Draft prospect rankings from Tankathon for import.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 mb-6">
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
          </>
        )}
      </div>

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
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Scrape WNBA Prospects
        </button>
      )}

      {phase === 'scraping' && (
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          Scraping Tankathon... this may take a few seconds.
        </div>
      )}

      {phase === 'importing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            Importing {importProgress.done} / {importProgress.total} prospects...
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
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
            <button
              onClick={toggleAll}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              {sortedProspects.every(p => selected.has(p.slug)) ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-gray-500">Source: {scrapeData.source}</span>
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
                      checked={sortedProspects.length > 0 && sortedProspects.every(p => selected.has(p.slug))}
                      onChange={toggleAll}
                      className="accent-orange-500"
                    />
                  </th>
                  <SortHeader label="Rank" sortKey="rank" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortHeader label="Player" sortKey="name" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Pos</th>
                  <SortHeader label="School" sortKey="school" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Height</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Age</th>
                  <SortHeader label="PPG" sortKey="ppg" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">RPG</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">APG</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedProspects.map(p => {
                  const status = getStatus(p.slug);
                  const rankBg = p.rank <= 5
                    ? 'bg-yellow-400/20 text-yellow-400'
                    : p.rank <= 15
                      ? 'bg-green-400/20 text-green-400'
                      : 'bg-gray-800 text-gray-400';
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
                          className="accent-orange-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${rankBg}`}>
                          {p.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 text-gray-400">{p.position || '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{p.school || '—'}</td>
                      <td className="px-3 py-2 text-gray-400 font-mono">{p.height || '—'}</td>
                      <td className="px-3 py-2 text-gray-400 font-mono">{p.age?.toFixed(1) || '—'}</td>
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
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          status === 'new'
                            ? 'bg-green-900/40 text-green-400'
                            : 'bg-gray-700/40 text-gray-400'
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

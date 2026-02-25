import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { Team, Matchup, TeamRecord, ScoringMode } from '../types';
import { mapTeam, mapMatchup } from '../lib/mappers';

interface AdminMatchupManagerProps {
  leagueId: string;
  seasonYear: number;
  scoringMode: ScoringMode;
  onClose: () => void;
}

type Tab = 'matchups' | 'scores';

interface MatchupRow {
  homeTeamId: string;
  awayTeamId: string;
}

export function AdminMatchupManager({ leagueId, seasonYear, scoringMode, onClose }: AdminMatchupManagerProps) {
  const [tab, setTab] = useState<Tab>('matchups');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [matchupWeeks, setMatchupWeeks] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Manual matchup editing
  const [editRows, setEditRows] = useState<MatchupRow[]>([]);

  // Score editing
  const [scoreEdits, setScoreEdits] = useState<Array<{ id: string; homeScore: string; awayScore: string }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teams
        const { data: teamRows } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', leagueId)
          .order('name');
        const teamData = (teamRows || []).map(mapTeam);
        setTeams(teamData);

        // Fetch distinct matchup weeks from league_weeks
        const { data: weekRows } = await supabase
          .from('league_weeks')
          .select('matchup_week')
          .eq('league_id', leagueId)
          .eq('season_year', seasonYear)
          .order('matchup_week', { ascending: true });

        const distinctWeeks = [...new Set((weekRows || []).map((r: any) => r.matchup_week))];
        setMatchupWeeks(distinctWeeks);
        if (distinctWeeks.length > 0) setSelectedWeek(distinctWeeks[0]);

        // Fetch all matchups
        const { data: matchupRows } = await supabase
          .from('league_matchups')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season_year', seasonYear)
          .order('matchup_week', { ascending: true });
        setMatchups((matchupRows || []).map(mapMatchup));
      } catch (err) {
        logger.error('Error loading matchup data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, seasonYear]);

  // Update edit rows when week changes
  useEffect(() => {
    const weekMatchups = matchups.filter(m => m.matchupWeek === selectedWeek);
    if (weekMatchups.length > 0) {
      setEditRows(weekMatchups.map(m => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId })));
    } else {
      // Default to 6 empty rows (12 teams / 2)
      const numMatchups = Math.floor(teams.length / 2);
      setEditRows(Array.from({ length: numMatchups }, () => ({ homeTeamId: '', awayTeamId: '' })));
    }
  }, [selectedWeek, matchups, teams.length]);

  // Update score edits when week changes
  useEffect(() => {
    const weekMatchups = matchups.filter(m => m.matchupWeek === selectedWeek);
    setScoreEdits(weekMatchups.map(m => ({
      id: m.id,
      homeScore: m.homeScore != null ? String(m.homeScore) : '',
      awayScore: m.awayScore != null ? String(m.awayScore) : '',
    })));
  }, [selectedWeek, matchups]);

  const handleSaveMatchups = async () => {
    // Validate: no empty slots, no duplicate teams
    const usedTeams = new Set<string>();
    for (const row of editRows) {
      if (!row.homeTeamId || !row.awayTeamId) {
        toast.error('Please fill in all matchup slots.');
        return;
      }
      if (row.homeTeamId === row.awayTeamId) {
        toast.error('A team cannot play itself.');
        return;
      }
      if (usedTeams.has(row.homeTeamId) || usedTeams.has(row.awayTeamId)) {
        toast.error('Each team can only appear in one matchup per week.');
        return;
      }
      usedTeams.add(row.homeTeamId);
      usedTeams.add(row.awayTeamId);
    }

    setSaving(true);
    try {
      // Delete existing matchups for this week
      await supabase
        .from('league_matchups')
        .delete()
        .eq('league_id', leagueId)
        .eq('season_year', seasonYear)
        .eq('matchup_week', selectedWeek);

      // Insert new matchups
      const rows = editRows.map((row, idx) => ({
        id: `${leagueId}_${seasonYear}_mw${selectedWeek}_${idx + 1}`,
        league_id: leagueId,
        season_year: seasonYear,
        matchup_week: selectedWeek,
        home_team_id: row.homeTeamId,
        away_team_id: row.awayTeamId,
      }));

      const { error } = await supabase.from('league_matchups').insert(rows);
      if (error) throw error;

      // Update local state
      setMatchups(prev => [
        ...prev.filter(m => !(m.matchupWeek === selectedWeek)),
        ...rows.map(mapMatchup),
      ]);

      toast.success(`Week ${selectedWeek} matchups saved!`);
    } catch (err: any) {
      toast.error(`Error saving matchups: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (teams.length < 2) {
      toast.error('Need at least 2 teams.');
      return;
    }
    if (teams.length % 2 !== 0) {
      toast.error('Odd number of teams not supported yet.');
      return;
    }

    const confirmed = confirm(
      `Auto-generate round-robin matchups for all ${matchupWeeks.length} weeks?\n\n` +
      `This will REPLACE all existing matchups for the ${seasonYear} season.\n` +
      `${teams.length} teams × ${matchupWeeks.length} weeks = ${matchupWeeks.length * (teams.length / 2)} total matchups.`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      // Delete all existing matchups for this season
      await supabase
        .from('league_matchups')
        .delete()
        .eq('league_id', leagueId)
        .eq('season_year', seasonYear);

      // Round-robin generation
      const teamIds = teams.map(t => t.id);
      const n = teamIds.length;
      const rounds: Array<Array<[string, string]>> = [];
      const rotatingTeams = [...teamIds];

      for (let round = 0; round < n - 1; round++) {
        const pairs: Array<[string, string]> = [];
        for (let i = 0; i < n / 2; i++) {
          const home = rotatingTeams[i];
          const away = rotatingTeams[n - 1 - i];
          if (round % 2 === 0) {
            pairs.push([home, away]);
          } else {
            pairs.push([away, home]);
          }
        }
        rounds.push(pairs);

        // Rotate: keep first fixed, rotate rest clockwise
        const last = rotatingTeams.pop()!;
        rotatingTeams.splice(1, 0, last);
      }

      const allRows = [];
      for (let weekIdx = 0; weekIdx < matchupWeeks.length; weekIdx++) {
        const roundIdx = weekIdx % rounds.length;
        const pairs = rounds[roundIdx];
        const mw = matchupWeeks[weekIdx];

        for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
          allRows.push({
            id: `${leagueId}_${seasonYear}_mw${mw}_${pairIdx + 1}`,
            league_id: leagueId,
            season_year: seasonYear,
            matchup_week: mw,
            home_team_id: pairs[pairIdx][0],
            away_team_id: pairs[pairIdx][1],
          });
        }
      }

      // Insert in chunks
      for (let i = 0; i < allRows.length; i += 500) {
        const chunk = allRows.slice(i, i + 500);
        const { error } = await supabase.from('league_matchups').insert(chunk);
        if (error) throw error;
      }

      setMatchups(allRows.map(mapMatchup));
      toast.success(`Generated ${allRows.length} matchups across ${matchupWeeks.length} weeks!`);
    } catch (err: any) {
      toast.error(`Error generating matchups: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScores = async () => {
    setSaving(true);
    try {
      for (const edit of scoreEdits) {
        const homeScore = edit.homeScore.trim() === '' ? null : parseInt(edit.homeScore, 10);
        const awayScore = edit.awayScore.trim() === '' ? null : parseInt(edit.awayScore, 10);

        const { error } = await supabase
          .from('league_matchups')
          .update({
            home_score: homeScore,
            away_score: awayScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', edit.id);
        if (error) throw error;
      }

      // Update local state
      setMatchups(prev => prev.map(m => {
        const edit = scoreEdits.find(e => e.id === m.id);
        if (!edit) return m;
        return {
          ...m,
          homeScore: edit.homeScore.trim() === '' ? null : parseInt(edit.homeScore, 10),
          awayScore: edit.awayScore.trim() === '' ? null : parseInt(edit.awayScore, 10),
        };
      }));

      toast.success(`Scores saved for Week ${selectedWeek}!`);
    } catch (err: any) {
      toast.error(`Error saving scores: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const teamMap = new Map(teams.map(t => [t.id, t]));
  const weekMatchups = matchups.filter(m => m.matchupWeek === selectedWeek);

  // Compute W-L-T records from all scored matchups
  const records = useMemo(() => {
    const map = new Map<string, TeamRecord>();
    for (const m of matchups) {
      if (m.homeScore === null || m.awayScore === null) continue;
      if (!map.has(m.homeTeamId)) map.set(m.homeTeamId, { wins: 0, losses: 0, ties: 0 });
      if (!map.has(m.awayTeamId)) map.set(m.awayTeamId, { wins: 0, losses: 0, ties: 0 });
      const h = map.get(m.homeTeamId)!;
      const a = map.get(m.awayTeamId)!;
      if (scoringMode === 'category_record') {
        h.wins += m.homeScore;
        h.losses += m.awayScore;
        a.wins += m.awayScore;
        a.losses += m.homeScore;
      } else {
        if (m.homeScore > m.awayScore) { h.wins++; a.losses++; }
        else if (m.awayScore > m.homeScore) { a.wins++; h.losses++; }
        else { h.ties++; a.ties++; }
      }
    }
    return map;
  }, [matchups, scoringMode]);

  const formatRecord = (teamId: string): string => {
    const rec = records.get(teamId);
    if (!rec) return '0-0';
    return rec.ties > 0 ? `${rec.wins}-${rec.losses}-${rec.ties}` : `${rec.wins}-${rec.losses}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#121212] rounded-lg p-8 text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#121212] rounded-lg border border-gray-800 max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Manage Matchups</h2>
              <p className="text-sm text-gray-400 mt-1">
                {seasonYear} Season — {teams.length} teams, {matchupWeeks.length} matchup weeks
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setTab('matchups')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === 'matchups'
                  ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Set Matchups
            </button>
            <button
              onClick={() => setTab('scores')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === 'scores'
                  ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Enter Scores
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Week selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-300">Week</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
            >
              {matchupWeeks.map(w => (
                <option key={w} value={w}>
                  Week {w} {matchups.some(m => m.matchupWeek === w) ? '' : '(no matchups)'}
                </option>
              ))}
            </select>
            {tab === 'matchups' && (
              <button
                onClick={handleAutoGenerate}
                disabled={saving}
                className="ml-auto px-4 py-2 text-sm text-purple-400 border border-purple-400/30 rounded-lg hover:bg-purple-400/10 transition-colors disabled:opacity-50"
              >
                Auto-Generate All Weeks
              </button>
            )}
          </div>

          {tab === 'matchups' && (
            <>
              {/* Matchup rows */}
              <div className="space-y-3">
                {editRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-6 text-right">{idx + 1}</span>
                    <select
                      value={row.homeTeamId}
                      onChange={(e) => {
                        const updated = [...editRows];
                        updated[idx] = { ...updated[idx], homeTeamId: e.target.value };
                        setEditRows(updated);
                      }}
                      className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-400"
                    >
                      <option value="">-- Home --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-600">vs</span>
                    <select
                      value={row.awayTeamId}
                      onChange={(e) => {
                        const updated = [...editRows];
                        updated[idx] = { ...updated[idx], awayTeamId: e.target.value };
                        setEditRows(updated);
                      }}
                      className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-400"
                    >
                      <option value="">-- Away --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveMatchups}
                disabled={saving}
                className="w-full px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : `Save Week ${selectedWeek} Matchups`}
              </button>
            </>
          )}

          {tab === 'scores' && (
            <>
              {weekMatchups.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No matchups set for Week {selectedWeek}. Set matchups first.
                </p>
              ) : (
                <div className="space-y-3">
                  {scoreEdits.map((edit, idx) => {
                    const matchup = weekMatchups[idx];
                    if (!matchup) return null;
                    const homeTeam = teamMap.get(matchup.homeTeamId);
                    const awayTeam = teamMap.get(matchup.awayTeamId);

                    return (
                      <div key={edit.id} className="flex items-center gap-3 bg-[#0a0a0a] rounded-lg p-3 border border-gray-800">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-white truncate block">
                            {homeTeam?.name || '???'}
                          </span>
                          <span className="text-xs text-gray-500">{formatRecord(matchup.homeTeamId)}</span>
                        </div>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="9"
                          placeholder="Cats"
                          value={edit.homeScore}
                          onChange={(e) => {
                            const updated = [...scoreEdits];
                            updated[idx] = { ...updated[idx], homeScore: e.target.value };
                            setScoreEdits(updated);
                          }}
                          className="w-20 px-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white text-sm text-center focus:outline-none focus:border-green-400"
                        />
                        <span className="text-xs text-gray-600">—</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="9"
                          placeholder="Cats"
                          value={edit.awayScore}
                          onChange={(e) => {
                            const updated = [...scoreEdits];
                            updated[idx] = { ...updated[idx], awayScore: e.target.value };
                            setScoreEdits(updated);
                          }}
                          className="w-20 px-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white text-sm text-center focus:outline-none focus:border-green-400"
                        />
                        <div className="flex-1 min-w-0 text-right">
                          <span className="text-sm font-semibold text-white truncate block">
                            {awayTeam?.name || '???'}
                          </span>
                          <span className="text-xs text-gray-500">{formatRecord(matchup.awayTeamId)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {weekMatchups.length > 0 && (
                <button
                  onClick={handleSaveScores}
                  disabled={saving}
                  className="w-full px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : `Save Week ${selectedWeek} Scores`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

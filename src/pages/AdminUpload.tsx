import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { baseKeeperRound } from '../lib/keeperAlgorithms';
import { toAbbrev } from '../lib/nbaTeams';
import Papa from 'papaparse';
import type { Player } from '../types';

export function AdminUpload() {
  const isSiteAdmin = useIsSiteAdmin();
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState<'players' | 'projectedStats' | 'previousStats' | 'prospects' | 'schedule'>('players');
  const [file, setFile] = useState<File | null>(null);
  const [leagueId, setLeagueId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!isSiteAdmin) {
      navigate('/');
    }
  }, [isSiteAdmin, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setProgress({ current: 0, total: 0 });
    }
  };

  const parseCSV = async (text: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
        complete: (results) => {
          resolve(results.data);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  };

  const handleUploadProjectedStats = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const text = await file.text();
      const rows = await parseCSV(text);

      setProgress({ current: 0, total: rows.length });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Skip empty rows
          if (!row.fantraxId || !row.name) {
            continue;
          }

          const parseNumber = (value: any): number => {
            const num = parseFloat(String(value || '0').replace(/,/g, ''));
            return isNaN(num) ? 0 : num;
          };

          const salary = parseNumber(row.Salary || row.salary);
          const score = parseNumber(row.Score || row.score);

          // Calculate Salary Score (PPM - Points Per Million)
          const salaryScore = salary > 0 ? (score / salary) * 1_000_000 : 0;

          const projectedStatsData = {
            fantrax_id: row.fantraxId.trim(),
            name: row.name.trim(),
            nba_team: row.nbaTeam?.trim() || '',
            position: (row.Position || row.position || '').trim(),
            rk_ov: parseNumber(row.RkOv || row.rkOv),
            age: Math.floor(parseNumber(row.Age || row.age)),
            salary,
            score,
            adp: parseNumber(row.ADP || row.adp),
            fg_percent: parseNumber(row['FG%'] || row.fgPercent),
            three_point_made: parseNumber(row['3PTM'] || row.threePointMade),
            ft_percent: parseNumber(row['FT%'] || row.ftPercent),
            points: parseNumber(row.PTS || row.points),
            rebounds: parseNumber(row.REB || row.rebounds),
            assists: parseNumber(row.AST || row.assists),
            steals: parseNumber(row.ST || row.steals),
            blocks: parseNumber(row.BLK || row.blocks),
            assist_to_turnover: parseNumber(row['A/TO'] || row.assistToTurnover),
            salary_score: isNaN(salaryScore) ? 0 : salaryScore,
            season_year: '2025-26',
          };

          // Save to Supabase using fantrax_id as primary key
          const { error } = await supabase
            .from('projected_stats')
            .upsert(projectedStatsData, { onConflict: 'fantrax_id' });
          if (error) throw error;

          successCount++;
          setProgress({ current: i + 1, total: rows.length });
        } catch (error: any) {
          errors.push(`Row ${i + 2} (${row.name || 'unknown'}): ${error.message}`);
          console.error(`Error processing row ${i + 2}:`, error, row);
        }
      }

      setResults({ success: successCount, errors });
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadPreviousStats = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const text = await file.text();
      const rows = await parseCSV(text);

      setProgress({ current: 0, total: rows.length });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Skip empty rows
          if (!row.fantraxId || !row.name) {
            continue;
          }

          const parseNumber = (value: any): number => {
            const num = parseFloat(String(value || '0').replace(/,/g, ''));
            return isNaN(num) ? 0 : num;
          };

          const previousStatsData = {
            fantrax_id: row.fantraxId.trim(),
            name: row.name.trim(),
            nba_team: row.nbaTeam?.trim() || '',
            position: (row.Position || row.position || '').trim(),
            fg_percent: parseNumber(row['FG%'] || row.fgPercent),
            three_point_made: parseNumber(row['3PTM'] || row.threePointMade),
            ft_percent: parseNumber(row['FT%'] || row.ftPercent),
            points: parseNumber(row.PTS || row.points),
            rebounds: parseNumber(row.REB || row.rebounds),
            assists: parseNumber(row.AST || row.assists),
            steals: parseNumber(row.ST || row.steals),
            blocks: parseNumber(row.BLK || row.blocks),
            assist_to_turnover: parseNumber(row['A/TO'] || row.assistToTurnover),
            season_year: '2024-25',
          };

          // Save to Supabase using fantrax_id as primary key
          const { error } = await supabase
            .from('previous_stats')
            .upsert(previousStatsData, { onConflict: 'fantrax_id' });
          if (error) throw error;

          successCount++;
          setProgress({ current: i + 1, total: rows.length });
        } catch (error: any) {
          errors.push(`Row ${i + 2} (${row.name || 'unknown'}): ${error.message}`);
          console.error(`Error processing row ${i + 2}:`, error, row);
        }
      }

      setResults({ success: successCount, errors });
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadProspects = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const text = await file.text();
      const rows = await parseCSV(text);

      setProgress({ current: 0, total: rows.length });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Skip empty rows
          if (!row.Player && !row.player) {
            continue;
          }

          const parseNumber = (value: any): number => {
            const num = parseFloat(String(value || '0').replace(/,/g, ''));
            return isNaN(num) ? 0 : num;
          };

          const playerName = (row.Player || row.player).trim();
          const rank = parseNumber(row.Rk || row.rank);

          // Generate ID from player name (lowercase, no spaces)
          const prospectId = playerName.toLowerCase().replace(/[^a-z0-9]/g, '_');

          const prospect: any = {
            id: prospectId,
            rank,
            player: playerName,
            school: (row.School || row.school || '').trim(),
            year: (row.Year || row.year || '').trim(),
            position: (row.Pos || row.position || '').trim(),
            position_rank: parseNumber(row['Pos Rk'] || row.posRk || row.positionRank),
            height: (row.HT || row.height || '').trim(),
            weight: parseNumber(row.WT || row.weight),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Add optional fields only if they have values
          const age = row.Age || row.age;
          if (age && String(age).trim()) {
            prospect.age = parseNumber(age);
          }

          const hometown = row.Hometown || row.hometown;
          if (hometown && String(hometown).trim()) {
            prospect.hometown = String(hometown).trim();
          }

          const highSchool = row['High School'] || row.highSchool;
          if (highSchool && String(highSchool).trim()) {
            prospect.high_school = String(highSchool).trim();
          }

          const draftYear = row['Draft Year'] || row.draftYear;
          if (draftYear && String(draftYear).trim()) {
            prospect.draft_year = parseNumber(draftYear);
          }

          const draftProjection = row['Draft Projection'] || row.draftProjection;
          if (draftProjection && String(draftProjection).trim()) {
            prospect.draft_projection = String(draftProjection).trim();
          }

          const scoutingReport = row['Scouting Report'] || row.scoutingReport;
          if (scoutingReport && String(scoutingReport).trim()) {
            prospect.scouting_report = String(scoutingReport).trim();
          }

          const strengths = row.Strengths || row.strengths;
          if (strengths && String(strengths).trim()) {
            prospect.strengths = String(strengths).split(',').map((s: string) => s.trim()).filter(s => s);
          }

          const weaknesses = row.Weaknesses || row.weaknesses;
          if (weaknesses && String(weaknesses).trim()) {
            prospect.weaknesses = String(weaknesses).split(',').map((s: string) => s.trim()).filter(s => s);
          }

          const playerComparison = row['Player Comparison'] || row.playerComparison;
          if (playerComparison && String(playerComparison).trim()) {
            prospect.player_comparison = String(playerComparison).trim();
          }

          // Save to Supabase using generated ID
          const { error } = await supabase
            .from('prospects')
            .upsert(prospect, { onConflict: 'id' });
          if (error) throw error;

          successCount++;
          setProgress({ current: i + 1, total: rows.length });
        } catch (error: any) {
          errors.push(`Row ${i + 2} (${row.Player || row.player || 'unknown'}): ${error.message}`);
          console.error(`Error processing row ${i + 2}:`, error, row);
        }
      }

      setResults({ success: successCount, errors });
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSchedule = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    const errors: string[] = [];
    let successCount = 0;

    const MONTH_MAP: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };

    function parseBBRefDate(dateStr: string): string {
      // "Tue Oct 21 2025" or "Tue, Oct 21, 2025" → "2025-10-21"
      const cleaned = dateStr.trim().replace(/,/g, '');
      const parts = cleaned.split(/\s+/);
      const month = MONTH_MAP[parts[1]] || '01';
      const day = parts[2].padStart(2, '0');
      const year = parts[3];
      return `${year}-${month}-${day}`;
    }

    function getSeasonYear(gameDate: string): number {
      const month = parseInt(gameDate.split('-')[1]);
      const year = parseInt(gameDate.split('-')[0]);
      return month >= 10 ? year : year - 1;
    }

    try {
      let text = await file.text();

      // Basketball Reference wraps every line in quotes — strip them so PapaParse can split on commas
      // Normalize line endings first (\r\n → \n)
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (text.startsWith('"')) {
        text = text
          .split('\n')
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              return trimmed.slice(1, -1);
            }
            return trimmed;
          })
          .join('\n');
      }

      const rows = await parseCSV(text);

      setProgress({ current: 0, total: rows.length });

      const batch: Array<{
        id: string;
        season_year: number;
        game_date: string;
        away_team: string;
        home_team: string;
        is_cup_game: boolean;
        notes: string | null;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const dateStr = row['Date'];
          if (!dateStr || dateStr === 'Date') continue; // skip empty rows and repeated header rows

          const gameDate = parseBBRefDate(dateStr);
          const awayName = row['Visitor/Neutral'] || '';
          const homeName = row['Home/Neutral'] || '';

          if (!awayName || !homeName) continue;

          const awayAbbrev = toAbbrev(awayName);
          const homeAbbrev = toAbbrev(homeName);
          const seasonYear = getSeasonYear(gameDate);
          const notes = row['Notes'] || null;
          const isCupGame = !!(notes && notes.includes('NBA Cup'));

          const id = `${seasonYear}_${gameDate}_${awayAbbrev}_${homeAbbrev}`;

          batch.push({
            id,
            season_year: seasonYear,
            game_date: gameDate,
            away_team: awayAbbrev,
            home_team: homeAbbrev,
            is_cup_game: isCupGame,
            notes,
          });

          successCount++;
          setProgress({ current: i + 1, total: rows.length });
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      // Upsert in chunks of 500
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const { error } = await supabase
          .from('games')
          .upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }

      setResults({ success: successCount, errors });
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (uploadType === 'projectedStats') {
      return handleUploadProjectedStats();
    }

    if (uploadType === 'previousStats') {
      return handleUploadPreviousStats();
    }

    if (uploadType === 'prospects') {
      return handleUploadProspects();
    }

    if (uploadType === 'schedule') {
      return handleUploadSchedule();
    }

    if (!file || !leagueId) {
      alert('Please select a file and enter league ID');
      return;
    }

    setUploading(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const text = await file.text();
      const rows = await parseCSV(text);

      setProgress({ current: 0, total: rows.length });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const isRookie = row.isRookie === 'true' || row.isRookie === '1';
          const onIR = row.onIR === 'true' || row.onIR === '1';
          const isInternationalStash = row.isInternationalStash === 'true' || row.isInternationalStash === '1';
          const intEligible = row.intEligible === 'true' || row.intEligible === '1';

          const player: Partial<Player> = {
            id: row.fantraxId,
            fantraxId: row.fantraxId || `player_${Date.now()}_${Math.random()}`,
            name: row.name,
            position: row.position,
            salary: parseInt(row.salary) || 0,
            nbaTeam: row.nbaTeam || '',
            roster: {
              leagueId,
              teamId: row.teamId || null,
              onIR,
              isRookie,
              isInternationalStash,
              intEligible,
            },
          };

          // Add rookie info if applicable
          if (isRookie && row.rookieRound && row.rookiePick) {
            player.roster!.rookieDraftInfo = {
              round: parseInt(row.rookieRound) as 1 | 2 | 3,
              pick: parseInt(row.rookiePick),
              redshirtEligible: row.redshirtEligible === 'true' || row.redshirtEligible === '1',
            };
          }

          // Add keeper info if applicable
          if (row.priorYearRound) {
            player.keeper = {
              priorYearRound: parseInt(row.priorYearRound),
            };
          }

          // Calculate derived base round
          if (player.keeper || player.roster?.rookieDraftInfo) {
            const derivedBaseRound = baseKeeperRound(player as Player);
            if (derivedBaseRound) {
              player.keeper = player.keeper || {};
              player.keeper.derivedBaseRound = derivedBaseRound;
            }
          }

          // Map to Supabase snake_case columns (flatten nested)
          const playerData = {
            id: player.id,
            fantrax_id: player.fantraxId,
            name: player.name,
            position: player.position,
            salary: player.salary,
            nba_team: player.nbaTeam,
            league_id: player.roster!.leagueId,
            team_id: player.roster!.teamId || null,
            on_ir: player.roster!.onIR,
            is_rookie: player.roster!.isRookie,
            is_international_stash: player.roster!.isInternationalStash,
            int_eligible: player.roster!.intEligible,
            rookie_draft_info: player.roster!.rookieDraftInfo || null,
            keeper_prior_year_round: player.keeper?.priorYearRound || null,
            keeper_derived_base_round: player.keeper?.derivedBaseRound || null,
          };

          // Save to Supabase using fantraxId as primary key
          const { error } = await supabase
            .from('players')
            .upsert(playerData, { onConflict: 'id' });
          if (error) throw error;

          successCount++;
          setProgress({ current: i + 1, total: rows.length });
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      setResults({ success: successCount, errors });
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const handleDeleteCollection = async (collectionName: 'players' | 'projectedStats' | 'previousStats' | 'prospects' | 'schedule') => {
    // Map collection names to Supabase table names
    const tableMap: Record<string, string> = {
      players: 'players',
      projectedStats: 'projected_stats',
      previousStats: 'previous_stats',
      prospects: 'prospects',
      schedule: 'games',
    };
    const tableName = tableMap[collectionName];

    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete ALL rows in the "${tableName}" table. This cannot be undone. Are you absolutely sure?`
    );

    if (!confirmed) return;

    const doubleCheck = window.confirm(
      `This is your last chance. Type "DELETE" in the next prompt to confirm deletion of ${tableName} table.`
    );

    if (!doubleCheck) return;

    const finalConfirm = window.prompt('Type DELETE to confirm:');
    if (finalConfirm !== 'DELETE') {
      alert('Deletion cancelled - text did not match.');
      return;
    }

    try {
      setUploading(true);

      // Count rows first
      const { count, error: countErr } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      if (countErr) throw countErr;

      const totalCount = count || 0;
      setProgress({ current: 0, total: totalCount });

      // Delete all rows - Supabase doesn't have batch limits like Firestore
      // Use a broad filter to delete all rows
      const { error: deleteErr } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '___impossible_id___'); // Supabase requires a filter for delete, this matches all rows
      if (deleteErr) throw deleteErr;

      setProgress({ current: totalCount, total: totalCount });

      alert(`Successfully deleted ${totalCount} rows from ${tableName} table.`);
      setResults({ success: totalCount, errors: [] });
    } catch (error: any) {
      alert(`Failed to delete table data: ${error.message}`);
      console.error('Delete error:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!isSiteAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Teams
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Uploads</h1>
          <p className="text-gray-500 mt-1">Bulk import players, stats, prospects, or NBA schedule from a CSV file</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          {/* Upload Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Type
            </label>
            <select
              value={uploadType}
              onChange={(e) => {
                setUploadType(e.target.value as 'players' | 'projectedStats' | 'previousStats' | 'prospects' | 'schedule');
                setFile(null);
                setResults(null);
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="players">Player Data</option>
              <option value="projectedStats">Projected Stats (2025-26)</option>
              <option value="previousStats">Previous Season Stats (2024-25)</option>
              <option value="prospects">Prospects (Draft Rankings)</option>
              <option value="schedule">NBA Schedule (Basketball Reference)</option>
            </select>
          </div>

          {/* League ID input (only for players) */}
          {uploadType === 'players' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                League ID
              </label>
              <select
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select a league</option>
                <option value="XPL9dJv8BTFNAMlrNBpJ">Main League (XPL9dJv8BTFNAMlrNBpJ)</option>
              </select>
            </div>
          )}

          {/* File upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Uploading {uploadType === 'players' ? 'players' : uploadType === 'projectedStats' ? 'projected stats' : uploadType === 'previousStats' ? 'previous stats' : uploadType === 'prospects' ? 'prospects' : 'games'}...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload button */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || (uploadType === 'players' && !leagueId) || uploading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' :
               uploadType === 'players' ? 'Upload Players' :
               uploadType === 'projectedStats' ? 'Upload Projected Stats' :
               uploadType === 'previousStats' ? 'Upload Previous Stats' :
               uploadType === 'prospects' ? 'Upload Prospects' :
               'Upload Schedule'}
            </button>

            <button
              onClick={() => handleDeleteCollection(uploadType)}
              disabled={uploading}
              className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete All
            </button>
          </div>

          {/* Results */}
          {results && (
            <div className="mt-6">
              <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                <p className="text-green-800 font-semibold">
                  ✓ Successfully uploaded {results.success} {uploadType === 'players' ? 'players' : uploadType === 'projectedStats' ? 'projected stats' : uploadType === 'previousStats' ? 'previous stats' : uploadType === 'prospects' ? 'prospects' : 'games'}
                </p>
              </div>

              {results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-red-800 font-semibold mb-2">
                    ⚠ {results.errors.length} errors:
                  </p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {results.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* CSV format guide */}
          <div className="mt-8 border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">CSV Format</h3>

            {uploadType === 'schedule' ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Download monthly schedule CSVs from Basketball Reference (Share &amp; Export &gt; CSV).
                </p>
                <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                  Date,Start (ET),Visitor/Neutral,PTS,Home/Neutral,PTS,,,Attend.,LOG,Arena,Notes
                </div>
                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p><strong>Columns used:</strong> Date, Visitor/Neutral, Home/Neutral, Notes</p>
                  <p><strong>Cup detection:</strong> Games with "NBA Cup" in the Notes column are flagged automatically</p>
                  <p><strong>Safe to re-upload:</strong> Uses upsert, so uploading the same month twice won't create duplicates</p>
                  <p><strong>Upload all months:</strong> Oct through Apr for a complete season analysis</p>
                </div>
              </>
            ) : uploadType === 'players' ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Your CSV should have these columns (first row = headers):
                </p>
                <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                  name,fantraxId,position,salary,nbaTeam,teamId,priorYearRound,isRookie,rookieRound,rookiePick,redshirtEligible,intEligible,onIR,isInternationalStash
                </div>

                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p><strong>Required:</strong> name, position, salary, nbaTeam</p>
                  <p><strong>Optional:</strong> teamId (your team's document ID), priorYearRound (1-13 for returning players)</p>
                  <p><strong>For rookies:</strong> isRookie=true, rookieRound (1-3), rookiePick (1-12), redshirtEligible=true/false, intEligible=true/false</p>
                  <p><strong>Boolean fields:</strong> Use "true" or "1" for true, anything else for false</p>
                  <p><strong>Column order:</strong> Doesn't matter! Columns can be in any order as long as headers match.</p>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Example CSV:</h4>
                  <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                    name,fantraxId,position,salary,nbaTeam,teamId,priorYearRound,isRookie,rookieRound,rookiePick,redshirtEligible<br/>
                    LeBron James,lbj001,"SF,PF",45000000,LAL,abc123xyz,3,false,,,false<br/>
                    Victor Wembanyama,vw001,C,12000000,SAS,abc123xyz,,true,1,1,true
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    ℹ️ Fields with commas (like "SF,PF") should be wrapped in quotes
                  </p>
                </div>
              </>
            ) : uploadType === 'prospects' ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Your CSV should have these columns (first row = headers):
                </p>
                <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                  Rk,Player,School,Year,Pos,Pos Rk,HT,WT
                </div>

                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p><strong>Required:</strong> Rk (rank), Player (name), School, Year, Pos (position), Pos Rk (position rank), HT (height), WT (weight)</p>
                  <p><strong>Optional:</strong> Age, Hometown, High School, Draft Year, Draft Projection, Scouting Report, Strengths, Weaknesses, Player Comparison</p>
                  <p><strong>List fields:</strong> Strengths and Weaknesses can be comma-separated (will be split into array)</p>
                  <p><strong>Column order:</strong> Doesn't matter! Columns can be in any order as long as headers match.</p>
                  <p><strong>ID Generation:</strong> Document ID automatically generated from player name</p>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Example CSV:</h4>
                  <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                    Rk,Player,School,Year,Pos,Pos Rk,HT,WT,Draft Year,Draft Projection<br/>
                    1,Cooper Flagg,Duke,Fr,PF,1,6-9,205,2025,Lottery Pick<br/>
                    2,Ace Bailey,Rutgers,Fr,SF,1,6-10,200,2025,Top 5 Pick<br/>
                    3,Dylan Harper,Rutgers,Fr,SG,1,6-6,215,2025,Top 3 Pick
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    ℹ️ Height format: "6-9" for 6 feet 9 inches. Weight in pounds.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Your CSV should have these columns (first row = headers):
                </p>
                <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                  fantraxId,name,nbaTeam,position,rkOv,age,salary,score,z3PtPts,fgPercent,threePointMade,rebounds,points,blocks,assists,turnoversPerGame,assistToTurnover
                </div>

                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p><strong>Required:</strong> fantraxId, name, salary, score</p>
                  <p><strong>Stats:</strong> All numeric fields (use decimals for percentages)</p>
                  <p><strong>Salary Score:</strong> Automatically calculated as (score / salary) × 1,000,000</p>
                  <p><strong>Season:</strong> Automatically set to 2025-26 (preseason projection)</p>
                  <p><strong>Column order:</strong> Doesn't matter! Columns can be in any order as long as headers match.</p>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Example CSV:</h4>
                  <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                    fantraxId,name,nbaTeam,position,salary,score,fgPercent,rebounds,points<br/>
                    lbj001,LeBron James,LAL,"SF,PF","45,999,660",100,0.486,3.9,36.7<br/>
                    vw001,Victor Wembanyama,SAS,C,"12,000,000",110,0.489,9.3,32.7
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    ℹ️ Salary can include commas - they will be automatically removed during upload
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

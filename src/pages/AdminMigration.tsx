import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { useNavigate } from 'react-router-dom';

export function AdminMigration() {
  const { loading: authLoading } = useAuth();
  const isSiteAdmin = useIsSiteAdmin();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isSiteAdmin) {
    navigate('/');
    return null;
  }

  const exportDraft = async () => {
    setLoading(true);
    setStatus('Exporting draft...');

    try {
      const { data: draftRow, error: draftError } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', 'XPL9dJv8BTFNAMlrNBpJ_2025')
        .single();

      if (draftError || !draftRow) {
        setStatus('Draft not found');
        setLoading(false);
        return;
      }

      const picks = draftRow.picks;

      let csv = 'pickId,currentTeamId,originalTeamId,playerId,playerName,round,pickInRound,overallPick,isKeeperSlot,pickedAt,pickedBy\n';

      const escapeCSV = (value: any) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      picks.forEach((pick: any) => {
        const pickId = `XPL9dJv8BTFNAMlrNBpJ_2025_pick_${pick.overallPick}`;
        csv += [
          escapeCSV(pickId),
          escapeCSV(pick.teamId),
          escapeCSV(pick.teamId),
          escapeCSV(pick.playerId),
          escapeCSV(pick.playerName),
          escapeCSV(pick.round),
          escapeCSV(pick.pickInRound),
          escapeCSV(pick.overallPick),
          escapeCSV(pick.isKeeperSlot ? 'true' : 'false'),
          escapeCSV(pick.pickedAt),
          escapeCSV(pick.pickedBy)
        ].join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'draft_picks.csv';
      a.click();

      setStatus(`Exported ${picks.length} picks to CSV`);
    } catch (error: any) {
      setStatus(`Error: ${error.message}\n\nCode: ${error.code || 'unknown'}`);
      console.error('Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('Importing CSV...');

    try {
      // Load team data first to get names
      setStatus('Loading team data...');
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*');
      if (teamsError) throw teamsError;

      const teamNames: Record<string, { name: string; abbrev: string }> = {};
      (teamsData || []).forEach((row: any) => {
        teamNames[row.id] = {
          name: row.name || '',
          abbrev: row.abbrev || ''
        };
      });

      const text = await file.text();
      const lines = text.split('\n');
      setStatus('Parsing CSV...');

      // Parse CSV properly handling quoted values
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current);
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVLine(lines[i]);
        const pick: any = {};

        headers.forEach((header, index) => {
          pick[header.trim()] = values[index]?.trim() || null;
        });

        const originalTeam = teamNames[pick.originalTeamId];
        const pickDoc = {
          id: pick.pickId,
          league_id: 'XPL9dJv8BTFNAMlrNBpJ',
          season_year: 2025,
          round: parseInt(pick.round),
          pick_in_round: parseInt(pick.pickInRound),
          overall_pick: parseInt(pick.overallPick),
          current_team_id: pick.currentTeamId,
          original_team_id: pick.originalTeamId,
          original_team_name: originalTeam?.name || '',
          original_team_abbrev: originalTeam?.abbrev || '',
          player_id: pick.playerId || null,
          player_name: pick.playerName || null,
          is_keeper_slot: pick.isKeeperSlot?.toLowerCase() === 'true' || pick.isKeeperSlot === true,
          picked_at: pick.pickedAt ? parseInt(pick.pickedAt) : null,
          picked_by: pick.pickedBy || null,
          was_traded: pick.currentTeamId !== pick.originalTeamId,
          trade_history: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('pick_assignments')
          .upsert(pickDoc);
        if (error) throw error;

        count++;

        if (count % 50 === 0) {
          setStatus(`Imported ${count} picks...`);
        }
      }

      setStatus(`Imported ${count} picks to pick_assignments table`);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testPicksView = async () => {
    setLoading(true);
    setStatus('Loading picks...');

    try {
      const { data: picksData, error: picksError } = await supabase
        .from('pick_assignments')
        .select('*');
      if (picksError) throw picksError;

      if (!picksData || picksData.length === 0) {
        setStatus('No picks found in pick_assignments table');
        setLoading(false);
        return;
      }

      const picks = picksData.map((row: any) => ({
        id: row.id,
        round: row.round,
        pickInRound: row.pick_in_round,
        overallPick: row.overall_pick,
        currentTeamId: row.current_team_id,
        playerName: row.player_name,
      }));

      // Group by round
      const byRound: any = {};
      picks.forEach((pick: any) => {
        if (!byRound[pick.round]) byRound[pick.round] = [];
        byRound[pick.round].push(pick);
      });

      // Format output
      let output = `Found ${picks.length} picks in pick_assignments table\n\n`;

      Object.keys(byRound).sort((a, b) => parseInt(a) - parseInt(b)).forEach(round => {
        output += `\n=== ROUND ${round} ===\n`;
        byRound[round]
          .sort((a: any, b: any) => a.pickInRound - b.pickInRound)
          .forEach((pick: any) => {
            output += `Pick ${pick.overallPick}: ${pick.playerName || '(empty)'} → ${pick.currentTeamId?.substring(0, 8)}\n`;
          });
      });

      setStatus(output);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Migration Tool</h1>
          <p className="text-gray-400 mt-2">Export draft to CSV, edit, then import to create pick_assignments table</p>
        </div>

        {/* Step 1: Export */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 1: Export Draft to CSV</h2>
          <p className="text-gray-400 mb-4">
            Download the current draft as a CSV file. You'll edit this file to fix the traded picks.
          </p>
          <button
            onClick={exportDraft}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Exporting...' : 'Export Draft to CSV'}
          </button>
        </div>

        {/* Step 2: Edit CSV */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 2: Edit CSV File</h2>
          <p className="text-gray-400 mb-4">
            Open the downloaded CSV in Excel/Sheets and fix the traded picks:
          </p>
          <ul className="text-gray-400 space-y-2 ml-6 list-disc">
            <li>Find pick #4 (Ja Morant) → change <code className="bg-[#0a0a0a] px-2 py-1 rounded">currentTeamId</code> from Woods to Raskob (9sRGjDOjvdSJbFwRwEDq)</li>
            <li>Find pick #126 (Quentin Grimes) → change <code className="bg-[#0a0a0a] px-2 py-1 rounded">currentTeamId</code> from Raskob to Woods (Yy7xO376mKWlJ7cZYhQ1)</li>
            <li>Verify pick #102 (Naz Reid) → <code className="bg-[#0a0a0a] px-2 py-1 rounded">currentTeamId</code> should be Woods</li>
          </ul>
          <p className="text-yellow-400 mt-4 text-sm">Save the file after editing</p>
        </div>

        {/* Step 3: Import */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 3: Import Edited CSV</h2>
          <p className="text-gray-400 mb-4">
            Upload the edited CSV to create the new pick_assignments records in Supabase.
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="block w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 file:cursor-pointer disabled:opacity-50"
          />
        </div>

        {/* Step 4: Test */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 4: Verify Data</h2>
          <p className="text-gray-400 mb-4">
            View all picks from the pick_assignments table to verify the data looks correct.
          </p>
          <button
            onClick={testPicksView}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            View Picks
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-bold text-white mb-2">Status</h3>
            <pre className="text-gray-400 whitespace-pre-wrap font-mono text-sm">{status}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

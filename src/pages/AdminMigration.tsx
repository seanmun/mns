import { useState } from 'react';
import { collection, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function AdminMigration() {
  const { role, loading: authLoading } = useAuth();
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

  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  const exportDraft = async () => {
    setLoading(true);
    setStatus('Exporting draft...');

    try {
      const draftDoc = await getDoc(doc(db, 'drafts', 'XPL9dJv8BTFNAMlrNBpJ_2025'));

      if (!draftDoc.exists()) {
        setStatus('❌ Draft not found');
        setLoading(false);
        return;
      }

      const draft = draftDoc.data();
      const picks = draft.picks;

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

      setStatus(`✅ Exported ${picks.length} picks to CSV`);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}\n\nCode: ${error.code || 'unknown'}`);
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
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const teamNames: Record<string, { name: string; abbrev: string }> = {};
      teamsSnap.docs.forEach(doc => {
        const data = doc.data();
        teamNames[doc.id] = {
          name: data.name || '',
          abbrev: data.abbrev || ''
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
          leagueId: 'XPL9dJv8BTFNAMlrNBpJ',
          seasonYear: 2025,
          round: parseInt(pick.round),
          pickInRound: parseInt(pick.pickInRound),
          overallPick: parseInt(pick.overallPick),
          currentTeamId: pick.currentTeamId,
          originalTeamId: pick.originalTeamId,
          originalTeamName: originalTeam?.name || '',
          originalTeamAbbrev: originalTeam?.abbrev || '',
          playerId: pick.playerId || null,
          playerName: pick.playerName || null,
          isKeeperSlot: pick.isKeeperSlot?.toLowerCase() === 'true' || pick.isKeeperSlot === true,
          pickedAt: pick.pickedAt ? parseInt(pick.pickedAt) : null,
          pickedBy: pick.pickedBy || null,
          wasTraded: pick.currentTeamId !== pick.originalTeamId,
          tradeHistory: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await setDoc(doc(db, 'pickAssignments', pick.pickId), pickDoc);
        count++;

        if (count % 50 === 0) {
          setStatus(`Imported ${count} picks...`);
        }
      }

      setStatus(`✅ Imported ${count} picks to pickAssignments collection`);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testPicksView = async () => {
    setLoading(true);
    setStatus('Loading picks...');

    try {
      const picksSnap = await getDocs(collection(db, 'pickAssignments'));

      if (picksSnap.empty) {
        setStatus('⚠️ No picks found in pickAssignments collection');
        setLoading(false);
        return;
      }

      const picks = picksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Group by round
      const byRound: any = {};
      picks.forEach((pick: any) => {
        if (!byRound[pick.round]) byRound[pick.round] = [];
        byRound[pick.round].push(pick);
      });

      // Format output
      let output = `✅ Found ${picks.length} picks in pickAssignments collection\n\n`;

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
      setStatus(`❌ Error: ${error.message}`);
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
          <p className="text-gray-400 mt-2">Export draft to CSV, edit, then import to create pickAssignments collection</p>
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
          <p className="text-yellow-400 mt-4 text-sm">⚠️ Save the file after editing</p>
        </div>

        {/* Step 3: Import */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Step 3: Import Edited CSV</h2>
          <p className="text-gray-400 mb-4">
            Upload the edited CSV to create the new pickAssignments collection in Firebase.
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
            View all picks from the pickAssignments collection to verify the data looks correct.
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

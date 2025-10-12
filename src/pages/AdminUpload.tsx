import { useState } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { baseKeeperRound } from '../lib/keeperAlgorithms';
import Papa from 'papaparse';
import type { Player, ProjectedStats, PreviousStats } from '../types';

export function AdminUpload() {
  const [uploadType, setUploadType] = useState<'players' | 'projectedStats' | 'previousStats'>('players');
  const [file, setFile] = useState<File | null>(null);
  const [leagueId, setLeagueId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const navigate = useNavigate();

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

          const projectedStats: ProjectedStats = {
            fantraxId: row.fantraxId.trim(),
            name: row.name.trim(),
            nbaTeam: row.nbaTeam?.trim() || '',
            position: (row.Position || row.position || '').trim(),
            rkOv: parseNumber(row.RkOv || row.rkOv),
            age: Math.floor(parseNumber(row.Age || row.age)),
            salary,
            score,
            adp: parseNumber(row.ADP || row.adp),
            fgPercent: parseNumber(row['FG%'] || row.fgPercent),
            threePointMade: parseNumber(row['3PTM'] || row.threePointMade),
            ftPercent: parseNumber(row['FT%'] || row.ftPercent),
            points: parseNumber(row.PTS || row.points),
            rebounds: parseNumber(row.REB || row.rebounds),
            assists: parseNumber(row.AST || row.assists),
            steals: parseNumber(row.ST || row.steals),
            blocks: parseNumber(row.BLK || row.blocks),
            assistToTurnover: parseNumber(row['A/TO'] || row.assistToTurnover),
            salaryScore: isNaN(salaryScore) ? 0 : salaryScore,
            seasonYear: '2025-26',
          };

          // Save to Firestore using fantraxId as document ID
          await setDoc(doc(db, 'projectedStats', row.fantraxId.trim()), projectedStats);
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

          const previousStats: PreviousStats = {
            fantraxId: row.fantraxId.trim(),
            name: row.name.trim(),
            nbaTeam: row.nbaTeam?.trim() || '',
            position: (row.Position || row.position || '').trim(),
            fgPercent: parseNumber(row['FG%'] || row.fgPercent),
            threePointMade: parseNumber(row['3PTM'] || row.threePointMade),
            ftPercent: parseNumber(row['FT%'] || row.ftPercent),
            points: parseNumber(row.PTS || row.points),
            rebounds: parseNumber(row.REB || row.rebounds),
            assists: parseNumber(row.AST || row.assists),
            steals: parseNumber(row.ST || row.steals),
            blocks: parseNumber(row.BLK || row.blocks),
            assistToTurnover: parseNumber(row['A/TO'] || row.assistToTurnover),
            seasonYear: '2024-25',
          };

          // Save to Firestore using fantraxId as document ID
          await setDoc(doc(db, 'previousStats', row.fantraxId.trim()), previousStats);
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

  const handleUpload = async () => {
    if (uploadType === 'projectedStats') {
      return handleUploadProjectedStats();
    }

    if (uploadType === 'previousStats') {
      return handleUploadPreviousStats();
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

          // Save to Firestore using fantraxId as document ID
          await setDoc(doc(db, 'players', row.fantraxId), player);
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

  const handleDeleteCollection = async (collectionName: 'players' | 'projectedStats' | 'previousStats') => {
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete ALL documents in the "${collectionName}" collection. This cannot be undone. Are you absolutely sure?`
    );

    if (!confirmed) return;

    const doubleCheck = window.confirm(
      `This is your last chance. Type "DELETE" in the next prompt to confirm deletion of ${collectionName} collection.`
    );

    if (!doubleCheck) return;

    const finalConfirm = window.prompt('Type DELETE to confirm:');
    if (finalConfirm !== 'DELETE') {
      alert('Deletion cancelled - text did not match.');
      return;
    }

    try {
      setUploading(true);
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);

      setProgress({ current: 0, total: snapshot.size });

      // Delete in batches of 500 (Firestore limit)
      const batchSize = 500;
      let deletedCount = 0;

      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + batchSize);

        batchDocs.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });

        await batch.commit();
        deletedCount += batchDocs.length;
        setProgress({ current: deletedCount, total: snapshot.size });
      }

      alert(`Successfully deleted ${deletedCount} documents from ${collectionName} collection.`);
      setResults({ success: deletedCount, errors: [] });
    } catch (error: any) {
      alert(`Failed to delete collection: ${error.message}`);
      console.error('Delete error:', error);
    } finally {
      setUploading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Manage Players</h1>
          <p className="text-gray-500 mt-1">Bulk import players, projected stats, or previous season stats from a CSV file</p>
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
                setUploadType(e.target.value as 'players' | 'projectedStats' | 'previousStats');
                setFile(null);
                setResults(null);
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="players">Player Data</option>
              <option value="projectedStats">Projected Stats (2025-26)</option>
              <option value="previousStats">Previous Season Stats (2024-25)</option>
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
                <span>Uploading players...</span>
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
              {uploading ? 'Uploading...' : uploadType === 'players' ? 'Upload Players' : uploadType === 'projectedStats' ? 'Upload Projected Stats' : 'Upload Previous Stats'}
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
                  ✓ Successfully uploaded {results.success} players
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

            {uploadType === 'players' ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  Your CSV should have these columns (first row = headers):
                </p>
                <div className="bg-gray-50 p-4 rounded text-xs font-mono overflow-x-auto">
                  name,fantraxId,position,salary,nbaTeam,teamId,priorYearRound,isRookie,rookieRound,rookiePick,redshirtEligible,intEligible,onIR,isInternationalStash
                </div>

                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <p><strong>Required:</strong> name, position, salary, nbaTeam</p>
                  <p><strong>Optional:</strong> teamId (your team's Firestore document ID), priorYearRound (1-13 for returning players)</p>
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

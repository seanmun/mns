import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCanManageLeague } from '../hooks/useCanManageLeague';
import { AdminRosterManagement } from '../components/AdminRosterManagement';
import type { League } from '../types';

// --- Mapping helper ---

function mapLeague(row: any): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines || { keepersLockAt: '', redshirtLockAt: '', draftAt: '' },
    cap: row.cap,
    schedule: row.schedule || undefined,
    keepersLocked: row.keepers_locked,
    draftStatus: row.draft_status,
    seasonStatus: row.season_status,
    commissionerId: row.commissioner_id || undefined,
    leaguePhase: row.league_phase || 'keeper_season',
  };
}

export function AdminRosterManager() {
  const canManage = useCanManageLeague();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);

  useEffect(() => {
    if (!canManage) {
      navigate('/');
      return;
    }

    const fetchLeagues = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('leagues')
          .select('*');
        if (error) throw error;

        const leagueData = (rows || []).map(mapLeague);
        setLeagues(leagueData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching leagues:', error);
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [canManage, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Roster Management</h1>

        {/* League Selection */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Select League</h2>
          <div className="grid gap-3">
            {leagues.map((league) => (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  selectedLeague?.id === league.id
                    ? 'border-purple-400 bg-purple-400/10 text-white'
                    : 'border-gray-700 hover:border-gray-600 text-gray-300'
                }`}
              >
                <div className="font-semibold">{league.name}</div>
                <div className="text-sm text-gray-500">{league.seasonYear} Season</div>
              </button>
            ))}
          </div>
        </div>

        {/* Info Box */}
        {!selectedLeague && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <div className="font-semibold text-blue-400 mb-1">Select a League</div>
                <div className="text-sm text-gray-300">
                  Choose a league above to manage rosters. You'll be able to:
                </div>
                <ul className="list-disc list-inside text-sm text-gray-400 mt-2 space-y-1">
                  <li>Add free agents to any team</li>
                  <li>Move players to/from IR</li>
                  <li>Drop players from rosters</li>
                  <li>View real-time roster counts</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Roster Management Modal */}
      {selectedLeague && (
        <AdminRosterManagement
          leagueId={selectedLeague.id}
          seasonYear={selectedLeague.seasonYear}
          onClose={() => setSelectedLeague(null)}
        />
      )}
    </div>
  );
}

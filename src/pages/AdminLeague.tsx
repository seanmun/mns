import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchAllRows } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AdminRosterManagement } from '../components/AdminRosterManagement';
import type { League, RegularSeasonRoster, Player, TeamFees } from '../types';

// --- Mapping helpers ---

function mapLeague(row: any): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines || {},
    cap: row.cap || {},
    keepersLocked: row.keepers_locked,
    draftStatus: row.draft_status,
    seasonStatus: row.season_status,
    seasonStartedAt: row.season_started_at ? new Date(row.season_started_at).getTime() : undefined,
    seasonStartedBy: row.season_started_by || undefined,
  };
}

function mapPlayer(row: any): Player {
  return {
    id: row.id,
    fantraxId: row.fantrax_id,
    name: row.name,
    position: row.position,
    salary: row.salary,
    nbaTeam: row.nba_team,
    roster: {
      leagueId: row.league_id,
      teamId: row.team_id,
      onIR: row.on_ir,
      isRookie: row.is_rookie,
      isInternationalStash: row.is_international_stash,
      intEligible: row.int_eligible,
      rookieDraftInfo: row.rookie_draft_info || undefined,
    },
    keeper:
      row.keeper_prior_year_round != null || row.keeper_derived_base_round != null
        ? {
            priorYearRound: row.keeper_prior_year_round || undefined,
            derivedBaseRound: row.keeper_derived_base_round || undefined,
          }
        : undefined,
  };
}

export function AdminLeague() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [showRosterManagement, setShowRosterManagement] = useState(false);
  const [startingSeasonProcessing, setStartingSeasonProcessing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    seasonYear: 2025,
    'cap.floor': 170_000_000,
    'cap.firstApron': 195_000_000,
    'cap.secondApron': 225_000_000,
    'cap.max': 255_000_000,
    'cap.tradeLimit': 40_000_000,
    'cap.penaltyRatePerM': 2,
  });

  useEffect(() => {
    if (role !== 'admin') {
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
  }, [role, navigate]);

  const handleSelectLeague = (league: League) => {
    setSelectedLeague(league);
    setEditForm({
      name: league.name,
      seasonYear: league.seasonYear,
      'cap.floor': league.cap.floor,
      'cap.firstApron': league.cap.firstApron,
      'cap.secondApron': league.cap.secondApron,
      'cap.max': league.cap.max,
      'cap.tradeLimit': league.cap.tradeLimit,
      'cap.penaltyRatePerM': league.cap.penaltyRatePerM,
    });
  };

  const handleSave = async () => {
    if (!selectedLeague) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('leagues')
        .update({
          name: editForm.name,
          season_year: editForm.seasonYear,
          cap: {
            floor: editForm['cap.floor'],
            firstApron: editForm['cap.firstApron'],
            secondApron: editForm['cap.secondApron'],
            max: editForm['cap.max'],
            tradeLimit: editForm['cap.tradeLimit'],
            penaltyRatePerM: editForm['cap.penaltyRatePerM'],
          },
        })
        .eq('id', selectedLeague.id);
      if (error) throw error;

      // Update local state
      setLeagues((prev) =>
        prev.map((league) =>
          league.id === selectedLeague.id
            ? {
                ...league,
                name: editForm.name,
                seasonYear: editForm.seasonYear,
                cap: {
                  ...league.cap,
                  floor: editForm['cap.floor'],
                  firstApron: editForm['cap.firstApron'],
                  secondApron: editForm['cap.secondApron'],
                  max: editForm['cap.max'],
                  tradeLimit: editForm['cap.tradeLimit'],
                  penaltyRatePerM: editForm['cap.penaltyRatePerM'],
                },
              }
            : league
        )
      );

      alert('League updated successfully!');
      setSaving(false);
    } catch (error) {
      console.error('Error updating league:', error);
      alert('Error updating league. Check console for details.');
      setSaving(false);
    }
  };

  const handleStartSeason = async () => {
    if (!selectedLeague) return;

    const confirmed = confirm(
      `Are you sure you want to start the ${selectedLeague.seasonYear} season?\n\n` +
      `This will:\n` +
      `- Lock all team fees based on current rosters\n` +
      `- Calculate first apron fees ($50) for teams over $195M\n` +
      `- Calculate second apron penalties ($2/M over $225M)\n\n` +
      `This action cannot be undone!`
    );

    if (!confirmed) return;

    try {
      setStartingSeasonProcessing(true);

      // Load all regular season rosters for this league
      const { data: rostersRows, error: rostersErr } = await supabase
        .from('regular_season_rosters')
        .select('*')
        .eq('league_id', selectedLeague.id)
        .eq('season_year', selectedLeague.seasonYear);
      if (rostersErr) throw rostersErr;

      // Load all players (paginated past 1000-row limit)
      const playersRows = await fetchAllRows('players');

      const playersMap = new Map(
        playersRows.map(row => [row.id, mapPlayer(row)])
      );

      let teamsProcessed = 0;
      let errors: string[] = [];

      // Process each roster
      for (const rosterRow of (rostersRows || [])) {
        const roster: RegularSeasonRoster = {
          id: rosterRow.id,
          teamId: rosterRow.team_id,
          leagueId: rosterRow.league_id,
          seasonYear: rosterRow.season_year,
          activeRoster: rosterRow.active_roster || [],
          irSlots: rosterRow.ir_slots || [],
          redshirtPlayers: rosterRow.redshirt_players || [],
          internationalPlayers: rosterRow.international_players || [],
          isLegalRoster: rosterRow.is_legal_roster ?? true,
          lastUpdated: rosterRow.last_updated ? new Date(rosterRow.last_updated).getTime() : Date.now(),
          updatedBy: rosterRow.updated_by || '',
        };

        try {
          // Calculate total salary (active + IR only)
          let totalSalary = 0;
          [...roster.activeRoster, ...roster.irSlots].forEach(playerId => {
            const player = playersMap.get(playerId);
            if (player) {
              totalSalary += player.salary || 0;
            }
          });

          // Calculate apron fees
          const firstApronFee = totalSalary > 195_000_000 ? 50 : 0;
          const overBy = Math.max(0, totalSalary - 225_000_000);
          const overByM = Math.ceil(overBy / 1_000_000);
          const secondApronPenalty = overByM * 2;

          // Update teamFees record
          const feesId = `${selectedLeague.id}_${roster.teamId}_${selectedLeague.seasonYear}`;

          // Get existing fees to preserve franchise/redshirt fees
          const { data: existingFeesRows } = await supabase
            .from('team_fees')
            .select('*')
            .eq('id', feesId);

          let existingFees: TeamFees | null = null;
          if (existingFeesRows && existingFeesRows.length > 0) {
            const r = existingFeesRows[0];
            existingFees = {
              id: r.id,
              franchiseTagFees: r.franchise_tag_fees,
              redshirtFees: r.redshirt_fees,
              firstApronFee: r.first_apron_fee,
              secondApronPenalty: r.second_apron_penalty,
              totalFees: r.total_fees,
              feesLocked: r.fees_locked,
            } as TeamFees;
          }

          const franchiseTagFees = existingFees?.franchiseTagFees || 0;
          const redshirtFees = existingFees?.redshirtFees || 0;
          const totalFees = franchiseTagFees + redshirtFees + firstApronFee + secondApronPenalty;

          const { error: updateErr } = await supabase
            .from('team_fees')
            .update({
              first_apron_fee: firstApronFee,
              second_apron_penalty: secondApronPenalty,
              total_fees: totalFees,
              fees_locked: true,
              locked_at: Date.now(),
              locked_salary: totalSalary,
            })
            .eq('id', feesId);
          if (updateErr) throw updateErr;

          teamsProcessed++;
        } catch (error) {
          console.error(`Error processing team ${roster.teamId}:`, error);
          errors.push(`Team ${roster.teamId}: ${error}`);
        }
      }

      setStartingSeasonProcessing(false);

      if (errors.length > 0) {
        alert(
          `Season started with errors!\n\n` +
          `Teams processed: ${teamsProcessed}\n` +
          `Errors: ${errors.length}\n\n` +
          `Check console for details.`
        );
        console.error('Errors during season start:', errors);
      } else {
        alert(
          `Season started successfully!\n\n` +
          `${teamsProcessed} teams processed\n` +
          `All fees have been locked based on current rosters.`
        );
      }
    } catch (error) {
      console.error('Error starting season:', error);
      alert(`Error starting season: ${error}`);
      setStartingSeasonProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Manage Leagues</h1>
          {selectedLeague && (
            <div className="flex gap-3">
              <button
                onClick={handleStartSeason}
                disabled={startingSeasonProcessing}
                className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingSeasonProcessing ? 'Starting Season...' : 'Start Season'}
              </button>
              <button
                onClick={() => setShowRosterManagement(true)}
                className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors"
              >
                Manage Rosters
              </button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* League Selection */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Select League</h2>
            <div className="space-y-2">
              {leagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => handleSelectLeague(league)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedLeague?.id === league.id
                      ? 'border-green-400 bg-green-400/10 text-white'
                      : 'border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  <div className="font-semibold">{league.name}</div>
                  <div className="text-sm text-gray-500">{league.seasonYear} Season</div>
                </button>
              ))}
            </div>
          </div>

          {/* Edit Form */}
          {selectedLeague ? (
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Edit League</h2>
              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    League Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Season
                  </label>
                  <select
                    value={editForm.seasonYear}
                    onChange={(e) =>
                      setEditForm({ ...editForm, seasonYear: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                  >
                    <option value={2024}>2024-2025</option>
                    <option value={2025}>2025-2026</option>
                    <option value={2026}>2026-2027</option>
                    <option value={2027}>2027-2028</option>
                    <option value={2028}>2028-2029</option>
                    <option value={2029}>2029-2030</option>
                  </select>
                </div>

                {/* Salary Cap Settings */}
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-3">Salary Cap</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Floor ($M)
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.floor'] / 1_000_000}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.floor': parseInt(e.target.value) * 1_000_000 })
                        }
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        First Apron ($M) - $50 one-time fee
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.firstApron'] / 1_000_000}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.firstApron': parseInt(e.target.value) * 1_000_000 })
                        }
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Second Apron ($M) - Penalty starts here
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.secondApron'] / 1_000_000}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.secondApron': parseInt(e.target.value) * 1_000_000 })
                        }
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Hard Cap ($M) - Cannot exceed
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.max'] / 1_000_000}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.max': parseInt(e.target.value) * 1_000_000 })
                        }
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Trade Limit ($M) - Adjust cap via trades (±)
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.tradeLimit'] / 1_000_000}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.tradeLimit': parseInt(e.target.value) * 1_000_000 })
                        }
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Penalty Rate - $ per $1M over Second Apron
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.penaltyRatePerM']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.penaltyRatePerM': parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full mt-6 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 flex items-center justify-center text-gray-500">
              Select a league to edit
            </div>
          )}
        </div>
      </div>

      {/* Roster Management Modal */}
      {showRosterManagement && selectedLeague && (
        <AdminRosterManagement
          leagueId={selectedLeague.id}
          seasonYear={selectedLeague.seasonYear}
          onClose={() => setShowRosterManagement(false)}
        />
      )}
    </div>
  );
}

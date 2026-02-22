import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Team, League } from '../types';
import { DEFAULT_ROSTER_SETTINGS } from '../types';

// Map a Supabase team row to the Team type
function mapTeam(row: any): Team {
  return {
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    abbrev: row.abbrev,
    owners: row.owners,
    ownerNames: row.owner_names,
    telegramUsername: row.telegram_username,
    capAdjustments: row.cap_adjustments || { tradeDelta: 0 },
    settings: row.settings || { maxKeepers: 8 },
    banners: row.banners,
  };
}

// Map a Supabase league row to the League type
function mapLeague(row: any): League {
  return {
    id: row.id,
    name: row.name,
    seasonYear: row.season_year,
    deadlines: row.deadlines,
    cap: row.cap,
    schedule: row.schedule || undefined,
    keepersLocked: row.keepers_locked,
    draftStatus: row.draft_status,
    seasonStatus: row.season_status,
    seasonStartedAt: row.season_started_at,
    seasonStartedBy: row.season_started_by,
    leaguePhase: row.league_phase || 'keeper_season',
    scoringMode: row.scoring_mode || 'category_record',
    roster: row.roster || DEFAULT_ROSTER_SETTINGS,
  };
}

export function TeamSelect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<Map<string, League>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      if (!user?.email) return;

      try {
        // Fetch teams where user is an owner
        const { data: teamRows, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .contains('owners', [user.email]);

        if (teamError) throw teamError;

        const teamData = (teamRows || []).map(mapTeam);
        setTeams(teamData);

        // Fetch leagues for these teams
        const leagueIds = [...new Set(teamData.map((t) => t.leagueId))];

        if (leagueIds.length > 0) {
          const { data: leagueRows, error: leagueError } = await supabase
            .from('leagues')
            .select('*')
            .in('id', leagueIds);

          if (leagueError) throw leagueError;

          const leagueData = (leagueRows || []).map(mapLeague);
          setLeagues(new Map(leagueData.map((l) => [l.id, l])));
        }

        setLoading(false);

        // Auto-redirect if user has only one team - go to league home
        if (teamData.length === 1) {
          const team = teamData[0];
          navigate(`/league/${team.leagueId}`);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
        setLoading(false);
      }
    };

    fetchTeams();
  }, [user, navigate]);

  const handleSelectTeam = (team: Team) => {
    navigate(`/league/${team.leagueId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading your teams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Your Teams</h1>
            <p className="text-gray-400 mt-1">
              Signed in as {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Teams list */}
        {teams.length === 0 ? (
          <div className="bg-[#121212] p-8 rounded-lg border border-gray-800 text-center">
            <p className="text-gray-400">
              No teams found. Contact your league administrator to be added to a team.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teams.map((team) => {
              const league = leagues.get(team.leagueId);
              return (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className="bg-[#121212] p-6 rounded-lg border border-gray-800 hover:border-green-400 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {team.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {team.abbrev}
                      </p>
                      {league && (
                        <p className="text-sm text-gray-500 mt-2">
                          {league.name} • {league.seasonYear}
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-6 h-6 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>

                  {team.owners.length > 1 && (
                    <div className="mt-4 text-xs text-gray-500">
                      Co-owners: {team.owners.filter((o) => o !== user?.email).join(', ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

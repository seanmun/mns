import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Team, League } from '../types';

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
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('owners', 'array-contains', user.email));
        const snapshot = await getDocs(q);

        const teamData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Team[];

        setTeams(teamData);

        // Fetch leagues for these teams
        const leagueIds = [...new Set(teamData.map((t) => t.leagueId))];
        const leaguePromises = leagueIds.map(async (leagueId) => {
          const leagueDoc = await getDocs(
            query(collection(db, 'leagues'), where('__name__', '==', leagueId))
          );
          if (!leagueDoc.empty) {
            return {
              id: leagueDoc.docs[0].id,
              ...leagueDoc.docs[0].data(),
            } as League;
          }
          return null;
        });

        const leagueData = (await Promise.all(leaguePromises)).filter(
          Boolean
        ) as League[];
        setLeagues(new Map(leagueData.map((l) => [l.id, l])));

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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-500">Loading your teams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Teams</h1>
            <p className="text-gray-500 mt-1">
              Signed in as {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>

        {/* Teams list */}
        {teams.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500">
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
                  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {team.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {team.abbrev}
                      </p>
                      {league && (
                        <p className="text-sm text-gray-500 mt-2">
                          {league.name} • {league.seasonYear}
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-6 h-6 text-gray-400"
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

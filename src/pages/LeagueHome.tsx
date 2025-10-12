import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Team, League } from '../types';

// Record Book Data
const recordBookData = {
  firstPlaces: [
    { name: 'Kirbiak', count: 3 },
    { name: 'Sean', count: 2 },
    { name: 'Rick', count: 2 },
    { name: 'Tea Mike', count: 1 },
    { name: 'Ian', count: 1 },
    { name: 'Woods', count: 1 },
    { name: 'Bad', count: 1 },
    { name: 'Stine', count: 1 },
  ],
  secondPlaces: [
    { name: 'Sean', count: 3 },
    { name: 'Bad', count: 3 },
    { name: 'Woods', count: 2 },
    { name: 'Kirbiak', count: 1 },
    { name: 'Tea Mike', count: 1 },
    { name: 'Pudd', count: 1 },
    { name: 'Rick', count: 1 },
  ],
  thirdPlaces: [
    { name: 'Sean', count: 3 },
    { name: 'Stine', count: 3 },
    { name: 'Rick', count: 2 },
    { name: 'Kirbiak', count: 2 },
    { name: 'Ian', count: 1 },
    { name: 'PJ', count: 1 },
  ],
};

export function LeagueHome() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRecordBook, setShowRecordBook] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!leagueId || !user?.email) return;

      try {
        // Fetch league data
        const leagueDoc = await getDocs(
          query(collection(db, 'leagues'), where('__name__', '==', leagueId))
        );
        if (!leagueDoc.empty) {
          setLeague({ id: leagueDoc.docs[0].id, ...leagueDoc.docs[0].data() } as League);
        }

        // Fetch all teams in this league
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('leagueId', '==', leagueId));
        const snapshot = await getDocs(q);

        const teamData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Team[];

        setTeams(teamData);

        // Find user's team
        const userTeam = teamData.find((team) => team.owners.includes(user.email || ''));
        setMyTeam(userTeam || null);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching league data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, user]);

  const handleTeamClick = (teamId: string) => {
    navigate(`/league/${leagueId}/team/${teamId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{league?.name || 'Money Never Sleeps 2025-26'}</h1>
          <p className="text-gray-500 mt-1">Welcome back! Manage your team and prepare for the draft.</p>
        </div>

        {/* Mobile: 4 Cards in 2x2 grid */}
        <div className="lg:hidden grid grid-cols-2 gap-4 mb-6">
          {/* My Team Card */}
          {myTeam ? (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-1">{myTeam.name}</h3>
              <p className="text-xs text-gray-500 mb-3">{myTeam.abbrev}</p>
              <button
                onClick={() => navigate(`/league/${leagueId}/team/${myTeam.id}`)}
                className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Manage Roster
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">My Team</h3>
              <p className="text-xs text-gray-500">Not assigned</p>
            </div>
          )}

          {/* Draft Card */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1">📋 Draft</h3>
            <p className="text-xs text-gray-600 mb-3">Coming Soon</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/draft`)}
              className="w-full bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              View Draft
            </button>
          </div>

          {/* Reigning Champion Card */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1">🏆 Champion</h3>
            <p className="text-base font-semibold text-yellow-600 mb-3">Kirbiak</p>
            <button
              onClick={() => setShowRecordBook(!showRecordBook)}
              className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Record Book
            </button>
          </div>
        </div>

        {/* Desktop & Mobile: Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prize Pool Section */}
            <div className="bg-gradient-to-br from-green-400 via-green-500 to-green-600 rounded-lg shadow-lg p-6 text-gray-900">
              <h2 className="text-xl font-bold mb-2">💰 Prize Pool</h2>
              <div className="text-4xl font-bold mb-4">${teams.length * 50}</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-white/30 rounded p-3">
                  <div className="font-semibold">1st Place</div>
                  <div className="text-2xl font-bold">${teams.length * 50 * 0.5}</div>
                </div>
                <div className="bg-white/30 rounded p-3">
                  <div className="font-semibold">2nd Place</div>
                  <div className="text-2xl font-bold">${teams.length * 50 * 0.3}</div>
                </div>
                <div className="bg-white/30 rounded p-3">
                  <div className="font-semibold">3rd Place</div>
                  <div className="text-2xl font-bold">${teams.length * 50 * 0.2}</div>
                </div>
              </div>
            </div>

            {/* All Teams Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">All Teams</h2>
                <p className="text-sm text-gray-500 mt-1">
                  View submitted rosters. Scenarios are private until submission.
                </p>
              </div>
              <div className="divide-y">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamClick(team.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{team.name}</div>
                      <div className="text-sm text-gray-500">
                        {team.ownerNames && team.ownerNames.length > 0 ? team.ownerNames.join(', ') : team.owners.join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        View Roster
                      </span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Cards (Desktop only) */}
          <div className="hidden lg:block space-y-6">
            {/* My Team Card */}
            {myTeam ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{myTeam.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{myTeam.abbrev}</p>
                <button
                  onClick={() => navigate(`/league/${leagueId}/team/${myTeam.id}`)}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Manage Roster
                </button>
                <div className="mt-4 text-sm text-gray-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Max Keepers:</span>
                    <span className="font-semibold">{myTeam.settings.maxKeepers}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">My Team</h3>
                <p className="text-sm text-gray-500">You are not assigned to a team in this league.</p>
              </div>
            )}

            {/* Draft Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">📋 Draft</h3>
              <p className="text-sm text-gray-600 mb-4">
                Coming Soon
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/draft`)}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                View Draft
              </button>
            </div>

            {/* Reigning Champion Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">🏆 Reigning Champion</h3>
              <p className="text-xl font-semibold text-yellow-600 mb-4">Kirbiak</p>
              <button
                onClick={() => setShowRecordBook(!showRecordBook)}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-between"
              >
                <span>Record Book</span>
                <svg
                  className={`w-5 h-5 transition-transform ${showRecordBook ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showRecordBook && (
                <div className="mt-4 space-y-4">
                  {/* 1st Places */}
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-600 mb-2">🥇 1st Place Finishes</h4>
                    <div className="space-y-1">
                      {recordBookData.firstPlaces.map((record) => (
                        <div key={record.name} className="flex justify-between text-sm">
                          <span className="text-gray-700">{record.name}</span>
                          <span className="font-medium text-gray-900">{record.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2nd Places */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">🥈 2nd Place Finishes</h4>
                    <div className="space-y-1">
                      {recordBookData.secondPlaces.map((record) => (
                        <div key={record.name} className="flex justify-between text-sm">
                          <span className="text-gray-700">{record.name}</span>
                          <span className="font-medium text-gray-900">{record.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3rd Places */}
                  <div>
                    <h4 className="text-sm font-semibold text-orange-600 mb-2">🥉 3rd Place Finishes</h4>
                    <div className="space-y-1">
                      {recordBookData.thirdPlaces.map((record) => (
                        <div key={record.name} className="flex justify-between text-sm">
                          <span className="text-gray-700">{record.name}</span>
                          <span className="font-medium text-gray-900">{record.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

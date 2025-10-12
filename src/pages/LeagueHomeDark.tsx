import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Team, League } from '../types';

export function LeagueHomeDark() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{league?.name || 'Money Never Sleeps 2025-26'}</h1>
          <p className="text-gray-400 mt-1">Welcome back! Manage your team and prepare for the draft.</p>
        </div>

        {/* Mobile: Cards in 2x2 grid */}
        <div className="lg:hidden grid grid-cols-2 gap-4 mb-6">
          {/* My Team Card */}
          {myTeam ? (
            <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-bold text-white mb-1">{myTeam.name}</h3>
              <p className="text-xs text-gray-400 mb-3">{myTeam.abbrev}</p>
              <button
                onClick={() => navigate(`/league/${leagueId}/team/${myTeam.id}`)}
                className="w-full bg-gradient-to-r from-green-400 to-green-500 text-gray-900 px-3 py-2 rounded-lg text-sm font-semibold hover:from-green-500 hover:to-green-600 transition-all"
              >
                Manage Roster
              </button>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-bold text-white mb-2">My Team</h3>
              <p className="text-xs text-gray-400">Not assigned</p>
            </div>
          )}

          {/* Draft Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">📋</span>
              <h3 className="text-sm font-bold text-white">Draft</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Coming Soon</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/draft`)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              View Draft
            </button>
          </div>

          {/* Free Agent Pool Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/baseketball-icon.png" alt="Basketball" className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Free Agent Pool</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Browse available players</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/free-agents`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              View Pool
            </button>
          </div>

          {/* Rookie Draft Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🎯</span>
              <h3 className="text-sm font-bold text-white">Rookie Draft</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">June 25, 2025</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/rookie-draft`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              View Results
            </button>
          </div>

          {/* Rules Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">📜</span>
              <h3 className="text-sm font-bold text-white">Rules</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">League guidelines</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/rules`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              View Rules
            </button>
          </div>

          {/* Reigning Champion Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <img src="/icons/trophy-icon.png" alt="Trophy" className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Champion</h3>
            </div>
            <p className="text-base font-semibold text-yellow-400 mb-3">Kirbiak</p>
            <button
              onClick={() => navigate(`/league/${leagueId}/record-book`)}
              className="w-full bg-gray-800 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
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
            <div className="bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-gray-900 border border-green-300">
              <div className="flex items-center gap-3 mb-2">
                <img src="/icons/money-icon.png" alt="Money" className="w-8 h-8" />
                <h2 className="text-xl font-bold">Prize Pool</h2>
              </div>
              <div className="text-4xl font-bold mb-4">${teams.length * 50}</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-black/20 rounded p-3">
                  <div className="font-semibold">1st Place</div>
                  <div className="text-2xl font-bold">${teams.length * 50 * 0.5}</div>
                </div>
                <div className="bg-black/20 rounded p-3">
                  <div className="font-semibold">2nd Place</div>
                  <div className="text-2xl font-bold">${teams.length * 50 * 0.3}</div>
                </div>
                <div className="bg-black/20 rounded p-3">
                  <div className="font-semibold">3rd Place</div>
                  <div className="text-2xl font-bold">${teams.length * 50 * 0.2}</div>
                </div>
              </div>
            </div>

            {/* All Teams Section */}
            <div className="bg-[#1a1a1a] rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold text-white">All Teams</h2>
                <p className="text-sm text-gray-400 mt-1">
                  View submitted rosters. Scenarios are private until submission.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamClick(team.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <div>
                      <div className="font-semibold text-white">{team.name}</div>
                      <div className="text-sm text-gray-400">
                        {team.ownerNames && team.ownerNames.length > 0 ? team.ownerNames.join(', ') : team.owners.join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
                        View Roster
                      </span>
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-bold text-white mb-2">{myTeam.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{myTeam.abbrev}</p>
                <button
                  onClick={() => navigate(`/league/${leagueId}/team/${myTeam.id}`)}
                  className="w-full bg-gradient-to-r from-green-400 to-green-500 text-gray-900 px-4 py-3 rounded-lg font-semibold hover:from-green-500 hover:to-green-600 transition-all"
                >
                  Manage Roster
                </button>
                <div className="mt-4 text-sm text-gray-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Max Keepers:</span>
                    <span className="font-semibold text-white">{myTeam.settings.maxKeepers}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-bold text-white mb-4">My Team</h3>
                <p className="text-sm text-gray-400">You are not assigned to a team in this league.</p>
              </div>
            )}

            {/* Draft Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📋</span>
                <h3 className="text-lg font-bold text-white">Draft</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Coming Soon
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/draft`)}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                View Draft
              </button>
            </div>

            {/* Free Agent Pool Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/baseketball-icon.png" alt="Basketball" className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">Free Agent Pool</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Browse available players and plan your draft strategy.
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/free-agents`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                View Pool
              </button>
            </div>

            {/* Rookie Draft Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎯</span>
                <h3 className="text-lg font-bold text-white">Rookie Draft</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                June 25, 2025 results
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/rookie-draft`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                View Results
              </button>
            </div>

            {/* Rules Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📜</span>
                <h3 className="text-lg font-bold text-white">Rules</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                League guidelines and policies
              </p>
              <button
                onClick={() => navigate(`/league/${leagueId}/rules`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                View Rules
              </button>
            </div>

            {/* Reigning Champion Card */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icons/trophy-icon.png" alt="Trophy" className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">Reigning Champion</h3>
              </div>
              <p className="text-xl font-semibold text-yellow-400 mb-4">Kirbiak</p>
              <button
                onClick={() => navigate(`/league/${leagueId}/record-book`)}
                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Record Book
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Team, League } from '../types';
import { mapTeam, mapLeague } from '../lib/mappers';

type WaitlistStatus = 'idle' | 'joined' | 'error';

export function TeamSelect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<Map<string, League>>(new Map());
  const [loading, setLoading] = useState(true);
  const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>('idle');
  const [marketingOptin, setMarketingOptin] = useState(false);
  const [optinSaved, setOptinSaved] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

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

        // Auto-redirect if user has only one team - go to league home
        if (teamData.length === 1) {
          const team = teamData[0];
          navigate(`/league/${team.leagueId}`);
        }

        // Auto-add to waitlist if no teams found
        if (teamData.length === 0 && user?.email) {
          const { error: waitlistErr } = await supabase
            .from('waitlist')
            .upsert({ email: user.email }, { onConflict: 'email' });

          if (!waitlistErr) {
            setWaitlistStatus('joined');
            // Check if they already opted in
            const { data: existing } = await supabase
              .from('waitlist')
              .select('marketing_optin')
              .eq('email', user.email)
              .maybeSingle();
            if (existing?.marketing_optin) {
              setMarketingOptin(true);
              setOptinSaved(true);
            }
          } else {
            setWaitlistStatus('error');
          }
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [user, navigate]);

  const handleMarketingOptin = useCallback(async () => {
    if (!user?.email) return;
    const newValue = !marketingOptin;
    setMarketingOptin(newValue);
    const { error } = await supabase
      .from('waitlist')
      .update({ marketing_optin: newValue, updated_at: new Date().toISOString() })
      .eq('email', user.email);
    if (!error) {
      setOptinSaved(true);
      setTimeout(() => setOptinSaved(false), 2000);
    }
  }, [user?.email, marketingOptin]);

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
          <div className="bg-[#121212] p-8 rounded-lg border border-gray-800 text-center max-w-lg mx-auto">
            {waitlistStatus === 'joined' ? (
              <>
                <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-400">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">You're on the list!</h2>
                <p className="text-gray-400 mb-6">
                  We'll reach out when your league is ready. In the meantime, stay in the loop.
                </p>

                {/* Roadmap */}
                <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4 mb-4 text-left">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Roadmap</h3>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2.5">
                      <span className="text-green-400 text-xs mt-0.5 flex-shrink-0">Q2 2026</span>
                      <span className="text-sm text-gray-300">WNBA Beta Launch</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-green-400 text-xs mt-0.5 flex-shrink-0">Q3 2026</span>
                      <span className="text-sm text-gray-300">Full NBA Season Launch</span>
                    </li>
                  </ul>
                </div>

                {/* Marketing opt-in */}
                <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4 text-left">
                  <button
                    onClick={handleMarketingOptin}
                    className="flex items-start gap-3 w-full text-left group"
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      marketingOptin
                        ? 'bg-green-400 border-green-400'
                        : 'border-gray-600 group-hover:border-gray-400'
                    }`}>
                      {marketingOptin && (
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white">Send me product updates</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        New features, platform status, and release notes. No spam, unsubscribe anytime.
                      </p>
                    </div>
                  </button>
                  {optinSaved && (
                    <p className="text-xs text-green-400 mt-2 ml-8">Saved!</p>
                  )}
                </div>

                <p className="text-xs text-gray-600 mt-6">
                  Signed in as {user?.email}
                </p>
              </>
            ) : (
              <p className="text-gray-400">
                Something went wrong joining the waitlist. Try refreshing the page.
              </p>
            )}
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

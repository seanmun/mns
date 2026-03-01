import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import { getDailyQuote } from '../data/hinkieQuotes';

export function Header() {
  const { user, role, signOut } = useAuth();
  const { currentLeague, userLeagues, setCurrentLeagueId, loading: leaguesLoading } = useLeague();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);

  // Fetch user's team for current league
  useEffect(() => {
    const fetchUserTeam = async () => {
      if (!user?.email || !currentLeague?.id) {
        setUserTeamId(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id')
          .eq('league_id', currentLeague.id)
          .contains('owners', [user.email])
          .limit(1);

        if (error) throw error;

        setUserTeamId(data && data.length > 0 ? data[0].id : null);
      } catch (error) {
        console.error('Error fetching user team:', error);
        setUserTeamId(null);
      }
    };

    fetchUserTeam();
  }, [user?.email, currentLeague?.id]);

  // Check if today's quote has been read
  const checkNotifications = () => {
    const dailyQuote = getDailyQuote();
    const readKey = `hinkie-quote-read-${dailyQuote.id}-${new Date().toDateString()}`;
    const hasRead = localStorage.getItem(readKey) === 'true';
    setHasNotifications(!hasRead);
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  // Check notifications on mount and listen for changes
  useEffect(() => {
    checkNotifications();

    // Listen for inbox read events
    const handleInboxRead = () => {
      checkNotifications();
    };

    window.addEventListener('inboxRead', handleInboxRead);
    return () => window.removeEventListener('inboxRead', handleInboxRead);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(event.target as Node)) {
        setIsLeagueDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSiteAdmin = role === 'admin';
  const isLeagueManager = currentLeague?.commissionerId === user?.id;
  const showAdminMenu = isSiteAdmin || isLeagueManager;

  // Close dropdowns on ESC key
  useEffect(() => {
    if (!isDropdownOpen && !isLeagueDropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsLeagueDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, isLeagueDropdownOpen]);

  // If no user, show simple header with logo and login button
  if (!user) {
    return (
      <header className="sticky top-0 z-50 bg-[#0a0a0a] shadow-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src="/icons/mnsBall-icon.webp" alt="MNS" className="h-10 w-10 rounded-full" />
              <span className="text-lg font-bold text-white hidden sm:block">Money Never Sleeps</span>
            </Link>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-black font-semibold rounded-lg hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a] shadow-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / League Switcher */}
          <div className="flex items-center gap-4">
            <Link to="/teams" className="flex items-center gap-2">
              <img src="/icons/mnsBall-icon.webp" alt="MNS" className="h-10 w-10 rounded-full" />
            </Link>

            {/* League Switcher */}
            <div className="relative" ref={leagueDropdownRef}>
              <button
                onClick={() => setIsLeagueDropdownOpen(!isLeagueDropdownOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                disabled={leaguesLoading}
                aria-label="Switch league"
                aria-haspopup="true"
                aria-expanded={isLeagueDropdownOpen}
              >
                <span className="text-xs md:text-sm font-bold text-white">
                  {leaguesLoading ? 'Loading...' : currentLeague?.name || 'Select League'}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isLeagueDropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* League Dropdown */}
              {isLeagueDropdownOpen && !leaguesLoading && (
                <div className="absolute left-0 mt-2 w-64 bg-[#121212] rounded-lg shadow-lg border border-gray-800 py-1 z-50" role="menu">
                  {userLeagues.length > 0 ? (
                    <>
                      <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
                        Your Leagues
                      </div>
                      {userLeagues.map((league) => (
                        <button
                          key={league.id}
                          onClick={() => {
                            setCurrentLeagueId(league.id);
                            setIsLeagueDropdownOpen(false);
                            navigate(`/league/${league.id}`);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                            currentLeague?.id === league.id
                              ? 'bg-gray-800 text-green-400'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }`}
                        >
                          <div className="font-medium">{league.name}</div>
                          {currentLeague?.id === league.id && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      ))}
                      <div className="border-t border-gray-800 my-1"></div>
                    </>
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No leagues found
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setIsLeagueDropdownOpen(false);
                      navigate('/create-league');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create League
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            {/* User Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                aria-label="User menu"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                <div className="relative">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-8 h-8 rounded-full border-2 border-gray-700"
                    />
                  )}
                  {/* Notification Indicator */}
                  {hasNotifications && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border-2 border-[#0a0a0a] animate-pulse"></span>
                  )}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-white">
                    {user.displayName}
                  </div>
                  {showAdminMenu && (
                    <div className={`text-xs font-semibold ${isSiteAdmin ? 'text-purple-400' : 'text-blue-400'}`}>
                      {isSiteAdmin ? 'Admin' : 'Commissioner'}
                    </div>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#121212] rounded-lg shadow-lg border border-gray-800 py-1 z-50" role="menu">
                  {/* My Team Link - only show if user has a team in current league */}
                  {userTeamId && currentLeague && (
                    <>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate(`/league/${currentLeague.id}/team/${userTeamId}`);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        My Team
                      </button>
                      <div className="border-t border-gray-800 my-1"></div>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/teams');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    League
                  </button>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate(currentLeague ? `/league/${currentLeague.id}/inbox` : '/inbox');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="flex-1">Inbox</span>
                    {hasNotifications && (
                      <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                    )}
                  </button>

                  {/* League Manager Hub Link */}
                  {showAdminMenu && (
                    <>
                      <div className="border-t border-gray-800 my-1"></div>
                      <button
                        onClick={() => { setIsDropdownOpen(false); navigate('/lm'); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                        role="menuitem"
                      >
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        League Manager
                      </button>
                    </>
                  )}

                  {/* Site Admin Hub Link */}
                  {isSiteAdmin && (
                    <button
                      onClick={() => { setIsDropdownOpen(false); navigate('/site-admin'); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                      Site Admin
                    </button>
                  )}

                  <div className="border-t border-gray-800 my-1"></div>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

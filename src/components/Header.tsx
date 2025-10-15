import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  // Check if today's quote has been read
  const checkNotifications = () => {
    const dailyQuote = getDailyQuote();
    const readKey = `hinkie-quote-read-${dailyQuote.id}-${new Date().toDateString()}`;
    const hasRead = localStorage.getItem(readKey) === 'true';
    setHasNotifications(!hasRead);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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

  if (!user) return null;

  const isAdmin = role === 'admin';

  return (
    <header className="bg-[#0a0a0a] shadow-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / League Switcher */}
          <div className="flex items-center gap-4">
            <Link to="/teams" className="flex items-center gap-2">
              <img src="/icons/mns-icon.png" alt="MNS" className="h-10 w-10 rounded-full" />
            </Link>

            {/* League Switcher */}
            <div className="relative" ref={leagueDropdownRef}>
              <button
                onClick={() => setIsLeagueDropdownOpen(!isLeagueDropdownOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                disabled={leaguesLoading}
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
                <div className="absolute left-0 mt-2 w-64 bg-[#121212] rounded-lg shadow-lg border border-gray-800 py-1 z-50">
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
                      // TODO: Navigate to create league page
                      alert('Create League feature coming soon!');
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
                  {isAdmin && (
                    <div className="text-xs text-purple-400 font-semibold">
                      Admin
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
                <div className="absolute right-0 mt-2 w-48 bg-[#121212] rounded-lg shadow-lg border border-gray-800 py-1 z-50">
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
                      navigate('/inbox');
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

                  {/* Admin Section */}
                  {isAdmin && (
                    <>
                      <div className="border-t border-gray-800 my-1"></div>
                      <div className="px-4 py-2">
                        <div className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Admin</div>
                      </div>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/view-rosters');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View All Rosters
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/teams');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Manage Teams
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/players');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Manage Players
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/upload');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Players
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/league');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage League
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/draft-setup');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        Draft Setup
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/admin/draft-test');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        Draft Test
                      </button>
                    </>
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

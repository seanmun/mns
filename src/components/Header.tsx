import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDailyQuote } from '../data/hinkieQuotes';

export function Header() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link to="/teams" className="flex items-center gap-2">
              <img src="/icons/mns-icon.png" alt="MNS" className="h-10 w-10 rounded-full" />
              <span className="text-xs font-bold text-white">Money Never Sleeps</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            {/* Admin-only Nav */}
            {isAdmin && (
              <>
                <Link
                  to="/admin/teams"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Manage Teams
                </Link>
                <Link
                  to="/admin/players"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Manage Players
                </Link>
                <Link
                  to="/admin/upload"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Upload Players
                </Link>
              </>
            )}

            {/* User Menu */}
            <div className="relative border-l border-gray-800 pl-6" ref={dropdownRef}>
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

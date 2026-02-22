import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function LeagueTopNav() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Resolve user's team ID
  useEffect(() => {
    if (!leagueId || !user?.email) return;

    const fetchTeam = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, owners')
        .eq('league_id', leagueId);

      if (data) {
        const team = data.find((t: any) => (t.owners || []).includes(user.email));
        setUserTeamId(team?.id || null);
      }
    };

    fetchTeam();
  }, [leagueId, user?.email]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  if (!leagueId) return null;

  const path = location.pathname;
  const base = `/league/${leagueId}`;

  const moreItems = [
    { label: 'Draft Room', path: `${base}/draft` },
    { label: 'Mock Draft', path: `${base}/mock-draft` },
    { label: 'Prospects', path: `${base}/prospects` },
    { label: 'Rookie Draft', path: `${base}/rookie-draft` },
    { label: 'Record Book', path: `${base}/record-book` },
  ];

  const isMoreActive = moreItems.some(item => path === item.path);

  const handleNav = (to: string) => {
    setMoreOpen(false);
    navigate(to);
  };

  const navItems = [
    {
      label: 'Home', to: base, active: path === base || path === `${base}/`,
      icon: (sw: number) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    },
    {
      label: 'Roster', to: userTeamId ? `${base}/team/${userTeamId}` : '', active: path.includes('/team/'), disabled: !userTeamId,
      icon: (sw: number) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    },
    {
      label: 'Players', to: `${base}/free-agents`, active: path.includes('/free-agents'),
      icon: (sw: number) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      label: 'Trade', to: `${base}/trade-machine`, active: path.includes('/trade-machine'),
      icon: (sw: number) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>,
    },
    {
      label: 'Rules', to: `${base}/rules`, active: path === `${base}/rules`,
      icon: (sw: number) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      label: 'Inbox', to: `${base}/inbox`, active: path === `${base}/inbox`,
      icon: (sw: number) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    },
  ];

  return (
    <div className="hidden lg:block sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 h-10">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => !item.disabled && item.to && navigate(item.to)}
              disabled={item.disabled}
              className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                item.active
                  ? 'text-green-400 bg-green-400/10'
                  : item.disabled
                    ? 'text-gray-700 cursor-not-allowed'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.icon(item.active ? 2.5 : 1.5)}
              {item.label}
            </button>
          ))}

          {/* More dropdown */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                moreOpen || isMoreActive
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={moreOpen || isMoreActive ? 2.5 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              More
              <svg className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {moreOpen && (
              <div className="absolute top-full left-0 mt-1 bg-[#121212] border border-gray-800 rounded-lg shadow-2xl shadow-black/50 overflow-hidden min-w-[160px] z-50">
                {moreItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                      path === item.path
                        ? 'text-green-400 bg-green-400/5'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

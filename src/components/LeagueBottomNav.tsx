import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function LeagueBottomNav() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

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

  if (!leagueId) return null;

  const path = location.pathname;
  const base = `/league/${leagueId}`;

  // Active state detection
  const isHome = path === base || path === `${base}/`;
  const isRoster = path.includes('/team/');
  const isPlayers = path.includes('/free-agents');
  const isTrade = path.includes('/trade-machine');
  const morePages = ['/draft', '/rookie-draft', '/mock-draft', '/prospects', '/rules', '/record-book', '/inbox'];
  const isMoreActive = morePages.some(p => path.includes(p));

  const handleNav = (to: string) => {
    setMoreOpen(false);
    navigate(to);
  };

  const moreItems = [
    { label: 'Draft Room', path: `${base}/draft`, section: 'Draft' },
    { label: 'Mock Draft', path: `${base}/mock-draft`, section: 'Draft' },
    { label: 'Prospects', path: `${base}/prospects`, section: 'Draft' },
    { label: 'Rookie Draft', path: `${base}/rookie-draft`, section: 'Draft' },
    { label: 'Rules', path: `${base}/rules`, section: 'League' },
    { label: 'Record Book', path: `${base}/record-book`, section: 'League' },
    { label: 'Inbox', path: `/inbox`, section: 'League' },
  ];

  return (
    <>
      {/* Backdrop for More dropdown */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More dropdown */}
      {moreOpen && (
        <div className="fixed bottom-16 right-2 left-2 z-50 lg:hidden">
          <div className="bg-[#121212] border border-gray-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden mx-auto max-w-sm">
            {/* Draft section */}
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Draft</span>
            </div>
            {moreItems.filter(i => i.section === 'Draft').map(item => (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                  path.includes(item.path.replace(base, ''))
                    ? 'text-green-400 bg-green-400/5'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="border-t border-gray-800" />

            {/* League section */}
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">League</span>
            </div>
            {moreItems.filter(i => i.section === 'League').map(item => (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                  path === item.path || path.includes(item.path.replace(base, ''))
                    ? 'text-green-400 bg-green-400/5'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {/* Home */}
          <button
            onClick={() => handleNav(base)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isHome ? 'text-green-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isHome ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] font-medium">Home</span>
          </button>

          {/* Roster */}
          <button
            onClick={() => userTeamId && handleNav(`${base}/team/${userTeamId}`)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isRoster ? 'text-green-400' : userTeamId ? 'text-gray-500' : 'text-gray-700'
            }`}
            disabled={!userTeamId}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isRoster ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] font-medium">Roster</span>
          </button>

          {/* Players */}
          <button
            onClick={() => handleNav(`${base}/free-agents`)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isPlayers ? 'text-green-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isPlayers ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-[10px] font-medium">Players</span>
          </button>

          {/* Trade */}
          <button
            onClick={() => handleNav(`${base}/trade-machine`)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isTrade ? 'text-green-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isTrade ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span className="text-[10px] font-medium">Trade</span>
          </button>

          {/* More */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              moreOpen || isMoreActive ? 'text-green-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={moreOpen || isMoreActive ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

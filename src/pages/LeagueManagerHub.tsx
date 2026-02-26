import { useNavigate } from 'react-router-dom';
import { useLeague } from '../contexts/LeagueContext';
import { useAuth } from '../contexts/AuthContext';
import { useCanManageLeague } from '../hooks/useCanManageLeague';

interface ToolCard {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

function HubCard({ title, description, icon, onClick }: ToolCard & { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#121212] border border-gray-800 rounded-lg p-5 hover:border-green-400/60 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all text-left group w-full"
    >
      <div className="flex items-start gap-4">
        <div className="text-green-400/80 group-hover:text-green-400 transition-colors shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-0.5">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <svg className="w-4 h-4 text-gray-700 group-hover:text-green-400/60 transition-colors shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h2>
  );
}

export function LeagueManagerHub() {
  const navigate = useNavigate();
  const { currentLeague } = useLeague();
  const canManage = useCanManageLeague();
  const { role } = useAuth();
  const isSiteAdmin = role === 'admin';

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">You need commissioner or admin permissions.</p>
        </div>
      </div>
    );
  }

  if (!currentLeague) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No League Selected</p>
          <p className="text-sm mt-1">Select a league to access manager tools.</p>
        </div>
      </div>
    );
  }

  const leagueConfig: ToolCard[] = [
    {
      title: 'League Settings',
      description: 'Cap settings, deadlines, phases, and rules',
      path: '/lm/league',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      title: 'Manage Teams',
      description: 'Add/edit teams, owners, and telegram handles',
      path: '/lm/teams',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
  ];

  const rosterTools: ToolCard[] = [
{
      title: 'Manage Rosters',
      description: 'Edit keeper decisions and roster entries directly',
      path: '/lm/rosters',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    },
    {
      title: 'Roster Import',
      description: 'Bulk import from Fantrax TSV export',
      path: '/lm/roster-import',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    },
  ];

  const draftTools: ToolCard[] = [
    {
      title: 'Draft Setup',
      description: 'Set draft order and initialize the board',
      path: '/lm/draft-setup',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
    {
      title: 'Draft Picks',
      description: 'Manage current season pick ownership',
      path: '/lm/draft-picks',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    },
    {
      title: 'Rookie Draft Picks',
      description: 'Manage future rookie pick ownership',
      path: '/lm/rookie-picks',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>,
    },
    {
      title: 'Draft Test',
      description: 'Simulate draft with mock data',
      path: '/lm/draft-test',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    },
  ];

  const tradeTools: ToolCard[] = [
    {
      title: 'Trade Manager',
      description: 'Force trades and commissioner overrides',
      path: '/lm/trade',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
    },
    {
      title: 'Portfolio',
      description: 'Prize pool wallet and balances',
      path: '/lm/portfolio',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  const sections = [
    { title: 'League Configuration', tools: leagueConfig },
    { title: 'Roster Management', tools: rosterTools },
    { title: 'Draft Tools', tools: draftTools },
    { title: 'Trade & Portfolio', tools: tradeTools },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">League Manager</h1>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isSiteAdmin ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {isSiteAdmin ? 'Admin' : 'Commissioner'}
          </span>
        </div>
        <p className="text-sm text-gray-500">{currentLeague.name}</p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <SectionHeader title={section.title} />
            <div className="grid gap-3 sm:grid-cols-2">
              {section.tools.map((tool) => (
                <HubCard key={tool.path} {...tool} onClick={() => navigate(tool.path)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

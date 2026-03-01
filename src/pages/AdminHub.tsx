import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';

interface AdminStats {
  total_users: number;
  total_waitlist: number;
  total_leagues: number;
  dau_today: number;
  dau_7d_avg: number;
  dau_30d_avg: number;
}

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
      className="bg-[#121212] border border-gray-800 rounded-lg p-5 hover:border-purple-400/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all text-left group w-full"
    >
      <div className="flex items-start gap-4">
        <div className="text-purple-400/80 group-hover:text-purple-400 transition-colors shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-0.5">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <svg className="w-4 h-4 text-gray-700 group-hover:text-purple-400/60 transition-colors shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#121212] border border-gray-800 rounded-lg p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-[#121212] border border-gray-800 rounded-lg p-5 animate-pulse">
      <div className="h-3 w-20 bg-gray-800 rounded mb-3" />
      <div className="h-7 w-16 bg-gray-800 rounded" />
    </div>
  );
}

export function AdminHub() {
  const navigate = useNavigate();
  const isSiteAdmin = useIsSiteAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (!error && data) setStats(data as AdminStats);
      setStatsLoading(false);
    }
    loadStats();
  }, []);

  if (!isSiteAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">Site admin permissions required.</p>
        </div>
      </div>
    );
  }

  const dataTools: ToolCard[] = [
    {
      title: 'Manage Players',
      description: 'Edit player database, salaries, and team assignments',
      path: '/admin/players',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
      title: 'Uploads',
      description: 'Bulk upload players, stats, and projections via CSV',
      path: '/admin/upload',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    },
    {
      title: 'All Picks View',
      description: 'View all draft picks across leagues',
      path: '/admin/picks',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    },
    {
      title: 'WNBA Player Scraper',
      description: 'Scrape and import WNBA player data from public sources',
      path: '/admin/wnba-scraper',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    },
    {
      title: 'WNBA Prospect Scraper',
      description: 'Scrape 2026 WNBA Draft prospect rankings from Tankathon',
      path: '/admin/wnba-prospects',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    },
    {
      title: 'Manage Prospects',
      description: 'Add, edit rankings, and delete NBA/WNBA draft prospects',
      path: '/admin/prospects',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
  ];

  const systemTools: ToolCard[] = [
    {
      title: 'Email Templates',
      description: 'Manage transactional email templates',
      path: '/admin/email-templates',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    },
    {
      title: 'Data Audit',
      description: 'Run integrity checks and fix data issues',
      path: '/admin/data-audit',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      title: 'Migration',
      description: 'Database migration tools and utilities',
      path: '/admin/migration',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Site Admin</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
            Admin
          </span>
        </div>
        <p className="text-sm text-gray-500">Platform-wide administration tools</p>
      </div>

      <div className="space-y-8">
        <section>
          <SectionHeader title="Platform Metrics" />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {statsLoading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : stats ? (
              <>
                <StatCard label="Total Users" value={stats.total_users} />
                <StatCard label="Waitlist" value={stats.total_waitlist} />
                <StatCard label="Leagues" value={stats.total_leagues} />
                <StatCard
                  label="Daily Active Users"
                  value={stats.dau_today}
                  sub={`7d avg: ${stats.dau_7d_avg} · 30d avg: ${stats.dau_30d_avg}`}
                />
              </>
            ) : (
              <p className="text-sm text-gray-500 col-span-full">
                Run the <code className="text-purple-400">get_admin_stats()</code> migration to enable metrics.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Data Management" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dataTools.map((tool) => (
              <HubCard key={tool.path} {...tool} onClick={() => navigate(tool.path)} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="System Tools" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systemTools.map((tool) => (
              <HubCard key={tool.path} {...tool} onClick={() => navigate(tool.path)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

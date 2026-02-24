import { Link } from 'react-router-dom';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  title: string;
  changes: string[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '0.2.1',
    date: '2026-02-23',
    type: 'patch',
    title: 'Roster Page Improvements',
    changes: [
      'Added mobile tab switcher for Salary Cap and Fees & Roster panels',
      'Phase-aware labels — shows "Players" instead of "Keepers" during regular season',
      'Hides keeper-specific draft budget stats during regular season',
      'Removed Propose Trade and Propose Wager buttons',
      'Added branded email templates with Resend SMTP integration',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-02-22',
    type: 'minor',
    title: 'Waitlist & Public Pages',
    changes: [
      'Added waitlist flow for new signups with auto-join, marketing opt-in, and roadmap preview',
      'Updated Home page and Login page copy for public-facing messaging',
      'Added Privacy, About, and Roadmap as standalone pages',
      'Overhauled footer with useful navigation links (About, Roadmap, Privacy, Changelog)',
      'Fixed matchup date ranges — removed incorrect Mon-Sun snapping',
      'Renamed "Week" to "Matchup" throughout matchup views',
      'Fixed matchup numbering to use position-based index instead of raw week numbers',
      'Interactive matchup detail — click team names to view roster stats',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-02-20',
    type: 'minor',
    title: 'Supabase Migration',
    changes: [
      'Migrated entire data layer from Firebase to Supabase (PostgreSQL)',
      'Replaced Firebase Auth with Supabase Auth (Google OAuth + magic link)',
      'Replaced Firebase Cloud Function with Supabase Edge Function for blockchain/wallet data',
      'Added pagination helper to handle 1000+ player queries',
      'Removed all Firebase dependencies (39 packages removed)',
      'Fixed manifest icons and deprecated meta tags',
    ],
  },
  {
    version: '0.0.6',
    date: '2025-12-10',
    type: 'patch',
    title: 'Wagers Update',
    changes: [
      'Updated wager functionality and UI improvements',
    ],
  },
  {
    version: '0.0.5',
    date: '2025-12-09',
    type: 'patch',
    title: 'Prospects & Wagers',
    changes: [
      'Added Prospects feature with CSV upload for scouting data',
      'Wagers functionality improvements',
    ],
  },
  {
    version: '0.0.4',
    date: '2025-11-12',
    type: 'patch',
    title: 'Regular Season Features',
    changes: [
      'Redshirt activation fees',
      'Prize pool zones',
      'Roster moves enabled for regular season',
    ],
  },
  {
    version: '0.0.3',
    date: '2025-11-11',
    type: 'patch',
    title: 'Draft & Season Launch',
    changes: [
      'Draft completion workflow and archiving',
      'Begin season functionality',
      'Prize pool rules',
      'Draft card reorder and styling updates',
    ],
  },
  {
    version: '0.0.2',
    date: '2025-10-18',
    type: 'patch',
    title: 'Performance & Polish',
    changes: [
      'Comprehensive performance optimizations',
      'Home page styling and footer layout updates',
    ],
  },
  {
    version: '0.0.1',
    date: '2025-10-01',
    type: 'patch',
    title: 'Initial Release',
    changes: [
      'Keeper management with salary cap tracking',
      'Live draft with real-time updates',
      'Owner dashboard with keeper strategy tools',
      'Admin tools for league management',
      'Telegram notifications for draft picks',
      'ETH prize pool tracking via Alchemy',
    ],
  },
];

function getTypeBadge(type: ChangelogEntry['type']) {
  switch (type) {
    case 'major':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-400/10 text-red-400 border border-red-400/30">Major</span>;
    case 'minor':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-400/10 text-green-400 border border-green-400/30">Minor</span>;
    case 'patch':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-400/10 text-gray-400 border border-gray-400/30">Patch</span>;
  }
}

export function Changelog() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-gray-400 hover:text-green-400 text-sm transition-colors">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Changelog</h1>
        <p className="text-gray-400 mb-8">
          All notable changes to MNS Keeper League.
          Versioning follows <span className="text-gray-300">major.minor.patch</span> format.
        </p>

        <div className="space-y-8">
          {changelog.map((entry) => (
            <div key={entry.version} className="border-l-2 border-gray-800 pl-6 relative">
              <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-gray-600" />
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-white">v{entry.version}</h2>
                {getTypeBadge(entry.type)}
                <span className="text-sm text-gray-500">{entry.date}</span>
              </div>
              <h3 className="text-gray-300 font-medium mb-3">{entry.title}</h3>
              <ul className="space-y-1.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                    <span className="text-green-400 mt-1 shrink-0">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

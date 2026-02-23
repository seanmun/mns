import { Link } from 'react-router-dom';

interface Milestone {
  quarter: string;
  title: string;
  description: string;
  status: 'complete' | 'active' | 'upcoming';
}

const milestones: Milestone[] = [
  {
    quarter: 'Q4 2025',
    title: 'Platform Launch',
    description: 'Single-league keeper management with live drafts, salary cap engine, and commissioner tools.',
    status: 'complete',
  },
  {
    quarter: 'Q1 2026',
    title: 'Supabase Migration',
    description: 'Migrated from Firebase to Supabase (PostgreSQL) for better scalability and multi-tenant support.',
    status: 'complete',
  },
  {
    quarter: 'Q2 2026',
    title: 'WNBA Beta Launch',
    description: 'First multi-tenant league creation. Open beta for WNBA keeper leagues with full draft and roster management.',
    status: 'active',
  },
  {
    quarter: 'Q3 2026',
    title: 'Full NBA Season Launch',
    description: 'Open league creation for the 2026-27 NBA season. Public signups, league invites, and expanded commissioner tools.',
    status: 'upcoming',
  },
  {
    quarter: 'Future',
    title: 'Multi-Sport & Mobile',
    description: 'Expand to additional sports leagues. Native mobile apps for iOS and Android.',
    status: 'upcoming',
  },
];

function getStatusStyles(status: Milestone['status']) {
  switch (status) {
    case 'complete':
      return {
        dot: 'bg-green-400',
        badge: 'bg-green-400/10 text-green-400 border-green-400/30',
        label: 'Complete',
      };
    case 'active':
      return {
        dot: 'bg-green-400 animate-pulse',
        badge: 'bg-green-400/10 text-green-400 border-green-400/30',
        label: 'In Progress',
      };
    case 'upcoming':
      return {
        dot: 'bg-gray-600',
        badge: 'bg-gray-400/10 text-gray-400 border-gray-400/30',
        label: 'Upcoming',
      };
  }
}

export function Roadmap() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-gray-400 hover:text-green-400 text-sm transition-colors">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Roadmap</h1>
        <p className="text-gray-400 mb-8">
          Where we've been and where we're going.
        </p>

        <div className="space-y-8">
          {milestones.map((milestone) => {
            const styles = getStatusStyles(milestone.status);
            return (
              <div key={milestone.quarter} className="border-l-2 border-gray-800 pl-6 relative">
                <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${styles.dot}`} />
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-green-400">{milestone.quarter}</span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles.badge}`}>
                    {styles.label}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mb-1">{milestone.title}</h2>
                <p className="text-gray-400 text-sm">{milestone.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

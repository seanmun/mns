import { Link } from 'react-router-dom';

export function About() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-gray-400 hover:text-green-400 text-sm transition-colors">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">About</h1>
        <p className="text-gray-400 mb-8">
          The platform behind the league.
        </p>

        <div className="space-y-8">
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-3">What is MNS?</h2>
            <p className="text-gray-400 leading-relaxed">
              Money Never Sleeps is a fantasy basketball platform built for serious keeper leagues. We combine salary cap management, live drafts, and deep roster strategy into a single experience designed for dynasty leagues that play for keeps.
            </p>
          </div>

          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-3">Built Different</h2>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white">Keeper-first design</strong> — every feature is built around multi-year dynasty strategy, not single-season redraft</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white">Salary cap engine</strong> — real cap math with keeper costs, trade implications, and scenario planning</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white">Live draft board</strong> — real-time auction draft with instant cap updates and pick tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white">Commissioner tools</strong> — league setup, trade management, roster controls, and season management</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-3">Where We're Headed</h2>
            <p className="text-gray-400 leading-relaxed">
              MNS started as a tool for a single league. We're building it into a multi-tenant platform where anyone can create and manage their own keeper league — starting with WNBA in 2026, then expanding to full NBA and beyond.
            </p>
            <Link
              to="/roadmap"
              className="inline-block mt-4 text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              View the roadmap &rarr;
            </Link>
          </div>

          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-3">Contact</h2>
            <p className="text-gray-400 mb-3">
              Built by Sean Munley.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <a
                href="mailto:sean.munley@protonmail.com"
                className="text-green-400 hover:text-green-300 transition-colors"
              >
                sean.munley@protonmail.com
              </a>
              <a
                href="https://seanmun.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 transition-colors"
              >
                seanmun.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

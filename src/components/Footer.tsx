import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0a0a] border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3">
            <img
              src="/icons/mnsBall-icon.webp"
              alt="MNS"
              className="w-12 h-12 rounded-full opacity-70"
            />
            <p className="text-gray-400 text-sm">
              Money Never Sleeps — Where Fantasy Basketball Meets Wall Street
            </p>
            <Link
              to="/changelog"
              className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-purple-400/10 text-purple-400 border border-purple-400/30 hover:bg-purple-400/20 transition-colors"
            >
              v0.2.0 BETA
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link to="/about" className="text-gray-400 hover:text-green-400 transition-colors">
              About
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/roadmap" className="text-gray-400 hover:text-green-400 transition-colors">
              Roadmap
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/privacy" className="text-gray-400 hover:text-green-400 transition-colors">
              Privacy
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/media" className="text-gray-400 hover:text-green-400 transition-colors">
              Media
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/changelog" className="text-gray-400 hover:text-green-400 transition-colors">
              Changelog
            </Link>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <span>&copy; {currentYear} MNS</span>
            <span className="hidden sm:inline">&middot;</span>
            <a
              href="https://seanmun.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-green-400 transition-colors"
            >
              Built by Sean Munley
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

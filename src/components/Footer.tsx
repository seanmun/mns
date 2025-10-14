import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0a0a] border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">MNS Keeper League</h3>
            <p className="text-gray-400 text-sm">
              A dynasty fantasy basketball league with salary cap management and keeper strategy.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/teams" className="text-gray-400 text-sm hover:text-green-400 transition-colors">
                  My Teams
                </Link>
              </li>
              <li>
                <Link to="/league/mns2026/rules" className="text-gray-400 text-sm hover:text-green-400 transition-colors">
                  Rules
                </Link>
              </li>
              <li>
                <Link to="/league/mns2026/record-book" className="text-gray-400 text-sm hover:text-green-400 transition-colors">
                  Record Book
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact/Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">League Info</h3>
            <p className="text-gray-400 text-sm">
              2025-2026 Season
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {currentYear} MNS Keeper League. All rights reserved.
            </p>
            <a
              href="https://seanmun.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 text-sm hover:text-green-400 transition-colors"
            >
              Built by Sean Munley
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

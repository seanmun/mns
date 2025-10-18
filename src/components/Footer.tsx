import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  return (
    <>
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    <footer className="bg-[#0a0a0a] border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">MNS Keeper League</h3>
            <p className="text-gray-400 text-sm mb-2">
              A dynasty fantasy basketball league with salary cap management and keeper strategy.
            </p>
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-purple-400/10 text-purple-400 border border-purple-400/30">
              BETA
            </span>
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
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2">
              <img
                src="/icons/mnsBall-icon.png"
                alt="MNS"
                className="w-8 h-8 rounded-full opacity-70"
              />
              <p className="text-gray-400 text-sm">
                Money Never Sleeps - Where Fantasy Basketball Meets Wall Street
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
              <span>© {currentYear} MNS Keeper League</span>
              <span className="hidden sm:inline">•</span>
              <button
                onClick={() => setIsPrivacyModalOpen(true)}
                className="hover:text-green-400 transition-colors"
              >
                Privacy Policy
              </button>
              <span className="hidden sm:inline">•</span>
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
      </div>
    </footer>
    </>
  );
}

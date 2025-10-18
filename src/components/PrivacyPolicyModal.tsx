import { useEffect } from 'react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#121212] border border-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          <div>
            <p className="text-gray-400 mb-4">
              <strong className="text-white">Effective Date:</strong> October 18, 2025
            </p>
            <p className="text-gray-400">
              Money Never Sleeps ("we," "us," or "our") operates a fantasy basketball dynasty league platform. This Privacy Policy explains how we collect, use, and protect your information.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">1. Information We Collect</h3>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Account Information:</strong> When you sign in with Google, we collect your name, email address, and profile photo.</p>
              <p><strong className="text-white">League Data:</strong> We collect information about your team, roster decisions, keeper selections, and draft picks.</p>
              <p><strong className="text-white">Usage Data:</strong> We may collect information about how you interact with our platform.</p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>To provide and maintain our fantasy basketball league platform</li>
              <li>To manage your team roster and keeper selections</li>
              <li>To facilitate draft operations and league communications</li>
              <li>To calculate salary cap usage and league fees</li>
              <li>To track prize pool investments and portfolio performance</li>
              <li>To send notifications about draft picks and league updates</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">3. Data Sharing and Disclosure</h3>
            <div className="space-y-2 text-gray-400">
              <p>We do not sell your personal information. We may share information:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>With other league members (team names, rosters, and public league data)</li>
                <li>With service providers (Firebase, Vercel) who help us operate the platform</li>
                <li>When required by law or to protect our rights</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">4. Data Security</h3>
            <p className="text-gray-400">
              We use industry-standard security measures to protect your information. Your data is stored securely using Firebase Authentication and Firestore Database with security rules in place to restrict unauthorized access.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h3>
            <div className="space-y-2 text-gray-400">
              <p>Our platform uses the following third-party services:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong className="text-white">Google Authentication:</strong> For secure sign-in</li>
                <li><strong className="text-white">Firebase:</strong> For database and hosting</li>
                <li><strong className="text-white">Telegram Bot API:</strong> For draft notifications</li>
                <li><strong className="text-white">Alchemy & CoinGecko:</strong> For blockchain portfolio tracking</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">6. Your Rights</h3>
            <div className="space-y-2 text-gray-400">
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Access your personal information</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">7. Cookies and Tracking</h3>
            <p className="text-gray-400">
              We use local storage to maintain your session and store user preferences. We do not use third-party tracking or advertising cookies.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">8. Children's Privacy</h3>
            <p className="text-gray-400">
              Our platform is not intended for users under the age of 18. We do not knowingly collect information from children.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">9. Changes to This Policy</h3>
            <p className="text-gray-400">
              We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Effective Date" at the top of this policy.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-3">10. Contact Us</h3>
            <p className="text-gray-400">
              If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at:
            </p>
            <p className="text-green-400 mt-2">
              <a href="mailto:sean.munley@protonmail.com" className="hover:text-green-300 transition-colors">
                sean.munley@protonmail.com
              </a>
            </p>
          </div>

          <div className="pt-4 border-t border-gray-800">
            <p className="text-sm text-gray-500">
              By using Money Never Sleeps, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 border-2 border-green-400 text-green-400 rounded-lg font-semibold hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';

export function Privacy() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-gray-400 hover:text-green-400 text-sm transition-colors">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">
          <strong className="text-gray-300">Effective Date:</strong> October 18, 2025
        </p>

        <div className="space-y-8">
          <p className="text-gray-400">
            Money Never Sleeps ("we," "us," or "our") operates a fantasy basketball dynasty league platform. This Privacy Policy explains how we collect, use, and protect your information.
          </p>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <div className="space-y-2 text-gray-400">
              <p><strong className="text-white">Account Information:</strong> When you sign in with Google, we collect your name, email address, and profile photo.</p>
              <p><strong className="text-white">League Data:</strong> We collect information about your team, roster decisions, keeper selections, and draft picks.</p>
              <p><strong className="text-white">Usage Data:</strong> We may collect information about how you interact with our platform.</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
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
            <h2 className="text-xl font-bold text-white mb-3">3. Data Sharing and Disclosure</h2>
            <div className="space-y-2 text-gray-400">
              <p>We do not sell your personal information. We may share information:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>With other league members (team names, rosters, and public league data)</li>
                <li>With service providers (Supabase, Vercel) who help us operate the platform</li>
                <li>When required by law or to protect our rights</li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Security</h2>
            <p className="text-gray-400">
              We use industry-standard security measures to protect your information. Your data is stored securely using Supabase Authentication and PostgreSQL with row-level security policies to restrict unauthorized access.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
            <div className="space-y-2 text-gray-400">
              <p>Our platform uses the following third-party services:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong className="text-white">Google Authentication:</strong> For secure sign-in</li>
                <li><strong className="text-white">Supabase:</strong> For database, authentication, and hosting</li>
                <li><strong className="text-white">Telegram Bot API:</strong> For draft notifications</li>
                <li><strong className="text-white">Alchemy & CoinGecko:</strong> For blockchain portfolio tracking</li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">6. Your Rights</h2>
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
            <h2 className="text-xl font-bold text-white mb-3">7. Cookies and Tracking</h2>
            <p className="text-gray-400">
              We use local storage to maintain your session and store user preferences. We do not use third-party tracking or advertising cookies.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">8. Children's Privacy</h2>
            <p className="text-gray-400">
              Our platform is not intended for users under the age of 18. We do not knowingly collect information from children.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-400">
              We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Effective Date" at the top of this policy.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-3">10. Contact Us</h2>
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
      </div>
    </div>
  );
}

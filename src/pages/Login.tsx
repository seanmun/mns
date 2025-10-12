import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export function Login() {
  const { user, loading, signInWithGoogle, sendEmailLink } = useAuth();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/teams" />;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);

    try {
      await sendEmailLink(email);
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send email link');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              <img src="/icons/moneyneversleeps-icon.png" alt="MNS" className="w-60 h-60 rounded-lg" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              MNS Keeper Manager
            </h1>
            <p className="text-lg text-gray-300">
              Master your draft strategy
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Track keepers • Manage cap space • Plan scenarios
            </p>
          </div>
        </div>

        <div className="bg-[#121212] p-8 rounded-lg border border-gray-800 space-y-6">
          {/* Email Link Sign In */}
          {!emailSent ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">
                  Sign in with Email
                </h2>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full px-4 py-3 border-2 border-green-400 text-green-400 rounded-md hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all disabled:opacity-50 font-semibold cursor-pointer"
                  >
                    {sending ? 'Sending...' : 'Send Sign-In Link'}
                  </button>
                </form>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#121212] text-gray-400">Or</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Check your email!
              </h3>
              <p className="text-gray-300 mb-4">
                We sent a sign-in link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-400">
                Click the link in your email to sign in. You can close this window.
              </p>
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                className="mt-4 text-sm text-green-400 hover:text-green-300 cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          )}

          {/* Google Sign In */}
          {!emailSent && (
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#0a0a0a] border-2 border-gray-700 rounded-md text-white hover:border-green-400 hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.3)] transition-all font-semibold cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          )}

          <p className="text-xs text-gray-400 text-center">
            Only authorized team owners can access this application
          </p>
        </div>
      </div>
    </div>
  );
}

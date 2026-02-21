import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function FinishSignIn() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Supabase handles the magic link token exchange automatically.
  // The onAuthStateChange listener in AuthContext picks up the session
  // from the URL hash. We just wait and redirect.

  useEffect(() => {
    if (user) {
      window.localStorage.removeItem('emailForSignIn');
      navigate('/teams');
    }
  }, [user, navigate]);

  // If something goes wrong after a few seconds, show an error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!user) {
        setError('Sign-in link may have expired. Please try again.');
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [user]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="bg-[#121212] p-8 rounded-lg border border-gray-800 text-center">
            <div className="text-red-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Sign-In Failed
            </h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="text-green-400 hover:text-green-300 cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
        <div className="text-gray-400">Signing you in...</div>
      </div>
    </div>
  );
}

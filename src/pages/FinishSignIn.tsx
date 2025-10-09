import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function FinishSignIn() {
  const { completeEmailLinkSignIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [processing, setProcessing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const finishSignIn = async () => {
      // Get email from localStorage
      const storedEmail = window.localStorage.getItem('emailForSignIn');

      if (storedEmail) {
        try {
          await completeEmailLinkSignIn(storedEmail);
          // User will be set by AuthContext, navigate happens in parent
        } catch (err: any) {
          setError(err.message || 'Failed to sign in');
          setProcessing(false);
        }
      } else {
        // Email not in storage, ask user to enter it
        setNeedsEmail(true);
        setProcessing(false);
      }
    };

    finishSignIn();
  }, [completeEmailLinkSignIn]);

  useEffect(() => {
    if (user) {
      navigate('/teams');
    }
  }, [user, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      await completeEmailLinkSignIn(email);
      // User will be set, navigate happens above
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-500">Signing you in...</div>
        </div>
      </div>
    );
  }

  if (needsEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Confirm Your Email
            </h1>
            <p className="text-gray-600">
              Please enter the email address you used to sign in
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <div className="text-red-600 mb-4">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sign-In Failed
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-800"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

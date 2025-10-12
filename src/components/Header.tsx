import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  const isAdmin = role === 'admin';

  return (
    <header className="bg-[#0a0a0a] shadow-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link to="/teams" className="flex items-center gap-2">
              <img src="/icons/mns-icon.png" alt="MNS" className="h-10 w-10 rounded-full" />
              <span className="text-sm font-bold text-white">Money Never Sleeps</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            {/* Common Nav */}
            <Link
              to="/teams"
              className="text-gray-300 hover:text-green-400 font-medium transition-colors"
            >
              My Teams
            </Link>

            {/* Admin-only Nav */}
            {isAdmin && (
              <>
                <Link
                  to="/admin/teams"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Manage Teams
                </Link>
                <Link
                  to="/admin/upload"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Upload Players
                </Link>
              </>
            )}

            {/* User Menu */}
            <div className="flex items-center space-x-4 border-l border-gray-800 pl-6">
              <div className="flex items-center space-x-2">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border-2 border-gray-700"
                  />
                )}
                <div className="text-sm">
                  <div className="font-medium text-white">
                    {user.displayName}
                  </div>
                  {isAdmin && (
                    <div className="text-xs text-purple-400 font-semibold">
                      Admin
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

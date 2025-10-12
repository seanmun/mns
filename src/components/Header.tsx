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
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link to="/teams" className="text-xl font-bold text-gray-900">
              MNS
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            {/* Common Nav */}
            <Link
              to="/teams"
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              My Teams
            </Link>

            {/* Admin-only Nav */}
            {isAdmin && (
              <>
                <Link
                  to="/admin/teams"
                  className="text-blue-700 hover:text-blue-900 font-medium"
                >
                  Manage Teams
                </Link>
                <Link
                  to="/admin/upload"
                  className="text-blue-700 hover:text-blue-900 font-medium"
                >
                  Upload Players
                </Link>
              </>
            )}

            {/* User Menu */}
            <div className="flex items-center space-x-4 border-l border-gray-200 pl-6">
              <div className="flex items-center space-x-2">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {user.displayName}
                  </div>
                  {isAdmin && (
                    <div className="text-xs text-blue-600 font-semibold">
                      Admin
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-900"
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

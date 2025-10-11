import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { FinishSignIn } from './pages/FinishSignIn';
import { TeamSelect } from './pages/TeamSelect';
import { LeagueHome } from './pages/LeagueHome';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { AdminUpload } from './pages/AdminUpload';
import { AdminTeams } from './pages/AdminTeams';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/" />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/finishSignIn" element={<FinishSignIn />} />
          <Route
            path="/teams"
            element={
              <PrivateRoute>
                <AppLayout>
                  <TeamSelect />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId"
            element={
              <PrivateRoute>
                <AppLayout>
                  <LeagueHome />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/team/:teamId"
            element={
              <PrivateRoute>
                <AppLayout>
                  <OwnerDashboard />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/teams"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminTeams />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/upload"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminUpload />
                </AppLayout>
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

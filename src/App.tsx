import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Login } from './pages/Login';
import { FinishSignIn } from './pages/FinishSignIn';
import { TeamSelect } from './pages/TeamSelect';
import { LeagueHome } from './pages/LeagueHome';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { Draft } from './pages/Draft';
import { FreeAgents } from './pages/FreeAgents';
import { RecordBook } from './pages/RecordBook';
import { RookieDraft } from './pages/RookieDraft';
import { Rules } from './pages/Rules';
import { AdminUpload } from './pages/AdminUpload';
import { AdminTeams } from './pages/AdminTeams';
import { AdminPlayers } from './pages/AdminPlayers';
import { Inbox } from './pages/Inbox';
import { Profile } from './pages/Profile';

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
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
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
            path="/league/:leagueId/draft"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Draft />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/free-agents"
            element={
              <PrivateRoute>
                <AppLayout>
                  <FreeAgents />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/record-book"
            element={
              <PrivateRoute>
                <AppLayout>
                  <RecordBook />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/rookie-draft"
            element={
              <PrivateRoute>
                <AppLayout>
                  <RookieDraft />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/rules"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Rules />
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
          <Route
            path="/admin/players"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminPlayers />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Inbox />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Profile />
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

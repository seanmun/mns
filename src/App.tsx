import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LeagueProvider } from './contexts/LeagueContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
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
import { AdminLeague } from './pages/AdminLeague';
import { AdminDraftTest } from './pages/AdminDraftTest';
import { AdminDraftSetup } from './pages/AdminDraftSetup';
import { AdminViewRosters } from './pages/AdminViewRosters';
import { AdminRookiePicks } from './pages/AdminRookiePicks';
import { AdminDraftPicks } from './pages/AdminDraftPicks';
import { AdminTradeManager } from './pages/AdminTradeManager';
import { AdminPortfolio } from './pages/AdminPortfolio';
import { AdminMigration } from './pages/AdminMigration';
import { AdminPicksView } from './pages/AdminPicksView';
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
        <LeagueProvider>
          <Routes>
          <Route
            path="/"
            element={
              <AppLayout>
                <Home />
              </AppLayout>
            }
          />
          <Route path="/login" element={<Login />} />
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
            path="/admin/view-rosters"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminViewRosters />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/rookie-picks"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminRookiePicks />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/draft-picks"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminDraftPicks />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/portfolio"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminPortfolio />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/trade"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminTradeManager />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/migration"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminMigration />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/picks"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminPicksView />
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
            path="/admin/league"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminLeague />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/draft-test"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminDraftTest />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/draft-setup"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminDraftSetup />
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
        </LeagueProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

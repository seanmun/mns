import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LeagueProvider } from './contexts/LeagueContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';

// Eagerly loaded (critical for initial render)
import { Home } from './pages/Home';
import { Login } from './pages/Login';

// Lazy loaded route components (using named imports)
const FinishSignIn = lazy(() => import('./pages/FinishSignIn').then(m => ({ default: m.FinishSignIn })));
const TeamSelect = lazy(() => import('./pages/TeamSelect').then(m => ({ default: m.TeamSelect })));
const LeagueHome = lazy(() => import('./pages/LeagueHome').then(m => ({ default: m.LeagueHome })));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then(m => ({ default: m.OwnerDashboard })));
const Draft = lazy(() => import('./pages/Draft').then(m => ({ default: m.Draft })));
const FreeAgents = lazy(() => import('./pages/FreeAgents').then(m => ({ default: m.FreeAgents })));
const RecordBook = lazy(() => import('./pages/RecordBook').then(m => ({ default: m.RecordBook })));
const RookieDraft = lazy(() => import('./pages/RookieDraft').then(m => ({ default: m.RookieDraft })));
const Rules = lazy(() => import('./pages/Rules').then(m => ({ default: m.Rules })));
const Prospects = lazy(() => import('./pages/Prospects').then(m => ({ default: m.Prospects })));
const MockDraft = lazy(() => import('./pages/MockDraft').then(m => ({ default: m.MockDraft })));
const TradeMachine = lazy(() => import('./pages/TradeMachine').then(m => ({ default: m.TradeMachine })));
const Inbox = lazy(() => import('./pages/Inbox').then(m => ({ default: m.Inbox })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Changelog = lazy(() => import('./pages/Changelog').then(m => ({ default: m.Changelog })));

// Admin pages (lazy loaded - not needed for most users)
const AdminUpload = lazy(() => import('./pages/AdminUpload').then(m => ({ default: m.AdminUpload })));
const AdminTeams = lazy(() => import('./pages/AdminTeams').then(m => ({ default: m.AdminTeams })));
const AdminPlayers = lazy(() => import('./pages/AdminPlayers').then(m => ({ default: m.AdminPlayers })));
const AdminLeague = lazy(() => import('./pages/AdminLeague').then(m => ({ default: m.AdminLeague })));
const AdminRosterManager = lazy(() => import('./pages/AdminRosterManager').then(m => ({ default: m.AdminRosterManager })));
const AdminDraftTest = lazy(() => import('./pages/AdminDraftTest').then(m => ({ default: m.AdminDraftTest })));
const AdminDraftSetup = lazy(() => import('./pages/AdminDraftSetup').then(m => ({ default: m.AdminDraftSetup })));
const AdminViewRosters = lazy(() => import('./pages/AdminViewRosters').then(m => ({ default: m.AdminViewRosters })));
const AdminRookiePicks = lazy(() => import('./pages/AdminRookiePicks').then(m => ({ default: m.AdminRookiePicks })));
const AdminDraftPicks = lazy(() => import('./pages/AdminDraftPicks').then(m => ({ default: m.AdminDraftPicks })));
const AdminTradeManager = lazy(() => import('./pages/AdminTradeManager').then(m => ({ default: m.AdminTradeManager })));
const AdminPortfolio = lazy(() => import('./pages/AdminPortfolio').then(m => ({ default: m.AdminPortfolio })));
const AdminMigration = lazy(() => import('./pages/AdminMigration').then(m => ({ default: m.AdminMigration })));
const AdminPicksView = lazy(() => import('./pages/AdminPicksView').then(m => ({ default: m.AdminPicksView })));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <div className="mt-4 text-gray-400">Loading...</div>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
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
      <ScrollToTop />
      <AuthProvider>
        <LeagueProvider>
          <Suspense fallback={<LoadingFallback />}>
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
          <Route
            path="/changelog"
            element={
              <AppLayout>
                <Changelog />
              </AppLayout>
            }
          />
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
            path="/league/:leagueId/prospects"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Prospects />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/mock-draft"
            element={
              <PrivateRoute>
                <AppLayout>
                  <MockDraft />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/trade-machine"
            element={
              <PrivateRoute>
                <AppLayout>
                  <TradeMachine />
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
            path="/admin/rosters"
            element={
              <PrivateRoute>
                <AppLayout>
                  <AdminRosterManager />
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
          </Suspense>
        </LeagueProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

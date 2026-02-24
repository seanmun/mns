import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LeagueProvider, useLeague } from './contexts/LeagueContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { LeagueBottomNav } from './components/LeagueBottomNav';
import { LeagueTopNav } from './components/LeagueTopNav';

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
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const Roadmap = lazy(() => import('./pages/Roadmap').then(m => ({ default: m.Roadmap })));
const Media = lazy(() => import('./pages/Media').then(m => ({ default: m.Media })));
const MatchupDetail = lazy(() => import('./pages/MatchupDetail').then(m => ({ default: m.MatchupDetail })));

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

function InboxRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { currentLeagueId, loading: leagueLoading } = useLeague();

  if (authLoading || leagueLoading) return <LoadingFallback />;
  if (!user) return <Navigate to="/" />;
  if (currentLeagueId) return <Navigate to={`/league/${currentLeagueId}/inbox`} replace />;
  return <Navigate to="/teams" replace />;
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

function LeagueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <LeagueTopNav />
      <main className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>
      <Footer />
      <LeagueBottomNav />
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
          <Route
            path="/privacy"
            element={
              <AppLayout>
                <Privacy />
              </AppLayout>
            }
          />
          <Route
            path="/about"
            element={
              <AppLayout>
                <About />
              </AppLayout>
            }
          />
          <Route
            path="/roadmap"
            element={
              <AppLayout>
                <Roadmap />
              </AppLayout>
            }
          />
          <Route
            path="/media"
            element={
              <AppLayout>
                <Media />
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
                <LeagueLayout>
                  <LeagueHome />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/matchup/:matchupId"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <MatchupDetail />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/team/:teamId"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <OwnerDashboard />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/draft"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <Draft />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/free-agents"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <FreeAgents />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/record-book"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <RecordBook />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/rookie-draft"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <RookieDraft />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/rules"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <Rules />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/prospects"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <Prospects />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/mock-draft"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <MockDraft />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/trade-machine"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <TradeMachine />
                </LeagueLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/league/:leagueId/inbox"
            element={
              <PrivateRoute>
                <LeagueLayout>
                  <Inbox />
                </LeagueLayout>
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
          {/* Legacy /inbox redirect — now lives at /league/:leagueId/inbox */}
          <Route
            path="/inbox"
            element={<InboxRedirect />}
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

import { useNavigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';

export function Home() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { userLeagues, loading: leaguesLoading } = useLeague();

  // Redirect authenticated users to their league
  useEffect(() => {
    // Wait for auth and leagues to load
    if (authLoading || leaguesLoading) return;

    // If user is authenticated, redirect them
    if (user) {
      if (userLeagues.length === 0) {
        // User has no leagues - redirect to teams page (where they can create/join)
        navigate('/teams');
      } else if (userLeagues.length === 1) {
        // User has exactly one league - go directly to that league's home page
        navigate(`/league/${userLeagues[0].id}`);
      } else {
        // User has multiple leagues - go to teams page to select
        navigate('/teams');
      }
    }
  }, [user, userLeagues, authLoading, leaguesLoading, navigate]);

  // Loop center-ball video back to start before the blank frame at ~19s
  const handleCenterBallLoop = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.currentTime >= 19.5) {
      video.currentTime = 0;
    }
  }, []);

  // Show loading while checking auth status
  if (authLoading || (user && leaguesLoading)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent" />
          <div className="mt-4 text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  // Only show home page to unauthenticated users
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Video - left-ball for desktop, center-ball for mobile */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-15 hidden md:block"
        >
          <source src="/video/left-ball.mp4" type="video/mp4" />
        </video>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-15 md:hidden"
          onTimeUpdate={handleCenterBallLoop}
        >
          <source src="/video/center-ball.mp4" type="video/mp4" />
        </video>

        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-purple-400/10 to-pink-400/10" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="text-center">
            {/* Logo/Icon */}
            <div className="flex justify-center mb-8">
              <img
                src="/icons/mnsBall-icon.webp"
                alt="Money Never Sleeps"
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full shadow-2xl ring-4 ring-green-400/30"
              />
            </div>

            {/* Title */}
            <h1 className="text-5xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text text-transparent">
              Money Never Sleeps
            </h1>

            <p className="text-xl sm:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
              Where Fantasy Basketball Meets Wall Street
            </p>

            <p className="text-lg text-gray-400 mb-8 max-w-3xl mx-auto">
              Navigate real NBA cap rules with apron thresholds, manage keeper contracts with advancing rounds, and make strategic decisions with actual monetary consequences. Track live blockchain investments where penalties fuel the prize pool—sweat your matchups and your portfolio, because money never sleeps.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-4 border-2 border-green-400 text-green-400 rounded-lg text-lg font-bold hover:bg-green-400/10 hover:shadow-[0_0_30px_rgba(74,222,128,0.6)] transition-all cursor-pointer"
              >
                Enter League
              </button>
              <button
                onClick={() => {
                  const featuresSection = document.getElementById('features');
                  featuresSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-8 py-4 border-2 border-gray-700 text-gray-300 rounded-lg text-lg font-semibold hover:border-green-400 hover:text-green-400 hover:bg-green-400/10 transition-all cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">What Makes MNS Special</h2>
          <p className="text-gray-400 text-lg">A sophisticated platform for serious fantasy basketball owners</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1: Salary Cap */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 hover:border-green-400/50 transition-all hover:shadow-[0_0_20px_rgba(74,222,128,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/money-icon.webp" alt="Salary Cap" className="w-12 h-12 rounded-full" />
              <h3 className="text-xl font-bold">Real NBA Salary Cap</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Navigate first apron ($195M) and second apron ($225M) thresholds with real financial penalties. Every dollar counts.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-400 flex-shrink-0">•</span>
                <span>$50 one-time fee for crossing first apron</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 flex-shrink-0">•</span>
                <span>$2 per $1M over second apron</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 flex-shrink-0">•</span>
                <span>Trade cap adjustments (±$30M)</span>
              </li>
            </ul>
          </div>

          {/* Feature 2: Dynasty Keepers */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 hover:border-purple-400/50 transition-all hover:shadow-[0_0_20px_rgba(192,132,252,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/lock-icon.webp" alt="Keepers" className="w-12 h-12 rounded-full" />
              <h3 className="text-xl font-bold">Dynasty Keeper System</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Keep up to 8 players season-over-season, building a true dynasty with strategic round management.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Keepers advance one round each year</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Franchise tags for multiple superstars</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 flex-shrink-0">•</span>
                <span>Smart stacking algorithm resolves conflicts</span>
              </li>
            </ul>
          </div>

          {/* Feature 3: Rookie Development */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 hover:border-pink-400/50 transition-all hover:shadow-[0_0_20px_rgba(244,114,182,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/rookie-icon.webp" alt="Rookies" className="w-12 h-12 rounded-full" />
              <h3 className="text-xl font-bold">Rookie Pipeline</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Stash rookies for $10, activate mid-season for $25. Build your future with the annual rookie draft.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-pink-400 flex-shrink-0">•</span>
                <span>Redshirt system mirrors college basketball</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 flex-shrink-0">•</span>
                <span>Annual rookie draft with lottery system</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 flex-shrink-0">•</span>
                <span>International stash for future prospects</span>
              </li>
            </ul>
          </div>

          {/* Feature 4: Live Draft */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 hover:border-blue-400/50 transition-all hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/draft-icon.webp" alt="Draft" className="w-12 h-12 rounded-full" />
              <h3 className="text-xl font-bold">Live Draft Board</h3>
            </div>
            <p className="text-gray-400 mb-4">
              13-round snake draft with real-time updates and Telegram notifications with @username tagging.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">•</span>
                <span>Keepers automatically occupy rounds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">•</span>
                <span>Real-time Telegram notifications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">•</span>
                <span>Admin tools for keeper management</span>
              </li>
            </ul>
          </div>

          {/* Feature 5: Prize Pool */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 hover:border-yellow-400/50 transition-all hover:shadow-[0_0_20px_rgba(250,204,21,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/trophy-icon.webp" alt="Prize Pool" className="w-12 h-12 rounded-full" />
              <h3 className="text-xl font-bold">Prize Pool Investment</h3>
            </div>
            <p className="text-gray-400 mb-4">
              All fees invested in voted-upon assets. Pool could be $600, $2,000, or $150,000 by playoffs!
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 flex-shrink-0">•</span>
                <span>Live portfolio tracking via blockchain</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 flex-shrink-0">•</span>
                <span>Dynamic payout rules based on returns</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 flex-shrink-0">•</span>
                <span>Real-time ETH balance updates</span>
              </li>
            </ul>
          </div>

          {/* Feature 6: Analytics */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 hover:border-emerald-400/50 transition-all hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/settings-icon.webp" alt="Analytics" className="w-12 h-12 rounded-full" />
              <h3 className="text-xl font-bold">Advanced Analytics</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Visual cap thermometer, scenario planning, and smart metrics for strategic decision-making.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">•</span>
                <span>Real-time cap usage tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">•</span>
                <span>Save and compare multiple scenarios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">•</span>
                <span>Player projections and stats</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gradient-to-br from-gray-900 to-[#0a0a0a] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Four simple phases to dynasty greatness</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Phase 1 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center border-2 border-green-400">
                  <span className="text-2xl font-bold text-green-400">1</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Keeper Selection</h3>
              <p className="text-gray-400 text-sm">
                Review your roster, select up to 8 keepers, manage your salary cap, and pay franchise tags for superstars.
              </p>
            </div>

            {/* Phase 2 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-purple-400/20 rounded-full flex items-center justify-center border-2 border-purple-400">
                  <span className="text-2xl font-bold text-purple-400">2</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Draft</h3>
              <p className="text-gray-400 text-sm">
                13-round snake draft with keepers filling their assigned rounds. Telegram notifications keep you updated.
              </p>
            </div>

            {/* Phase 3 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-pink-400/20 rounded-full flex items-center justify-center border-2 border-pink-400">
                  <span className="text-2xl font-bold text-pink-400">3</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Regular Season</h3>
              <p className="text-gray-400 text-sm">
                Weekly head-to-head matchups, 9 statistical categories, manage trades within cap constraints.
              </p>
            </div>

            {/* Phase 4 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center border-2 border-yellow-400">
                  <span className="text-2xl font-bold text-yellow-400">4</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">Playoffs & Payout</h3>
              <p className="text-gray-400 text-sm">
                Top 6 teams compete for the prize pool. Live portfolio valuation shows real-time returns.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6">Ready to Build Your Dynasty?</h2>
        <p className="text-xl text-gray-400 mb-8">
          Join the most sophisticated fantasy basketball league where strategy, finance, and hoops converge.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-12 py-5 border-2 border-green-400 text-green-400 rounded-lg text-xl font-bold hover:bg-green-400/10 hover:shadow-[0_0_40px_rgba(74,222,128,0.8)] transition-all cursor-pointer"
        >
          Get Started
        </button>
        <p className="text-sm text-gray-500 mt-4">
          Sign in with Google to access your team
        </p>
      </div>

    </div>
  );
}

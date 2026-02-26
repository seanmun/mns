import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDailyQuote } from '../data/hinkieQuotes';
import { useAuth } from '../contexts/AuthContext';
import { useWagers } from '../hooks/useWagers';
import { useTradeProposals } from '../hooks/useTradeProposals';
import { WagerProposal } from '../components/WagerProposal';
import { TradeProposalCard } from '../components/TradeProposalCard';
import type { Team } from '../types';
import { mapTeam } from '../lib/mappers';

export function Inbox() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const dailyQuote = getDailyQuote();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [myTeam, setMyTeam] = useState<Team | null>(null);

  // Fetch wagers involving the user's team
  const { wagers } = useWagers({
    leagueId,
    teamId: myTeam?.id,
  });

  // Fetch trade proposals involving the user's team
  const { proposals: tradeProposals, responses: tradeResponses } = useTradeProposals(
    leagueId,
    myTeam?.id
  );
  const pendingTrades = tradeProposals.filter(p => p.status === 'pending');
  const archivedTrades = tradeProposals.filter(p => p.status !== 'pending');
  const activeWagers = wagers.filter(w => w.status === 'pending' || w.status === 'accepted' || w.status === 'live');
  const archivedWagers = wagers.filter(w => w.status === 'declined' || w.status === 'settled');
  const archiveCount = archivedTrades.length + archivedWagers.length;

  // Debug logging
  useEffect(() => {
    console.log('Inbox Debug:', {
      leagueId,
      myTeam: myTeam?.id,
      myTeamName: myTeam?.name,
      userEmail: user?.email,
      wagersCount: wagers.length,
      wagers: wagers.map(w => ({
        id: w.id,
        proposer: w.proposerId,
        opponent: w.opponentId,
        status: w.status
      }))
    });
  }, [leagueId, myTeam, user, wagers]);

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Fetch user's team
  useEffect(() => {
    const fetchMyTeam = async () => {
      if (!leagueId || !user?.email) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', leagueId);

        if (error) throw error;

        const teamData = (data || []).map(mapTeam);
        const userTeam = teamData.find((team) => team.owners.includes(user.email || ''));
        setMyTeam(userTeam || null);
      } catch (error) {
        console.error('Error fetching team:', error);
      }
    };

    fetchMyTeam();
  }, [leagueId, user]);

  // Load read status from localStorage
  useEffect(() => {
    const readKey = `hinkie-quote-read-${dailyQuote.id}-${new Date().toDateString()}`;
    const hasRead = localStorage.getItem(readKey) === 'true';
    setIsRead(hasRead);
  }, [dailyQuote.id]);

  // Handle expand and mark as read
  const handleExpand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setIsRead(true);
      const readKey = `hinkie-quote-read-${dailyQuote.id}-${new Date().toDateString()}`;
      localStorage.setItem(readKey, 'true');

      // Trigger a custom event to update the header notification
      window.dispatchEvent(new Event('inboxRead'));
    } else {
      setIsExpanded(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Inbox</h1>
          <p className="text-gray-400 mt-1">
            Daily wisdom from the Process
          </p>
        </div>

        {/* Daily Quote Message */}
        <div className={`bg-[#121212] rounded-lg border overflow-hidden transition-colors ${
          isRead ? 'border-gray-800' : 'border-green-400/50 shadow-[0_0_15px_rgba(74,222,128,0.3)]'
        }`}>
          {/* Message Header - Clickable */}
          <button
            onClick={handleExpand}
            className="w-full px-6 py-4 border-b border-gray-800 hover:bg-gray-800/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {/* Unread Indicator */}
              {!isRead && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              )}

              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-black font-bold">
                SH
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold truncate ${isRead ? 'text-gray-400' : 'text-white'}`}>
                    Sam Hinkie
                  </h3>
                  {!isRead && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-400 text-black">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm truncate">{dailyQuote.quote.substring(0, 50)}...</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{today.split(',')[0]}</span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Message Content - Expandable */}
          {isExpanded && (
            <div className="px-6 py-8 md:flex md:items-center md:gap-8">
            {/* Quote Image - 50% width on desktop */}
            <div className="mb-6 md:mb-0 md:w-1/2 rounded-lg overflow-hidden border border-gray-800 flex-shrink-0">
              <img
                src={dailyQuote.image}
                alt={dailyQuote.quote}
                className="w-full h-auto"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Quote Text - 50% width on desktop */}
            <blockquote className="text-center md:text-left md:w-1/2">
              <p className="text-2xl md:text-3xl font-serif text-green-400 italic mb-4">
                "{dailyQuote.quote}"
              </p>
              <footer className="text-green-400 text-sm font-semibold">
                — Sam Hinkie
              </footer>
            </blockquote>
            </div>
          )}

        </div>

        {/* Active Wager Proposals */}
        {activeWagers.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Wager Proposals</h2>
            {activeWagers.map((wager) => (
              <WagerProposal
                key={wager.id}
                wager={wager}
                userEmail={user?.email || ''}
                isOpponent={myTeam?.id === wager.opponentId}
              />
            ))}
          </div>
        )}

        {/* Active Trade Proposals */}
        {pendingTrades.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Trade Proposals</h2>
            {pendingTrades.map((proposal) => (
              <TradeProposalCard
                key={proposal.id}
                proposal={proposal}
                responses={tradeResponses.get(proposal.id) || []}
                userTeamId={myTeam?.id || null}
                userEmail={user?.email || ''}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {activeWagers.length === 0 && pendingTrades.length === 0 && (
          <div className="mt-6 text-center py-12">
            <svg
              className="w-16 h-16 text-gray-600 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-400 text-sm">
              No new proposals
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Wager and trade proposals will appear here
            </p>
          </div>
        )}

        {/* Archive Section */}
        {archiveCount > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setIsArchiveOpen(!isArchiveOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#121212] rounded-lg border border-gray-800 hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
                <span className="text-gray-400 font-medium">Archive</span>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {archiveCount}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isArchiveOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isArchiveOpen && (
              <div className="mt-4 space-y-6 opacity-75">
                {/* Archived Trades */}
                {archivedTrades.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Completed Trades
                    </h3>
                    {archivedTrades.map((proposal) => (
                      <TradeProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        responses={tradeResponses.get(proposal.id) || []}
                        userTeamId={myTeam?.id || null}
                        userEmail={user?.email || ''}
                      />
                    ))}
                  </div>
                )}

                {/* Archived Wagers */}
                {archivedWagers.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Settled Wagers
                    </h3>
                    {archivedWagers.map((wager) => (
                      <WagerProposal
                        key={wager.id}
                        wager={wager}
                        userEmail={user?.email || ''}
                        isOpponent={myTeam?.id === wager.opponentId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

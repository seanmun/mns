import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { useWatchList, togglePlayerInWatchList } from '../hooks/useWatchList';
import type { Draft, Team, Player } from '../types';

export function Draft() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, role } = useAuth();
  const { currentLeague } = useLeague();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftPickOwnership, setDraftPickOwnership] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState(1);
  const [view, setView] = useState<'board' | 'players'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [sortColumn, setSortColumn] = useState<'salary' | 'score' | 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'fgPercent' | 'ftPercent' | 'threePointMade'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const { projectedStats } = useProjectedStats();
  const { watchList, setWatchList } = useWatchList(
    user?.email || undefined,
    leagueId,
    userTeamId || undefined
  );

  const isAdmin = role === 'admin';

  // Find user's team
  const userTeamIds = teams
    .filter((team) => team.owners.includes(user?.email || ''))
    .map((team) => team.id);

  // Check if user owns the current pick (accounting for trades)
  const currentPickOwner = draft?.currentPick
    ? draftPickOwnership.get(draft.currentPick.overallPick) || draft.currentPick.teamId
    : null;

  const isUserOnClock = draft?.currentPick && currentPickOwner && userTeamIds.includes(currentPickOwner);

  // Get user's team ID for watchlist
  useEffect(() => {
    if (!leagueId || !user?.email || teams.length === 0) return;

    const userTeam = teams.find(t => t.owners.includes(user.email!));
    if (userTeam) {
      setUserTeamId(userTeam.id);
    }
  }, [teams, leagueId, user]);

  // Redirect non-admins if this is a test draft
  useEffect(() => {
    if (draft && draft.settings.isTestDraft && role !== 'admin' && role !== null) {
      navigate(`/league/${leagueId}`);
    }
  }, [draft, role, navigate, leagueId]);

  useEffect(() => {
    if (!leagueId || !currentLeague) return;

    loadInitialData();
    loadDraftPickOwnership();
  }, [leagueId, currentLeague]);

  useEffect(() => {
    if (!leagueId || !currentLeague) return;

    // Real-time listener for draft updates
    const draftId = `${leagueId}_${currentLeague.seasonYear}`;
    const draftRef = doc(db, 'drafts', draftId);

    const unsubscribe = onSnapshot(draftRef, (snapshot) => {
      if (snapshot.exists()) {
        const draftData = { id: snapshot.id, ...snapshot.data() } as Draft;
        setDraft(draftData);

        // Auto-navigate to current round when draft updates
        if (draftData.currentPick && view === 'board') {
          setSelectedRound(draftData.currentPick.round);
        }
      }
    });

    return () => unsubscribe();
  }, [leagueId, currentLeague, view]);

  useEffect(() => {
    if (!leagueId) return;

    // Real-time listener for player updates (to remove drafted players from pool)
    const playersRef = collection(db, 'players');
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      const playersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];
      setPlayers(playersData);
    });

    return () => unsubscribe();
  }, [leagueId]);

  const loadInitialData = async () => {
    if (!leagueId || !currentLeague) return;

    setLoading(true);
    try {
      // Load teams
      const teamsRef = collection(db, 'teams');
      const teamsQuery = query(teamsRef, where('leagueId', '==', leagueId));
      const teamsSnap = await getDocs(teamsQuery);
      const teamsData = teamsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setTeams(teamsData);

      // Players are loaded via real-time listener
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDraftPickOwnership = async () => {
    if (!leagueId) return;

    try {
      const draftPicksRef = collection(db, 'draftPicks');
      const draftPicksQuery = query(draftPicksRef, where('leagueId', '==', leagueId));
      const draftPicksSnap = await getDocs(draftPicksQuery);

      const ownershipMap = new Map<number, string>();
      draftPicksSnap.docs.forEach((doc) => {
        const pick = doc.data();
        ownershipMap.set(pick.pickNumber, pick.currentOwner);
      });

      console.log('[Draft] Loaded draft pick ownership:', ownershipMap.size, 'picks');
      setDraftPickOwnership(ownershipMap);
    } catch (error) {
      console.error('Error loading draft pick ownership:', error);
    }
  };

  const handleDraftPlayer = async (playerId: string) => {
    if (!draft || !draft.currentPick || !user?.email) return;
    if (!isUserOnClock && !isAdmin) {
      alert('It is not your turn to pick!');
      return;
    }

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Confirm pick
    const confirmed = window.confirm(
      `Confirm draft pick:\n\n${player.name}\n${player.position} - ${player.nbaTeam}\n$${(player.salary / 1_000_000).toFixed(1)}M`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const draftRef = doc(db, 'drafts', draft.id);

      let nextOpenPickTeamId: string | undefined;

      await runTransaction(db, async (transaction) => {
        const draftSnap = await transaction.get(draftRef);
        if (!draftSnap.exists()) {
          throw new Error('Draft does not exist');
        }

        const currentDraft = { id: draftSnap.id, ...draftSnap.data() } as Draft;

        // Verify player hasn't been drafted
        const alreadyDrafted = currentDraft.picks.some(
          p => p.playerId === playerId && p.pickedAt
        );
        if (alreadyDrafted) {
          throw new Error('Player has already been drafted');
        }

        // Update current pick
        const updatedPicks = currentDraft.picks.map(pick => {
          if (pick.overallPick === currentDraft.currentPick?.overallPick) {
            return {
              ...pick,
              playerId,
              playerName: player.name,
              pickedAt: Date.now(),
              pickedBy: user.email,
            };
          }
          return pick;
        });

        // Find next open pick
        const nextOpenPick = updatedPicks.find(
          p => p.overallPick > (currentDraft.currentPick?.overallPick || 0) && !p.isKeeperSlot
        );

        // Store next team ID for Telegram notification (accounting for trades)
        if (nextOpenPick) {
          nextOpenPickTeamId = draftPickOwnership.get(nextOpenPick.overallPick) || nextOpenPick.teamId;
        }

        const updatedDraft: any = {
          picks: updatedPicks,
          status: nextOpenPick ? 'in_progress' : 'completed',
        };

        // Only add currentPick if there is one
        if (nextOpenPick) {
          updatedDraft.currentPick = {
            round: nextOpenPick.round,
            pickInRound: nextOpenPick.pickInRound,
            overallPick: nextOpenPick.overallPick,
            teamId: nextOpenPick.teamId,
            startedAt: Date.now(),
          };
        }

        // Only add completedAt if draft is complete
        if (!nextOpenPick) {
          updatedDraft.completedAt = Date.now();
        }

        transaction.update(draftRef, updatedDraft);

        // Update the player document to assign them to the drafting team
        const actualPickOwner = draftPickOwnership.get(currentDraft.currentPick?.overallPick || 0)
          || currentDraft.currentPick?.teamId;

        console.log('[Draft] Assigning player', playerId, 'to team', actualPickOwner);

        const playerRef = doc(db, 'players', playerId);
        transaction.update(playerRef, {
          'roster.teamId': actualPickOwner,
          'roster.leagueId': currentDraft.leagueId
        });
      });

      // Telegram notification is now handled server-side by Cloud Function
      console.log('[Draft] Pick saved. Cloud Function will send Telegram notification.');

      // Success! Switch back to board view
      setView('board');
      setSearchTerm('');

      alert(`Successfully drafted ${player.name}!`);
    } catch (error: any) {
      console.error('Error making pick:', error);
      alert(`Failed to draft player: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const convertKeeperToRegularPick = async (pickNumber: number) => {
    if (!draft || !leagueId || !currentLeague) return;

    const pickToConvert = draft.picks.find(p => p.overallPick === pickNumber);
    if (!pickToConvert) {
      alert('Pick not found.');
      return;
    }

    if (!pickToConvert.isKeeperSlot) {
      alert('This is already a regular pick, not a keeper slot.');
      return;
    }

    const confirmMsg = `Convert Round ${pickToConvert.round}, Pick ${pickToConvert.pickInRound} from keeper slot to regular draft pick?`;
    if (!confirm(confirmMsg)) return;

    try {
      const draftId = `${leagueId}_${currentLeague.seasonYear}`;
      const draftRef = doc(db, 'drafts', draftId);

      await runTransaction(db, async (transaction) => {
        const draftSnap = await transaction.get(draftRef);
        if (!draftSnap.exists()) throw new Error('Draft not found');

        const currentDraft = draftSnap.data() as Draft;
        const updatedPicks = currentDraft.picks.map(p => {
          if (p.overallPick === pickNumber) {
            return {
              ...p,
              isKeeperSlot: false,
            };
          }
          return p;
        });

        transaction.update(draftRef, { picks: updatedPicks });
      });

      alert(`Pick converted to regular draft pick!`);
    } catch (error: any) {
      console.error('Error converting pick:', error);
      alert(`Failed to convert pick: ${error.message}`);
    }
  };

  const undoPick = async (pickNumber: number) => {
    if (!draft || !leagueId || !currentLeague) return;

    const pickToUndo = draft.picks.find(p => p.overallPick === pickNumber);
    if (!pickToUndo || !pickToUndo.playerId) {
      alert('This pick has no player to undo.');
      return;
    }

    const confirmMsg = `Are you sure you want to undo pick #${pickNumber}?\n\nPlayer: ${pickToUndo.playerName}\nTeam: ${pickToUndo.teamName}\n\nThis will release the player back to the pool${pickToUndo.isKeeperSlot ? ' and remove from team roster' : ''}.`;

    if (!confirm(confirmMsg)) return;

    try {
      const draftId = `${leagueId}_${currentLeague.seasonYear}`;
      const draftRef = doc(db, 'drafts', draftId);
      const playerRef = doc(db, 'players', pickToUndo.playerId);

      await runTransaction(db, async (transaction) => {
        // ALL READS FIRST
        const draftSnap = await transaction.get(draftRef);
        if (!draftSnap.exists()) throw new Error('Draft not found');

        let rosterSnap = null;
        if (pickToUndo.isKeeperSlot) {
          const rosterId = `${leagueId}_${pickToUndo.teamId}_${currentLeague.seasonYear}`;
          const rosterRef = doc(db, 'rosters', rosterId);
          rosterSnap = await transaction.get(rosterRef);
        }

        // NOW DO WRITES
        const currentDraft = draftSnap.data() as Draft;
        const updatedPicks = currentDraft.picks.map(p => {
          if (p.overallPick === pickNumber) {
            return {
              ...p,
              playerId: null,
              playerName: null,
              pickedAt: null,
              isKeeperSlot: false, // Convert keeper slot to regular pick
            };
          }
          return p;
        });

        // Update draft with cleared pick
        transaction.update(draftRef, { picks: updatedPicks });

        // Release player back to pool
        transaction.update(playerRef, {
          'roster.teamId': null,
          'roster.leagueId': null,
        });

        // If it's a keeper, also remove from roster entries
        if (pickToUndo.isKeeperSlot && rosterSnap && rosterSnap.exists()) {
          const rosterId = `${leagueId}_${pickToUndo.teamId}_${currentLeague.seasonYear}`;
          const rosterRef = doc(db, 'rosters', rosterId);
          const rosterData = rosterSnap.data();
          const updatedEntries = rosterData.entries.filter((e: any) => e.playerId !== pickToUndo.playerId);
          transaction.update(rosterRef, { entries: updatedEntries });
        }
      });

      alert(`Pick #${pickNumber} has been undone. ${pickToUndo.playerName} is back in the player pool${pickToUndo.isKeeperSlot ? ' and removed from team roster' : ''}.`);
    } catch (error: any) {
      console.error('Error undoing pick:', error);
      alert(`Failed to undo pick: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading draft...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Draft Not Available</h1>
            <p className="text-gray-300 mb-6">
              The draft has not been set up yet. Please contact your league admin.
            </p>
            <button
              onClick={() => navigate(`/league/${leagueId}`)}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Back to League Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleToggleWatchList = async (e: React.MouseEvent, playerFantraxId: string) => {
    e.stopPropagation();

    if (!user?.email || !leagueId || !userTeamId) {
      alert('Please sign in to add players to your watchlist');
      return;
    }

    try {
      const updatedWatchList = await togglePlayerInWatchList(
        user.email,
        leagueId,
        userTeamId,
        playerFantraxId,
        watchList
      );
      setWatchList(updatedWatchList);
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      alert('Failed to update watchlist');
    }
  };

  const getRoundPicks = (round: number) => {
    return draft.picks.filter((pick) => pick.round === round);
  };

  // Get available players (not yet drafted, not on rosters)
  const draftedPlayerIds = new Set(
    draft.picks.filter(p => p.playerId).map(p => p.playerId!)
  );

  const filteredPlayers = players.filter(p => {
    // Exclude players already on rosters or drafted
    if (p.roster?.teamId || draftedPlayerIds.has(p.id)) return false;

    // Apply search filter
    const matchesSearch = !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nbaTeam?.toLowerCase().includes(searchTerm.toLowerCase());

    // Apply position filter
    const matchesPosition = positionFilter === 'all' || p.position.includes(positionFilter);

    // Apply watchlist filter
    const matchesWatchlist = !showWatchlistOnly || watchList?.playerIds.includes(p.fantraxId);

    return matchesSearch && matchesPosition && matchesWatchlist;
  });

  // Sort available players
  const availablePlayers = [...filteredPlayers].sort((a, b) => {
    let aValue: number | undefined;
    let bValue: number | undefined;

    if (sortColumn === 'salary') {
      aValue = a.salary;
      bValue = b.salary;
    } else {
      const aStats = projectedStats.get(a.fantraxId);
      const bStats = projectedStats.get(b.fantraxId);
      aValue = aStats?.[sortColumn];
      bValue = bStats?.[sortColumn];
    }

    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    const diff = aValue - bValue;
    return sortDirection === 'asc' ? diff : -diff;
  });

  const currentPickTeam = teams.find(t => t.id === draft.currentPick?.teamId);

  if (view === 'players') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header with Back Button */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Draft a Player</h1>
              {draft.currentPick && (
                <p className="text-gray-400 mt-1">
                  Pick #{draft.currentPick.overallPick} - Round {draft.currentPick.round}, Pick {draft.currentPick.pickInRound}
                </p>
              )}
            </div>
            <button
              onClick={() => setView('board')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Back to Board
            </button>
          </div>

          {/* Current Pick Banner */}
          {draft.currentPick && currentPickTeam && (
            <div className={`mb-6 p-4 rounded-lg border ${
              isUserOnClock
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-purple-500/10 border-purple-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className="text-2xl">⏰</div>
                <div>
                  <div className="font-semibold text-white">
                    {isUserOnClock ? "You're on the clock!" : `${currentPickTeam.name} is on the clock`}
                  </div>
                  <div className="text-sm text-gray-400">
                    Select a player to draft
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="bg-[#121212] border border-gray-800 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Search Players
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or NBA team..."
                  className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Filter by Position
                </label>
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-green-400"
                >
                  <option value="all">All Positions</option>
                  <option value="PG">PG</option>
                  <option value="SG">SG</option>
                  <option value="SF">SF</option>
                  <option value="PF">PF</option>
                  <option value="C">C</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {availablePlayers.length} available players
              </div>
              <button
                onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showWatchlistOnly
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill={showWatchlistOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                Watchlist Only
                {watchList && watchList.playerIds.length > 0 && (
                  <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {watchList.playerIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Players Table */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#0a0a0a] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-r border-gray-800 w-48">
                      Player
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('salary')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Salary
                        {sortColumn === 'salary' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('score')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Score
                        {sortColumn === 'score' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('points')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        PTS
                        {sortColumn === 'points' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('rebounds')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        REB
                        {sortColumn === 'rebounds' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('assists')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        AST
                        {sortColumn === 'assists' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('steals')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        ST
                        {sortColumn === 'steals' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('blocks')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        BLK
                        {sortColumn === 'blocks' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('fgPercent')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        FG%
                        {sortColumn === 'fgPercent' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('ftPercent')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        FT%
                        {sortColumn === 'ftPercent' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort('threePointMade')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        3PM
                        {sortColumn === 'threePointMade' && (
                          <svg className={`w-3 h-3 transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    {(isUserOnClock || isAdmin) && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-[#121212] divide-y divide-gray-800">
                  {availablePlayers.map((player) => {
                    const stats = projectedStats.get(player.fantraxId);
                    const isWatched = watchList?.playerIds.includes(player.fantraxId) || false;
                    return (
                      <tr
                        key={player.id}
                        className="hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="sticky left-0 z-10 bg-[#121212] px-4 py-3 border-r border-gray-800 w-48">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleToggleWatchList(e, player.fantraxId)}
                              className="flex-shrink-0 hover:scale-110 transition-transform"
                            >
                              <svg
                                className={`w-4 h-4 ${
                                  isWatched ? 'fill-green-400 text-green-400' : 'fill-none text-gray-600'
                                } stroke-current stroke-2`}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                />
                              </svg>
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">
                                {player.name}
                              </div>
                              <div className="text-xs text-gray-400">
                                {player.nbaTeam} | {player.position}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-white text-right font-medium">
                          ${(player.salary / 1_000_000).toFixed(1)}M
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-400 text-center font-semibold">
                          {stats?.score?.toFixed(1) || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.points?.toFixed(1) || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.rebounds?.toFixed(1) || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.assists?.toFixed(1) || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.steals?.toFixed(1) || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.blocks?.toFixed(1) || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.fgPercent ? `${(stats.fgPercent * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.ftPercent ? `${(stats.ftPercent * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 text-center">
                          {stats?.threePointMade?.toFixed(1) || '-'}
                        </td>
                        {(isUserOnClock || isAdmin) && (
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleDraftPlayer(player.id)}
                              disabled={submitting}
                              className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submitting ? 'Drafting...' : 'Draft'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Draft Board View
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Draft Board</h1>
          <p className="text-gray-400 mt-1">
            {draft.status === 'setup' && 'Draft not started yet'}
            {draft.status === 'in_progress' && 'Draft in progress'}
            {draft.status === 'completed' && 'Draft completed'}
            {draft.status === 'paused' && 'Draft paused'}
          </p>
        </div>

        {/* Current Pick Banner */}
        {draft.status === 'in_progress' && draft.currentPick && currentPickTeam && (
          <div className={`mb-6 p-4 rounded-lg border ${
            isUserOnClock
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-purple-500/10 border-purple-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">⏰</div>
                <div>
                  <div className="font-semibold text-white">
                    {isUserOnClock ? "You're on the clock!" : `${currentPickTeam.name} is on the clock`}
                  </div>
                  <div className="text-sm text-gray-400">
                    Pick #{draft.currentPick.overallPick} - Round {draft.currentPick.round}, Pick {draft.currentPick.pickInRound}
                  </div>
                </div>
              </div>
              {(isUserOnClock || isAdmin) && (
                <button
                  onClick={() => setView('players')}
                  className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                >
                  Make Pick
                </button>
              )}
            </div>
          </div>
        )}

        {/* Round Tabs */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 13 }, (_, i) => i + 1).map((round) => (
              <button
                key={round}
                onClick={() => setSelectedRound(round)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  selectedRound === round
                    ? 'bg-green-500 text-white'
                    : 'bg-[#0a0a0a] text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {round}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-4 mb-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500/10 border border-blue-500/30"></div>
              <span className="text-gray-400">Keeper</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/10 border border-green-500/30"></div>
              <span className="text-gray-400">Your Pick</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500/10 border border-purple-500/30"></div>
              <span className="text-gray-400">On the Clock</span>
            </div>
          </div>
        </div>

        {/* Draft Board */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Round {selectedRound} {selectedRound % 2 === 0 && '(Snake - Reversed)'}
              </h2>
              {(() => {
                // Find user's next unpicked slot across all rounds
                const currentOverallPick = draft?.currentPick?.overallPick || 0;
                const nextUserPick = draft?.picks.find(
                  p => userTeamIds.includes(p.teamId) &&
                       !p.playerId &&
                       p.overallPick >= currentOverallPick
                );

                if (nextUserPick) {
                  const picksUntilUser = nextUserPick.overallPick - currentOverallPick;
                  return (
                    <p className="text-sm text-green-400 mt-1">
                      {picksUntilUser === 0
                        ? "You're on the clock!"
                        : `${picksUntilUser} pick${picksUntilUser === 1 ? '' : 's'} until you're up (Round ${nextUserPick.round})`}
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          <div className="space-y-1.5">
            {getRoundPicks(selectedRound).map((pick) => {
              // Check if pick was traded
              const actualOwner = draftPickOwnership.get(pick.overallPick) || pick.teamId;
              const isUserPick = userTeamIds.includes(actualOwner);
              const isOnClock = draft.currentPick?.overallPick === pick.overallPick;
              const isTraded = actualOwner !== pick.teamId;
              const actualOwnerTeam = teams.find(t => t.id === actualOwner);

              return (
                <div
                  key={pick.overallPick}
                  className={`p-2 rounded-lg border ${
                    isOnClock
                      ? 'bg-purple-500/10 border-purple-500/30 ring-2 ring-purple-500'
                      : pick.isKeeperSlot
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : isUserPick
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-[#0a0a0a] border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className="text-center flex-shrink-0 min-w-[32px]">
                        <div className="text-[9px] text-gray-500 leading-tight">OVR</div>
                        <div className="text-sm font-bold text-green-400 leading-tight">
                          {pick.overallPick}
                        </div>
                      </div>
                      <div className="text-center flex-shrink-0 min-w-[28px]">
                        <div className="text-[9px] text-gray-500 leading-tight">Pick</div>
                        <div className="text-xs font-semibold text-white leading-tight">
                          {pick.pickInRound}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="font-semibold text-white text-sm overflow-hidden text-ellipsis whitespace-nowrap" title={isTraded && actualOwnerTeam ? `${actualOwnerTeam.name} (via ${pick.teamAbbrev})` : pick.teamName}>
                          {isTraded && actualOwnerTeam ? (
                            <>
                              {actualOwnerTeam.name}
                              <span className="text-xs text-yellow-400 ml-1">(via {pick.teamAbbrev})</span>
                            </>
                          ) : (
                            pick.teamName
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {pick.isKeeperSlot ? 'Keeper' : isOnClock ? 'On the Clock' : pick.pickedAt ? 'Drafted' : 'Available'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 min-w-[80px] flex items-center justify-end gap-2">
                      {pick.playerName ? (
                        <>
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {pick.playerName}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {pick.isKeeperSlot ? 'Keeper' : 'Drafted'}
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => undoPick(pick.overallPick)}
                              className="px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                              title="Undo this pick"
                            >
                              Undo
                            </button>
                          )}
                        </>
                      ) : isOnClock ? (
                        <div className="text-xs text-purple-400 font-semibold animate-pulse">
                          Selecting...
                        </div>
                      ) : pick.isKeeperSlot && isAdmin ? (
                        <button
                          onClick={() => convertKeeperToRegularPick(pick.overallPick)}
                          className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/30 transition-colors"
                          title="Convert keeper slot to regular pick"
                        >
                          Convert to Pick
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500">-</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="text-sm text-gray-400">Total Picks</div>
            <div className="text-2xl font-bold text-white">{draft.picks.length}</div>
          </div>
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="text-sm text-gray-400">Keeper Slots</div>
            <div className="text-2xl font-bold text-blue-400">
              {draft.picks.filter((p) => p.isKeeperSlot).length}
            </div>
          </div>
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="text-sm text-gray-400">Picks Made</div>
            <div className="text-2xl font-bold text-green-400">
              {draft.picks.filter((p) => p.pickedAt).length}
            </div>
          </div>
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
            <div className="text-sm text-gray-400">Remaining</div>
            <div className="text-2xl font-bold text-purple-400">
              {draft.picks.filter((p) => !p.pickedAt).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

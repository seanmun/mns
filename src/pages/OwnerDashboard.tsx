import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRoster, useTeamPlayers, useTeam, useLeague, updateRoster, submitRoster, saveScenario } from '../hooks/useRoster';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { usePreviousStats } from '../hooks/usePreviousStats';
import { useAuth } from '../contexts/AuthContext';
import { useWatchList } from '../hooks/useWatchList';
import { RosterTable } from '../components/RosterTable';
import { CapThermometer } from '../components/CapThermometer';
import { SummaryCard } from '../components/SummaryCard';
import { DraftBoardView } from '../components/DraftBoardView';
import { WatchListView } from '../components/WatchListView';
import { baseKeeperRound, stackKeeperRounds, computeSummary, validateRoster } from '../lib/keeperAlgorithms';
import type { RosterEntry, Decision, Player, SavedScenario } from '../types';

interface RookieDraftPick {
  id: string;
  year: number;
  round: 1 | 2;
  originalTeam: string;
  originalTeamName: string;
  currentOwner: string;
  leagueId: string;
}

export function OwnerDashboard() {
  const { leagueId, teamId } = useParams<{ leagueId: string; teamId: string }>();
  const { user } = useAuth();

  const { team, loading: teamLoading } = useTeam(teamId!);
  const { league } = useLeague(leagueId!);
  const { players, loading: playersLoading } = useTeamPlayers(leagueId!, teamId!);
  const { roster, loading: rosterLoading } = useRoster(leagueId!, teamId!);
  const { projectedStats, loading: statsLoading } = useProjectedStats();
  const { previousStats } = usePreviousStats();
  const { watchList } = useWatchList(user?.email || '', leagueId!, teamId!);
  const [allLeaguePlayers, setAllLeaguePlayers] = useState<Player[]>([]);
  const [rookiePicks, setRookiePicks] = useState<RookieDraftPick[]>([]);
  const [draftedPlayers, setDraftedPlayers] = useState<Player[]>([]);

  // Check if current user is the owner of this team
  const isOwner = team?.owners.includes(user?.email || '') || false;

  // Check if user can see keeper decisions (own team or keepers are locked)
  const canViewDecisions = isOwner || league?.keepersLocked;

  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [draftCarouselIndex, setDraftCarouselIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const playersMap = useMemo(() => {
    return new Map(players.map((p) => [p.id, p]));
  }, [players]);

  // Swipe detection - minimum distance to trigger swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && carouselIndex < 1) {
      setCarouselIndex(1);
    }
    if (isRightSwipe && carouselIndex > 0) {
      setCarouselIndex(0);
    }
  };

  const onDraftTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && draftCarouselIndex < 1) {
      setDraftCarouselIndex(1);
    }
    if (isRightSwipe && draftCarouselIndex > 0) {
      setDraftCarouselIndex(0);
    }
  };

  // Initialize entries from roster or most recent scenario
  useEffect(() => {
    if (roster) {
      // If roster is submitted, load from roster.entries (the locked keepers)
      if (roster.status === 'submitted' && roster.entries && roster.entries.length > 0) {
        console.log('[OwnerDashboard] Loading submitted roster entries:', roster.entries.length);
        setEntries(roster.entries);
        setActiveScenarioId(null);
      }
      // Otherwise, load most recent scenario if available
      else if (roster.savedScenarios && roster.savedScenarios.length > 0) {
        const mostRecent = [...roster.savedScenarios].sort((a, b) => b.timestamp - a.timestamp)[0];
        // Recalculate baseRound for all entries to ensure they're up to date
        const updatedEntries = mostRecent.entries.map((entry) => {
          const player = playersMap.get(entry.playerId);
          // Default to round 13 if no baseRound can be calculated
          return {
            ...entry,
            baseRound: player ? (baseKeeperRound(player) || 13) : (entry.baseRound || 13),
          };
        });
        setEntries(updatedEntries);
        setActiveScenarioId(mostRecent.scenarioId);
      } else {
        // No scenarios - show clean slate (all players as DROP)
        if (players.length > 0) {
          const cleanSlate: RosterEntry[] = players.map((player) => ({
            playerId: player.id,
            decision: 'DROP',
            baseRound: baseKeeperRound(player) || 13,
          }));
          setEntries(cleanSlate);
          setActiveScenarioId(null);
        }
      }
    } else if (players.length > 0 && entries.length === 0) {
      // Create initial entries for all players
      const initialEntries: RosterEntry[] = players.map((player) => ({
        playerId: player.id,
        decision: 'DROP',
        baseRound: baseKeeperRound(player) || 13,
      }));
      setEntries(initialEntries);
      setActiveScenarioId(null);
    }
  }, [roster, players, playersMap]);

  // Fetch all league players for watchlist display and rookie picks
  useEffect(() => {
    const fetchAllPlayers = async () => {
      if (!leagueId) return;

      try {
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('roster.leagueId', '==', leagueId));
        const snapshot = await getDocs(q);
        const allPlayers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Player[];
        console.log(`[OwnerDashboard] Fetched ${allPlayers.length} league players for leagueId: ${leagueId}`);
        console.log(`[OwnerDashboard] Team ${teamId} roster entries:`, roster?.entries?.length || 0);
        setAllLeaguePlayers(allPlayers);
      } catch (error) {
        console.error('Error fetching league players:', error);
      }
    };

    const fetchRookiePicks = async () => {
      if (!leagueId || !teamId) return;
      try {
        const picksRef = collection(db, 'rookieDraftPicks');
        const picksQuery = query(picksRef, where('leagueId', '==', leagueId), where('currentOwner', '==', teamId));
        const picksSnap = await getDocs(picksQuery);
        const picksData = picksSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RookieDraftPick[];
        setRookiePicks(picksData);
      } catch (error) {
        console.error('Error loading rookie picks:', error);
      }
    };

    const fetchDraftedPlayers = async () => {
      if (!leagueId || !teamId || !league) return;
      try {
        // Load current draft
        const draftId = `${leagueId}_${league.seasonYear}`;
        const draftRef = collection(db, 'drafts');
        const draftQuery = query(draftRef, where('__name__', '==', draftId));
        const draftSnap = await getDocs(draftQuery);

        if (!draftSnap.empty) {
          const draft = draftSnap.docs[0].data();

          // Load draft pick ownership to check for traded picks
          const draftPicksRef = collection(db, 'draftPicks');
          const draftPicksQuery = query(draftPicksRef, where('leagueId', '==', leagueId));
          const draftPicksSnap = await getDocs(draftPicksQuery);

          const pickOwnership = new Map<number, string>();
          draftPicksSnap.docs.forEach(doc => {
            const pick = doc.data();
            pickOwnership.set(pick.pickNumber, pick.currentOwner);
          });

          // Get picks for this team that have been drafted (accounting for trades)
          const teamDraftedPicks = draft.picks?.filter((pick: any) => {
            // Include all picks that have a player, whether keeper slot or not
            if (!pick.playerId || !pick.pickedAt) return false;

            // Check actual owner (accounting for trades)
            const actualOwner = pickOwnership.get(pick.overallPick) || pick.teamId;
            return actualOwner === teamId;
          }) || [];

          // Load player data for drafted picks
          if (teamDraftedPicks.length > 0) {
            const playerIds = teamDraftedPicks.map((pick: any) => pick.playerId);
            const playersRef = collection(db, 'players');
            const playersSnap = await getDocs(playersRef);

            const draftedPlayerData = playersSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data() }) as Player)
              .filter(p => playerIds.includes(p.id));

            setDraftedPlayers(draftedPlayerData);
          } else {
            setDraftedPlayers([]);
          }
        }
      } catch (error) {
        console.error('Error loading drafted players:', error);
      }
    };

    fetchAllPlayers();
    fetchRookiePicks();
    fetchDraftedPlayers();
  }, [leagueId, teamId, league]);

  const handleDecisionChange = (playerId: string, decision: Decision) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.playerId === playerId) {
          const player = playersMap.get(playerId);
          // Default to round 13 if no baseRound can be calculated
          const calculatedBaseRound = player ? (baseKeeperRound(player) || 13) : (entry.baseRound || 13);
          return {
            ...entry,
            decision,
            baseRound: calculatedBaseRound,
          };
        }
        return entry;
      })
    );
  };

  const handleUpdatePriority = (playerId: string, direction: 'up' | 'down') => {
    console.log('handleUpdatePriority called:', playerId, direction);
    setEntries((prev) => {
      const entry = prev.find(e => e.playerId === playerId);
      if (!entry?.baseRound) {
        console.log('No entry or baseRound found');
        return prev;
      }

      // Find all entries with the same BASE round
      const sameBaseRoundEntries = prev.filter(e => e.baseRound === entry.baseRound && e.decision !== 'DROP');
      console.log('Same base round entries:', sameBaseRoundEntries.length);
      if (sameBaseRoundEntries.length <= 1) return prev; // Nothing to reorder

      // Sort by current priority
      const sorted = [...sameBaseRoundEntries].sort((a, b) => {
        const prioA = a.priority ?? 999;
        const prioB = b.priority ?? 999;
        return prioA - prioB;
      });
      console.log('Sorted before swap:', sorted.map(e => ({ id: e.playerId, priority: e.priority })));

      const currentIndex = sorted.findIndex(e => e.playerId === playerId);
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      console.log('Current index:', currentIndex, 'New index:', newIndex);

      if (newIndex < 0 || newIndex >= sorted.length) return prev; // Can't move further

      // Swap
      [sorted[currentIndex], sorted[newIndex]] = [sorted[newIndex], sorted[currentIndex]];
      console.log('Sorted after swap:', sorted.map(e => ({ id: e.playerId, priority: e.priority })));

      // Reassign priorities
      const priorityMap = new Map(sorted.map((e, idx) => [e.playerId, idx]));
      console.log('Priority map:', Array.from(priorityMap.entries()));

      const newEntries = prev.map(e => {
        const newPriority = priorityMap.get(e.playerId);
        if (newPriority !== undefined) {
          return { ...e, priority: newPriority };
        }
        return e;
      });

      console.log('Updated entries with priorities:', newEntries.filter(e => e.baseRound === entry.baseRound).map(e => ({ id: e.playerId, priority: e.priority })));

      return newEntries;
    });
  };


  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }

    try {
      setIsSaving(true);

      // First, ensure roster exists by saving current state
      await updateRoster({
        leagueId: leagueId!,
        teamId: teamId!,
        entries,
        allPlayers: playersMap,
        tradeDelta: team?.capAdjustments.tradeDelta || 0,
      });

      const { franchiseTags } = stackKeeperRounds([...entries]);
      const summary = computeSummary({
        entries,
        allPlayers: playersMap,
        tradeDelta: team?.capAdjustments.tradeDelta || 0,
        franchiseTags,
      });

      await saveScenario({
        leagueId: leagueId!,
        teamId: teamId!,
        scenarioName,
        entries,
        summary,
        savedBy: user?.email || '',
      });

      setScenarioName('');
      alert('Scenario saved successfully!');
    } catch (error: any) {
      console.error('Error saving scenario:', error);
      alert(`Failed to save scenario: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadScenario = (scenario: SavedScenario) => {
    // Recalculate baseRound for all entries to ensure they're up to date
    const updatedEntries = scenario.entries.map((entry) => {
      const player = playersMap.get(entry.playerId);
      return {
        ...entry,
        baseRound: player ? (baseKeeperRound(player) || 13) : (entry.baseRound || 13),
      };
    });
    setEntries(updatedEntries);
    setActiveScenarioId(scenario.scenarioId);
  };

  const handleSubmit = async () => {
    const errors = validateRoster(entries, playersMap, team?.settings.maxKeepers);
    const hasErrors = errors.some((e) => e.type === 'error');

    if (hasErrors) {
      alert(
        'Please fix the following errors before submitting:\n\n' +
          errors
            .filter((e) => e.type === 'error')
            .map((e) => `• ${e.message}`)
            .join('\n')
      );
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to submit your final keepers? This will lock your roster for owner editing (admin can still unlock).'
    );

    if (!confirmed) return;

    try {
      setIsSaving(true);

      await updateRoster({
        leagueId: leagueId!,
        teamId: teamId!,
        entries,
        allPlayers: playersMap,
        tradeDelta: team?.capAdjustments.tradeDelta || 0,
      });

      await submitRoster(leagueId!, teamId!);

      alert('Keepers submitted successfully!');
    } catch (error) {
      console.error('Error submitting roster:', error);
      alert('Failed to submit roster. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate stacked entries and current summary for display
  const { stackedEntries, currentSummary } = useMemo(() => {
    // If user can't view decisions, show all as DROP
    if (!canViewDecisions) {
      const dropEntries = entries.map(e => ({ ...e, decision: 'DROP' as Decision }));
      const summary = computeSummary({
        entries: dropEntries,
        allPlayers: playersMap,
        tradeDelta: team?.capAdjustments.tradeDelta || 0,
        franchiseTags: 0,
      });
      return { stackedEntries: dropEntries, currentSummary: summary };
    }

    // Deep copy entries so stacking doesn't mutate original state
    const entriesCopy = entries.map(e => ({ ...e }));
    const { franchiseTags } = stackKeeperRounds(entriesCopy);
    const summary = computeSummary({
      entries: entriesCopy,
      allPlayers: playersMap,
      tradeDelta: team?.capAdjustments.tradeDelta || 0,
      franchiseTags,
    });
    return { stackedEntries: entriesCopy, currentSummary: summary };
  }, [entries, playersMap, team, canViewDecisions]);


  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const entryA = entries.find(e => e.playerId === a.id);
      const entryB = entries.find(e => e.playerId === b.id);

      // Get base round from entry first, then fall back to player's derived base round
      const baseRoundA = entryA?.baseRound ?? a.keeper?.derivedBaseRound ?? 999;
      const baseRoundB = entryB?.baseRound ?? b.keeper?.derivedBaseRound ?? 999;

      return baseRoundA - baseRoundB;
    });
  }, [players, entries]);

  // Calculate position eligibility counts for keepers
  const positionCounts = useMemo(() => {
    const keepers = entries.filter(e => e.decision === 'KEEP');
    const counts = { guard: 0, forward: 0, center: 0 };

    keepers.forEach(entry => {
      const player = playersMap.get(entry.playerId);
      if (!player) return;

      const positions = player.position.split(',').map(p => p.trim());

      // Count each position category
      if (positions.some(p => p === 'PG' || p === 'SG' || p === 'G')) {
        counts.guard++;
      }
      if (positions.some(p => p === 'SF' || p === 'PF' || p === 'F')) {
        counts.forward++;
      }
      if (positions.some(p => p === 'C')) {
        counts.center++;
      }
    });

    return counts;
  }, [entries, playersMap]);

  const isLocked = roster?.status === 'adminLocked' || roster?.status === 'submitted';

  if (teamLoading || playersLoading || rosterLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-white">{team?.name}</h1>
            {team?.banners && team.banners.length > 0 && (
              <div className="flex gap-1">
                {team.banners.map((year) => (
                  <span
                    key={year}
                    className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 text-xs font-bold rounded shadow-sm"
                  >
                    🏆 {year}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-gray-400 mt-1">
            {team?.ownerNames && team.ownerNames.length > 0 ? team.ownerNames.join(', ') : team?.owners.join(', ')}
          </p>
          {isLocked && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
              🔒 Roster Locked
            </div>
          )}
          {!canViewDecisions && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-800 text-gray-400 border border-gray-700">
              👁️ Keeper decisions are private until the league admin locks keepers
            </div>
          )}
        </div>

        {/* Desktop: Side by side layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <CapThermometer summary={currentSummary} maxKeepers={team?.settings.maxKeepers} />
          </div>
          <div>
            <SummaryCard summary={currentSummary} maxKeepers={team?.settings.maxKeepers} />
          </div>
        </div>

        {/* Mobile: Quick stats cards and swipeable carousel */}
        <div className="lg:hidden mb-6">
            {/* Quick Stats Cards - clickable toggles */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setCarouselIndex(0)}
                className={`p-4 rounded-lg shadow-sm text-left transition-all ${
                  carouselIndex === 0
                    ? 'bg-green-400 text-black ring-2 ring-green-400'
                    : 'bg-[#121212] text-white hover:bg-[#1a1a1a] border border-gray-800'
                }`}
              >
                <div className="text-xs font-medium opacity-80">Total Salary</div>
                <div className="text-2xl font-bold mt-1">
                  ${(currentSummary.capUsed / 1_000_000).toFixed(1)}M
                </div>
              </button>
              <button
                onClick={() => setCarouselIndex(1)}
                className={`p-4 rounded-lg shadow-sm text-left transition-all ${
                  carouselIndex === 1
                    ? 'bg-green-400 text-black ring-2 ring-green-400'
                    : 'bg-[#121212] text-white hover:bg-[#1a1a1a] border border-gray-800'
                }`}
              >
                <div className="text-xs font-medium opacity-80">Total Fees</div>
                <div className="text-2xl font-bold mt-1">
                  ${(currentSummary.totalFees + 50).toFixed(0)}
                </div>
              </button>
            </div>

            <div className="relative overflow-hidden">
              {/* Carousel container */}
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Slide 1: Salary Cap Status */}
                <div className="w-full flex-shrink-0 px-2">
                  <CapThermometer summary={currentSummary} maxKeepers={team?.settings.maxKeepers} />
                </div>
                {/* Slide 2: Roster Summary and Fees */}
                <div className="w-full flex-shrink-0 px-2">
                  <SummaryCard summary={currentSummary} maxKeepers={team?.settings.maxKeepers} />
                </div>
              </div>

              {/* Dots indicator */}
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setCarouselIndex(0)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    carouselIndex === 0 ? 'bg-green-400' : 'bg-gray-700'
                  }`}
                  aria-label="View Salary Cap Status"
                />
                <button
                  onClick={() => setCarouselIndex(1)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    carouselIndex === 1 ? 'bg-green-400' : 'bg-gray-700'
                  }`}
                  aria-label="View Roster Summary"
                />
              </div>
            </div>
        </div>


        {/* Scenario Selector Dropdown - Only show when keepers are not locked and user is owner */}
        {isOwner && roster?.status !== 'adminLocked' && league?.keepersLocked !== true && (
          <div className="bg-[#121212] p-6 rounded-lg border border-gray-800 mb-6">
            <label className="block text-sm font-medium text-white mb-2">
              Load Scenario
            </label>
            <select
              value={activeScenarioId || ''}
              onChange={(e) => {
                const scenarioId = e.target.value;
                if (scenarioId === '') {
                  // Load blank slate
                  const cleanSlate: RosterEntry[] = players.map((player) => ({
                    playerId: player.id,
                    decision: 'DROP',
                    baseRound: baseKeeperRound(player) || 13,
                  }));
                  setEntries(cleanSlate);
                  setActiveScenarioId(null);
                } else {
                  const scenario = roster?.savedScenarios?.find(s => s.scenarioId === scenarioId);
                  if (scenario) {
                    handleLoadScenario(scenario);
                  }
                }
              }}
              className="w-full rounded-md bg-[#0a0a0a] border-gray-700 text-white shadow-sm focus:border-green-400 focus:ring-green-400"
            >
              <option value="">Blank Slate (All Dropped)</option>
              {roster?.savedScenarios?.map((scenario) => (
                <option key={scenario.scenarioId} value={scenario.scenarioId}>
                  {scenario.name} - {scenario.summary.keepersCount} keepers, ${(scenario.summary.capUsed / 1_000_000).toFixed(1)}M cap, ${scenario.summary.totalFees} fees
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Roster table or Draft Board View */}
        {roster?.status === 'submitted' ? (
          <>
            {/* Desktop: 2-column layout for owners, single column for others */}
            {isOwner ? (
              <div className="hidden lg:grid lg:grid-cols-2 gap-6 mb-6">
                <DraftBoardView players={allLeaguePlayers} entries={stackedEntries} />
                <WatchListView watchList={watchList} allPlayers={allLeaguePlayers} projectedStats={projectedStats} />
              </div>
            ) : (
              <div className="hidden lg:block mb-6">
                <DraftBoardView players={allLeaguePlayers} entries={stackedEntries} />
              </div>
            )}

            {/* Mobile: Draft Board only, or carousel if owner */}
            <div className="lg:hidden mb-6">
              {isOwner ? (
                <>
                  {/* Quick toggle buttons */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => setDraftCarouselIndex(0)}
                      className={`p-4 rounded-lg shadow-sm text-left transition-all ${
                        draftCarouselIndex === 0
                          ? 'bg-green-400 text-black ring-2 ring-green-400'
                          : 'bg-[#121212] text-white hover:bg-[#1a1a1a] border border-gray-800'
                      }`}
                    >
                      <div className="text-xs font-medium opacity-80">Draft Board</div>
                      <div className="text-2xl font-bold mt-1">📋</div>
                    </button>
                    <button
                      onClick={() => setDraftCarouselIndex(1)}
                      className={`p-4 rounded-lg shadow-sm text-left transition-all ${
                        draftCarouselIndex === 1
                          ? 'bg-green-400 text-black ring-2 ring-green-400'
                          : 'bg-[#121212] text-white hover:bg-[#1a1a1a] border border-gray-800'
                      }`}
                    >
                      <div className="text-xs font-medium opacity-80">Watch List</div>
                      <div className="text-2xl font-bold mt-1">⭐</div>
                    </button>
                  </div>

                  <div className="relative overflow-hidden">
                    {/* Carousel container */}
                    <div
                      className="flex transition-transform duration-300 ease-out"
                      style={{ transform: `translateX(-${draftCarouselIndex * 100}%)` }}
                      onTouchStart={onTouchStart}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onDraftTouchEnd}
                    >
                      {/* Slide 1: Draft Board */}
                      <div className="w-full flex-shrink-0 px-2">
                        <DraftBoardView players={allLeaguePlayers} entries={stackedEntries} />
                      </div>
                      {/* Slide 2: Watch List */}
                      <div className="w-full flex-shrink-0 px-2">
                        <WatchListView watchList={watchList} allPlayers={allLeaguePlayers} projectedStats={projectedStats} />
                      </div>
                    </div>

                    {/* Dots indicator */}
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        onClick={() => setDraftCarouselIndex(0)}
                        className={`h-2 w-2 rounded-full transition-colors ${
                          draftCarouselIndex === 0 ? 'bg-green-400' : 'bg-gray-700'
                        }`}
                        aria-label="View Draft Board"
                      />
                      <button
                        onClick={() => setDraftCarouselIndex(1)}
                        className={`h-2 w-2 rounded-full transition-colors ${
                          draftCarouselIndex === 1 ? 'bg-green-400' : 'bg-gray-700'
                        }`}
                        aria-label="View Watch List"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <DraftBoardView players={allLeaguePlayers} entries={stackedEntries} />
              )}
            </div>
          </>
        ) : (
          <div className="mb-6">
            <RosterTable
              players={sortedPlayers}
              entries={stackedEntries}
              onDecisionChange={handleDecisionChange}
              onUpdatePriority={handleUpdatePriority}
              isLocked={isLocked}
              isOwner={isOwner}
              canViewDecisions={canViewDecisions}
              projectedStats={projectedStats}
              previousStats={previousStats}
            />
          </div>
        )}

        {/* Actions - Only visible to team owner */}
        {!isLocked && isOwner && (
          <div className="bg-[#121212] p-6 rounded-lg border border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Save Scenario */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Save Scenario
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g., Final v1, Conservative, Aggressive"
                    className="flex-1 rounded-md bg-[#0a0a0a] border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-green-400 focus:ring-green-400"
                  />
                  <button
                    onClick={handleSaveScenario}
                    disabled={isSaving || !scenarioName.trim()}
                    className="px-6 py-2 border-2 border-green-400 text-green-400 rounded hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] disabled:opacity-50 font-medium transition-all cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Save your current keeper selections with a descriptive name
                </p>
              </div>

              {/* Submit Final */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-white mb-2">
                  Submit Keepers
                </label>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="px-4 py-2 border-2 border-purple-400 text-purple-400 rounded hover:bg-purple-400/10 hover:shadow-[0_0_15px_rgba(192,132,252,0.5)] disabled:opacity-50 font-medium transition-all cursor-pointer"
                >
                  Submit Final Keepers
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Lock your roster and submit to the league
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Position Eligibility Counts */}
        {canViewDecisions && (
          <div className="mt-6 bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Position Eligibility</h2>
            <p className="text-sm text-gray-400 mb-4">
              Number of keepers eligible for each position category
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400 mb-2">
                  {positionCounts.guard}
                </div>
                <div className="text-sm text-gray-400">Guards</div>
                <div className="text-xs text-gray-500 mt-1">PG, SG, G</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-2">
                  {positionCounts.forward}
                </div>
                <div className="text-sm text-gray-400">Forwards</div>
                <div className="text-xs text-gray-500 mt-1">SF, PF, F</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-2">
                  {positionCounts.center}
                </div>
                <div className="text-sm text-gray-400">Centers</div>
                <div className="text-xs text-gray-500 mt-1">C</div>
              </div>
            </div>
          </div>
        )}

        {/* Drafted Players */}
        {draftedPlayers.length > 0 && (
          <div className="mt-6 bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Drafted Players ({draftedPlayers.length})</h2>
            <div className="space-y-2">
              {draftedPlayers.map(player => {
                const stats = projectedStats.get(player.fantraxId);
                return (
                  <div key={player.id} className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{player.name}</div>
                        <div className="text-xs text-gray-400">
                          {player.position} - {player.nbaTeam}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          ${(player.salary / 1_000_000).toFixed(1)}M
                        </div>
                        {stats && (
                          <div className="text-xs text-gray-400">
                            {stats.points.toFixed(1)} pts, {stats.rebounds.toFixed(1)} reb, {stats.assists.toFixed(1)} ast
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Salary</span>
                <span className="font-bold text-white">
                  ${(draftedPlayers.reduce((sum, p) => sum + p.salary, 0) / 1_000_000).toFixed(1)}M
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rookie Draft Picks */}
        {rookiePicks.length > 0 && (
          <div className="mt-6 bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Rookie Draft Picks ({rookiePicks.length})</h2>
            <div className="space-y-4">
              {(() => {
                // Group picks by year
                const picksByYear: Record<number, RookieDraftPick[]> = {};
                rookiePicks.forEach(pick => {
                  if (!picksByYear[pick.year]) {
                    picksByYear[pick.year] = [];
                  }
                  picksByYear[pick.year].push(pick);
                });

                // Sort picks within each year by round
                Object.keys(picksByYear).forEach(year => {
                  picksByYear[Number(year)].sort((a, b) => a.round - b.round);
                });

                return Object.keys(picksByYear).sort().map(year => (
                  <div key={year}>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">{year}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {picksByYear[Number(year)].map(pick => {
                        const isTraded = pick.currentOwner !== pick.originalTeam;
                        return (
                          <div
                            key={pick.id}
                            className={`p-3 rounded border ${
                              isTraded
                                ? 'bg-yellow-400/10 border-yellow-400/30'
                                : 'bg-[#0a0a0a] border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-medium text-sm ${
                                pick.round === 1 ? 'text-green-400' : 'text-purple-400'
                              }`}>
                                Round {pick.round}
                              </span>
                              {isTraded && (
                                <span className="text-xs text-yellow-400">Traded</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {pick.originalTeamName}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

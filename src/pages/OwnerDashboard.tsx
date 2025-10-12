import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useRoster, useTeamPlayers, useTeam, updateRoster, submitRoster, saveScenario, deleteScenario } from '../hooks/useRoster';
import { useProjectedStats } from '../hooks/useProjectedStats';
import { usePreviousStats } from '../hooks/usePreviousStats';
import { useAuth } from '../contexts/AuthContext';
import { RosterTable } from '../components/RosterTable';
import { CapThermometer } from '../components/CapThermometer';
import { SummaryCard } from '../components/SummaryCard';
import { SavedScenarios } from '../components/SavedScenarios';
import { baseKeeperRound, stackKeeperRounds, computeSummary, validateRoster } from '../lib/keeperAlgorithms';
import type { RosterEntry, Decision, SavedScenario } from '../types';

export function OwnerDashboard() {
  const { leagueId, teamId } = useParams<{ leagueId: string; teamId: string }>();
  const { user } = useAuth();

  const { team, loading: teamLoading } = useTeam(teamId!);
  const { players, loading: playersLoading } = useTeamPlayers(leagueId!, teamId!);
  const { roster, loading: rosterLoading } = useRoster(leagueId!, teamId!);
  const { projectedStats, loading: statsLoading } = useProjectedStats();
  const { previousStats } = usePreviousStats();

  // Check if current user is the owner of this team
  const isOwner = team?.owners.includes(user?.email || '') || false;

  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
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

  // Initialize entries from roster or most recent scenario
  useEffect(() => {
    if (roster) {
      // Load most recent scenario if available, otherwise show clean slate
      if (roster.savedScenarios && roster.savedScenarios.length > 0) {
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
    const confirmed = window.confirm(
      `Load scenario "${scenario.name}"? This will replace your current keeper selections.`
    );

    if (!confirmed) return;

    setEntries(scenario.entries);
    setActiveScenarioId(scenario.scenarioId);
  };

  const handleScenarioChange = (scenarioId: string) => {
    if (scenarioId === 'clean') {
      // Load clean slate
      const cleanSlate: RosterEntry[] = players.map((player) => ({
        playerId: player.id,
        decision: 'DROP',
        baseRound: baseKeeperRound(player) || undefined,
      }));
      setEntries(cleanSlate);
      setActiveScenarioId(null);
    } else {
      // Load selected scenario
      const scenario = roster?.savedScenarios?.find(s => s.scenarioId === scenarioId);
      if (scenario) {
        setEntries(scenario.entries);
        setActiveScenarioId(scenario.scenarioId);
      }
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    try {
      await deleteScenario(leagueId!, teamId!, scenarioId);
    } catch (error) {
      console.error('Error deleting scenario:', error);
      alert('Failed to delete scenario. Please try again.');
    }
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
  }, [entries, playersMap, team]);


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
        </div>

        {/* Desktop: Side by side layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <CapThermometer summary={currentSummary} />
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
                <CapThermometer summary={currentSummary} />
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


        {/* Scenario Selector - Only visible to team owner */}
        {!isLocked && isOwner && (
          <div className="mb-4 bg-[#121212] p-4 rounded-lg border border-gray-800">
            <label className="block text-sm font-medium text-white mb-2">
              Active Scenario
            </label>
            <select
              value={activeScenarioId || 'clean'}
              onChange={(e) => handleScenarioChange(e.target.value)}
              className="block w-full md:w-96 rounded-md bg-[#0a0a0a] border-gray-700 text-white shadow-sm focus:border-green-400 focus:ring-green-400"
            >
              <option value="clean">Clean Slate (No Scenario)</option>
              {roster?.savedScenarios
                ?.sort((a, b) => b.timestamp - a.timestamp)
                .map((scenario) => (
                  <option key={scenario.scenarioId} value={scenario.scenarioId}>
                    {scenario.name} ({new Date(scenario.timestamp).toLocaleDateString()})
                  </option>
                ))}
            </select>
            {activeScenarioId && (
              <p className="mt-2 text-sm text-gray-400">
                Viewing saved scenario. Make changes and save as a new scenario or overwrite by saving with the same name.
              </p>
            )}
          </div>
        )}

        {/* Roster table */}
        <div className="mb-6">
          <RosterTable
            players={sortedPlayers}
            entries={stackedEntries}
            onDecisionChange={handleDecisionChange}
            onUpdatePriority={handleUpdatePriority}
            isLocked={isLocked}
            isOwner={isOwner}
            projectedStats={projectedStats}
            previousStats={previousStats}
          />
        </div>

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

        {/* Saved Scenarios - Only visible to team owner */}
        {isOwner && roster?.savedScenarios && roster.savedScenarios.length > 0 && (
          <div className="mt-6">
            <SavedScenarios
              scenarios={roster.savedScenarios}
              onLoad={handleLoadScenario}
              onDelete={!isLocked ? handleDeleteScenario : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

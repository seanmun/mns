import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useRoster, useTeamPlayers, useTeam, updateRoster, submitRoster, saveScenario, deleteScenario } from '../hooks/useRoster';
import { RosterTable } from '../components/RosterTable';
import { CapThermometer } from '../components/CapThermometer';
import { SummaryCard } from '../components/SummaryCard';
import { StackingAssistant } from '../components/StackingAssistant';
import { SavedScenarios } from '../components/SavedScenarios';
import { baseKeeperRound, stackKeeperRounds, computeSummary, validateRoster } from '../lib/keeperAlgorithms';
import type { RosterEntry, Decision, SavedScenario } from '../types';

export function OwnerDashboard() {
  const { leagueId, teamId } = useParams<{ leagueId: string; teamId: string }>();

  const { team, loading: teamLoading } = useTeam(teamId!);
  const { players, loading: playersLoading } = useTeamPlayers(leagueId!, teamId!);
  const { roster, loading: rosterLoading } = useRoster(leagueId!, teamId!);

  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState('');

  const playersMap = useMemo(() => {
    return new Map(players.map((p) => [p.id, p]));
  }, [players]);

  // Initialize entries from roster or create default
  useEffect(() => {
    if (roster) {
      setEntries(roster.entries);
    } else if (players.length > 0 && entries.length === 0) {
      // Create initial entries for all players
      const initialEntries: RosterEntry[] = players.map((player) => ({
        playerId: player.id,
        decision: 'DROP',
        baseRound: baseKeeperRound(player) || undefined,
      }));
      setEntries(initialEntries);
    }
  }, [roster, players]);

  const handleDecisionChange = (playerId: string, decision: Decision) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.playerId === playerId ? { ...entry, decision } : entry
      )
    );
    setIsDirty(true);
  };

  const handleAutoAssign = async () => {
    try {
      setIsSaving(true);

      await updateRoster({
        leagueId: leagueId!,
        teamId: teamId!,
        entries,
        allPlayers: playersMap,
        tradeDelta: team?.capAdjustments.tradeDelta || 0,
      });

      setIsDirty(false);
    } catch (error) {
      console.error('Error auto-assigning keeper rounds:', error);
      alert('Failed to auto-assign keeper rounds. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      await updateRoster({
        leagueId: leagueId!,
        teamId: teamId!,
        entries,
        allPlayers: playersMap,
        tradeDelta: team?.capAdjustments.tradeDelta || 0,
      });

      setIsDirty(false);
    } catch (error) {
      console.error('Error saving roster:', error);
      alert('Failed to save roster. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
      });

      setScenarioName('');
      setIsDirty(false);
      alert('Scenario saved successfully!');
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('Failed to save scenario. Please try again.');
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
    setIsDirty(true);
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

  // Calculate current summary for display
  const currentSummary = useMemo(() => {
    const { franchiseTags } = stackKeeperRounds([...entries]);
    return computeSummary({
      entries,
      allPlayers: playersMap,
      tradeDelta: team?.capAdjustments.tradeDelta || 0,
      franchiseTags,
    });
  }, [entries, playersMap, team]);

  const franchiseTagsRequired = useMemo(() => {
    const { franchiseTags } = stackKeeperRounds([...entries]);
    return franchiseTags;
  }, [entries]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const entryA = entries.find(e => e.playerId === a.id);
      const entryB = entries.find(e => e.playerId === b.id);
      const baseRoundA = entryA?.baseRound ?? 999;
      const baseRoundB = entryB?.baseRound ?? 999;
      return baseRoundA - baseRoundB;
    });
  }, [players, entries]);

  const isLocked = roster?.status === 'adminLocked' || roster?.status === 'submitted';

  if (teamLoading || playersLoading || rosterLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{team?.name}</h1>
          <p className="text-gray-500 mt-1">
            Owners: {team?.owners.join(', ')}
          </p>
          {isLocked && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              🔒 Roster Locked
            </div>
          )}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <CapThermometer summary={currentSummary} />
          </div>
          <div>
            <SummaryCard summary={currentSummary} maxKeepers={team?.settings.maxKeepers} />
          </div>
        </div>

        {/* Stacking Assistant */}
        {!isLocked && (
          <div className="mb-6">
            <StackingAssistant
              entries={entries}
              players={playersMap}
              onAutoAssign={handleAutoAssign}
              franchiseTagsRequired={franchiseTagsRequired}
            />
          </div>
        )}

        {/* Roster table */}
        <div className="mb-6">
          <RosterTable
            players={sortedPlayers}
            entries={entries}
            onDecisionChange={handleDecisionChange}
            isLocked={isLocked}
          />
        </div>

        {/* Actions */}
        {!isLocked && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Save Scenario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Save Scenario
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="Scenario name..."
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveScenario}
                    disabled={isSaving || !scenarioName.trim()}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-end gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Submit Final
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saved Scenarios */}
        {roster?.savedScenarios && roster.savedScenarios.length > 0 && (
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

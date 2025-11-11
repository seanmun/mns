import { useMemo } from 'react';
import type { RegularSeasonRoster, Player, Team, RosterSummary, TeamFees } from '../types';
import { CapThermometer } from './CapThermometer';
import { SummaryCard } from './SummaryCard';

interface RegularSeasonRosterViewProps {
  regularSeasonRoster: RegularSeasonRoster;
  allPlayers: Player[];
  team: Team;
  teamFees: TeamFees | null;
}

export function RegularSeasonRosterView({ regularSeasonRoster, allPlayers, team, teamFees }: RegularSeasonRosterViewProps) {
  // Create player map for quick lookups
  const playersMap = useMemo(() => {
    return new Map(allPlayers.map(p => [p.id, p]));
  }, [allPlayers]);

  // Get players for each roster section
  const activePlayers = useMemo(() => {
    return regularSeasonRoster.activeRoster
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.activeRoster, playersMap]);

  const irPlayers = useMemo(() => {
    return regularSeasonRoster.irSlots
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.irSlots, playersMap]);

  const redshirtPlayers = useMemo(() => {
    return regularSeasonRoster.redshirtPlayers
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.redshirtPlayers, playersMap]);

  const internationalPlayers = useMemo(() => {
    return regularSeasonRoster.internationalPlayers
      .map(playerId => playersMap.get(playerId))
      .filter((p): p is Player => p !== undefined);
  }, [regularSeasonRoster.internationalPlayers, playersMap]);

  // Calculate total salary from active + IR players only
  const totalSalary = useMemo(() => {
    const activeTotal = activePlayers.reduce((sum, p) => sum + (p?.salary || 0), 0);
    const irTotal = irPlayers.reduce((sum, p) => sum + (p?.salary || 0), 0);
    return activeTotal + irTotal;
  }, [activePlayers, irPlayers]);

  const isIllegalRoster = activePlayers.length > 13;

  // Create summary for CapThermometer and SummaryCard
  const summary: RosterSummary = useMemo(() => {
    const baseCap = 225_000_000;
    const tradeDelta = team.capAdjustments.tradeDelta || 0;
    const capEffective = Math.max(170_000_000, Math.min(255_000_000, baseCap + tradeDelta));

    // Calculate potential penalties (not locked until season starts)
    const overBy = Math.max(0, totalSalary - 225_000_000);
    const overByM = Math.ceil(overBy / 1_000_000);
    const penaltyDues = overByM * 2;
    const firstApronFee = totalSalary > 195_000_000 ? 50 : 0;

    // Use actual fees from teamFees if available, otherwise calculate potential fees
    const franchiseTagDues = teamFees?.franchiseTagFees || 0;
    const redshirtDues = teamFees?.redshirtFees || 0;

    // If fees are locked, use the locked values; otherwise show calculated values
    const lockedFirstApronFee = teamFees?.feesLocked ? teamFees.firstApronFee : firstApronFee;
    const lockedPenaltyDues = teamFees?.feesLocked ? teamFees.secondApronPenalty : penaltyDues;

    // Total fees = pre-draft fees (always locked) + season fees (locked if season started)
    const totalFees = franchiseTagDues + redshirtDues + lockedFirstApronFee + lockedPenaltyDues;

    return {
      keepersCount: activePlayers.length, // Only active roster, not IR
      draftedCount: 0, // Not applicable for regular season
      redshirtsCount: redshirtPlayers.length,
      intStashCount: internationalPlayers.length,
      capUsed: totalSalary,
      capBase: baseCap,
      capTradeDelta: tradeDelta,
      capEffective,
      overSecondApronByM: overByM,
      penaltyDues: lockedPenaltyDues,
      franchiseTags: 0, // Count not tracked in regular season
      franchiseTagDues,
      redshirtDues,
      firstApronFee: lockedFirstApronFee,
      activationDues: 0,
      totalFees,
    };
  }, [activePlayers, irPlayers, redshirtPlayers, internationalPlayers, totalSalary, team, teamFees]);

  return (
    <div className="space-y-6">
      {/* Roster Status Banner */}
      {isIllegalRoster && (
        <div className="bg-pink-500/10 border border-pink-400/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-pink-400">Illegal Roster</div>
              <div className="text-sm text-gray-300">
                Active roster has {activePlayers.length} players. Maximum is 13.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop: Side by side layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CapThermometer summary={summary} maxKeepers={team.settings.maxKeepers} />
        </div>
        <div>
          <SummaryCard summary={summary} maxKeepers={team.settings.maxKeepers} isRegularSeason={true} />
        </div>
      </div>

      {/* Mobile: Stack vertically */}
      <div className="lg:hidden space-y-6">
        <CapThermometer summary={summary} maxKeepers={team.settings.maxKeepers} />
        <SummaryCard summary={summary} maxKeepers={team.settings.maxKeepers} isRegularSeason={true} />
      </div>

      {/* Active Roster */}
      <div className="bg-[#121212] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Active Roster</h3>
            <span className={`text-sm font-medium ${isIllegalRoster ? 'text-pink-400' : 'text-gray-400'}`}>
              {activePlayers.length}/13
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a0a0a]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {activePlayers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No active players
                  </td>
                </tr>
              ) : (
                activePlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-white">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IR Slots */}
      <div className="bg-[#121212] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">IR Slots</h3>
            <span className="text-sm text-gray-400">{irPlayers.length}/2</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a0a0a]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {irPlayers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No IR players
                  </td>
                </tr>
              ) : (
                irPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-white">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Redshirt Players */}
      {redshirtPlayers.length > 0 && (
        <div className="bg-[#121212] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Redshirt Players</h3>
              <span className="text-sm text-yellow-400">{redshirtPlayers.length}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Does not count toward salary</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {redshirtPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-yellow-400">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* International Players */}
      {internationalPlayers.length > 0 && (
        <div className="bg-[#121212] rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">International Stash</h3>
              <span className="text-sm text-cyan-400">{internationalPlayers.length}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Does not count toward salary</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {internationalPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-white">{player.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.position}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{player.nbaTeam}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">
                      ${(player.salary / 1_000_000).toFixed(1)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

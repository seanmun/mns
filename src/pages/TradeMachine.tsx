import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import { useTradeProposals } from '../hooks/useTradeProposals';
import { computeTradeCapImpact } from '../lib/tradeCapCalculator';
import { TradeProposalCard } from '../components/TradeProposalCard';
import { stackKeeperRounds, computeSummary } from '../lib/keeperAlgorithms';
import type { Team, Player, RosterDoc, TradeAsset, TradeAssetType } from '../types';

interface RookieDraftPick {
  id: string;
  year: number;
  round: number;
  originalTeam: string;
  originalTeamName: string;
  currentOwner: string;
  leagueId: string;
}

const formatSalary = (salary: number) => `$${(salary / 1_000_000).toFixed(2)}M`;

export function TradeMachine() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const { currentLeague } = useLeague();

  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [rosters, setRosters] = useState<Map<string, RosterDoc>>(new Map());
  const [rookiePicks, setRookiePicks] = useState<RookieDraftPick[]>([]);
  const [loading, setLoading] = useState(true);

  // Trade builder state
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [tradeAssets, setTradeAssets] = useState<TradeAsset[]>([]);
  const [tradeNote, setTradeNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find user's team
  const myTeam = useMemo(
    () => teams.find(t => t.owners.includes(user?.email || '')),
    [teams, user?.email]
  );

  // Trade proposals
  const { proposals, responses, loading: proposalsLoading } = useTradeProposals(
    leagueId,
    myTeam?.id
  );

  // Trade deadline check
  const isPostDeadline = useMemo(() => {
    if (!currentLeague?.schedule?.tradeDeadlineDate) return false;
    return new Date() > new Date(currentLeague.schedule.tradeDeadlineDate);
  }, [currentLeague]);

  // Load all data
  useEffect(() => {
    if (!leagueId) return;
    loadData();
  }, [leagueId]);

  const loadData = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      const mappedTeams = (teamsData || []).map((t: any): Team => ({
        id: t.id,
        leagueId: t.league_id,
        name: t.name,
        abbrev: t.abbrev,
        owners: t.owners || [],
        ownerNames: t.owner_names || [],
        telegramUsername: t.telegram_username,
        capAdjustments: t.cap_adjustments || { tradeDelta: 0 },
        settings: t.settings || { maxKeepers: 8 },
        banners: t.banners || [],
      }));
      setTeams(mappedTeams.sort((a, b) => a.name.localeCompare(b.name)));

      const { data: playersData = [], error: playersErr } = await supabase
        .from('players')
        .select('*')
        .eq('league_id', leagueId);
      if (playersErr) throw playersErr;
      const playersMap = new Map<string, Player>();
      (playersData || []).forEach((row: any) => {
        playersMap.set(row.id, {
          id: row.id,
          fantraxId: row.fantrax_id,
          name: row.name,
          position: row.position,
          salary: row.salary,
          nbaTeam: row.nba_team,
          roster: {
            leagueId: row.league_id,
            teamId: row.team_id,
            onIR: row.on_ir,
            isRookie: row.is_rookie,
            isInternationalStash: row.is_international_stash,
            intEligible: row.int_eligible,
            rookieDraftInfo: row.rookie_draft_info || undefined,
          },
          keeper: row.keeper_prior_year_round != null || row.keeper_derived_base_round != null
            ? {
                priorYearRound: row.keeper_prior_year_round || undefined,
                derivedBaseRound: row.keeper_derived_base_round || undefined,
              }
            : undefined,
        });
      });
      setPlayers(playersMap);

      const { data: rostersData } = await supabase
        .from('rosters')
        .select('*')
        .eq('league_id', leagueId);

      const rostersMap = new Map<string, RosterDoc>();
      for (const row of rostersData || []) {
        rostersMap.set(row.team_id, {
          id: row.id,
          teamId: row.team_id,
          leagueId: row.league_id,
          seasonYear: row.season_year,
          entries: row.entries || [],
          status: row.status,
          summary: row.summary || {},
          savedScenarios: row.saved_scenarios,
        } as RosterDoc);
      }
      setRosters(rostersMap);

      const { data: rookiePicksData } = await supabase
        .from('rookie_draft_picks')
        .select('*')
        .eq('league_id', leagueId);

      setRookiePicks((rookiePicksData || []).map((p: any): RookieDraftPick => ({
        id: p.id,
        year: p.year,
        round: p.round,
        originalTeam: p.original_team,
        originalTeamName: p.original_team_name,
        currentOwner: p.current_owner,
        leagueId: p.league_id,
      })));

      // Pre-select user's team
      const myT = mappedTeams.find(t => t.owners.includes(user?.email || ''));
      if (myT) {
        setSelectedTeamIds([myT.id]);
      }
    } catch (err) {
      logger.error('Error loading trade machine data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle team selection
  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev => {
      if (prev.includes(teamId)) {
        // Remove team and clear any assets involving them
        setTradeAssets(a => a.filter(
          asset => asset.fromTeamId !== teamId && asset.toTeamId !== teamId
        ));
        return prev.filter(id => id !== teamId);
      }
      if (prev.length >= 5) return prev; // Max 5 teams
      return [...prev, teamId];
    });
  };

  // Add asset to trade — for 2-team trades, auto-assign destination
  const addAsset = (type: TradeAssetType, id: string, displayName: string, salary: number, fromTeamId: string, fromTeamName: string) => {
    if (tradeAssets.some(a => a.id === id && a.fromTeamId === fromTeamId)) return;

    // For 2-team trades, auto-assign the other team as destination
    let toTeamId = '';
    let toTeamName = '';
    if (selectedTeamIds.length === 2) {
      const otherId = selectedTeamIds.find(id => id !== fromTeamId);
      if (otherId) {
        const otherTeam = teams.find(t => t.id === otherId);
        toTeamId = otherId;
        toTeamName = otherTeam?.name || '';
      }
    }

    setTradeAssets(prev => [...prev, {
      type, id, displayName, salary,
      fromTeamId, fromTeamName,
      toTeamId, toTeamName,
    }]);
  };

  // Remove asset from trade
  const removeAsset = (index: number) => {
    setTradeAssets(prev => prev.filter((_, i) => i !== index));
  };

  // Update destination for multi-team trades
  const updateDestination = (index: number, toTeamId: string) => {
    const toTeam = teams.find(t => t.id === toTeamId);
    setTradeAssets(prev => prev.map((asset, i) =>
      i === index ? { ...asset, toTeamId, toTeamName: toTeam?.name || '' } : asset
    ));
  };

  // Cap impact
  const capImpact = useMemo(() => {
    const valid = tradeAssets.filter(a => a.toTeamId);
    if (valid.length === 0) return [];

    const rosterEntries = new Map<string, any[]>();
    const tradeDeltas = new Map<string, number>();
    const tNames = new Map<string, string>();

    for (const team of teams) {
      const roster = rosters.get(team.id);
      rosterEntries.set(team.id, roster?.entries || []);
      tradeDeltas.set(team.id, team.capAdjustments?.tradeDelta || 0);
      tNames.set(team.id, team.name);
    }

    return computeTradeCapImpact({
      assets: valid.map(a => ({
        type: a.type, id: a.id, salary: a.salary,
        fromTeamId: a.fromTeamId, toTeamId: a.toTeamId,
      })),
      rosters: rosterEntries,
      players,
      tradeDelta: tradeDeltas,
      teamNames: tNames,
    });
  }, [tradeAssets, teams, rosters, players]);

  // Validate trade
  const canSubmit = useMemo(() => {
    if (isPostDeadline) return false;
    if (tradeAssets.length === 0) return false;
    if (tradeAssets.some(a => !a.toTeamId)) return false;
    if (selectedTeamIds.length < 2) return false;
    if (myTeam && !selectedTeamIds.includes(myTeam.id)) return false;
    return true;
  }, [tradeAssets, selectedTeamIds, isPostDeadline, myTeam]);

  // Submit trade
  const handleSubmit = async () => {
    if (!canSubmit || !leagueId || !myTeam || !user?.email || !currentLeague) return;
    setIsSubmitting(true);
    try {
      const proposalId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Involved teams = all teams that appear in assets
      const involvedIds = new Set<string>();
      for (const a of tradeAssets) {
        involvedIds.add(a.fromTeamId);
        if (a.toTeamId) involvedIds.add(a.toTeamId);
      }
      const teamIdsArr = Array.from(involvedIds);

      const { error: propErr } = await supabase
        .from('trade_proposals')
        .insert({
          id: proposalId,
          league_id: leagueId,
          season_year: currentLeague.seasonYear,
          proposed_by_team_id: myTeam.id,
          proposed_by_email: user.email,
          status: 'pending',
          assets: tradeAssets,
          involved_team_ids: teamIdsArr,
          note: tradeNote || null,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });

      if (propErr) throw propErr;

      const responseInserts = teamIdsArr.map(teamId => {
        const team = teams.find(t => t.id === teamId);
        return {
          id: `${proposalId}_${teamId}`,
          proposal_id: proposalId,
          team_id: teamId,
          team_name: team?.name || '',
          status: teamId === myTeam.id ? 'accepted' : 'pending',
          responded_by: teamId === myTeam.id ? user.email : null,
          responded_at: teamId === myTeam.id ? new Date().toISOString() : null,
        };
      });

      const { error: respErr } = await supabase
        .from('trade_proposal_responses')
        .insert(responseInserts);

      if (respErr) throw respErr;

      setTradeAssets([]);
      setTradeNote('');
      setSelectedTeamIds(myTeam ? [myTeam.id] : []);
      toast.success('Trade proposal submitted! Waiting for other teams to respond.');
    } catch (err) {
      logger.error('Error submitting trade:', err);
      toast.error('Failed to submit trade proposal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get team summary
  const getTeamSummary = (teamId: string) => {
    const roster = rosters.get(teamId);
    const team = teams.find(t => t.id === teamId);
    if (!roster || !team) return null;

    const entries = roster.entries || [];
    const keepers = entries.filter((e: any) => e.decision === 'KEEP');
    const stacked = stackKeeperRounds(keepers);

    return computeSummary({
      entries,
      allPlayers: players,
      tradeDelta: team.capAdjustments?.tradeDelta || 0,
      franchiseTags: stacked.franchiseTags,
    });
  };

  // Reset trade
  const handleReset = () => {
    setTradeAssets([]);
    setTradeNote('');
    setSelectedTeamIds(myTeam ? [myTeam.id] : []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading Trade Machine...</div>
      </div>
    );
  }

  const selectedTeams = selectedTeamIds
    .map(id => teams.find(t => t.id === id))
    .filter(Boolean) as Team[];

  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const completedProposals = proposals.filter(p => p.status !== 'pending');

  // Helper: render asset button
  const renderAssetButton = (
    type: TradeAssetType,
    id: string,
    displayName: string,
    salary: number,
    teamId: string,
    teamName: string,
    subtitle?: string,
  ) => {
    const isSelected = tradeAssets.some(a => a.id === id && a.fromTeamId === teamId);
    return (
      <button
        key={id}
        onClick={() => {
          if (isSelected) {
            // Remove asset on second click
            const idx = tradeAssets.findIndex(a => a.id === id && a.fromTeamId === teamId);
            if (idx >= 0) removeAsset(idx);
          } else {
            addAsset(type, id, displayName, salary, teamId, teamName);
          }
        }}
        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
          isSelected
            ? 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400'
            : 'bg-[#0a0a0a] text-white hover:bg-gray-800/80 border border-transparent'
        }`}
      >
        <span className="truncate">
          {displayName}
          {subtitle && <span className="text-gray-500 ml-1 text-xs">{subtitle}</span>}
        </span>
        {salary > 0 && <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{formatSalary(salary)}</span>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              to={`/league/${leagueId}`}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← League Home
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white">Trade Machine</h1>
          <p className="text-gray-400 mt-1">Build and propose multi-team trades</p>
        </div>

        {/* Trade Deadline Banner */}
        {isPostDeadline && (
          <div className="mb-6 p-4 bg-red-400/10 border border-red-400/30 rounded-lg text-red-400 text-sm">
            The trade deadline has passed. Trades can no longer be submitted.
          </div>
        )}

        {/* ============ STEP 1: Select Teams ============ */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Select Teams</h2>
              <p className="text-xs text-gray-500">Choose 2-5 teams to include in the trade</p>
            </div>
            {tradeAssets.length > 0 && (
              <button
                onClick={handleReset}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Reset Trade
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {teams.map(team => {
              const isSelected = selectedTeamIds.includes(team.id);
              const isMyTeam = team.id === myTeam?.id;
              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  disabled={!isSelected && selectedTeamIds.length >= 5}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    isSelected
                      ? isMyTeam
                        ? 'bg-green-400/20 border-green-400 text-green-400'
                        : 'bg-cyan-400/20 border-cyan-400 text-cyan-400'
                      : 'bg-[#0a0a0a] border-gray-700 text-gray-400 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  {team.abbrev}
                </button>
              );
            })}
          </div>
        </div>

        {/* ============ STEP 2: Team Panels Side-by-Side ============ */}
        {selectedTeamIds.length >= 2 && (
          <>
            <div className={`grid gap-4 mb-6 ${
              selectedTeams.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
              selectedTeams.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
              selectedTeams.length === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
              'grid-cols-1 md:grid-cols-2 lg:grid-cols-5'
            }`}>
              {selectedTeams.map(team => {
                const isMyTeam = team.id === myTeam?.id;
                const roster = rosters.get(team.id);
                const teamPicks = rookiePicks.filter(p => p.currentOwner === team.id);
                const summary = getTeamSummary(team.id);

                const entries = roster?.entries || [];
                const keepers = entries.filter((e: any) => e.decision === 'KEEP');
                const redshirts = entries.filter((e: any) => e.decision === 'REDSHIRT');
                const intStash = entries.filter((e: any) => e.decision === 'INT_STASH');

                // Assets being sent FROM this team
                const outgoing = tradeAssets.filter(a => a.fromTeamId === team.id);
                // Assets being received BY this team
                const incoming = tradeAssets.filter(a => a.toTeamId === team.id);

                return (
                  <div
                    key={team.id}
                    className={`bg-[#121212] rounded-lg border overflow-hidden flex flex-col ${
                      isMyTeam ? 'border-green-400/50' : 'border-gray-800'
                    }`}
                  >
                    {/* Team Header */}
                    <div className="px-4 py-3 border-b border-gray-800">
                      <div className="font-semibold text-white text-sm">
                        {team.name}
                        {isMyTeam && <span className="text-green-400 text-xs ml-1">(You)</span>}
                      </div>
                      {summary && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Cap: {formatSalary(summary.capUsed)}
                          <span className="text-gray-600 mx-1">|</span>
                          {summary.keepersCount} keeper{summary.keepersCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Trade Summary Bar — what's moving */}
                    {(outgoing.length > 0 || incoming.length > 0) && (
                      <div className="px-4 py-2 border-b border-gray-800 bg-[#0a0a0a]">
                        {outgoing.length > 0 && (
                          <div className="text-xs text-red-400 mb-1">
                            Sending {outgoing.length} asset{outgoing.length !== 1 ? 's' : ''}
                          </div>
                        )}
                        {incoming.length > 0 && (
                          <div className="text-xs text-green-400">
                            Receiving {incoming.length} asset{incoming.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assets — scrollable */}
                    <div className="flex-1 overflow-y-auto max-h-[400px] p-3 space-y-3">
                      {/* Keepers */}
                      {keepers.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-green-400 mb-1.5 uppercase tracking-wider">Keepers</h4>
                          <div className="space-y-1">
                            {keepers.map((entry: any) => {
                              const player = players.get(entry.playerId);
                              if (!player) return null;
                              return renderAssetButton(
                                'keeper', entry.playerId, player.name, player.salary,
                                team.id, team.name, player.position
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Redshirts */}
                      {redshirts.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-yellow-400 mb-1.5 uppercase tracking-wider">Redshirts</h4>
                          <div className="space-y-1">
                            {redshirts.map((entry: any) => {
                              const player = players.get(entry.playerId);
                              if (!player) return null;
                              return renderAssetButton(
                                'redshirt', entry.playerId, player.name, player.salary,
                                team.id, team.name, player.position
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Int Stash */}
                      {intStash.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Stash</h4>
                          <div className="space-y-1">
                            {intStash.map((entry: any) => {
                              const player = players.get(entry.playerId);
                              if (!player) return null;
                              return renderAssetButton(
                                'int_stash', entry.playerId, player.name, player.salary,
                                team.id, team.name, player.position
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Rookie Picks */}
                      {teamPicks.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-purple-400 mb-1.5 uppercase tracking-wider">Picks</h4>
                          <div className="space-y-1">
                            {teamPicks.sort((a, b) => a.year - b.year || a.round - b.round).map(pick => {
                              const displayName = `${pick.year} Rd ${pick.round} (${pick.originalTeamName})`;
                              return renderAssetButton(
                                'rookie_pick', pick.id, displayName, 0,
                                team.id, team.name,
                                pick.originalTeam !== pick.currentOwner ? 'acquired' : undefined
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {keepers.length === 0 && redshirts.length === 0 && intStash.length === 0 && teamPicks.length === 0 && (
                        <p className="text-gray-600 text-xs text-center py-4">No assets</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ============ Trade Details (3+ teams: destination pickers) ============ */}
            {selectedTeamIds.length > 2 && tradeAssets.length > 0 && (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-5 mb-6">
                <h3 className="text-sm font-bold text-white mb-3">Assign Destinations</h3>
                <p className="text-xs text-gray-500 mb-3">
                  For 3+ team trades, select which team receives each asset.
                </p>
                <div className="space-y-2">
                  {tradeAssets.map((asset, index) => (
                    <div key={index} className="bg-[#0a0a0a] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <button
                        onClick={() => removeAsset(index)}
                        className="text-red-400 hover:text-red-300 text-xs self-start"
                      >
                        ✕
                      </button>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          asset.type === 'keeper' ? 'bg-green-400/20 text-green-400' :
                          asset.type === 'redshirt' ? 'bg-yellow-400/20 text-yellow-400' :
                          asset.type === 'int_stash' ? 'bg-blue-400/20 text-blue-400' :
                          'bg-purple-400/20 text-purple-400'
                        }`}>
                          {asset.type === 'int_stash' ? 'STASH' : asset.type === 'rookie_pick' ? 'PICK' : asset.type.toUpperCase()}
                        </span>
                        <span className="text-white text-sm truncate">{asset.displayName}</span>
                        {asset.salary > 0 && (
                          <span className="text-gray-500 text-xs">{formatSalary(asset.salary)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 text-xs">{asset.fromTeamName}</span>
                        <span className="text-gray-600">→</span>
                        <select
                          value={asset.toTeamId}
                          onChange={(e) => updateDestination(index, e.target.value)}
                          className="px-2 py-1.5 bg-[#121212] border border-gray-700 rounded text-white text-xs"
                        >
                          <option value="">To...</option>
                          {selectedTeamIds
                            .filter(id => id !== asset.fromTeamId)
                            .map(id => {
                              const t = teams.find(tm => tm.id === id);
                              return <option key={id} value={id}>{t?.name}</option>;
                            })}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============ Cap Impact ============ */}
            {capImpact.length > 0 && (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Cap Impact</h3>
                <div className={`grid gap-4 ${
                  capImpact.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
                }`}>
                  {capImpact.map(impact => (
                    <div key={impact.teamId} className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                      <h4 className="text-sm font-semibold text-white mb-3">{impact.teamName}</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <div className="text-gray-500 text-xs">Before</div>
                          <div className="text-white">{formatSalary(impact.before.capUsed)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">After</div>
                          <div className={`font-medium ${
                            impact.after.capUsed > impact.before.capUsed ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {formatSalary(impact.after.capUsed)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Salary Out</div>
                          <div className="text-green-400">{impact.salaryOut > 0 ? `-${formatSalary(impact.salaryOut)}` : '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Salary In</div>
                          <div className="text-red-400">{impact.salaryIn > 0 ? `+${formatSalary(impact.salaryIn)}` : '-'}</div>
                        </div>
                      </div>
                      {impact.warnings.length > 0 && (
                        <div className="space-y-1">
                          {impact.warnings.map((w, i) => (
                            <div key={i} className="text-xs px-2 py-1 bg-yellow-400/10 border border-yellow-400/30 rounded text-yellow-400">
                              {w}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============ Submit ============ */}
            {tradeAssets.length > 0 && (
              <div className="bg-[#121212] rounded-lg border border-cyan-400/30 p-5 mb-8">
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-1 block">Note (optional)</label>
                  <input
                    type="text"
                    value={tradeNote}
                    onChange={(e) => setTradeNote(e.target.value)}
                    placeholder="Add a message to the other teams..."
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {tradeAssets.length} asset{tradeAssets.length !== 1 ? 's' : ''}
                    {tradeAssets.some(a => !a.toTeamId) && (
                      <span className="text-yellow-400 ml-2">
                        (assign all destinations)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    className="px-6 py-3 bg-cyan-400 text-black rounded-lg font-semibold hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Trade Proposal'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Prompt to select more teams */}
        {selectedTeamIds.length < 2 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-1">Select at least 2 teams to start building a trade</p>
            <p className="text-sm">Your team is pre-selected. Pick a trade partner above.</p>
          </div>
        )}

        {/* ============ Pending Proposals ============ */}
        {pendingProposals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Pending Trade Proposals ({pendingProposals.length})
            </h2>
            <div className="space-y-3">
              {pendingProposals.map(proposal => (
                <TradeProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  responses={responses.get(proposal.id) || []}
                  userTeamId={myTeam?.id || null}
                  userEmail={user?.email || ''}
                  onTradeExecuted={loadData}
                />
              ))}
            </div>
          </div>
        )}

        {/* ============ Trade History ============ */}
        {completedProposals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Trade History</h2>
            <div className="space-y-3">
              {completedProposals.map(proposal => (
                <TradeProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  responses={responses.get(proposal.id) || []}
                  userTeamId={myTeam?.id || null}
                  userEmail={user?.email || ''}
                />
              ))}
            </div>
          </div>
        )}

        {!proposalsLoading && proposals.length === 0 && selectedTeamIds.length >= 2 && tradeAssets.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-sm">
            No trade proposals yet. Click on assets in the team panels to start building a trade.
          </div>
        )}
      </div>
    </div>
  );
}

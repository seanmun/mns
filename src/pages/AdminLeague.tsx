import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, fetchAllRows } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useCanManageLeague } from '../hooks/useCanManageLeague';
import { AdminRosterManagement } from '../components/AdminRosterManagement';
import { AdminMatchupManager } from '../components/AdminMatchupManager';
import { ScheduleWeekPreview } from '../components/ScheduleWeekPreview';
import { PlayoffConfig } from '../components/PlayoffConfig';
import type { League, TeamFees } from '../types';
import { LEAGUE_PHASE_ORDER, LEAGUE_PHASE_LABELS } from '../types';
import { getNextPhase } from '../lib/phaseGating';
import { generateWeeks, analyzeSchedule } from '../lib/scheduleUtils';
import type { CombinedWeekConfig, ScheduleAnalysis } from '../lib/scheduleUtils';
import { mapLeague, mapPlayer } from '../lib/mappers';

export function AdminLeague() {
  const canManage = useCanManageLeague();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [showRosterManagement, setShowRosterManagement] = useState(false);
  const [showMatchupManager, setShowMatchupManager] = useState(false);
  const [startingSeasonProcessing, setStartingSeasonProcessing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    seasonYear: 2025,
    scoringMode: 'category_record' as 'matchup_record' | 'category_record',
    'cap.floor': 170_000_000,
    'cap.firstApron': 195_000_000,
    'cap.secondApron': 225_000_000,
    'cap.max': 255_000_000,
    'cap.tradeLimit': 40_000_000,
    'cap.penaltyRatePerM': 2,
    'schedule.numWeeks': 24,
    'schedule.seasonStartDate': '',
    'schedule.tradeDeadlineWeek': 16,
    'schedule.tradeDeadlineDate': '',
    'schedule.playoffTeams': 6,
    'schedule.playoffWeeks': 3,
    'schedule.playoffByeTeams': 2,
    'schedule.consolationWeeks': 3,
    'schedule.combineCup': false,
    'schedule.combineAllStar': false,
    'schedule.extendFirstWeek': false,
    'roster.maxActive': 13,
    'roster.maxStarters': 10,
    'roster.maxIR': 2,
    telegramChatId: '',
  });
  const [generatingWeeks, setGeneratingWeeks] = useState(false);
  const [weeksGenerated, setWeeksGenerated] = useState(false);
  const [scheduleAnalysis, setScheduleAnalysis] = useState<ScheduleAnalysis | null>(null);
  const [analyzingSchedule, setAnalyzingSchedule] = useState(false);
  const combineCup = editForm['schedule.combineCup'];
  const combineAllStar = editForm['schedule.combineAllStar'];
  const extendFirstWeek = editForm['schedule.extendFirstWeek'];
  const setCombineCup = (v: boolean) => setEditForm(f => ({ ...f, 'schedule.combineCup': v }));
  const setCombineAllStar = (v: boolean) => setEditForm(f => ({ ...f, 'schedule.combineAllStar': v }));
  const setExtendFirstWeek = (v: boolean) => setEditForm(f => ({ ...f, 'schedule.extendFirstWeek': v }));

  // Fee management state
  type FeeTeamInfo = { teamId: string; teamName: string; salary: number; firstApronFee: number; secondApronPenalty: number; feesLocked: boolean; tradeDelta: number };
  const [feeTeams, setFeeTeams] = useState<FeeTeamInfo[]>([]);
  const [feeTeamsLoading, setFeeTeamsLoading] = useState(false);
  const [capPeaks, setCapPeaks] = useState<Map<string, string>>(new Map());

  // Salary cap trade state
  const [capTradeTeamA, setCapTradeTeamA] = useState('');
  const [capTradeTeamB, setCapTradeTeamB] = useState('');
  const [capTradeAmount, setCapTradeAmount] = useState(0);
  const [capTradeProcessing, setCapTradeProcessing] = useState(false);

  // Build combined weeks config from checkbox state
  const combinedWeeks = useMemo((): CombinedWeekConfig[] => {
    const cw: CombinedWeekConfig[] = [];
    if (combineCup && scheduleAnalysis?.cupKnockoutWeeks) {
      cw.push({ calendarWeeks: scheduleAnalysis.cupKnockoutWeeks, label: 'NBA Cup' });
    }
    if (combineAllStar && scheduleAnalysis?.allStarWeeks) {
      cw.push({ calendarWeeks: scheduleAnalysis.allStarWeeks, label: 'All-Star' });
    }
    if (extendFirstWeek && scheduleAnalysis?.firstWeekShort) {
      cw.push({ calendarWeeks: [1, 2], label: 'Extended' });
    }
    return cw;
  }, [combineCup, combineAllStar, extendFirstWeek, scheduleAnalysis]);

  useEffect(() => {
    if (!canManage) {
      navigate('/');
      return;
    }

    const fetchLeagues = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('leagues')
          .select('*');
        if (error) throw error;

        const leagueData = (rows || []).map(mapLeague);
        setLeagues(leagueData);

        // Auto-select if only one league
        if (leagueData.length === 1) {
          handleSelectLeague(leagueData[0]);
        }

        setLoading(false);
      } catch (error) {
        logger.error('Error fetching leagues:', error);
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [canManage, navigate]);

  const fetchScheduleAnalysis = async (seasonYear: number) => {
    setAnalyzingSchedule(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('game_date, is_cup_game')
        .eq('season_year', seasonYear);

      if (error) throw error;
      if (data && data.length > 0) {
        const analysis = analyzeSchedule(data);
        setScheduleAnalysis(analysis);
      } else {
        setScheduleAnalysis(null);
      }
    } catch (err) {
      logger.error('Error fetching schedule:', err);
      setScheduleAnalysis(null);
    } finally {
      setAnalyzingSchedule(false);
    }
  };

  const handleSelectLeague = (league: League) => {
    setSelectedLeague(league);
    setEditForm({
      name: league.name,
      seasonYear: league.seasonYear,
      scoringMode: league.scoringMode,
      'cap.floor': league.cap.floor,
      'cap.firstApron': league.cap.firstApron,
      'cap.secondApron': league.cap.secondApron,
      'cap.max': league.cap.max,
      'cap.tradeLimit': league.cap.tradeLimit,
      'cap.penaltyRatePerM': league.cap.penaltyRatePerM,
      'schedule.numWeeks': league.schedule?.numWeeks || 24,
      'schedule.seasonStartDate': league.schedule?.seasonStartDate || '',
      'schedule.tradeDeadlineWeek': league.schedule?.tradeDeadlineWeek || 16,
      'schedule.tradeDeadlineDate': league.schedule?.tradeDeadlineDate || '',
      'schedule.playoffTeams': league.schedule?.playoffTeams || 6,
      'schedule.playoffWeeks': league.schedule?.playoffWeeks || 3,
      'schedule.playoffByeTeams': league.schedule?.playoffByeTeams || 2,
      'schedule.consolationWeeks': league.schedule?.consolationWeeks || 3,
      'schedule.combineCup': league.schedule?.combineCup || false,
      'schedule.combineAllStar': league.schedule?.combineAllStar || false,
      'schedule.extendFirstWeek': league.schedule?.extendFirstWeek || false,
      'roster.maxActive': league.roster?.maxActive ?? 13,
      'roster.maxStarters': league.roster?.maxStarters ?? 10,
      'roster.maxIR': league.roster?.maxIR ?? 2,
      telegramChatId: league.telegramChatId || '',
    });
    setWeeksGenerated(false);
    fetchScheduleAnalysis(league.seasonYear);
  };

  const handleSave = async () => {
    if (!selectedLeague) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('leagues')
        .update({
          name: editForm.name,
          season_year: editForm.seasonYear,
          scoring_mode: editForm.scoringMode,
          telegram_chat_id: editForm.telegramChatId || null,
          cap: {
            floor: editForm['cap.floor'],
            firstApron: editForm['cap.firstApron'],
            secondApron: editForm['cap.secondApron'],
            max: editForm['cap.max'],
            tradeLimit: editForm['cap.tradeLimit'],
            penaltyRatePerM: editForm['cap.penaltyRatePerM'],
          },
          schedule: {
            numWeeks: editForm['schedule.numWeeks'],
            seasonStartDate: editForm['schedule.seasonStartDate'],
            tradeDeadlineWeek: editForm['schedule.tradeDeadlineWeek'],
            tradeDeadlineDate: editForm['schedule.tradeDeadlineDate'],
            playoffTeams: editForm['schedule.playoffTeams'],
            playoffWeeks: editForm['schedule.playoffWeeks'],
            playoffByeTeams: editForm['schedule.playoffByeTeams'],
            consolationWeeks: editForm['schedule.consolationWeeks'],
            combineCup: editForm['schedule.combineCup'],
            combineAllStar: editForm['schedule.combineAllStar'],
            extendFirstWeek: editForm['schedule.extendFirstWeek'],
          },
          roster: {
            maxActive: editForm['roster.maxActive'],
            maxStarters: editForm['roster.maxStarters'],
            maxIR: editForm['roster.maxIR'],
          },
        })
        .eq('id', selectedLeague.id);
      if (error) throw error;

      // Update local state
      setLeagues((prev) =>
        prev.map((league) =>
          league.id === selectedLeague.id
            ? {
                ...league,
                name: editForm.name,
                seasonYear: editForm.seasonYear,
                scoringMode: editForm.scoringMode,
                telegramChatId: editForm.telegramChatId || undefined,
                cap: {
                  ...league.cap,
                  floor: editForm['cap.floor'],
                  firstApron: editForm['cap.firstApron'],
                  secondApron: editForm['cap.secondApron'],
                  max: editForm['cap.max'],
                  tradeLimit: editForm['cap.tradeLimit'],
                  penaltyRatePerM: editForm['cap.penaltyRatePerM'],
                },
                schedule: {
                  numWeeks: editForm['schedule.numWeeks'],
                  seasonStartDate: editForm['schedule.seasonStartDate'],
                  tradeDeadlineWeek: editForm['schedule.tradeDeadlineWeek'],
                  tradeDeadlineDate: editForm['schedule.tradeDeadlineDate'],
                  playoffTeams: editForm['schedule.playoffTeams'],
                  playoffWeeks: editForm['schedule.playoffWeeks'],
                  playoffByeTeams: editForm['schedule.playoffByeTeams'],
                  consolationWeeks: editForm['schedule.consolationWeeks'],
                  combineCup: editForm['schedule.combineCup'],
                  combineAllStar: editForm['schedule.combineAllStar'],
                  extendFirstWeek: editForm['schedule.extendFirstWeek'],
                },
                roster: {
                  maxActive: editForm['roster.maxActive'],
                  maxStarters: editForm['roster.maxStarters'],
                  maxIR: editForm['roster.maxIR'],
                },
              }
            : league
        )
      );

      setSelectedLeague(prev => prev ? {
        ...prev,
        name: editForm.name,
        seasonYear: editForm.seasonYear,
        scoringMode: editForm.scoringMode,
      } : null);

      toast.success('League updated successfully!');
      setSaving(false);
    } catch (error) {
      logger.error('Error updating league:', error);
      toast.error('Error updating league. Check console for details.');
      setSaving(false);
    }
  };

  const handleGenerateWeeks = async () => {
    if (!selectedLeague) return;

    const numWeeks = editForm['schedule.numWeeks'];
    const startDate = editForm['schedule.seasonStartDate'];
    const deadlineWeek = editForm['schedule.tradeDeadlineWeek'];
    const playoffWeeksCount = editForm['schedule.playoffTeams'] >= 2 ? editForm['schedule.playoffWeeks'] : 0;
    const consolationWeeksCount = editForm['schedule.playoffTeams'] >= 2 ? editForm['schedule.consolationWeeks'] : 0;

    if (!startDate) {
      toast.error('Please set a season start date first.');
      return;
    }
    if (numWeeks < 1 || numWeeks > 52) {
      toast.error('Number of weeks must be between 1 and 52.');
      return;
    }

    const postSeasonWeeks = Math.max(playoffWeeksCount, consolationWeeksCount);
    const totalWeeks = numWeeks + postSeasonWeeks;
    const postSeasonDesc = [
      playoffWeeksCount > 0 ? `${playoffWeeksCount} playoff` : '',
      consolationWeeksCount > 0 ? `${consolationWeeksCount} consolation` : '',
    ].filter(Boolean).join(' + ');
    const confirmed = confirm(
      `Generate ${numWeeks} regular season weeks${postSeasonDesc ? ` + ${postSeasonDesc} weeks` : ''} starting ${startDate}?${combinedWeeks.length > 0 ? `\n\nCombined weeks: ${combinedWeeks.map(c => `${c.label} (${c.calendarWeeks.join('-')})`).join(', ')}` : ''}\n\nThis will replace any existing weeks for this season.`
    );
    if (!confirmed) return;

    setGeneratingWeeks(true);
    try {
      await supabase
        .from('league_weeks')
        .delete()
        .eq('league_id', selectedLeague.id)
        .eq('season_year', selectedLeague.seasonYear);

      const weeks = generateWeeks(
        selectedLeague.id,
        selectedLeague.seasonYear,
        numWeeks,
        startDate,
        deadlineWeek,
        combinedWeeks,
        postSeasonWeeks > 0 ? { weeks: playoffWeeksCount, consolationWeeks: consolationWeeksCount } : undefined
      );

      const { error } = await supabase.from('league_weeks').insert(weeks);
      if (error) throw error;

      setWeeksGenerated(true);
      toast.success(`${totalWeeks} weeks generated (${numWeeks} regular${postSeasonDesc ? ` + ${postSeasonDesc}` : ''})!`);
    } catch (error) {
      logger.error('Error generating weeks:', error);
      toast.error(`Error generating weeks: ${error}`);
    } finally {
      setGeneratingWeeks(false);
    }
  };

  const handleAdvancePhase = async () => {
    if (!selectedLeague) return;

    const nextPhase = getNextPhase(selectedLeague.leaguePhase);
    if (!nextPhase) return;

    const confirmed = confirm(
      `Advance to ${LEAGUE_PHASE_LABELS[nextPhase]}?\n\n` +
      `Current: ${LEAGUE_PHASE_LABELS[selectedLeague.leaguePhase]}\n` +
      `This affects all users in the league.`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('leagues')
      .update({ league_phase: nextPhase })
      .eq('id', selectedLeague.id);

    if (error) {
      toast.error(`Failed to advance phase: ${error.message}`);
      return;
    }

    setLeagues(prev => prev.map(l =>
      l.id === selectedLeague.id ? { ...l, leaguePhase: nextPhase } : l
    ));
    setSelectedLeague(prev => prev ? { ...prev, leaguePhase: nextPhase } : null);
  };

  const handleRevertPhase = async () => {
    if (!selectedLeague) return;

    const idx = LEAGUE_PHASE_ORDER.indexOf(selectedLeague.leaguePhase);
    if (idx <= 0) return;
    const prevPhase = LEAGUE_PHASE_ORDER[idx - 1];

    const confirmed = confirm(
      `Revert to ${LEAGUE_PHASE_LABELS[prevPhase]}?\n\n` +
      `Current: ${LEAGUE_PHASE_LABELS[selectedLeague.leaguePhase]}\n\n` +
      `Only do this if the phase was advanced by mistake.`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('leagues')
      .update({ league_phase: prevPhase })
      .eq('id', selectedLeague.id);

    if (error) {
      toast.error(`Failed to revert phase: ${error.message}`);
      return;
    }

    setLeagues(prev => prev.map(l =>
      l.id === selectedLeague.id ? { ...l, leaguePhase: prevPhase } : l
    ));
    setSelectedLeague(prev => prev ? { ...prev, leaguePhase: prevPhase } : null);
  };

  // Load team fee overview for the fee management section
  const loadFeeTeams = async () => {
    if (!selectedLeague) return;
    setFeeTeamsLoading(true);
    try {
      const [teamsResult, playersRows, feesResult] = await Promise.all([
        supabase.from('teams').select('id, name, cap_adjustments').eq('league_id', selectedLeague.id),
        fetchAllRows('players', '*', (q: any) => q.eq('league_id', selectedLeague.id)),
        supabase.from('team_fees').select('*').eq('league_id', selectedLeague.id).eq('season_year', selectedLeague.seasonYear),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      const allPlayers = playersRows.map(mapPlayer);
      const feesMap = new Map<string, any>();
      for (const f of (feesResult.data || [])) feesMap.set(f.team_id, f);

      const result: FeeTeamInfo[] = (teamsResult.data || []).map((t: any) => {
        let salary = 0;
        allPlayers
          .filter(p => p.roster.teamId === t.id && ['active', 'bench', 'ir'].includes(p.slot))
          .forEach(p => { salary += p.salary || 0; });

        const fees = feesMap.get(t.id);
        return {
          teamId: t.id,
          teamName: t.name,
          salary,
          firstApronFee: fees?.first_apron_fee || 0,
          secondApronPenalty: fees?.second_apron_penalty || 0,
          feesLocked: fees?.fees_locked || false,
          tradeDelta: t.cap_adjustments?.tradeDelta || 0,
        };
      });

      result.sort((a, b) => b.salary - a.salary);
      setFeeTeams(result);
    } catch (err) {
      logger.error('Failed to load fee teams:', err);
      toast.error('Failed to load team fee data');
    } finally {
      setFeeTeamsLoading(false);
    }
  };

  // Apply a cap peak to update fees (watermark logic)
  const handleApplyCapPeak = async (teamId: string, teamName: string) => {
    if (!selectedLeague) return;
    const peakStr = capPeaks.get(teamId);
    if (!peakStr) return;
    const peak = parseFloat(peakStr) * 1_000_000;
    if (isNaN(peak) || peak <= 0) {
      toast.error('Enter a valid peak salary in $M');
      return;
    }

    const feesId = `${selectedLeague.id}_${teamId}_${selectedLeague.seasonYear}`;
    try {
      const { data: existing } = await supabase.from('team_fees').select('*').eq('id', feesId).maybeSingle();

      // Watermark: never reduce existing fees
      const existingFirstApron = existing?.first_apron_fee || 0;
      const existingPenalty = existing?.second_apron_penalty || 0;

      const newFirstApron = Math.max(existingFirstApron, peak > 195_000_000 ? 50 : 0);
      const overByM = peak > 225_000_000 ? Math.ceil((peak - 225_000_000) / 1_000_000) : 0;
      const newPenalty = Math.max(existingPenalty, overByM * 2);

      const franchiseTagFees = existing?.franchise_tag_fees || 0;
      const redshirtFees = existing?.redshirt_fees || 0;
      const unredshirtFees = existing?.unredshirt_fees || 0;
      const totalFees = franchiseTagFees + redshirtFees + unredshirtFees + newFirstApron + newPenalty;

      if (existing) {
        const { error } = await supabase.from('team_fees')
          .update({ first_apron_fee: newFirstApron, second_apron_penalty: newPenalty, total_fees: totalFees })
          .eq('id', feesId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('team_fees').insert({
          id: feesId, league_id: selectedLeague.id, team_id: teamId, season_year: selectedLeague.seasonYear,
          first_apron_fee: newFirstApron, second_apron_penalty: newPenalty, total_fees: totalFees,
        });
        if (error) throw error;
      }

      const changes: string[] = [];
      if (newFirstApron > existingFirstApron) changes.push('First Apron: $50');
      if (newPenalty > existingPenalty) changes.push(`Second Apron: $${newPenalty} (was $${existingPenalty})`);
      if (changes.length === 0) changes.push('No fee changes (peak below existing watermark)');

      toast.success(`${teamName} cap peak applied: $${(peak / 1_000_000).toFixed(1)}M\n${changes.join(', ')}`);
      setCapPeaks(prev => { const n = new Map(prev); n.delete(teamId); return n; });
      loadFeeTeams();
    } catch (err) {
      logger.error('Failed to apply cap peak:', err);
      toast.error(`Failed to apply cap peak for ${teamName}`);
    }
  };

  // Execute salary cap trade between two teams
  const handleCapTrade = async () => {
    if (!selectedLeague || !capTradeTeamA || !capTradeTeamB || capTradeAmount === 0) return;
    if (capTradeTeamA === capTradeTeamB) {
      toast.error('Cannot trade cap space with the same team');
      return;
    }

    const amountRaw = capTradeAmount * 1_000_000;
    const teamAInfo = feeTeams.find(t => t.teamId === capTradeTeamA);
    const teamBInfo = feeTeams.find(t => t.teamId === capTradeTeamB);
    if (!teamAInfo || !teamBInfo) return;

    const newDeltaA = teamAInfo.tradeDelta - amountRaw;
    const newDeltaB = teamBInfo.tradeDelta + amountRaw;

    const confirmed = confirm(
      `Salary Cap Trade:\n\n` +
      `${teamAInfo.teamName}: ${teamAInfo.tradeDelta / 1_000_000 >= 0 ? '+' : ''}${(teamAInfo.tradeDelta / 1_000_000).toFixed(0)}M → ${newDeltaA / 1_000_000 >= 0 ? '+' : ''}${(newDeltaA / 1_000_000).toFixed(0)}M\n` +
      `${teamBInfo.teamName}: ${teamBInfo.tradeDelta / 1_000_000 >= 0 ? '+' : ''}${(teamBInfo.tradeDelta / 1_000_000).toFixed(0)}M → ${newDeltaB / 1_000_000 >= 0 ? '+' : ''}${(newDeltaB / 1_000_000).toFixed(0)}M\n\n` +
      `Proceed?`
    );
    if (!confirmed) return;

    setCapTradeProcessing(true);
    try {
      const [resultA, resultB] = await Promise.all([
        supabase.from('teams').update({ cap_adjustments: { tradeDelta: newDeltaA } }).eq('id', capTradeTeamA),
        supabase.from('teams').update({ cap_adjustments: { tradeDelta: newDeltaB } }).eq('id', capTradeTeamB),
      ]);
      if (resultA.error) throw resultA.error;
      if (resultB.error) throw resultB.error;

      toast.success(`Cap trade executed: $${Math.abs(capTradeAmount)}M transferred`);
      setCapTradeAmount(0);
      loadFeeTeams(); // refresh
    } catch (err) {
      logger.error('Failed to execute cap trade:', err);
      toast.error('Failed to execute salary cap trade');
    } finally {
      setCapTradeProcessing(false);
    }
  };

  const handleLockFees = async () => {
    if (!selectedLeague) return;

    const confirmed = confirm(
      `Lock all team fees for the ${selectedLeague.seasonYear} season?\n\n` +
      `This will:\n` +
      `- Calculate first apron fees ($50) for teams over $195M\n` +
      `- Calculate second apron penalties ($2/M over $225M)\n` +
      `- Lock fees so they can't change\n\n` +
      `This action cannot be undone!`
    );

    if (!confirmed) return;

    try {
      setStartingSeasonProcessing(true);

      // Load teams and players for this league
      const { data: teamsRows, error: teamsErr } = await supabase
        .from('teams')
        .select('id, name')
        .eq('league_id', selectedLeague.id);
      if (teamsErr) throw teamsErr;

      const playersRows = await fetchAllRows('players', '*', (q: any) => q.eq('league_id', selectedLeague.id));
      const allPlayers = playersRows.map(mapPlayer);

      let teamsProcessed = 0;
      const errors: string[] = [];

      for (const team of (teamsRows || [])) {
        try {
          // Sum salary from active + bench + ir players on this team
          let totalSalary = 0;
          allPlayers
            .filter(p => p.roster.teamId === team.id && ['active', 'bench', 'ir'].includes(p.slot))
            .forEach(p => { totalSalary += p.salary || 0; });

          const overBy = Math.max(0, totalSalary - 225_000_000);
          const overByM = Math.ceil(overBy / 1_000_000);
          const currentPenalty = overByM * 2;

          const feesId = `${selectedLeague.id}_${team.id}_${selectedLeague.seasonYear}`;

          const { data: existingFeesRows } = await supabase
            .from('team_fees')
            .select('*')
            .eq('id', feesId);

          let existingFees: TeamFees | null = null;
          if (existingFeesRows && existingFeesRows.length > 0) {
            const r = existingFeesRows[0];
            existingFees = {
              id: r.id,
              franchiseTagFees: r.franchise_tag_fees,
              redshirtFees: r.redshirt_fees,
              firstApronFee: r.first_apron_fee,
              secondApronPenalty: r.second_apron_penalty,
              totalFees: r.total_fees,
              feesLocked: r.fees_locked,
            } as TeamFees;
          }

          // Sticky: preserve existing first apron charge; only add for newly over teams
          const firstApronFee = (existingFees?.firstApronFee && existingFees.firstApronFee > 0)
            ? existingFees.firstApronFee
            : (totalSalary > 195_000_000 ? 50 : 0);

          // Highest watermark: never drop below previously stored penalty
          const secondApronPenalty = Math.max(existingFees?.secondApronPenalty || 0, currentPenalty);

          const franchiseTagFees = existingFees?.franchiseTagFees || 0;
          const redshirtFees = existingFees?.redshirtFees || 0;
          const unredshirtFees = existingFees ? (existingFeesRows![0].unredshirt_fees || 0) : 0;
          const totalFees = franchiseTagFees + redshirtFees + unredshirtFees + firstApronFee + secondApronPenalty;

          const { error: updateErr } = await supabase
            .from('team_fees')
            .update({
              first_apron_fee: firstApronFee,
              second_apron_penalty: secondApronPenalty,
              total_fees: totalFees,
              fees_locked: true,
              locked_at: new Date().toISOString(),
            })
            .eq('id', feesId);
          if (updateErr) throw updateErr;

          teamsProcessed++;
        } catch (error) {
          logger.error(`Error processing team ${team.id}:`, error);
          errors.push(`Team ${team.name}: ${error}`);
        }
      }

      setStartingSeasonProcessing(false);

      if (errors.length > 0) {
        toast.error(`Fees locked with errors!\n\n${teamsProcessed} teams processed, ${errors.length} errors.\nCheck console.`);
      } else {
        toast.success(`Fees locked successfully!\n\n${teamsProcessed} teams processed.`);
      }
    } catch (error) {
      logger.error('Error locking fees:', error);
      toast.error(`Error locking fees: ${error}`);
      setStartingSeasonProcessing(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header — title + league dropdown + action buttons */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white">League Settings</h1>
            {leagues.length > 0 && (
              <select
                value={selectedLeague?.id || ''}
                onChange={(e) => {
                  const league = leagues.find(l => l.id === e.target.value);
                  if (league) handleSelectLeague(league);
                }}
                className="px-4 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
              >
                {!selectedLeague && <option value="" disabled>Select League</option>}
                {leagues.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.seasonYear}-{l.seasonYear + 1})</option>
                ))}
              </select>
            )}
          </div>
          {selectedLeague && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowMatchupManager(true)}
                className="px-5 py-2.5 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Manage Matchups
              </button>
              <button
                onClick={() => setShowRosterManagement(true)}
                className="px-5 py-2.5 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors text-sm"
              >
                Manage Rosters
              </button>
            </div>
          )}
        </div>

        {!selectedLeague ? (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-12 text-center text-gray-500">
            Select a league to configure
          </div>
        ) : (
          <div className="space-y-6">

            {/* Phase Stepper */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">League Phase</h2>

              <div className="flex items-center justify-between mb-6">
                {LEAGUE_PHASE_ORDER.map((phase, idx) => {
                  const currentIdx = LEAGUE_PHASE_ORDER.indexOf(selectedLeague.leaguePhase);
                  const isComplete = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={phase} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                            isCurrent
                              ? 'border-green-400 bg-green-400 text-black'
                              : isComplete
                              ? 'border-green-400/50 bg-green-400/20 text-green-400'
                              : 'border-gray-700 bg-transparent text-gray-600'
                          }`}
                        >
                          {isComplete ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span className={`text-xs mt-2 text-center ${
                          isCurrent ? 'text-green-400 font-semibold' : isComplete ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {LEAGUE_PHASE_LABELS[phase]}
                        </span>
                      </div>
                      {idx < LEAGUE_PHASE_ORDER.length - 1 && (
                        <div className={`h-0.5 w-full mx-1 -mt-5 ${
                          idx < currentIdx ? 'bg-green-400/50' : 'bg-gray-700'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                {getNextPhase(selectedLeague.leaguePhase) && (
                  <button
                    onClick={handleAdvancePhase}
                    className="px-5 py-2.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Advance to {LEAGUE_PHASE_LABELS[getNextPhase(selectedLeague.leaguePhase)!]}
                  </button>
                )}
                {LEAGUE_PHASE_ORDER.indexOf(selectedLeague.leaguePhase) > 0 && (
                  <button
                    onClick={handleRevertPhase}
                    className="px-4 py-2.5 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Revert Phase
                  </button>
                )}
                {selectedLeague.leaguePhase === 'regular_season' && (
                  <button
                    onClick={handleLockFees}
                    disabled={startingSeasonProcessing}
                    className="px-4 py-2.5 text-sm text-yellow-400 border border-yellow-400/30 rounded-lg hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
                  >
                    {startingSeasonProcessing ? 'Locking Fees...' : 'Lock Team Fees'}
                  </button>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Basic Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">League Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Season</label>
                  <select
                    value={editForm.seasonYear}
                    onChange={(e) => setEditForm({ ...editForm, seasonYear: parseInt(e.target.value) })}
                    className={inputClass}
                  >
                    <option value={2024}>2024-2025</option>
                    <option value={2025}>2025-2026</option>
                    <option value={2026}>2026-2027</option>
                    <option value={2027}>2027-2028</option>
                    <option value={2028}>2028-2029</option>
                    <option value={2029}>2029-2030</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Scoring Mode</label>
                  <select
                    value={editForm.scoringMode}
                    onChange={(e) => setEditForm({ ...editForm, scoringMode: e.target.value as 'matchup_record' | 'category_record' })}
                    className={inputClass}
                  >
                    <option value="category_record">Matchup Category Record</option>
                    <option value="matchup_record">Matchup Record</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {editForm.scoringMode === 'category_record'
                      ? '7-2 week = +7W +2L to season record'
                      : '1 W or L per weekly matchup'}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={editForm.telegramChatId}
                    onChange={(e) => setEditForm({ ...editForm, telegramChatId: e.target.value })}
                    placeholder="-100xxxxxxxxxx"
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Add @mns_draft_bot to your Telegram group, then paste the chat ID here for draft notifications.
                  </p>
                </div>
              </div>
            </div>

            {/* Salary Cap */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Salary Cap</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Floor ($M)</label>
                  <input type="number" value={editForm['cap.floor'] / 1_000_000}
                    onChange={(e) => setEditForm({ ...editForm, 'cap.floor': parseInt(e.target.value) * 1_000_000 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">First Apron ($M)</label>
                  <input type="number" value={editForm['cap.firstApron'] / 1_000_000}
                    onChange={(e) => setEditForm({ ...editForm, 'cap.firstApron': parseInt(e.target.value) * 1_000_000 })}
                    className={inputClass} />
                  <p className="text-xs text-gray-600 mt-1">$50 one-time fee</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Second Apron ($M)</label>
                  <input type="number" value={editForm['cap.secondApron'] / 1_000_000}
                    onChange={(e) => setEditForm({ ...editForm, 'cap.secondApron': parseInt(e.target.value) * 1_000_000 })}
                    className={inputClass} />
                  <p className="text-xs text-gray-600 mt-1">Penalty starts here</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Hard Cap ($M)</label>
                  <input type="number" value={editForm['cap.max'] / 1_000_000}
                    onChange={(e) => setEditForm({ ...editForm, 'cap.max': parseInt(e.target.value) * 1_000_000 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Trade Limit ($M)</label>
                  <input type="number" value={editForm['cap.tradeLimit'] / 1_000_000}
                    onChange={(e) => setEditForm({ ...editForm, 'cap.tradeLimit': parseInt(e.target.value) * 1_000_000 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Penalty Rate ($/M)</label>
                  <input type="number" value={editForm['cap.penaltyRatePerM']}
                    onChange={(e) => setEditForm({ ...editForm, 'cap.penaltyRatePerM': parseInt(e.target.value) })}
                    className={inputClass} />
                </div>
              </div>
            </div>

            {/* Roster Settings */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Roster Settings</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Max Active</label>
                  <input type="number" min={1} max={30} value={editForm['roster.maxActive']}
                    onChange={(e) => setEditForm({ ...editForm, 'roster.maxActive': parseInt(e.target.value) || 13 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Max Starters</label>
                  <input type="number" min={0} max={editForm['roster.maxActive']} value={editForm['roster.maxStarters']}
                    onChange={(e) => setEditForm({ ...editForm, 'roster.maxStarters': parseInt(e.target.value) || 10 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">IR Slots</label>
                  <input type="number" min={0} max={10} value={editForm['roster.maxIR']}
                    onChange={(e) => setEditForm({ ...editForm, 'roster.maxIR': parseInt(e.target.value) || 2 })}
                    className={inputClass} />
                </div>
              </div>
            </div>

            {/* Schedule + Week Preview */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Schedule</h2>

              {/* Schedule inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Regular Season Weeks</label>
                  <input type="number" min={1} max={52} value={editForm['schedule.numWeeks']}
                    onChange={(e) => setEditForm({ ...editForm, 'schedule.numWeeks': parseInt(e.target.value) || 24 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Season Start Date</label>
                  <input type="date" value={editForm['schedule.seasonStartDate']}
                    onChange={(e) => setEditForm({ ...editForm, 'schedule.seasonStartDate': e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Trade Deadline Week</label>
                  <input type="number" min={1} max={editForm['schedule.numWeeks']} value={editForm['schedule.tradeDeadlineWeek']}
                    onChange={(e) => setEditForm({ ...editForm, 'schedule.tradeDeadlineWeek': parseInt(e.target.value) || 16 })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Trade Deadline Date</label>
                  <input type="date" value={editForm['schedule.tradeDeadlineDate']}
                    onChange={(e) => setEditForm({ ...editForm, 'schedule.tradeDeadlineDate': e.target.value })}
                    className={inputClass} />
                </div>
              </div>

              {/* Combined Weeks — auto-detected */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Combined Weeks <span className="text-gray-600">(auto-detected from schedule)</span>
                </label>
                {analyzingSchedule ? (
                  <p className="text-xs text-gray-500">Analyzing schedule...</p>
                ) : !scheduleAnalysis ? (
                  <p className="text-xs text-gray-600">
                    Upload NBA schedule in Uploads to enable smart detection.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {scheduleAnalysis.cupKnockoutWeeks && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={combineCup} onChange={(e) => setCombineCup(e.target.checked)}
                          className="mt-0.5 accent-green-400" />
                        <div>
                          <span className="text-sm text-white">Cup knockout (Weeks {scheduleAnalysis.cupKnockoutWeeks.join('-')})</span>
                          <p className="text-xs text-gray-500">NBA Cup QF/SF/Championship — fewer regular games</p>
                        </div>
                      </label>
                    )}
                    {scheduleAnalysis.allStarWeeks && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={combineAllStar} onChange={(e) => setCombineAllStar(e.target.checked)}
                          className="mt-0.5 accent-green-400" />
                        <div>
                          <span className="text-sm text-white">All-Star break (Weeks {scheduleAnalysis.allStarWeeks.join('-')})</span>
                          <p className="text-xs text-gray-500">All-Star break gap detected in schedule</p>
                        </div>
                      </label>
                    )}
                    {scheduleAnalysis.firstWeekShort && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={extendFirstWeek} onChange={(e) => setExtendFirstWeek(e.target.checked)}
                          className="mt-0.5 accent-green-400" />
                        <div>
                          <span className="text-sm text-white">Extend first week (Weeks 1-2)</span>
                          <p className="text-xs text-gray-500">Season starts mid-week — fewer games in Week 1</p>
                        </div>
                      </label>
                    )}
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-xs text-gray-600">
                        {scheduleAnalysis.totalGames} games loaded — suggested {scheduleAnalysis.suggestedNumWeeks} weeks from {scheduleAnalysis.seasonStartDate}
                      </p>
                      <button
                        onClick={() => {
                          if (!scheduleAnalysis) return;
                          setEditForm(prev => ({
                            ...prev,
                            'schedule.numWeeks': scheduleAnalysis.suggestedNumWeeks,
                            'schedule.seasonStartDate': scheduleAnalysis.seasonStartDate,
                          }));
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                      >
                        Apply suggested
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Week Preview Grid */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">Week Preview</label>
                <ScheduleWeekPreview
                  numWeeks={editForm['schedule.numWeeks']}
                  seasonStartDate={editForm['schedule.seasonStartDate']}
                  tradeDeadlineWeek={editForm['schedule.tradeDeadlineWeek']}
                  combinedWeeks={combinedWeeks}
                  playoffWeeks={editForm['schedule.playoffTeams'] >= 2 ? editForm['schedule.playoffWeeks'] : 0}
                  consolationWeeks={editForm['schedule.playoffTeams'] >= 2 ? editForm['schedule.consolationWeeks'] : 0}
                />
              </div>

              {/* Generate Weeks */}
              <button
                onClick={handleGenerateWeeks}
                disabled={generatingWeeks || !editForm['schedule.seasonStartDate']}
                className="w-full px-4 py-2.5 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingWeeks ? 'Generating...' : weeksGenerated ? 'Regenerate Weeks' : 'Generate Weeks'}
              </button>
              {weeksGenerated && (
                <p className="text-sm text-green-400 mt-2">
                  Weeks generated successfully.
                </p>
              )}
            </div>

            {/* Playoffs */}
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Playoffs</h2>
              <PlayoffConfig
                playoffTeams={editForm['schedule.playoffTeams']}
                playoffWeeks={editForm['schedule.playoffWeeks']}
                playoffByeTeams={editForm['schedule.playoffByeTeams']}
                consolationWeeks={editForm['schedule.consolationWeeks']}
                maxTeams={12}
                onChange={(field, value) => setEditForm(prev => ({ ...prev, [field]: value }))}
              />
            </div>

            {/* Fee Management */}
            {selectedLeague.leaguePhase === 'regular_season' && (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Fee Management</h2>
                  <button
                    onClick={loadFeeTeams}
                    disabled={feeTeamsLoading}
                    className="px-3 py-1.5 text-xs text-green-400 border border-green-400/30 rounded hover:bg-green-400/10 transition-colors disabled:opacity-50"
                  >
                    {feeTeamsLoading ? 'Loading...' : feeTeams.length > 0 ? 'Refresh' : 'Load Teams'}
                  </button>
                </div>

                {feeTeams.length > 0 && (
                  <div className="space-y-4">
                    {/* Team fees overview table */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-gray-300">Team Fees Overview</h3>
                        <span className="text-xs text-yellow-400/60 border border-yellow-400/20 rounded px-1.5 py-0.5">BETA</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-800 text-left">
                              <th className="pb-2 text-gray-500 font-medium">Team</th>
                              <th className="pb-2 text-gray-500 font-medium text-right">Salary</th>
                              <th className="pb-2 text-gray-500 font-medium text-center">1st Apron</th>
                              <th className="pb-2 text-gray-500 font-medium text-right">2nd Apron</th>
                              <th className="pb-2 text-gray-500 font-medium text-right">Cap Peak ($M)</th>
                              <th className="pb-2 text-gray-500 font-medium text-right"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {feeTeams.map(ft => (
                              <tr key={ft.teamId} className="border-b border-gray-800/50">
                                <td className="py-2 text-white">{ft.teamName}</td>
                                <td className={`py-2 text-right ${ft.salary > 195_000_000 ? 'text-yellow-400' : 'text-gray-300'}`}>
                                  ${(ft.salary / 1_000_000).toFixed(1)}M
                                </td>
                                <td className="py-2 text-center">
                                  {ft.firstApronFee > 0 ? (
                                    <span className="text-yellow-400 font-medium">${ft.firstApronFee}</span>
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                                <td className="py-2 text-right">
                                  {ft.secondApronPenalty > 0 ? (
                                    <span className="text-orange-400 font-medium">${ft.secondApronPenalty}</span>
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                                <td className="py-2 text-right">
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder={(ft.salary / 1_000_000).toFixed(1)}
                                    value={capPeaks.get(ft.teamId) || ''}
                                    onChange={(e) => setCapPeaks(prev => new Map(prev).set(ft.teamId, e.target.value))}
                                    className="w-24 px-2 py-1 text-right bg-[#0a0a0a] border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-green-400"
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  {capPeaks.get(ft.teamId) && (
                                    <button
                                      onClick={() => handleApplyCapPeak(ft.teamId, ft.teamName)}
                                      className="px-2 py-1 text-xs text-green-400 border border-green-400/30 rounded hover:bg-green-400/10 transition-colors"
                                    >
                                      Apply
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Enter a team's peak salary in $M to update fees. Watermark logic: fees only go up, never down.
                      </p>
                    </div>

                    {/* Salary Cap Trade */}
                    <div className="border-t border-gray-800 pt-4">
                      <h3 className="text-sm font-medium text-gray-300 mb-3">Salary Cap Trade</h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Team A (gives cap)</label>
                          <select
                            value={capTradeTeamA}
                            onChange={(e) => setCapTradeTeamA(e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Select team</option>
                            {feeTeams.map(ft => (
                              <option key={ft.teamId} value={ft.teamId}>
                                {ft.teamName} ({ft.tradeDelta >= 0 ? '+' : ''}{(ft.tradeDelta / 1_000_000).toFixed(0)}M)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Team B (receives cap)</label>
                          <select
                            value={capTradeTeamB}
                            onChange={(e) => setCapTradeTeamB(e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Select team</option>
                            {feeTeams.filter(ft => ft.teamId !== capTradeTeamA).map(ft => (
                              <option key={ft.teamId} value={ft.teamId}>
                                {ft.teamName} ({ft.tradeDelta >= 0 ? '+' : ''}{(ft.tradeDelta / 1_000_000).toFixed(0)}M)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Amount ($M)</label>
                          <input
                            type="number"
                            value={capTradeAmount}
                            onChange={(e) => setCapTradeAmount(parseInt(e.target.value) || 0)}
                            min={1}
                            max={40}
                            className={inputClass}
                          />
                        </div>
                        <button
                          onClick={handleCapTrade}
                          disabled={capTradeProcessing || !capTradeTeamA || !capTradeTeamB || capTradeAmount === 0}
                          className="px-4 py-2.5 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {capTradeProcessing ? 'Processing...' : 'Execute Cap Trade'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Positive amount = Team A gives cap space to Team B. Both teams' trade delta will adjust accordingly.
                      </p>
                    </div>
                  </div>
                )}

                {feeTeams.length === 0 && !feeTeamsLoading && (
                  <p className="text-sm text-gray-600">Click "Load Teams" to view fee status and manage salary cap trades.</p>
                )}
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Roster Management Modal */}
      {showRosterManagement && selectedLeague && (
        <AdminRosterManagement
          leagueId={selectedLeague.id}
          seasonYear={selectedLeague.seasonYear}
          rosterSettings={selectedLeague.roster}
          onClose={() => setShowRosterManagement(false)}
        />
      )}

      {/* Matchup Manager Modal */}
      {showMatchupManager && selectedLeague && (
        <AdminMatchupManager
          leagueId={selectedLeague.id}
          seasonYear={selectedLeague.seasonYear}
          scoringMode={selectedLeague.scoringMode}
          onClose={() => setShowMatchupManager(false)}
        />
      )}
    </div>
  );
}

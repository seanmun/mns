import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import { toast } from 'sonner';
import type { Sport, LeagueCapSettings, LeaguePhase, LeagueFeeSettings } from '../types';
import { NBA_CAP_DEFAULTS, WNBA_CAP_DEFAULTS, DEFAULT_ROSTER_SETTINGS, NBA_FEE_DEFAULTS, WNBA_FEE_DEFAULTS, LEAGUE_PHASE_LABELS } from '../types';

// TODO: Wizard should eventually include these LM config steps:
// - Schedule length (number of weeks, season start date)
// - Playoff format (# teams, # weeks, consolation)
// - Trade deadline
// - Roster settings (max active, starters, IR slots)
// - Scoring mode (matchup_record vs category_record)
// - Rookie draft rounds (NBA: 3, WNBA: 1)
// Blocked for WNBA: schedule not released yet. Revisit when WNBA 2026 schedule drops.

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = 'sport' | 'basics' | 'origin' | 'teams' | 'review';

interface WizardTeam {
  name: string;
  abbrev: string;
  ownerEmail: string;
  ownerName: string;
}

interface WizardState {
  sport: Sport | null;
  leagueName: string;
  leagueSlug: string;
  seasonYear: number;
  numTeams: number;
  leaguePhase: LeaguePhase;
  fees: LeagueFeeSettings;
  isCarryOver: boolean;
  teams: WizardTeam[];
}

// Phases available when migrating from another platform
const CARRYOVER_PHASES: { value: LeaguePhase; label: string; description: string }[] = [
  { value: 'champion', label: 'Post-Champion', description: 'Season ended, champion crowned — next up is rookie draft or keepers' },
  { value: 'rookie_draft', label: 'Rookie Draft', description: 'Drafting rookies before the regular season' },
  { value: 'keeper_season', label: 'Keeper Season', description: 'Teams are deciding which players to keep' },
  { value: 'draft', label: 'Draft', description: 'Ready to run the main draft' },
  { value: 'regular_season', label: 'Regular Season', description: 'Season is underway, matchups are active' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

function makeEmptyTeams(count: number, currentUserEmail?: string): WizardTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    name: '',
    abbrev: '',
    ownerEmail: i === 0 && currentUserEmail ? currentUserEmail : '',
    ownerName: '',
  }));
}

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'sport', label: 'Sport' },
  { key: 'basics', label: 'Basics' },
  { key: 'origin', label: 'Type' },
  { key: 'teams', label: 'Teams' },
  { key: 'review', label: 'Review' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function CreateLeague() {
  const { user } = useAuth();
  const { setCurrentLeagueId, refreshLeagues } = useLeague();
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>('sport');
  const [creating, setCreating] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [suffix] = useState(randomSuffix);

  const [state, setState] = useState<WizardState>({
    sport: null,
    leagueName: '',
    leagueSlug: '',
    seasonYear: 2026,
    numTeams: 10,
    leaguePhase: 'keeper_season',
    fees: NBA_FEE_DEFAULTS,
    isCarryOver: false,
    teams: makeEmptyTeams(10, user?.email ?? undefined),
  });

  const update = (partial: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...partial }));
  };

  const capDefaults: LeagueCapSettings = state.sport === 'wnba' ? WNBA_CAP_DEFAULTS : NBA_CAP_DEFAULTS;

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // Validation
  const validTeams = useMemo(
    () => state.teams.filter(t => t.name.trim() && t.abbrev.trim()),
    [state.teams]
  );

  const canCreate = state.sport && state.leagueName.trim() && state.leagueSlug.trim() && validTeams.length >= 1;

  // ─── Step Navigation ────────────────────────────────────────────────────────

  const goTo = (s: WizardStep) => setStep(s);

  // ─── Creation Handler ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!canCreate || !user) return;
    setCreating(true);

    try {
      const leagueId = state.leagueSlug;

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('leagues')
        .select('id')
        .eq('id', leagueId)
        .maybeSingle();

      if (existing) {
        toast.error('A league with this ID already exists. Choose a different name or edit the slug.');
        setSlugError('This slug is already taken');
        setStep('basics');
        setCreating(false);
        return;
      }

      // Insert league
      const { error: leagueErr } = await supabase
        .from('leagues')
        .insert({
          id: leagueId,
          name: state.leagueName.trim(),
          sport: state.sport,
          season_year: state.seasonYear,
          commissioner_id: user.id,
          league_phase: state.leaguePhase,
          keepers_locked: false,
          cap: capDefaults,
          fees: state.fees,
          scoring_mode: 'category_record',
          roster: DEFAULT_ROSTER_SETTINGS,
          deadlines: {},
        });

      if (leagueErr) throw leagueErr;

      // Insert teams
      const teamInserts = validTeams.map(t => ({
        id: `${leagueId}_${t.abbrev.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        league_id: leagueId,
        name: t.name.trim(),
        abbrev: t.abbrev.toUpperCase().trim(),
        owners: t.ownerEmail.trim() ? [t.ownerEmail.trim().toLowerCase()] : [],
        owner_names: t.ownerName.trim() ? [t.ownerName.trim()] : [],
        cap_adjustments: { tradeDelta: 0 },
        settings: { maxKeepers: 8 },
        banners: [],
      }));

      if (teamInserts.length > 0) {
        const { error: teamsErr } = await supabase
          .from('teams')
          .insert(teamInserts);

        if (teamsErr) throw teamsErr;
      }

      // Refresh context and navigate
      refreshLeagues();
      setCurrentLeagueId(leagueId);
      toast.success('League created!');
      navigate('/lm');
    } catch (error: any) {
      console.error('Error creating league:', error);
      toast.error(`Failed to create league: ${error?.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Create a League</h1>
          <p className="text-gray-400 mt-2">Set up your keeper league in a few steps</p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    i < currentStepIndex
                      ? 'bg-green-400 border-green-400 text-black'
                      : i === currentStepIndex
                      ? 'border-green-400 text-green-400'
                      : 'border-gray-700 text-gray-600'
                  }`}>
                    {i < currentStepIndex ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1 ${
                    i <= currentStepIndex ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 ${
                    i < currentStepIndex ? 'bg-green-400' : 'bg-gray-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {step === 'sport' && (
          <StepSport onSelect={(sport) => {
            update({ sport, fees: sport === 'wnba' ? WNBA_FEE_DEFAULTS : NBA_FEE_DEFAULTS });
            goTo('basics');
          }} />
        )}

        {step === 'basics' && (
          <StepBasics
            state={state}
            suffix={suffix}
            slugError={slugError}
            onUpdate={(partial) => {
              if (partial.leagueSlug !== undefined) setSlugError('');
              update(partial);
            }}
            onNext={() => goTo('origin')}
            onBack={() => goTo('sport')}
          />
        )}

        {step === 'origin' && (
          <StepOrigin
            onChoose={(isCarryOver) => {
              if (isCarryOver) {
                update({ isCarryOver, leaguePhase: 'champion' });
              } else {
                update({ isCarryOver, leaguePhase: 'draft' });
              }
              goTo('teams');
            }}
            onBack={() => goTo('basics')}
          />
        )}

        {step === 'teams' && (
          <StepTeams
            state={state}
            onUpdate={update}
            onNext={() => goTo('review')}
            onBack={() => goTo('origin')}
          />
        )}

        {step === 'review' && (
          <StepReview
            state={state}
            capDefaults={capDefaults}
            validTeamCount={validTeams.length}
            creating={creating}
            onCreate={handleCreate}
            onBack={() => goTo('teams')}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Sport Selection ─────────────────────────────────────────────────

function StepSport({ onSelect }: { onSelect: (sport: Sport) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Choose Your Sport</h2>
        <p className="text-sm text-gray-400 mt-1">This determines your player pool and salary cap structure</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* NBA Card */}
        <button
          onClick={() => onSelect('nba')}
          className="bg-[#121212] rounded-xl border-2 border-gray-800 p-8 text-left hover:border-green-400 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">NBA</h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Full salary cap with floor, first apron, and second apron tiers. Keeper rounds, trade deadlines, and rookie drafts.
          </p>
          <div className="mt-4 text-xs text-gray-600">
            Default cap: $170M floor &mdash; $255M max
          </div>
        </button>

        {/* WNBA Card */}
        <button
          onClick={() => onSelect('wnba')}
          className="bg-[#121212] rounded-xl border-2 border-gray-800 p-8 text-left hover:border-green-400 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">WNBA</h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Simplified salary cap with a single cap maximum. Keeper contracts and competitive draft system.
          </p>
          <div className="mt-4 text-xs text-gray-600">
            Default cap: $1.5M max
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: League Basics ───────────────────────────────────────────────────

function StepBasics({
  state,
  suffix,
  slugError,
  onUpdate,
  onNext,
  onBack,
}: {
  state: WizardState;
  suffix: string;
  slugError: string;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const buildSlug = (name: string, year: number) => {
    if (!name.trim()) return '';
    return `${slugify(name)}-${year}-${suffix}`;
  };

  const handleNameChange = (name: string) => {
    onUpdate({ leagueName: name, leagueSlug: buildSlug(name, state.seasonYear) });
  };

  const handleYearChange = (year: number) => {
    onUpdate({ seasonYear: year, leagueSlug: buildSlug(state.leagueName, year) });
  };

  const handleNumTeamsChange = (num: number) => {
    const clamped = Math.max(4, Math.min(16, num));
    const currentTeams = state.teams;
    let newTeams: WizardTeam[];

    if (clamped > currentTeams.length) {
      newTeams = [...currentTeams, ...makeEmptyTeams(clamped - currentTeams.length)];
    } else {
      newTeams = currentTeams.slice(0, clamped);
    }

    onUpdate({ numTeams: clamped, teams: newTeams });
  };

  const canProceed = state.leagueName.trim().length >= 2 && state.leagueSlug.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">League Details</h2>
        <p className="text-sm text-gray-400 mt-1">
          {state.sport === 'wnba' ? 'WNBA' : 'NBA'} Keeper League
        </p>
      </div>

      <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 space-y-5">
        {/* League Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">League Name</label>
          <input
            type="text"
            value={state.leagueName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Money Never Sleeps"
            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:border-green-400 focus:outline-none transition-colors"
          />
        </div>

        {/* League Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">League ID (URL slug)</label>
          <input
            type="text"
            value={state.leagueSlug}
            onChange={(e) => onUpdate({ leagueSlug: slugify(e.target.value) })}
            placeholder="auto-generated"
            className={`w-full px-4 py-2.5 bg-[#0a0a0a] border rounded-lg text-white placeholder-gray-600 focus:outline-none transition-colors ${
              slugError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-green-400'
            }`}
          />
          {slugError && <p className="text-red-400 text-xs mt-1">{slugError}</p>}
          {!slugError && state.leagueSlug && (
            <p className="text-gray-600 text-xs mt-1">Your league URL: /league/{state.leagueSlug}</p>
          )}
        </div>

        {/* Season Year */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Season Year</label>
          <select
            value={state.seasonYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:border-green-400 focus:outline-none transition-colors"
          >
            {[2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Number of Teams */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Number of Teams</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNumTeamsChange(state.numTeams - 1)}
              disabled={state.numTeams <= 4}
              className="w-10 h-10 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              -
            </button>
            <span className="text-2xl font-bold text-white w-12 text-center">{state.numTeams}</span>
            <button
              onClick={() => handleNumTeamsChange(state.numTeams + 1)}
              disabled={state.numTeams >= 16}
              className="w-10 h-10 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Cap Summary */}
        <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Salary Cap</span>
            <span className="text-xs text-gray-600">(customizable later)</span>
          </div>
          {state.sport === 'wnba' ? (
            <p className="text-sm text-gray-400">
              Cap Max: <span className="text-white font-semibold">${(WNBA_CAP_DEFAULTS.max / 1_000_000).toFixed(1)}M</span>
              <span className="text-gray-600 ml-2">Simplified &mdash; no apron tiers</span>
            </p>
          ) : (
            <div className="text-sm text-gray-400 space-y-1">
              <p>Floor: <span className="text-white font-semibold">${NBA_CAP_DEFAULTS.floor / 1_000_000}M</span></p>
              <p>First Apron: <span className="text-white font-semibold">${NBA_CAP_DEFAULTS.firstApron / 1_000_000}M</span></p>
              <p>Second Apron: <span className="text-white font-semibold">${NBA_CAP_DEFAULTS.secondApron / 1_000_000}M</span></p>
              <p>Max: <span className="text-white font-semibold">${NBA_CAP_DEFAULTS.max / 1_000_000}M</span></p>
            </div>
          )}
        </div>

        {/* Fee Settings */}
        <FeeConfig
          fees={state.fees}
          sport={state.sport}
          onUpdate={(fees) => onUpdate({ fees })}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:text-white hover:border-gray-500 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: New or Carry-Over ───────────────────────────────────────────────

function StepOrigin({
  onChoose,
  onBack,
}: {
  onChoose: (isCarryOver: boolean) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">League Type</h2>
        <p className="text-sm text-gray-400 mt-1">Is this a brand new league or migrating from another platform?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onChoose(false)}
          className="bg-[#121212] rounded-xl border-2 border-gray-800 p-8 text-left hover:border-green-400 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Start Fresh</h3>
          <p className="text-sm text-gray-400">
            Begin a new league from scratch. Set up teams and add players later.
          </p>
        </button>

        <button
          onClick={() => onChoose(true)}
          className="bg-[#121212] rounded-xl border-2 border-gray-800 p-8 text-left hover:border-green-400 hover:shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Import from Another Platform</h3>
          <p className="text-sm text-gray-400">
            Bring over your existing league from ESPN, Fantrax, or another service.
          </p>
        </button>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:text-white hover:border-gray-500 transition-colors">
          Back
        </button>
        <div /> {/* spacer */}
      </div>
    </div>
  );
}

// ─── Step 4: Teams ───────────────────────────────────────────────────────────

function StepTeams({
  state,
  onUpdate,
  onNext,
  onBack,
}: {
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const updateTeam = (index: number, field: keyof WizardTeam, value: string) => {
    const newTeams = [...state.teams];
    newTeams[index] = { ...newTeams[index], [field]: value };
    onUpdate({ teams: newTeams });
  };

  const filledCount = state.teams.filter(t => t.name.trim() && t.abbrev.trim()).length;
  const canProceed = filledCount >= 1;

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Set Up Teams</h2>
        <p className="text-sm text-gray-400 mt-1">
          {state.isCarryOver
            ? 'Enter your teams. You can import rosters after league creation.'
            : 'Fill in what you know now. You can edit teams later.'}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {filledCount} of {state.numTeams} teams filled in (at least 1 required)
        </p>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {state.teams.map((team, i) => (
          <div
            key={i}
            className={`bg-[#121212] rounded-lg border p-4 transition-colors ${
              team.name.trim() && team.abbrev.trim()
                ? 'border-green-400/30'
                : 'border-gray-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-gray-500 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center">
                {i + 1}
              </span>
              {team.name.trim() ? (
                <span className="text-sm font-semibold text-white">{team.name}</span>
              ) : (
                <span className="text-sm text-gray-600">Team {i + 1}</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Team Name"
                value={team.name}
                onChange={(e) => updateTeam(i, 'name', e.target.value)}
                className="col-span-2 sm:col-span-1 px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:border-green-400 focus:outline-none transition-colors"
              />
              <input
                type="text"
                placeholder="Abbrev"
                value={team.abbrev}
                onChange={(e) => updateTeam(i, 'abbrev', e.target.value.toUpperCase().slice(0, 4))}
                maxLength={4}
                className="px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:border-green-400 focus:outline-none transition-colors uppercase"
              />
              <input
                type="email"
                placeholder="Owner Email"
                value={team.ownerEmail}
                onChange={(e) => updateTeam(i, 'ownerEmail', e.target.value)}
                className="px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:border-green-400 focus:outline-none transition-colors"
              />
              <input
                type="text"
                placeholder="Owner Name"
                value={team.ownerName}
                onChange={(e) => updateTeam(i, 'ownerName', e.target.value)}
                className="px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:border-green-400 focus:outline-none transition-colors"
              />
            </div>
          </div>
        ))}
      </div>

      {state.isCarryOver && (
        <>
          {/* Starting Phase — carry-over leagues pick where they left off */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Where did your last season end?</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CARRYOVER_PHASES.map((phase) => (
                <button
                  key={phase.value}
                  onClick={() => onUpdate({ leaguePhase: phase.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    state.leaguePhase === phase.value
                      ? 'border-green-400 bg-green-400/10'
                      : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <span className={`text-sm font-semibold ${
                    state.leaguePhase === phase.value ? 'text-green-400' : 'text-white'
                  }`}>
                    {phase.label}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">{phase.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-400/10 border border-blue-400/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              After creating your league, use the <span className="font-semibold">Roster Import</span> tool in League Manager to import players for each team from Fantrax or ESPN.
            </p>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:text-white hover:border-gray-500 transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Review
        </button>
      </div>
    </div>
  );
}

// ─── Fee Config ──────────────────────────────────────────────────────────────

const FEE_FIELDS: { key: keyof LeagueFeeSettings; label: string; prefix: string; nbaOnly?: boolean }[] = [
  { key: 'buyIn', label: 'League Buy-In', prefix: '$' },
  { key: 'firstApronFee', label: 'First Apron Fee', prefix: '$', nbaOnly: true },
  { key: 'penaltyRatePerM', label: 'Penalty Rate (per $1M over)', prefix: '$', nbaOnly: true },
  { key: 'redshirtFee', label: 'Redshirt Fee', prefix: '$' },
  { key: 'franchiseTagFee', label: 'Franchise Tag Fee', prefix: '$' },
  { key: 'activationFee', label: 'Activation Fee', prefix: '$' },
];

function FeeConfig({
  fees,
  sport,
  onUpdate,
}: {
  fees: LeagueFeeSettings;
  sport: Sport | null;
  onUpdate: (fees: LeagueFeeSettings) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const visibleFields = sport === 'wnba'
    ? FEE_FIELDS.filter(f => !f.nbaOnly)
    : FEE_FIELDS;

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fees</span>
          <p className="text-sm text-gray-400 mt-0.5">
            Buy-in: <span className="text-white font-semibold">${fees.buyIn}</span>
            {fees.firstApronFee > 0 && (
              <span className="ml-2">Apron: <span className="text-white font-semibold">${fees.firstApronFee}</span></span>
            )}
          </p>
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          {visibleFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{field.prefix}</span>
                <input
                  type="number"
                  min={0}
                  value={fees[field.key]}
                  onChange={(e) => onUpdate({ ...fees, [field.key]: Number(e.target.value) || 0 })}
                  className="w-full pl-7 pr-3 py-2 bg-[#121212] border border-gray-700 rounded-lg text-white text-sm focus:border-green-400 focus:outline-none transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 5: Review & Create ─────────────────────────────────────────────────

function StepReview({
  state,
  capDefaults,
  validTeamCount,
  creating,
  onCreate,
  onBack,
}: {
  state: WizardState;
  capDefaults: LeagueCapSettings;
  validTeamCount: number;
  creating: boolean;
  onCreate: () => void;
  onBack: () => void;
}) {
  const validTeams = state.teams.filter(t => t.name.trim() && t.abbrev.trim());

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Review & Create</h2>
        <p className="text-sm text-gray-400 mt-1">Everything look good?</p>
      </div>

      <div className="bg-[#121212] rounded-xl border border-gray-800 p-6 space-y-5">
        {/* League Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Sport</span>
            <p className="text-white font-semibold mt-0.5">{state.sport === 'wnba' ? 'WNBA' : 'NBA'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Season</span>
            <p className="text-white font-semibold mt-0.5">{state.seasonYear}</p>
          </div>
          <div className="col-span-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">League Name</span>
            <p className="text-white font-semibold mt-0.5">{state.leagueName}</p>
            <p className="text-xs text-gray-600 mt-0.5">ID: {state.leagueSlug}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Starting Phase</span>
            <p className="text-white font-semibold mt-0.5">
              {LEAGUE_PHASE_LABELS[state.leaguePhase] || state.leaguePhase}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Salary Cap</span>
            <p className="text-white font-semibold mt-0.5">
              ${(capDefaults.max / 1_000_000).toFixed(capDefaults.max >= 10_000_000 ? 0 : 1)}M max
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Type</span>
            <p className="text-white font-semibold mt-0.5">
              {state.isCarryOver ? 'Carry-over' : 'Fresh start'}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Buy-In</span>
            <p className="text-white font-semibold mt-0.5">${state.fees.buyIn}</p>
          </div>
        </div>

        {/* Teams */}
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            Teams ({validTeamCount})
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {validTeams.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0a] border border-gray-700 rounded-lg text-sm"
              >
                <span className="font-semibold text-green-400">{t.abbrev}</span>
                <span className="text-gray-400">{t.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Create Button */}
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="px-5 py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:text-white hover:border-gray-500 transition-colors">
          Back
        </button>
        <button
          onClick={onCreate}
          disabled={creating}
          className="px-8 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            'Create League'
          )}
        </button>
      </div>
    </div>
  );
}

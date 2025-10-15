import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import type { Team, Player, Draft, DraftPick, RosterDoc } from '../types';

export function AdminDraftSetup() {
  const { role, user } = useAuth();
  const { currentLeagueId, currentLeague } = useLeague();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<RosterDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [existingDraft, setExistingDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<'order' | 'confirm' | 'complete'>('order');
  const [isTestDraft, setIsTestDraft] = useState(true);

  useEffect(() => {
    if (role !== 'admin' || !currentLeagueId) {
      if (role !== 'admin') navigate('/');
      return;
    }

    loadData();
  }, [role, currentLeagueId, navigate]);

  const loadData = async () => {
    if (!currentLeagueId || !currentLeague) return;

    setLoading(true);
    try {
      // Load teams
      const teamsRef = collection(db, 'teams');
      const teamsQuery = query(teamsRef, where('leagueId', '==', currentLeagueId));
      const teamsSnap = await getDocs(teamsQuery);
      const teamsData = teamsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Team[];
      setTeams(teamsData);

      // Load all players
      const playersSnap = await getDocs(collection(db, 'players'));
      const playersData = playersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];
      setPlayers(playersData);

      // Load rosters for each team
      const rostersData: RosterDoc[] = [];
      for (const team of teamsData) {
        const rosterId = `${currentLeagueId}_${team.id}_${currentLeague.seasonYear}`;
        const rosterRef = doc(db, 'rosters', rosterId);
        const rosterSnap = await getDoc(rosterRef);
        if (rosterSnap.exists()) {
          rostersData.push({
            id: rosterSnap.id,
            ...rosterSnap.data(),
          } as RosterDoc);
        }
      }
      setRosters(rostersData);

      // Check if draft already exists
      const draftId = `${currentLeagueId}_${currentLeague.seasonYear}`;
      const draftRef = doc(db, 'drafts', draftId);
      const draftSnap = await getDoc(draftRef);

      if (draftSnap.exists()) {
        const draft = { id: draftSnap.id, ...draftSnap.data() } as Draft;
        setExistingDraft(draft);
        setDraftOrder(draft.draftOrder);

        if (draft.status === 'in_progress' || draft.status === 'completed') {
          setStep('complete');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const handleGenerateRandomOrder = () => {
    const shuffled = [...teams]
      .map((team) => team.id)
      .sort(() => Math.random() - 0.5);
    setDraftOrder(shuffled);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...draftOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setDraftOrder(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === draftOrder.length - 1) return;
    const newOrder = [...draftOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setDraftOrder(newOrder);
  };

  const handleInitializeDraft = async () => {
    if (!currentLeagueId || !currentLeague || !user?.email) return;
    if (draftOrder.length !== teams.length) {
      alert('Please set the draft order first');
      return;
    }

    try {
      // Generate all picks including keeper slots
      const picks: DraftPick[] = [];
      let overallPick = 1;

      for (let round = 1; round <= 13; round++) {
        const roundOrder = round % 2 === 1 ? draftOrder : [...draftOrder].reverse();

        roundOrder.forEach((teamId, index) => {
          const team = teams.find((t) => t.id === teamId)!;

          // Find keepers for this team in this round from roster
          const teamRoster = rosters.find(r => r.teamId === teamId);
          const keeperEntry = teamRoster?.entries.find(entry =>
            entry.decision === 'KEEP' && entry.keeperRound === round
          );

          let keeper: Player | undefined;
          if (keeperEntry) {
            keeper = players.find(p => p.id === keeperEntry.playerId);
          }

          const pick: any = {
            round,
            pickInRound: index + 1,
            overallPick,
            teamId,
            teamName: team.name,
            teamAbbrev: team.abbrev,
            isKeeperSlot: !!keeper,
          };

          // Only add these fields if there's a keeper
          if (keeper) {
            pick.playerId = keeper.id;
            pick.playerName = keeper.name;
            pick.pickedAt = Date.now();
            pick.pickedBy = 'keeper';
          }

          picks.push(pick);

          overallPick++;
        });
      }

      // Find first non-keeper pick
      const firstOpenPick = picks.find(p => !p.isKeeperSlot);

      // Create draft document
      const draftId = `${currentLeagueId}_${currentLeague.seasonYear}`;
      const draftData: any = {
        id: draftId,
        leagueId: currentLeagueId,
        seasonYear: currentLeague.seasonYear,
        status: 'setup',
        draftOrder,
        picks,
        settings: {
          allowAdminOverride: true,
          isTestDraft: isTestDraft,
        },
        createdAt: Date.now(),
        createdBy: user?.email || 'unknown',
      };

      // Only add currentPick if there's an open pick
      if (firstOpenPick) {
        draftData.currentPick = {
          round: firstOpenPick.round,
          pickInRound: firstOpenPick.pickInRound,
          overallPick: firstOpenPick.overallPick,
          teamId: firstOpenPick.teamId,
          startedAt: Date.now(),
        };
      }

      await setDoc(doc(db, 'drafts', draftId), draftData);

      const draft = draftData as Draft;
      setExistingDraft(draft);
      setStep('complete');

      alert('Draft initialized successfully!');
    } catch (error: any) {
      console.error('Error initializing draft:', error);
      alert(`Failed to initialize draft: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleStartDraft = async () => {
    if (!existingDraft) return;

    try {
      const draftRef = doc(db, 'drafts', existingDraft.id);
      await setDoc(draftRef, {
        ...existingDraft,
        status: 'in_progress',
        startedAt: Date.now(),
      });

      navigate(`/league/${currentLeagueId}/draft`);
    } catch (error) {
      console.error('Error starting draft:', error);
      alert('Failed to start draft');
    }
  };

  const handleDeleteDraft = async () => {
    if (!existingDraft || !currentLeagueId || !currentLeague) return;

    const confirmed = window.confirm(
      '⚠️ DELETE TEST DRAFT?\n\nThis will permanently delete this draft. All picks will be lost.\n\nThis does NOT affect player rosters - it only deletes the draft document.'
    );

    if (!confirmed) return;

    try {
      const draftRef = doc(db, 'drafts', existingDraft.id);
      await deleteDoc(draftRef);

      setExistingDraft(null);
      setDraftOrder([]);
      setStep('order');

      alert('Draft deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      alert(`Failed to delete draft: ${error?.message || 'Unknown error'}`);
    }
  };

  if (step === 'complete' && existingDraft) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-8">Draft Ready</h1>

          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Draft Initialized</h2>
                <p className="text-sm text-gray-400">Status: {existingDraft.status}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Picks:</span>
                <span className="text-white font-semibold">{existingDraft.picks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Keeper Slots:</span>
                <span className="text-blue-400 font-semibold">
                  {existingDraft.picks.filter(p => p.isKeeperSlot).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Available Picks:</span>
                <span className="text-green-400 font-semibold">
                  {existingDraft.picks.filter(p => !p.isKeeperSlot).length}
                </span>
              </div>
              {existingDraft.currentPick && (
                <div className="flex justify-between">
                  <span className="text-gray-400">First Pick:</span>
                  <span className="text-purple-400 font-semibold">
                    {teams.find(t => t.id === existingDraft.currentPick?.teamId)?.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {existingDraft.status === 'setup' && (
              <button
                onClick={handleStartDraft}
                className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
              >
                Start Draft
              </button>
            )}

            <button
              onClick={() => navigate(`/league/${currentLeagueId}/draft`)}
              className="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors"
            >
              Go to Draft Board
            </button>

            <button
              onClick={() => navigate('/admin/teams')}
              className="w-full px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to Admin
            </button>

            <div className="border-t border-gray-800 pt-3 mt-3">
              <button
                onClick={handleDeleteDraft}
                className="w-full px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 font-semibold rounded-lg hover:bg-red-500/20 transition-colors"
              >
                🗑️ Delete Test Draft
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                This only deletes the draft - does not affect rosters
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Draft Setup</h1>

        {existingDraft && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-500">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Draft Already Exists</span>
            </div>
            <p className="text-sm text-yellow-400 mt-1">
              A draft has already been created for this league. You can view/modify the order below.
            </p>
          </div>
        )}

        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Set Draft Order</h2>

          {/* Test/Real Draft Toggle */}
          <div className="mb-6 p-4 bg-[#0a0a0a] border border-gray-700 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-semibold text-white">Draft Type</div>
                <div className="text-sm text-gray-400 mt-1">
                  {isTestDraft
                    ? '🧪 Test Draft - Only admins can see this draft'
                    : '🔴 LIVE Draft - All users can participate'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestDraft(!isTestDraft)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isTestDraft ? 'bg-gray-600' : 'bg-green-500'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isTestDraft ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </label>
          </div>

          <button
            onClick={handleGenerateRandomOrder}
            className="mb-6 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Generate Random Order
          </button>

          {draftOrder.length > 0 && (
            <div className="space-y-2">
              {draftOrder.map((teamId, index) => {
                const team = teams.find((t) => t.id === teamId);
                return (
                  <div
                    key={teamId}
                    className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-gray-700 rounded-lg"
                  >
                    <span className="text-green-400 font-bold text-lg w-8">{index + 1}.</span>
                    <span className="flex-1 text-white">
                      {team?.abbrev} - {team?.name}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === draftOrder.length - 1}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {draftOrder.length > 0 && (
          <button
            onClick={handleInitializeDraft}
            className="mt-6 w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
          >
            {existingDraft ? 'Update Draft Order' : 'Initialize Draft (Place Keepers in Slots)'}
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useIsSiteAdmin } from '../hooks/useCanManageLeague';
import { mapProspect } from '../lib/mappers';
import type { Prospect, Sport } from '../types';

interface NewProspectForm {
  rank: number | '';
  player: string;
  position: string;
  school: string;
  year: string;
  height: string;
  weight: number | '';
  draftProjection: string;
}

const EMPTY_FORM: NewProspectForm = {
  rank: '',
  player: '',
  position: '',
  school: '',
  year: '',
  height: '',
  weight: '',
  draftProjection: '',
};

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const YEARS = ['Fr', 'So', 'Jr', 'Sr'];
const PROJECTIONS = ['Lottery', 'First Round', 'Second Round', 'Late Pick', 'Undrafted'];

export function AdminProspects() {
  const navigate = useNavigate();
  const isSiteAdmin = useIsSiteAdmin();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState<Sport>('nba');

  // Rank editing
  const [editedRanks, setEditedRanks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProspect, setNewProspect] = useState<NewProspectForm>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<NewProspectForm>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProspects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('sport', sport)
        .order('rank', { ascending: true });

      if (error) throw error;
      setProspects((data || []).map(mapProspect));
    } catch (err: any) {
      toast.error(`Failed to load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    loadProspects();
    setEditedRanks({});
    setDeleteConfirmId(null);
  }, [loadProspects]);

  const handleAdd = async () => {
    if (!newProspect.player.trim() || !newProspect.position || !newProspect.rank) {
      toast.error('Rank, player name, and position are required');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from('prospects').insert({
        rank: Number(newProspect.rank),
        player: newProspect.player.trim(),
        school: newProspect.school.trim(),
        year: newProspect.year,
        position: newProspect.position,
        height: newProspect.height || null,
        weight: newProspect.weight ? Number(newProspect.weight) : null,
        draft_projection: newProspect.draftProjection || null,
        sport,
      });
      if (error) throw error;
      toast.success(`Added ${newProspect.player}`);
      setNewProspect(EMPTY_FORM);
      setShowAddForm(false);
      await loadProspects();
    } catch (err: any) {
      toast.error(`Failed to add: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleSaveRanks = async () => {
    const entries = Object.entries(editedRanks);
    if (entries.length === 0) return;
    setSaving(true);
    try {
      for (const [id, newRank] of entries) {
        const { error } = await supabase
          .from('prospects')
          .update({ rank: newRank })
          .eq('id', id);
        if (error) throw error;
      }
      toast.success(`Updated ${entries.length} ranking(s)`);
      setEditedRanks({});
      await loadProspects();
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('prospects').delete().eq('id', id);
      if (error) throw error;
      toast.success('Prospect deleted');
      setDeleteConfirmId(null);
      await loadProspects();
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const startEditing = (p: Prospect) => {
    setEditingId(p.id);
    setEditForm({
      rank: p.rank,
      player: p.player,
      position: p.position,
      school: p.school,
      year: p.year || '',
      height: p.height || '',
      weight: p.weight || '',
      draftProjection: p.draftProjection || '',
    });
    setDeleteConfirmId(null);
  };

  const handleEditSave = async () => {
    if (!editingId || !editForm.player.trim() || !editForm.position) {
      toast.error('Player name and position are required');
      return;
    }
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('prospects')
        .update({
          player: editForm.player.trim(),
          position: editForm.position,
          school: editForm.school.trim(),
          year: editForm.year,
          height: editForm.height || null,
          weight: editForm.weight ? Number(editForm.weight) : null,
          draft_projection: editForm.draftProjection || null,
        })
        .eq('id', editingId);
      if (error) throw error;
      toast.success(`Updated ${editForm.player}`);
      setEditingId(null);
      await loadProspects();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  const handleRankChange = (id: string, _originalRank: number, value: string) => {
    const newRank = parseInt(value);
    if (isNaN(newRank) || newRank < 1) return;

    // Build current rank state (apply any pending edits)
    const currentRanks = prospects.map(p => ({
      id: p.id,
      rank: p.id in editedRanks ? editedRanks[p.id] : p.rank,
    }));

    const movingProspect = currentRanks.find(p => p.id === id);
    if (!movingProspect) return;
    const oldRank = movingProspect.rank;
    if (newRank === oldRank) return;

    // Cascade: shift everyone in between
    const next: Record<string, number> = {};
    for (const p of currentRanks) {
      let rank = p.rank;
      if (p.id === id) {
        rank = newRank;
      } else if (newRank < oldRank && rank >= newRank && rank < oldRank) {
        // Moving UP: shift ranks in [newRank, oldRank-1] down by 1
        rank = rank + 1;
      } else if (newRank > oldRank && rank > oldRank && rank <= newRank) {
        // Moving DOWN: shift ranks in [oldRank+1, newRank] up by 1
        rank = rank - 1;
      }

      // Only track if different from the DB value
      const dbRank = prospects.find(pr => pr.id === p.id)?.rank;
      if (rank !== dbRank) {
        next[p.id] = rank;
      }
    }

    setEditedRanks(next);
  };

  const dirtyCount = Object.keys(editedRanks).length;

  if (!isSiteAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">Site admin permissions required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/site-admin')}
          className="text-sm text-gray-500 hover:text-orange-400 mb-3 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Site Admin
        </button>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Manage Prospects</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
            Admin
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Add, reorder rankings, and delete NBA & WNBA draft prospects.
        </p>
      </div>

      {/* Sport toggle */}
      <div className="flex gap-2 mb-6">
        {(['nba', 'wnba'] as Sport[]).map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
              sport === s
                ? 'bg-orange-500 text-white'
                : 'bg-[#121212] text-gray-400 border border-gray-800 hover:border-orange-400/50'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Stats + Add button row */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-[#121212] border border-gray-800 rounded-lg px-4 py-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider mr-2">{sport.toUpperCase()} Prospects:</span>
          <span className="text-lg font-bold text-white">{prospects.length}</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showAddForm
              ? 'bg-gray-700 text-white'
              : 'border border-orange-500/50 text-orange-400 hover:bg-orange-500/10'
          }`}
        >
          {showAddForm ? 'Cancel' : '+ Add Prospect'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-[#121212] border border-gray-800 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">New Prospect</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <input
              type="number"
              placeholder="Rank *"
              min={1}
              value={newProspect.rank}
              onChange={(e) => setNewProspect({ ...newProspect, rank: e.target.value ? parseInt(e.target.value) : '' })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <input
              type="text"
              placeholder="Player Name *"
              value={newProspect.player}
              onChange={(e) => setNewProspect({ ...newProspect, player: e.target.value })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 sm:col-span-2"
            />
            <select
              value={newProspect.position}
              onChange={(e) => setNewProspect({ ...newProspect, position: e.target.value })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            >
              <option value="">Position *</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <input
              type="text"
              placeholder="School"
              value={newProspect.school}
              onChange={(e) => setNewProspect({ ...newProspect, school: e.target.value })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <select
              value={newProspect.year}
              onChange={(e) => setNewProspect({ ...newProspect, year: e.target.value })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            >
              <option value="">Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <input
              type="text"
              placeholder='Height (6-7)'
              value={newProspect.height}
              onChange={(e) => setNewProspect({ ...newProspect, height: e.target.value })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <input
              type="number"
              placeholder="Weight"
              value={newProspect.weight}
              onChange={(e) => setNewProspect({ ...newProspect, weight: e.target.value ? parseInt(e.target.value) : '' })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <select
              value={newProspect.draftProjection}
              onChange={(e) => setNewProspect({ ...newProspect, draftProjection: e.target.value })}
              className="bg-[#0a0a0a] border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            >
              <option value="">Projection</option>
              {PROJECTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {adding ? 'Adding...' : 'Add Prospect'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent" />
          <div className="mt-4 text-gray-400">Loading prospects...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && prospects.length === 0 && (
        <div className="bg-[#121212] border border-gray-800 rounded-lg p-12 text-center">
          <h3 className="text-lg font-bold text-white mb-2">No {sport.toUpperCase()} prospects</h3>
          <p className="text-sm text-gray-400">
            Add prospects manually or use the {sport === 'wnba' ? 'WNBA Prospect Scraper' : 'CSV Upload'} tool.
          </p>
        </div>
      )}

      {/* Prospects table */}
      {!loading && prospects.length > 0 && (
        <div className="overflow-x-auto border border-gray-800 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-gray-800">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Rank</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Player</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pos</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">School</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Year</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Height</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Wt</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Projection</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[...prospects].sort((a, b) => {
                const rankA = a.id in editedRanks ? editedRanks[a.id] : a.rank;
                const rankB = b.id in editedRanks ? editedRanks[b.id] : b.rank;
                return rankA - rankB;
              }).map((p) => {
                const isEdited = p.id in editedRanks;
                const displayRank = isEdited ? editedRanks[p.id] : p.rank;
                const isDeleting = deleteConfirmId === p.id;
                const isEditingThis = editingId === p.id;

                if (isEditingThis) {
                  return (
                    <tr key={p.id} className="bg-orange-500/5">
                      <td className="px-3 py-2">
                        <span className="w-16 text-sm text-center font-bold text-gray-500 block">{displayRank}</span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.player}
                          onChange={(e) => setEditForm({ ...editForm, player: e.target.value })}
                          className="w-full bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.position}
                          onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                          className="bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                        >
                          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.school}
                          onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                          className="w-full bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.year}
                          onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                          className="bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                        >
                          <option value="">—</option>
                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.height}
                          onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                          className="w-20 bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                          placeholder="6-7"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.weight}
                          onChange={(e) => setEditForm({ ...editForm, weight: e.target.value ? parseInt(e.target.value) : '' })}
                          className="w-16 bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.draftProjection}
                          onChange={(e) => setEditForm({ ...editForm, draftProjection: e.target.value })}
                          className="bg-[#0a0a0a] border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-400"
                        >
                          <option value="">—</option>
                          {PROJECTIONS.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={handleEditSave}
                            disabled={editSaving}
                            className="text-xs text-green-400 hover:text-green-300 font-medium"
                          >
                            {editSaving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={displayRank}
                        onChange={(e) => handleRankChange(p.id, p.rank, e.target.value)}
                        className={`w-16 bg-[#0a0a0a] border rounded px-2 py-1 text-sm text-center font-bold focus:outline-none ${
                          isEdited
                            ? 'border-orange-400 text-orange-400'
                            : 'border-gray-800 text-white focus:border-gray-600'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{p.player}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-400/20 text-blue-400 border border-blue-400/30">
                        {p.position}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{p.school || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{p.year || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono">{p.height || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono">{p.weight || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{p.draftProjection || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {isDeleting ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting}
                            className="text-xs text-red-400 hover:text-red-300 font-medium"
                          >
                            {deleting ? '...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => startEditing(p)}
                            className="text-xs text-orange-400/60 hover:text-orange-400 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="text-xs text-red-400/60 hover:text-red-400 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Save order sticky bar */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-orange-500/50 p-4 flex items-center justify-between z-40">
          <span className="text-sm text-gray-400">
            {dirtyCount} rank change{dirtyCount !== 1 ? 's' : ''} pending
          </span>
          <div className="flex gap-3">
            <button
              onClick={() => setEditedRanks({})}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg"
            >
              Discard
            </button>
            <button
              onClick={handleSaveRanks}
              disabled={saving}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

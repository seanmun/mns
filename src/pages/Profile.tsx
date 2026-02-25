import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  owners: string[];
  ownerNames?: string[];
}

// Map a Supabase team row to the local Team interface
function mapTeam(row: any): Team {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbrev,
    owners: row.owners,
    ownerNames: row.owner_names,
  };
}

export function Profile() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    newOwnerEmail: ''
  });

  // Load user's teams
  useEffect(() => {
    const loadTeams = async () => {
      if (!user?.email) return;

      try {
        const { data: teamRows, error } = await supabase
          .from('teams')
          .select('*')
          .contains('owners', [user.email]);

        if (error) throw error;

        const userTeams = (teamRows || []).map(mapTeam);
        setTeams(userTeams);
      } catch (error) {
        logger.error('Error loading teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [user]);

  const startEditing = (team: Team) => {
    setEditingTeam(team.id);
    setFormData({
      name: team.name,
      abbreviation: team.abbreviation,
      newOwnerEmail: ''
    });
  };

  const cancelEditing = () => {
    setEditingTeam(null);
    setFormData({
      name: '',
      abbreviation: '',
      newOwnerEmail: ''
    });
  };

  const handleSave = async (teamId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: formData.name,
          abbrev: formData.abbreviation,
        })
        .eq('id', teamId);

      if (error) throw error;

      // Update local state
      setTeams(teams.map(t =>
        t.id === teamId
          ? { ...t, name: formData.name, abbreviation: formData.abbreviation }
          : t
      ));

      setEditingTeam(null);
      setFormData({ name: '', abbreviation: '', newOwnerEmail: '' });
    } catch (error) {
      logger.error('Error updating team:', error);
      toast.error('Failed to update team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOwner = async (teamId: string) => {
    if (!formData.newOwnerEmail.trim()) return;

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (team.owners.includes(formData.newOwnerEmail.trim())) {
      toast.error('This email is already an owner of this team.');
      return;
    }

    setSaving(true);
    try {
      const updatedOwners = [...team.owners, formData.newOwnerEmail.trim()];

      const { error } = await supabase
        .from('teams')
        .update({ owners: updatedOwners })
        .eq('id', teamId);

      if (error) throw error;

      // Update local state
      setTeams(teams.map(t =>
        t.id === teamId
          ? { ...t, owners: updatedOwners }
          : t
      ));

      setFormData({ ...formData, newOwnerEmail: '' });
    } catch (error) {
      logger.error('Error adding owner:', error);
      toast.error('Failed to add owner. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOwner = async (teamId: string, ownerEmail: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (team.owners.length <= 1) {
      toast.error('Cannot remove the last owner from a team.');
      return;
    }

    if (!confirm(`Remove ${ownerEmail} from this team?`)) return;

    setSaving(true);
    try {
      const updatedOwners = team.owners.filter(email => email !== ownerEmail);

      const { error } = await supabase
        .from('teams')
        .update({ owners: updatedOwners })
        .eq('id', teamId);

      if (error) throw error;

      // Update local state
      setTeams(teams.map(t =>
        t.id === teamId
          ? { ...t, owners: updatedOwners }
          : t
      ));
    } catch (error) {
      logger.error('Error removing owner:', error);
      toast.error('Failed to remove owner. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Profile</h1>
          <p className="text-gray-400 mt-1">
            Manage your team information
          </p>
        </div>

        {/* Teams List */}
        {teams.length === 0 ? (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 text-center">
            <p className="text-gray-400">You don't own any teams yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => (
              <div key={team.id} className="bg-[#121212] rounded-lg border border-gray-800 p-6">
                {/* Team Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">{team.name}</h2>
                    <p className="text-gray-400 text-sm">{team.abbreviation}</p>
                  </div>
                  {editingTeam !== team.id && (
                    <button
                      onClick={() => startEditing(team)}
                      className="px-4 py-2 text-sm font-medium text-green-400 border border-green-400 rounded hover:bg-green-400/10 transition-colors"
                    >
                      Edit Team
                    </button>
                  )}
                </div>

                {/* Edit Form */}
                {editingTeam === team.id ? (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Team Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-md bg-[#0a0a0a] border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-green-400 focus:ring-green-400 px-4 py-2"
                        placeholder="Team name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Abbreviation
                      </label>
                      <input
                        type="text"
                        value={formData.abbreviation}
                        onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                        maxLength={4}
                        className="w-full rounded-md bg-[#0a0a0a] border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-green-400 focus:ring-green-400 px-4 py-2"
                        placeholder="e.g., LAL"
                      />
                      <p className="text-xs text-gray-500 mt-1">Max 4 characters</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSave(team.id)}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-black bg-green-400 rounded hover:bg-green-500 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-gray-400 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Owners Section */}
                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-white font-semibold mb-4">Team Owners</h3>
                  <div className="space-y-2 mb-4">
                    {team.owners.map((ownerEmail, index) => (
                      <div key={index} className="flex items-center justify-between bg-[#0a0a0a] rounded px-4 py-3">
                        <span className="text-gray-300 text-sm">{ownerEmail}</span>
                        {team.owners.length > 1 && (
                          <button
                            onClick={() => handleRemoveOwner(team.id, ownerEmail)}
                            disabled={saving}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Owner */}
                  <div className="flex gap-3">
                    <input
                      type="email"
                      value={formData.newOwnerEmail}
                      onChange={(e) => setFormData({ ...formData, newOwnerEmail: e.target.value })}
                      placeholder="Add owner email"
                      className="flex-1 rounded-md bg-[#0a0a0a] border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-green-400 focus:ring-green-400 px-4 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleAddOwner(team.id)}
                      disabled={saving || !formData.newOwnerEmail.trim()}
                      className="px-4 py-2 text-sm font-medium text-green-400 border border-green-400 rounded hover:bg-green-400/10 transition-colors disabled:opacity-50"
                    >
                      Add Owner
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

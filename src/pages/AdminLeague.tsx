import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { League } from '../types';

export function AdminLeague() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    seasonYear: 2025,
    'cap.floor': 170_000_000,
    'cap.base': 225_000_000,
    'cap.firstApron': 195_000_000,
    'cap.secondApron': 225_000_000,
    'cap.max': 255_000_000,
    'cap.tradeLimit': 40_000_000,
    'cap.penaltyStart': 225_000_000,
    'cap.penaltyRatePerM': 2,
  });

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchLeagues = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'leagues'));
        const leagueData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as League[];

        setLeagues(leagueData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching leagues:', error);
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [role, navigate]);

  const handleSelectLeague = (league: League) => {
    setSelectedLeague(league);
    setEditForm({
      name: league.name,
      seasonYear: league.seasonYear,
      'cap.floor': league.cap.floor,
      'cap.base': league.cap.base,
      'cap.firstApron': league.cap.firstApron,
      'cap.secondApron': league.cap.secondApron,
      'cap.max': league.cap.max,
      'cap.tradeLimit': league.cap.tradeLimit,
      'cap.penaltyStart': league.cap.penaltyStart,
      'cap.penaltyRatePerM': league.cap.penaltyRatePerM,
    });
  };

  const handleSave = async () => {
    if (!selectedLeague) return;

    try {
      setSaving(true);
      const leagueRef = doc(db, 'leagues', selectedLeague.id);

      await updateDoc(leagueRef, {
        name: editForm.name,
        seasonYear: editForm.seasonYear,
        'cap.floor': editForm['cap.floor'],
        'cap.base': editForm['cap.base'],
        'cap.firstApron': editForm['cap.firstApron'],
        'cap.secondApron': editForm['cap.secondApron'],
        'cap.max': editForm['cap.max'],
        'cap.tradeLimit': editForm['cap.tradeLimit'],
        'cap.penaltyStart': editForm['cap.penaltyStart'],
        'cap.penaltyRatePerM': editForm['cap.penaltyRatePerM'],
      });

      // Update local state
      setLeagues((prev) =>
        prev.map((league) =>
          league.id === selectedLeague.id
            ? {
                ...league,
                name: editForm.name,
                seasonYear: editForm.seasonYear,
                cap: {
                  floor: editForm['cap.floor'],
                  base: editForm['cap.base'],
                  firstApron: editForm['cap.firstApron'],
                  secondApron: editForm['cap.secondApron'],
                  max: editForm['cap.max'],
                  tradeLimit: editForm['cap.tradeLimit'],
                  penaltyStart: editForm['cap.penaltyStart'],
                  penaltyRatePerM: editForm['cap.penaltyRatePerM'],
                },
              }
            : league
        )
      );

      alert('League updated successfully!');
      setSaving(false);
    } catch (error) {
      console.error('Error updating league:', error);
      alert('Error updating league. Check console for details.');
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Manage Leagues</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* League Selection */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Select League</h2>
            <div className="space-y-2">
              {leagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => handleSelectLeague(league)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedLeague?.id === league.id
                      ? 'border-green-400 bg-green-400/10 text-white'
                      : 'border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  <div className="font-semibold">{league.name}</div>
                  <div className="text-sm text-gray-500">{league.seasonYear} Season</div>
                </button>
              ))}
            </div>
          </div>

          {/* Edit Form */}
          {selectedLeague ? (
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Edit League</h2>
              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    League Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Season Year
                  </label>
                  <input
                    type="number"
                    value={editForm.seasonYear}
                    onChange={(e) =>
                      setEditForm({ ...editForm, seasonYear: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-400"
                  />
                </div>

                {/* Salary Cap Settings */}
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-3">Salary Cap</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Floor
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.floor']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.floor': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Base Cap
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.base']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.base': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        First Apron
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.firstApron']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.firstApron': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Second Apron
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.secondApron']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.secondApron': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Hard Cap (Max)
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.max']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.max': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Trade Limit
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.tradeLimit']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.tradeLimit': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Penalty Start
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.penaltyStart']}
                        onChange={(e) =>
                          setEditForm({ ...editForm, 'cap.penaltyStart': parseInt(e.target.value) })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Penalty Rate ($/M)
                      </label>
                      <input
                        type="number"
                        value={editForm['cap.penaltyRatePerM']}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            'cap.penaltyRatePerM': parseInt(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 text-sm bg-[#0a0a0a] border border-gray-700 rounded text-white focus:outline-none focus:border-green-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full mt-6 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 flex items-center justify-center text-gray-500">
              Select a league to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

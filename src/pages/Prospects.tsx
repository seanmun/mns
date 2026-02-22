import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Prospect } from '../types';

export function Prospects() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');

  useEffect(() => {
    const fetchProspects = async () => {
      try {
        const { data, error } = await supabase
          .from('prospects')
          .select('*')
          .order('rank', { ascending: true });

        if (error) throw error;

        // Map snake_case to camelCase
        const prospectsData: Prospect[] = (data || []).map((row: any) => ({
          id: row.id,
          rank: row.rank,
          player: row.player,
          school: row.school,
          position: row.position,
          positionRank: row.position_rank,
          year: row.year,
          height: row.height,
          weight: row.weight,
          highSchool: row.high_school,
          draftProjection: row.draft_projection,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
        }));

        setProspects(prospectsData);
      } catch (error) {
        console.error('Error fetching prospects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProspects();
  }, []);

  const positions = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

  const filteredProspects = selectedPosition === 'ALL'
    ? prospects.slice(0, 25)
    : prospects.filter(p => p.position === selectedPosition).slice(0, 25);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent" />
            <div className="mt-4 text-gray-400">Loading prospects...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Prospects</h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-400 text-black">
                  2025 NBA Draft
                </span>
              </div>
              <p className="text-gray-400 mt-1">
                Top 25 college basketball prospects for the 2025 NBA Draft
              </p>
            </div>
            <button
              onClick={() => navigate(`/league/${leagueId}/mock-draft`)}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 border-2 border-green-400 text-green-400 rounded-lg font-semibold hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all"
            >
              Run Mock Draft
            </button>
          </div>
          {/* Mobile mock draft button */}
          <button
            onClick={() => navigate(`/league/${leagueId}/mock-draft`)}
            className="sm:hidden w-full mt-4 px-4 py-2.5 border-2 border-green-400 text-green-400 rounded-lg font-semibold hover:bg-green-400/10 transition-all"
          >
            Run Mock Draft Simulator
          </button>
        </div>

        {/* Position Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setSelectedPosition(pos)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  selectedPosition === pos
                    ? 'bg-green-400 text-black'
                    : 'bg-[#121212] text-gray-400 border border-gray-800 hover:border-green-400/50'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Showing {filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Prospects Table */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a] border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    School
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Height
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredProspects.map((prospect) => (
                  <tr
                    key={prospect.id}
                    className="hover:bg-[#1a1a1a] transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          prospect.rank <= 5
                            ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                            : prospect.rank <= 15
                            ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {prospect.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-white">
                        {prospect.player}
                      </div>
                      {prospect.draftProjection && (
                        <div className="text-xs text-gray-500 mt-1">
                          {prospect.draftProjection}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-300">
                        {prospect.school}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-400/20 text-blue-400 border border-blue-400/30">
                        {prospect.position}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-400">
                        {prospect.year}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-400">
                        {prospect.height}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-400">
                        {prospect.weight} lbs
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {filteredProspects.length === 0 && (
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-12 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-white mb-2">No prospects found</h3>
            <p className="text-sm text-gray-400">
              {selectedPosition === 'ALL'
                ? 'No prospects have been added yet.'
                : `No ${selectedPosition} prospects found.`}
            </p>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={`/league/${leagueId}/free-agents`}
            className="bg-[#121212] rounded-lg border border-gray-800 p-6 hover:border-pink-400/50 hover:bg-pink-400/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <img src="/icons/baseketball-icon.webp" alt="Free Agents" className="w-8 h-8 rounded-full" />
              <h3 className="text-lg font-bold text-white">Free Agent Pool</h3>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">
              Browse current available players
            </p>
          </a>

          <a
            href={`/league/${leagueId}/draft`}
            className="bg-[#121212] rounded-lg border border-gray-800 p-6 hover:border-purple-400/50 hover:bg-purple-400/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <img src="/icons/draft-icon.webp" alt="Draft" className="w-8 h-8 rounded-full" />
              <h3 className="text-lg font-bold text-white">Draft Results</h3>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">
              Review past draft picks
            </p>
          </a>

          <a
            href={`/league/${leagueId}/rookie-draft`}
            className="bg-[#121212] rounded-lg border border-gray-800 p-6 hover:border-blue-400/50 hover:bg-blue-400/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <img src="/icons/rookie-icon.webp" alt="Rookie Draft" className="w-8 h-8 rounded-full" />
              <h3 className="text-lg font-bold text-white">Rookie Draft</h3>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">
              View rookie draft results
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}

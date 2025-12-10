import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Team, Wager } from '../types';

interface ProposeWagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  seasonYear: number;
  myTeam: Team;
  allTeams: Team[];
  userEmail: string;
}

export function ProposeWagerModal({
  isOpen,
  onClose,
  leagueId,
  seasonYear,
  myTeam,
  allTeams,
  userEmail,
}: ProposeWagerModalProps) {
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filter out the user's team from opponent options
  const opponentOptions = allTeams.filter(team => team.id !== myTeam.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!selectedOpponentId) {
      setError('Please select an opponent');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!settlementDate) {
      setError('Please select a settlement date');
      return;
    }

    const selectedOpponent = allTeams.find(t => t.id === selectedOpponentId);
    if (!selectedOpponent) {
      setError('Invalid opponent selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = Date.now();
      const wagerData: Omit<Wager, 'id'> = {
        leagueId,
        seasonYear,
        proposerId: myTeam.id,
        proposerName: myTeam.name,
        opponentId: selectedOpponent.id,
        opponentName: selectedOpponent.name,
        description: description.trim(),
        amount: parseFloat(amount),
        settlementDate,
        status: 'pending',
        proposedAt: now,
        proposedBy: userEmail,
        createdAt: now,
        updatedAt: now,
      };

      await addDoc(collection(db, 'wagers'), wagerData);

      // Reset form
      setSelectedOpponentId('');
      setDescription('');
      setAmount('');
      setSettlementDate('');
      onClose();
    } catch (err) {
      console.error('Error creating wager:', err);
      setError('Failed to create wager. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#121212] rounded-lg border border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Propose Wager</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Opponent Selection */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Opponent
            </label>
            <select
              value={selectedOpponentId}
              onChange={(e) => setSelectedOpponentId(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              disabled={isSubmitting}
            >
              <option value="">Select opponent...</option>
              {opponentOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.abbrev})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Wager Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., My team will finish higher in the standings than yours"
              rows={4}
              maxLength={500}
              className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {description.length}/500 characters
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Amount ($)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Settlement Date */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Settlement Date
            </label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              When should this wager be settled?
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 text-gray-200 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-400 text-black rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

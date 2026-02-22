import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCanManageLeague } from '../hooks/useCanManageLeague';
import { useLeague } from '../contexts/LeagueContext';
import type { Portfolio } from '../types';

export function AdminPortfolio() {
  const canManage = useCanManageLeague();
  const { currentLeagueId } = useLeague();
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [usdInvested, setUsdInvested] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canManage) {
      navigate('/');
      return;
    }

    loadPortfolio();
  }, [canManage, currentLeagueId, navigate]);

  const loadPortfolio = async () => {
    if (!currentLeagueId) return;

    try {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', currentLeagueId)
        .single();

      if (!error && data) {
        const mapped: Portfolio = {
          id: data.id,
          leagueId: data.league_id,
          walletAddress: data.wallet_address,
          usdInvested: data.usd_invested,
          lastUpdated: data.last_updated,
          cachedEthBalance: data.cached_eth_balance,
          cachedUsdValue: data.cached_usd_value,
          cachedEthPrice: data.cached_eth_price,
        };
        setPortfolio(mapped);
        setWalletAddress(mapped.walletAddress);
        setUsdInvested(mapped.usdInvested.toString());
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentLeagueId) return;

    const invested = parseFloat(usdInvested);
    if (isNaN(invested) || invested < 0) {
      alert('Please enter a valid USD amount');
      return;
    }

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('Please enter a valid Ethereum wallet address');
      return;
    }

    setSaving(true);
    try {
      const portfolioData = {
        id: currentLeagueId,
        league_id: currentLeagueId,
        wallet_address: walletAddress.toLowerCase(),
        usd_invested: invested,
        last_updated: 0, // Will be set when first fetched
      };

      const { error } = await supabase
        .from('portfolios')
        .upsert(portfolioData);
      if (error) throw error;

      const mapped: Portfolio = {
        id: currentLeagueId,
        leagueId: currentLeagueId,
        walletAddress: walletAddress.toLowerCase(),
        usdInvested: invested,
        lastUpdated: 0,
      };
      setPortfolio(mapped);
      alert('Portfolio saved successfully!');
    } catch (error: any) {
      console.error('Error saving portfolio:', error);
      alert(`Failed to save: ${error.message}`);
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
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-white">Prize Pool Portfolio</h1>
          <p className="text-gray-400 mt-2">
            Configure the EVM wallet address and track prize pool investments
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
          <div className="space-y-6">
            {/* Wallet Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ethereum mainnet address (e.g., 0xe4e7a9ed3f7e3b32d16a495068fb2852dbdf8132)
              </p>
            </div>

            {/* USD Invested */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                USD Invested in Wallet
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={usdInvested}
                  onChange={(e) => setUsdInvested(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total USD amount that has been transferred to the wallet
              </p>
            </div>

            {/* Current Status */}
            {portfolio && (
              <div className="pt-4 border-t border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Current Configuration</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wallet:</span>
                    <span className="text-white font-mono">{portfolio.walletAddress.slice(0, 10)}...{portfolio.walletAddress.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">USD Invested:</span>
                    <span className="text-green-400 font-semibold">${portfolio.usdInvested.toFixed(2)}</span>
                  </div>
                  {portfolio.lastUpdated > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ETH Balance:</span>
                        <span className="text-white">{portfolio.cachedEthBalance?.toFixed(4)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Wallet Value:</span>
                        <span className="text-white">${portfolio.cachedUsdValue?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Updated:</span>
                        <span className="text-gray-500">{new Date(portfolio.lastUpdated).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-6 py-3 bg-green-400 text-black rounded-lg font-semibold hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Portfolio Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

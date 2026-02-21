/**
 * Blockchain utility functions for fetching ETH balance and price
 * Calls Supabase Edge Function to keep Alchemy API key secure
 */

import { supabase } from './supabase';

export interface WalletData {
  ethBalance: number;
  ethPrice: number;
  usdValue: number;
  timestamp: number;
}

/**
 * Fetch complete wallet data (balance + price + USD value)
 * Calls Supabase Edge Function which securely accesses Alchemy API
 */
export async function fetchWalletData(address: string): Promise<WalletData> {
  try {
    const { data, error } = await supabase.functions.invoke('get-portfolio-data', {
      body: { walletAddress: address },
    });

    if (error) throw error;
    return data as WalletData;
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    throw error;
  }
}

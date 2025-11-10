/**
 * Blockchain utility functions for fetching ETH balance and price
 * Now uses Firebase Function to keep Alchemy API key secure
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export interface WalletData {
  ethBalance: number;
  ethPrice: number;
  usdValue: number;
  timestamp: number;
}

/**
 * Fetch complete wallet data (balance + price + USD value)
 * Calls Firebase Function which securely accesses Alchemy API
 */
export async function fetchWalletData(address: string): Promise<WalletData> {
  try {
    const functions = getFunctions(app);
    const getPortfolioData = httpsCallable<
      { walletAddress: string },
      WalletData
    >(functions, 'getPortfolioData');

    const result = await getPortfolioData({ walletAddress: address });
    return result.data;
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    throw error;
  }
}

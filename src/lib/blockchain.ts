/**
 * Blockchain utility functions for fetching ETH balance and price
 * Uses Alchemy API for ETH balance and CoinGecko for ETH/USD price
 */

// Alchemy API (free tier) - you'll need to add your API key
const ALCHEMY_API_KEY = 'demo'; // Replace with actual key: https://www.alchemy.com/
const ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// CoinGecko API (free, no key needed)
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

export interface WalletData {
  ethBalance: number;
  ethPrice: number;
  usdValue: number;
  timestamp: number;
}

/**
 * Fetch ETH balance for a wallet address
 */
export async function fetchEthBalance(address: string): Promise<number> {
  try {
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // Convert from wei to ETH (hex string to decimal)
    const balanceWei = parseInt(data.result, 16);
    const balanceEth = balanceWei / 1e18;

    return balanceEth;
  } catch (error) {
    console.error('Error fetching ETH balance:', error);
    throw error;
  }
}

/**
 * Fetch current ETH/USD price from CoinGecko
 */
export async function fetchEthPrice(): Promise<number> {
  try {
    const response = await fetch(
      `${COINGECKO_URL}?ids=ethereum&vs_currencies=usd`
    );

    const data = await response.json();

    if (!data.ethereum?.usd) {
      throw new Error('Invalid price data');
    }

    return data.ethereum.usd;
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    throw error;
  }
}

/**
 * Fetch complete wallet data (balance + price + USD value)
 */
export async function fetchWalletData(address: string): Promise<WalletData> {
  const [ethBalance, ethPrice] = await Promise.all([
    fetchEthBalance(address),
    fetchEthPrice(),
  ]);

  return {
    ethBalance,
    ethPrice,
    usdValue: ethBalance * ethPrice,
    timestamp: Date.now(),
  };
}

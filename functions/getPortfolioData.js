const { onCall } = require('firebase-functions/v2/https');

/**
 * Cloud Function to fetch wallet data (ETH balance and price)
 * This keeps the Alchemy API key secure on the server
 */
exports.getPortfolioData = onCall(async (request) => {
  // Get the wallet address from the request
  const { walletAddress } = request.data;

  if (!walletAddress) {
    throw new Error('walletAddress is required');
  }

  // Get Alchemy API key from environment
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;

  if (!alchemyApiKey) {
    console.error('ALCHEMY_API_KEY not configured in functions environment');
    throw new Error('Server configuration error');
  }

  const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
  const coingeckoUrl = 'https://api.coingecko.com/api/v3/simple/price';

  try {
    // Fetch ETH balance from Alchemy
    const balanceResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
      }),
    });

    const balanceData = await balanceResponse.json();

    if (balanceData.error) {
      throw new Error(balanceData.error.message);
    }

    // Convert from wei to ETH (hex string to decimal)
    const balanceWei = parseInt(balanceData.result, 16);
    const ethBalance = balanceWei / 1e18;

    // Fetch ETH/USD price from CoinGecko (free, no API key needed)
    const priceResponse = await fetch(
      `${coingeckoUrl}?ids=ethereum&vs_currencies=usd`
    );

    const priceData = await priceResponse.json();

    if (!priceData.ethereum?.usd) {
      throw new Error('Invalid price data from CoinGecko');
    }

    const ethPrice = priceData.ethereum.usd;

    // Return wallet data
    return {
      ethBalance,
      ethPrice,
      usdValue: ethBalance * ethPrice,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    throw new Error(`Failed to fetch portfolio data: ${error.message}`);
  }
});

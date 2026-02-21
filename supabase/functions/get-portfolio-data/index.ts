import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "walletAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alchemyApiKey = Deno.env.get("ALCHEMY_API_KEY");
    if (!alchemyApiKey) {
      console.error("ALCHEMY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ETH balance from Alchemy
    const balanceResponse = await fetch(
      `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [walletAddress, "latest"],
        }),
      }
    );

    const balanceData = await balanceResponse.json();
    if (balanceData.error) {
      throw new Error(balanceData.error.message);
    }

    // Convert wei → ETH
    const balanceWei = parseInt(balanceData.result, 16);
    const ethBalance = balanceWei / 1e18;

    // Fetch ETH/USD price from CoinGecko (free, no key needed)
    const priceResponse = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const priceData = await priceResponse.json();

    if (!priceData.ethereum?.usd) {
      throw new Error("Invalid price data from CoinGecko");
    }

    const ethPrice = priceData.ethereum.usd;

    return new Response(
      JSON.stringify({
        ethBalance,
        ethPrice,
        usdValue: ethBalance * ethPrice,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching portfolio data:", error);
    return new Response(
      JSON.stringify({ error: `Failed to fetch portfolio data: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

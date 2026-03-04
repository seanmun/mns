import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Standard WNBA team abbreviations + aliases from various sources
const TEAM_MAP: Record<string, string> = {
  ATL: "ATL", CHI: "CHI", CON: "CON", DAL: "DAL", GSV: "GSV",
  IND: "IND", LVA: "LVA", LAS: "LAS", MIN: "MIN", NYL: "NYL",
  PHO: "PHO", SEA: "SEA", WAS: "WAS",
  // Common aliases
  NY: "NYL", LV: "LVA", LA: "LAS", GS: "GSV",
  CT: "CON", PHX: "PHO", CONN: "CON",
};

function normalizeTeam(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return TEAM_MAP[upper] || upper;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();
}

// Slim version of HHS player — only the fields we actually use
interface HHSSlim {
  _name: string;
  team_abbrev: string;
  salary: number;
  gp: number;
  pts_per_game: number;
  trb_per_game: number;
  ast_per_game: number;
  stl_per_game: number;
  blk_s_per_game: number;
  fg_pct: number;
  fg3m_pct: number;
  ft_pct: number;
}

async function scrapeHerHoopStats(): Promise<Map<string, HHSSlim>> {
  const url =
    "https://herhoopstats.com/salary-cap-sheet/wnba/players/salary_2026/stats_2025/";
  console.log("[HHS] Fetching:", url);
  const response = await fetch(url, {
    headers: { "User-Agent": "MNS-FantasyApp/1.0" },
  });

  if (!response.ok) {
    throw new Error(`HHS returned ${response.status}`);
  }

  const html = await response.text();
  console.log("[HHS] HTML length:", html.length);

  // Find the embedded JSON using indexOf
  const marker = "JSON.parse('";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    throw new Error(
      `Could not find JSON.parse in HHS page (length=${html.length})`
    );
  }
  const jsonStart = startIdx + marker.length;
  const jsonEnd = html.indexOf("')", jsonStart);
  if (jsonEnd === -1) {
    throw new Error("Could not find end of JSON.parse string");
  }
  const rawStr = html.substring(jsonStart, jsonEnd);
  console.log("[HHS] Raw JSON length:", rawStr.length);

  // Decode unicode escapes
  let jsonStr = rawStr;
  if (rawStr.includes("\\\\u00")) {
    jsonStr = rawStr.replace(/\\\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    jsonStr = jsonStr.replace(/\\\\/g, "\\");
  } else if (rawStr.includes("\\u00")) {
    jsonStr = rawStr.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  }
  console.log("[HHS] Decoded JSON length:", jsonStr.length);

  // Parse and extract only the fields we need
  let rawPlayers: Record<string, unknown>[];
  try {
    rawPlayers = JSON.parse(jsonStr);
  } catch (e) {
    console.log("[HHS] JSON.parse FAILED:", (e as Error).message);
    throw new Error(`JSON parse failed: ${(e as Error).message}`);
  }
  console.log("[HHS] Parsed player count:", rawPlayers.length);

  // Build slim Map — only keep fields we use
  const result = new Map<string, HHSSlim>();
  for (const p of rawPlayers) {
    const name =
      (p.full_name as string) ||
      `${(p.first_name as string) || ""} ${(p.last_name as string) || ""}`.trim();
    if (!name) continue;
    const key = normalizeName(name);
    result.set(key, {
      _name: name,
      team_abbrev: (p.team_abbrev as string) || "",
      salary: Number(p.cap_hit_salary_year) || 0,
      gp: Number(p.gp) || 0,
      pts_per_game: Number(p.pts_per_game) || 0,
      trb_per_game: Number(p.trb_per_game) || 0,
      ast_per_game: Number(p.ast_per_game) || 0,
      stl_per_game: Number(p.stl_per_game) || 0,
      blk_s_per_game: Number(p.blk_s_per_game) || 0,
      fg_pct: Number(p.fg_pct) || 0,
      fg3m_pct: Number(p.fg3m_pct) || 0,
      ft_pct: Number(p.ft_pct) || 0,
    });
  }
  console.log("[HHS] Map size:", result.size);
  return result;
}

interface BDLPlayer {
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  team: { abbreviation: string };
}

// Fetch with timeout helper
async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBallDontLie(): Promise<Map<string, BDLPlayer>> {
  const apiKey = Deno.env.get("BALLDONTLIE_API_KEY");
  if (!apiKey) {
    console.log("[BDL] No API key, skipping");
    return new Map();
  }

  console.log("[BDL] Starting fetch with API key");
  const result = new Map<string, BDLPlayer>();
  let cursor: number | null = null;
  let page = 0;

  do {
    const url = new URL(
      "https://api.balldontlie.io/wnba/v1/players/active"
    );
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", String(cursor));

    try {
      const res = await fetchWithTimeout(
        url.toString(),
        { headers: { Authorization: apiKey } },
        10_000 // 10 second timeout per page
      );
      if (!res.ok) {
        console.log(`[BDL] Page ${page} returned ${res.status}, stopping`);
        break;
      }

      const json = await res.json();
      for (const p of json.data || []) {
        const name = `${p.first_name} ${p.last_name}`.trim();
        const key = normalizeName(name);
        result.set(key, p);
      }
      page++;
      console.log(`[BDL] Page ${page}: ${json.data?.length || 0} players`);
      cursor = json.meta?.next_cursor || null;
    } catch (err) {
      console.log(`[BDL] Fetch error on page ${page}:`, (err as Error).message);
      break;
    }
  } while (cursor);

  console.log("[BDL] Total players:", result.size);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[MAIN] Starting scrape");

    // Scrape both sources in parallel
    const [hhsResult, bdlResult] = await Promise.allSettled([
      scrapeHerHoopStats(),
      fetchBallDontLie(),
    ]);

    console.log("[MAIN] Both sources settled");
    console.log("[MAIN] HHS:", hhsResult.status);
    console.log("[MAIN] BDL:", bdlResult.status);

    const hhs =
      hhsResult.status === "fulfilled" ? hhsResult.value : new Map();
    const bdl =
      bdlResult.status === "fulfilled" ? bdlResult.value : new Map();

    const hhsError =
      hhsResult.status === "rejected" ? hhsResult.reason?.message : null;
    const bdlError =
      bdlResult.status === "rejected" ? bdlResult.reason?.message : null;

    if (hhsError) console.log("[MAIN] HHS error:", hhsError);
    if (bdlError) console.log("[MAIN] BDL error:", bdlError);

    // Merge: HHS is primary (has salary + stats), BDL enriches (has position)
    const allNames = new Set([...hhs.keys(), ...bdl.keys()]);
    const merged: unknown[] = [];

    for (const key of allNames) {
      const h = hhs.get(key);
      const b = bdl.get(key);
      const sources: string[] = [];
      if (h) sources.push("herhoopstats");
      if (b) sources.push("balldontlie");

      const name = h?._name || (b ? `${b.first_name} ${b.last_name}` : key);
      const confidence =
        sources.length === 2
          ? 1.0
          : sources.includes("herhoopstats")
            ? 0.75
            : 0.5;

      merged.push({
        name,
        team: normalizeTeam(h?.team_abbrev || b?.team?.abbreviation || ""),
        position: b?.position || "",
        salary: h?.salary || 0,
        height: b?.height || null,
        stats: h
          ? {
              gamesPlayed: h.gp,
              pointsPerGame: h.pts_per_game,
              reboundsPerGame: h.trb_per_game,
              assistsPerGame: h.ast_per_game,
              stealsPerGame: h.stl_per_game,
              blocksPerGame: h.blk_s_per_game,
              fgPercent: h.fg_pct,
              threePercent: h.fg3m_pct,
              ftPercent: h.ft_pct,
            }
          : null,
        sources,
        confidence,
        slug: slugify(name),
      });
    }

    // Sort by salary descending
    merged.sort(
      (a: any, b: any) => (b.salary || 0) - (a.salary || 0)
    );

    console.log("[MAIN] Merged count:", merged.length, "- sending response");

    return new Response(
      JSON.stringify({
        players: merged,
        totalCount: merged.length,
        sourceStatus: {
          herhoopstats: hhsResult.status === "fulfilled" ? "ok" : "failed",
          balldontlie: bdlResult.status === "fulfilled" ? "ok" : "failed",
          hhsError,
          bdlError,
        },
        scrapedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.log("[MAIN] CATCH:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: `Scrape failed: ${(error as Error).message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

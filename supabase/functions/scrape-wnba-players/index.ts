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

interface HHSPlayer {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team_abbrev?: string;
  cap_hit_salary_year?: number | string;
  gp?: number | string;
  pts_per_game?: number | string;
  trb_per_game?: number | string;
  ast_per_game?: number | string;
  stl_per_game?: number | string;
  blk_s_per_game?: number | string;
  fg_pct?: number | string;
  fg3m_pct?: number | string;
  ft_pct?: number | string;
  signed_as?: string;
  [key: string]: unknown;
}

async function scrapeHerHoopStats(): Promise<Map<string, HHSPlayer & { _name: string }>> {
  const url =
    "https://herhoopstats.com/salary-cap-sheet/wnba/players/salary_2025/stats_2024/";
  const response = await fetch(url, {
    headers: { "User-Agent": "MNS-FantasyApp/1.0" },
  });

  if (!response.ok) {
    throw new Error(`HHS returned ${response.status}`);
  }

  const html = await response.text();

  // Find the embedded JSON using indexOf (more robust than regex for huge strings)
  const marker = "JSON.parse('";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    throw new Error(
      `Could not find JSON.parse in HHS page (length=${html.length}, ` +
      `has 'data'=${html.includes('data =')}, has 'parse'=${html.includes('JSON.parse')})`
    );
  }
  const jsonStart = startIdx + marker.length;
  // Find the closing ') — the JSON string uses \u0027 for apostrophes, so no raw ' inside
  const jsonEnd = html.indexOf("')", jsonStart);
  if (jsonEnd === -1) {
    throw new Error("Could not find end of JSON.parse string");
  }
  const rawStr = html.substring(jsonStart, jsonEnd);

  // HHS embeds data as JS string literal with escaped unicode: \\u0022 for ", \\u0027 for '
  // Detect escaping style and decode accordingly
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
  const players: HHSPlayer[] = JSON.parse(jsonStr);

  const result = new Map<string, HHSPlayer & { _name: string }>();
  for (const p of players) {
    const name =
      p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
    if (!name) continue;
    const key = normalizeName(name);
    result.set(key, { ...p, _name: name });
  }
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

async function fetchBallDontLie(): Promise<Map<string, BDLPlayer>> {
  const apiKey = Deno.env.get("BALLDONTLIE_API_KEY");
  if (!apiKey) return new Map();

  const result = new Map<string, BDLPlayer>();
  let cursor: number | null = null;

  do {
    const url = new URL(
      "https://api.balldontlie.io/wnba/v1/players/active"
    );
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", String(cursor));

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) break;

    const json = await res.json();
    for (const p of json.data || []) {
      const name = `${p.first_name} ${p.last_name}`.trim();
      const key = normalizeName(name);
      result.set(key, p);
    }
    cursor = json.meta?.next_cursor || null;
  } while (cursor);

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Scrape both sources in parallel
    const [hhsResult, bdlResult] = await Promise.allSettled([
      scrapeHerHoopStats(),
      fetchBallDontLie(),
    ]);

    const hhs =
      hhsResult.status === "fulfilled" ? hhsResult.value : new Map();
    const bdl =
      bdlResult.status === "fulfilled" ? bdlResult.value : new Map();

    const hhsError =
      hhsResult.status === "rejected" ? hhsResult.reason?.message : null;
    const bdlError =
      bdlResult.status === "rejected" ? bdlResult.reason?.message : null;

    if (hhsError) console.error("HHS scrape failed:", hhsError);
    if (bdlError) console.error("BDL fetch failed:", bdlError);

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
        salary: Number(h?.cap_hit_salary_year) || 0,
        height: b?.height || null,
        stats: h
          ? {
              gamesPlayed: Number(h.gp) || 0,
              pointsPerGame: Number(h.pts_per_game) || 0,
              reboundsPerGame: Number(h.trb_per_game) || 0,
              assistsPerGame: Number(h.ast_per_game) || 0,
              stealsPerGame: Number(h.stl_per_game) || 0,
              blocksPerGame: Number(h.blk_s_per_game) || 0,
              fgPercent: Number(h.fg_pct) || 0,
              threePercent: Number(h.fg3m_pct) || 0,
              ftPercent: Number(h.ft_pct) || 0,
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
    console.error("WNBA scrape error:", error);
    return new Response(
      JSON.stringify({ error: `Scrape failed: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

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

// ============================================================
// HHS Team Pages — pulls full roster per team (includes rookies
// without 2025 stats that the main salary cap page filters out)
// ============================================================
interface TeamPagePlayer {
  _name: string;
  team_abbrev: string;
  salary: number;
  status: string | null; // UFA, RFA, Reserved, etc.
}

// Slug → standard team abbreviation (matches TEAM_MAP canonical values)
const SLUG_TO_ABBREV: Record<string, string> = {
  "atlanta-dream": "ATL",
  "chicago-sky": "CHI",
  "connecticut-sun": "CON",
  "dallas-wings": "DAL",
  "golden-state-valkyries": "GSV",
  "indiana-fever": "IND",
  "las-vegas-aces": "LVA",
  "los-angeles-sparks": "LAS",
  "minnesota-lynx": "MIN",
  "new-york-liberty": "NYL",
  "phoenix-mercury": "PHO",
  "portland-fire": "POR",
  "seattle-storm": "SEA",
  "toronto-tempo": "TOR",
  "washington-mystics": "WAS",
};

// Extract base slug (before UUID) from a URL-encoded team value like
// "dallas-wings-11eaecc7-3583-13fc-b611-2362f5011b0b"
function baseSlug(value: string): string {
  // UUID is always 8-4-4-4-12; strip it from the end
  return value.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "");
}

// Discovers team slugs AND returns the seed page HTML so we can parse it
// without refetching (avoids HHS rate-limiting on the seed team).
async function discoverTeamSlugs(year: number): Promise<{ slugs: string[]; seedSlug: string; seedHtml: string }> {
  const seedSlug = "dallas-wings-11eaecc7-3583-13fc-b611-2362f5011b0b";
  const seedUrl = `https://herhoopstats.com/salary-cap-sheet/wnba/team/${year}/${seedSlug}/`;
  console.log("[TEAMS] Discovering team slugs from:", seedUrl);

  const res = await fetch(seedUrl, {
    headers: { "User-Agent": "MNS-FantasyApp/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Failed to discover team slugs: HTTP ${res.status}`);
  }

  const seedHtml = await res.text();
  // Match dropdown options: <option value="slug-uuid">Team Name</option>
  const optionRe = /<option\s+value="([a-z-]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})">/g;
  const slugs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = optionRe.exec(seedHtml)) !== null) {
    slugs.push(m[1]);
  }

  // Dedupe (dropdown may appear multiple times in HTML)
  const unique = [...new Set(slugs)];
  console.log("[TEAMS] Discovered", unique.length, "teams");
  return { slugs: unique, seedSlug, seedHtml };
}

function parseTeamPage(html: string, teamAbbrev: string): TeamPagePlayer[] {
  const players: TeamPagePlayer[] = [];

  // Each player row starts with their name cell; we then look ahead for the
  // first salary_cap_hit cell (which is the requested year's salary)
  // and an optional salary_unsigned_status cell for free-agent designation.
  const rowRe = /<td\s+sorttable_customkey="([^"]+)"\s+class="roster_stat_cell table_cell_left salary_player_name">([\s\S]*?)(?=<td[^>]*salary_player_name|<\/tbody>)/g;

  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html)) !== null) {
    const name = match[1].trim();
    const rowHtml = match[2];

    // First salary_cap_hit cell after the name = the requested year salary
    const salaryMatch = rowHtml.match(
      /<td[^>]*sorttable_customkey="(\d+)"[^>]*class="roster_stat_cell table_cell_right salary_cap_hit[^"]*"/
    );
    const salary = salaryMatch ? parseInt(salaryMatch[1], 10) : 0;

    // Status cell (UFA, RFA, etc.) — title attribute contains the human label
    const statusMatch = rowHtml.match(
      /class="roster_stat_cell table_cell_right salary_unsigned_status"[^>]*title="([^"]+)"/
    );
    const status = statusMatch ? statusMatch[1] : null;

    players.push({
      _name: name,
      team_abbrev: teamAbbrev,
      salary,
      status,
    });
  }

  return players;
}

async function scrapeHerHoopStatsTeams(year: number): Promise<Map<string, TeamPagePlayer>> {
  const result = new Map<string, TeamPagePlayer>();

  let discovery: { slugs: string[]; seedSlug: string; seedHtml: string };
  try {
    discovery = await discoverTeamSlugs(year);
  } catch (err) {
    console.log("[TEAMS] Discovery failed:", (err as Error).message);
    throw err;
  }
  const { slugs, seedSlug, seedHtml } = discovery;

  // Parse the seed team's HTML directly (already fetched during discovery)
  // — avoids hitting HHS twice in quick succession for the seed team.
  const seedBase = baseSlug(seedSlug);
  const seedAbbrev = SLUG_TO_ABBREV[seedBase] || seedBase.toUpperCase();
  const seedPlayers = parseTeamPage(seedHtml, seedAbbrev);
  console.log(`[TEAMS] ${seedBase} (from seed): ${seedPlayers.length} players`);
  for (const p of seedPlayers) {
    result.set(normalizeName(p._name), p);
  }

  // Fetch the remaining team pages sequentially with a small delay
  for (const slug of slugs) {
    if (slug === seedSlug) continue; // already handled via seed HTML
    const baseName = baseSlug(slug);
    const teamAbbrev = SLUG_TO_ABBREV[baseName] || baseName.toUpperCase();
    const url = `https://herhoopstats.com/salary-cap-sheet/wnba/team/${year}/${slug}/`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "MNS-FantasyApp/1.0" },
      });
      if (!res.ok) {
        console.log(`[TEAMS] ${baseName}: HTTP ${res.status}, skipping`);
        continue;
      }
      const html = await res.text();
      const players = parseTeamPage(html, teamAbbrev);
      console.log(`[TEAMS] ${baseName}: ${players.length} players`);

      for (const p of players) {
        result.set(normalizeName(p._name), p);
      }
    } catch (err) {
      console.log(`[TEAMS] ${baseName}: error -`, (err as Error).message);
    }

    // Small delay between team requests
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("[TEAMS] Total unique players:", result.size);
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

    // Year for HHS team pages — defaults to current year, override via ?year=2026
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // Scrape three sources in parallel:
    //   - HHS all-players JSON (rich stats, but excludes rookies w/ no 2025 stats)
    //   - HHS team pages (every contracted player including rookies; salary only)
    //   - BDL (position, height enrichment)
    const [hhsResult, hhsTeamsResult, bdlResult] = await Promise.allSettled([
      scrapeHerHoopStats(),
      scrapeHerHoopStatsTeams(year),
      fetchBallDontLie(),
    ]);

    console.log("[MAIN] All sources settled");
    console.log("[MAIN] HHS json:", hhsResult.status);
    console.log("[MAIN] HHS teams:", hhsTeamsResult.status);
    console.log("[MAIN] BDL:", bdlResult.status);

    const hhs =
      hhsResult.status === "fulfilled" ? hhsResult.value : new Map<string, HHSSlim>();
    const hhsTeams =
      hhsTeamsResult.status === "fulfilled" ? hhsTeamsResult.value : new Map<string, TeamPagePlayer>();
    const bdl =
      bdlResult.status === "fulfilled" ? bdlResult.value : new Map<string, BDLPlayer>();

    const hhsError =
      hhsResult.status === "rejected" ? hhsResult.reason?.message : null;
    const hhsTeamsError =
      hhsTeamsResult.status === "rejected" ? hhsTeamsResult.reason?.message : null;
    const bdlError =
      bdlResult.status === "rejected" ? bdlResult.reason?.message : null;

    if (hhsError) console.log("[MAIN] HHS json error:", hhsError);
    if (hhsTeamsError) console.log("[MAIN] HHS teams error:", hhsTeamsError);
    if (bdlError) console.log("[MAIN] BDL error:", bdlError);

    // Merge: union all names from all 3 sources.
    //   - team page → salary, team, status (definitive contract data)
    //   - JSON → detailed stats (only available for players with 2025 stats)
    //   - BDL → position, height
    const allNames = new Set([...hhs.keys(), ...hhsTeams.keys(), ...bdl.keys()]);
    const merged: unknown[] = [];

    for (const key of allNames) {
      const h = hhs.get(key);
      const t = hhsTeams.get(key);
      const b = bdl.get(key);
      const sources: string[] = [];
      if (h) sources.push("herhoopstats");
      if (t) sources.push("herhoopstats-team");
      if (b) sources.push("balldontlie");

      const name =
        t?._name ||
        h?._name ||
        (b ? `${b.first_name} ${b.last_name}` : key);

      // Confidence: full data from all 3 = 1.0; HHS only = 0.75; BDL only = 0.5
      const confidence =
        sources.length === 3
          ? 1.0
          : sources.includes("herhoopstats") || sources.includes("herhoopstats-team")
            ? 0.75
            : 0.5;

      merged.push({
        name,
        team: normalizeTeam(
          t?.team_abbrev || h?.team_abbrev || b?.team?.abbreviation || ""
        ),
        position: b?.position || "",
        // Prefer team-page salary (most current) over JSON salary
        salary: t?.salary || h?.salary || 0,
        status: t?.status || null,
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
          herhoopstatsTeams: hhsTeamsResult.status === "fulfilled" ? "ok" : "failed",
          balldontlie: bdlResult.status === "fulfilled" ? "ok" : "failed",
          hhsError,
          hhsTeamsError,
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

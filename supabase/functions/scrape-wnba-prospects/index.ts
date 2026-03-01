import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ScrapedProspect {
  rank: number;
  name: string;
  position: string;
  school: string;
  height: string;
  age: number | null;
  stats: {
    pointsPerGame: number;
    reboundsPerGame: number;
    assistsPerGame: number;
    blocksPerGame: number;
    stealsPerGame: number;
  } | null;
  slug: string;
  draftYear: number;
}

async function scrapeTankathon(): Promise<ScrapedProspect[]> {
  const url = "https://www.tankathon.com/wnba/big_board";
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Tankathon returned ${response.status}`);
  }

  const html = await response.text();
  console.log(`Tankathon HTML length: ${html.length}`);

  // Extract the draft year from the page title/heading
  const yearMatch = html.match(/(\d{4})\s*WNBA\s*Draft/i);
  const draftYear = yearMatch ? parseInt(yearMatch[1]) : 2026;
  console.log(`Draft year: ${draftYear}`);

  const prospects: ScrapedProspect[] = [];

  // Strategy 1: Look for structured data in script tags (JSON)
  const jsonPatterns = [
    /(?:prospects|players|big_board)\s*[=:]\s*(\[[\s\S]*?\]);/,
    /JSON\.parse\(['"](\[.*?)['"]\)/,
  ];

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match) {
      console.log("Found JSON data pattern");
      try {
        let jsonStr = match[1];
        // Handle unicode escapes if present
        if (jsonStr.includes("\\u00")) {
          jsonStr = jsonStr.replace(/\\\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        }
        const data = JSON.parse(jsonStr);
        console.log(`Parsed ${data.length} prospects from JSON`);
        for (const p of data) {
          const name = p.name || p.player || `${p.first_name || ""} ${p.last_name || ""}`.trim();
          if (!name) continue;
          prospects.push({
            rank: Number(p.rank || p.overall_rank) || prospects.length + 1,
            name,
            position: p.position || p.pos || "",
            school: p.school || p.team || "",
            height: p.height || "",
            age: p.age ? Number(p.age) : null,
            stats: null,
            slug: slugify(name),
            draftYear,
          });
        }
        if (prospects.length > 0) return prospects;
      } catch (e) {
        console.log("JSON parse failed:", e.message);
      }
    }
  }

  // Strategy 2: Parse from HTML text patterns
  // Tankathon renders prospect rows with a consistent text pattern:
  // "1 Awa Fam C | Valencia 6'4" 19.8 yrs pts 6.7 reb 4.2 ast 1.2 blk 0.3 stl 1.3"
  console.log("Trying HTML text pattern extraction");

  // Match prospect entries: rank, name, position | school, height, age
  const prospectRegex =
    /(?:^|\n)\s*(\d{1,2})\s+([A-Z][a-zA-Z'\u00C0-\u024F\-]+(?:\s+[A-Z][a-zA-Z'\u00C0-\u024F\-]+)+)\s+((?:PG|SG|SF|PF|C)(?:\/(?:PG|SG|SF|PF|C))?)\s*\|\s*([^0-9\n]+?)\s+(\d+['']\d+[""]?)\s+([\d.]+)\s*yrs?\s+pts\s+([\d.]+)\s+reb\s+([\d.]+)\s+ast\s+([\d.]+)/gm;

  let match;
  while ((match = prospectRegex.exec(html)) !== null) {
    prospects.push({
      rank: parseInt(match[1]),
      name: match[2].trim(),
      position: match[3].trim(),
      school: match[4].trim(),
      height: match[5].replace(/['']/g, "'").replace(/[""]/g, '"'),
      age: parseFloat(match[6]) || null,
      stats: {
        pointsPerGame: parseFloat(match[7]) || 0,
        reboundsPerGame: parseFloat(match[8]) || 0,
        assistsPerGame: parseFloat(match[9]) || 0,
        blocksPerGame: 0,
        stealsPerGame: 0,
      },
      slug: slugify(match[2].trim()),
      draftYear,
    });
  }

  if (prospects.length > 0) {
    console.log(`Parsed ${prospects.length} prospects from HTML text patterns`);
    return prospects;
  }

  // Strategy 3: Look for HTML elements with class patterns
  console.log("Trying HTML element extraction");

  // Try to find player name elements and extract surrounding data
  const nameRegex =
    /class="[^"]*(?:player|prospect|name)[^"]*"[^>]*>([^<]+)</gi;
  const names: string[] = [];
  while ((match = nameRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (name.length > 3 && name.includes(" ")) {
      names.push(name);
    }
  }

  if (names.length > 0) {
    console.log(`Found ${names.length} names from HTML elements`);
    for (let i = 0; i < names.length; i++) {
      prospects.push({
        rank: i + 1,
        name: names[i],
        position: "",
        school: "",
        height: "",
        age: null,
        stats: null,
        slug: slugify(names[i]),
        draftYear,
      });
    }
    return prospects;
  }

  // Log diagnostic info if nothing worked
  console.log("DIAGNOSTIC - first 2000 chars:", html.substring(0, 2000));
  console.log(
    "DIAGNOSTIC - contains 'Awa Fam':",
    html.includes("Awa Fam")
  );
  console.log(
    "DIAGNOSTIC - contains 'Azzi Fudd':",
    html.includes("Azzi Fudd")
  );

  throw new Error(
    `Could not extract prospects from Tankathon (html length=${html.length})`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const prospects = await scrapeTankathon();

    // Sort by rank
    prospects.sort((a, b) => a.rank - b.rank);

    return new Response(
      JSON.stringify({
        prospects,
        totalCount: prospects.length,
        source: "tankathon",
        scrapedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("WNBA prospect scrape error:", error);
    return new Response(
      JSON.stringify({ error: `Scrape failed: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

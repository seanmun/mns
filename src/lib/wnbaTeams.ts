/** WNBA full team name → standard 3-letter abbreviation */
export const WNBA_TEAM_ABBREV: Record<string, string> = {
  'Atlanta Dream': 'ATL',
  'Chicago Sky': 'CHI',
  'Connecticut Sun': 'CON',
  'Dallas Wings': 'DAL',
  'Golden State Valkyries': 'GSV',
  'Indiana Fever': 'IND',
  'Las Vegas Aces': 'LVA',
  'Los Angeles Sparks': 'LAS',
  'Minnesota Lynx': 'MIN',
  'New York Liberty': 'NYL',
  'Phoenix Mercury': 'PHO',
  'Seattle Storm': 'SEA',
  'Washington Mystics': 'WAS',
};

/** Aliases from various data sources that map to our standard abbreviations */
export const WNBA_ABBREV_ALIASES: Record<string, string> = {
  'NY': 'NYL',
  'LV': 'LVA',
  'LA': 'LAS',
  'GS': 'GSV',
  'CT': 'CON',
  'PHX': 'PHO',
  'CONN': 'CON',
  'VEGAS': 'LVA',
};

export const WNBA_ABBREV_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(WNBA_TEAM_ABBREV).map(([name, abbrev]) => [abbrev, name])
);

export function wnbaToAbbrev(raw: string): string {
  const trimmed = raw.trim();
  // Check full name first
  if (WNBA_TEAM_ABBREV[trimmed]) return WNBA_TEAM_ABBREV[trimmed];
  // Check if it's already a standard abbreviation
  const upper = trimmed.toUpperCase();
  if (WNBA_ABBREV_TO_NAME[upper]) return upper;
  // Check aliases
  return WNBA_ABBREV_ALIASES[upper] || trimmed;
}

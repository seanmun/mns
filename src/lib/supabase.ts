import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'mns-auth-token',
    // Increase lock timeout to prevent "lock timed out" errors
    // when multiple tabs compete for the auth token lock.
    // The underlying auth-js supports this but supabase-js types don't expose it.
    ...({ lockAcquireTimeout: 30000 } as any),
  },
});

/**
 * Fetch all rows from a table, paginating past the 1000-row API limit.
 * Usage: const rows = await fetchAllRows('players', '*');
 */
export async function fetchAllRows(
  table: string,
  select = '*',
  filter?: (query: any) => any
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

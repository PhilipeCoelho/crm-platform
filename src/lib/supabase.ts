import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing! Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
    }
});

/**
 * Safely fetches all rows across pages for queries that can exceed Supabase PostgREST's default 1000 limit.
 * Automatically chunks requests in pages of 1000 using range(from, to).
 *
 * @param queryBuilder Function receiving (from, to) range indices and returning a Supabase query builder.
 * @param pageSize Number of records per chunk (default 1000).
 */
export async function fetchAllRows<T = any>(
    queryBuilder: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
    pageSize = 1000
): Promise<{ data: T[]; error: any }> {
    let page = 0;
    let allData: T[] = [];
    while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await queryBuilder(from, to);
        if (error) {
            console.error('[fetchAllRows] Fetch error:', error);
            return { data: allData, error };
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        page++;
    }
    return { data: allData, error: null };
}

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { count: dealsCount } = await supabase.from('deals').select('*', { count: 'exact', head: true });
    const { count: analyticsCount } = await supabase.from('deal_analytics').select('*', { count: 'exact', head: true });
    console.log(`Deals: ${dealsCount}, Analytics: ${analyticsCount}`);
}

check();

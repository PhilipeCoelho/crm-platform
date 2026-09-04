import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('deals').select('status');
  const counts = {};
  if (data) {
    data.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
  }
  console.log('Deals Status Counts:', counts);
}
run();

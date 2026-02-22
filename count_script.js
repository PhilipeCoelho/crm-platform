const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { count: dealsTotal } = await supabase.from('deals').select('*', { count: 'exact', head: true });
  const { count: analyticsTotal } = await supabase.from('deal_analytics').select('*', { count: 'exact', head: true });
  const { count: dealsOpen } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const { count: analyticsOpen } = await supabase.from('deal_analytics').select('*', { count: 'exact', head: true }).eq('status_final', 'open');

  console.log(JSON.stringify({
    dealsTotal,
    analyticsTotal,
    dealsOpen,
    analyticsOpen
  }));
}

run();

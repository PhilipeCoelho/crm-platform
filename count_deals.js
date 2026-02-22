import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Script starting...");
  const { count: dealsTotal } = await supabase.from('deals').select('*', { count: 'exact', head: true });
  const { count: analyticsTotal } = await supabase.from('deal_analytics').select('*', { count: 'exact', head: true });
  console.log(`Deals: ${dealsTotal}, Analytics: ${analyticsTotal}`);
}

run().catch(console.error);

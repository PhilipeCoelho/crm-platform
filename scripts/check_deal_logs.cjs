const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking deal_logs table entries...");
  const { data, error } = await supabase
    .from('deal_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
  } else {
    console.log(`Found ${data.length} entries in deal_logs:`);
    console.log(JSON.stringify(data, null, 2));
  }
}
check();

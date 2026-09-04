const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking meta_integration_logs...");
  const { data: logs, error: err } = await supabase
    .from('meta_integration_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (err) {
    console.error("Error fetching logs:", err);
    process.exit(1);
  }
  
  console.log(`Found ${logs ? logs.length : 0} logs.`);
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      console.log(`[${log.created_at}] Event: ${log.event_type} | Status: ${log.status} | Msg: ${log.message}`);
    });
  } else {
    console.log("No integration logs found.");
  }
}

run();

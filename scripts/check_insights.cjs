const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking insights_comerciais table entries...");
  const { data, error } = await supabase
    .from('insights_comerciais')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching insights:", error);
  } else {
    console.log(`Found ${data.length} entries:`);
    console.log(JSON.stringify(data, null, 2));
  }
}
check();

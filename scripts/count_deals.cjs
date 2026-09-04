const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Script starting...");
  try {
    console.log("Fetching dealsTotal...");
    const { count: dealsTotal, error: err1 } = await supabase.from('deals').select('*', { count: 'exact', head: true });
    if (err1) throw err1;
    
    console.log("Fetching analyticsTotal...");
    const { count: analyticsTotal, error: err2 } = await supabase.from('deal_analytics').select('*', { count: 'exact', head: true });
    if (err2) throw err2;
    
    console.log("Done.");
    console.log(JSON.stringify({
      dealsTotal,
      analyticsTotal
    }));
  } catch (e) {
    console.error("ERROR:", e);
  }
}

run();

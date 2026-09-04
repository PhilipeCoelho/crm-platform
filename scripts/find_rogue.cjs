const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting...");
  const { data: deals, error } = await supabase.from('deals').select('id, status, title, pipeline_id');
  if (error) {
    console.error("Error fetching deals:", error);
    return;
  }
  console.log("Total deals in table:", deals.length);
  
  const counts = {};
  deals.forEach(d => {
    counts[d.status] = (counts[d.status] || 0) + 1;
  });
  console.log("Counts by status:", JSON.stringify(counts));

  const noPipeline = deals.filter(d => !d.pipeline_id);
  console.log("Deals without pipeline_id:", noPipeline.length);
  if (noPipeline.length > 0) {
     console.log("Rogue deals sample:", JSON.stringify(noPipeline.slice(0, 5)));
  }

  const wonDeals = deals.filter(d => d.status === 'won');
  console.log("Won deals:", JSON.stringify(wonDeals));
}
run();

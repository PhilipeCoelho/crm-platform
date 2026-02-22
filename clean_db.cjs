const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Cleaning database...");
  
  // Find non-active deals
  const { data: unwanted, error: e0 } = await supabase.from('deals').select('id, title, status').not('status', 'in', '("active", "open")');
  if (e0) {
      console.error(e0);
      return;
  }
  console.log("Deals to be ignored/removed:", unwanted);

  if (unwanted && unwanted.length > 0) {
    const ids = unwanted.map(d => d.id);
    const { error: err1 } = await supabase.from('deals').delete().in('id', ids);
    if (err1) console.error("Error deleting deals:", err1);
    else console.log("Deals deleted successfully.");
  }

  // Refresh analytics
  console.log("Refreshing deal_analytics...");
  // Clear all
  const { error: err2 } = await supabase.from('deal_analytics').delete().neq('deal_id', '00000000-0000-0000-0000-000000000000');
  if (err2) console.error("Error clearing analytics:", err2);

  const { data: deals } = await supabase.from('deals').select('id, created_at, status, stage_id');
  const { data: stages } = await supabase.from('stages').select('id, name');

  const analyticsEntries = (deals || []).map(d => ({
    deal_id: d.id,
    created_at: d.created_at,
    status_final: 'open',
    stage_atual: stages?.find(s => s.id === d.stage_id)?.name || 'Prospect',
    updated_at: new Date().toISOString()
  }));

  if (analyticsEntries.length > 0) {
    const { error: err3 } = await supabase.from('deal_analytics').insert(analyticsEntries);
    if (err3) console.error("Error repopulating analytics:", err3);
    else console.log(`Repopulated with ${analyticsEntries.length} active deals.`);
  }
}

run().catch(console.error);

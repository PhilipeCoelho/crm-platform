const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { count: dealsTotal } = await supabase.from('deals').select('*', { count: 'exact', head: true });
    
    const { data: analyticsData, error } = await supabase.from('deal_analytics').select('deal_id');
    if (error) throw error;
    
    const totalRows = analyticsData.length;
    const uniqueDeals = new Set(analyticsData.map(d => d.deal_id)).size;

    console.log(JSON.stringify({
      dealsTableCount: dealsTotal,
      analyticsTotalRows: totalRows,
      analyticsUniqueDeals: uniqueDeals
    }));
  } catch (e) {
    console.error(e);
  }
}

run();

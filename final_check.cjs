const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: deals, error: e1 } = await supabase.from('deals').select('id, status, pipeline_id, title');
    if (e1) throw e1;
    
    const { data: analytics, error: e2 } = await supabase.from('deal_analytics').select('deal_id, status_final, closed_at');
    if (e2) throw e2;

    const summary = {
      dealsTable: {
        total: deals.length,
        won: deals.filter(d => d.status === 'won').length,
        active: deals.filter(d => d.status === 'active' || d.status === 'open').length,
        lost: deals.filter(d => d.status === 'lost').length,
        noPipeline: deals.filter(d => !d.pipeline_id).length
      },
      analyticsTable: {
        total: analytics.length,
        won: analytics.filter(a => a.status_final === 'won').length,
        open: analytics.filter(a => a.status_final === 'open').length,
        lost: analytics.filter(a => a.status_final === 'lost').length,
        missingClosedAt: analytics.filter(a => a.status_final === 'won' && !a.closed_at).length
      }
    };

    console.log(JSON.stringify(summary, null, 2));
    
    // Find matching issues
    const wonDealIds = deals.filter(d => d.status === 'won').map(d => d.id);
    const analyticsWonStatus = analytics.filter(a => wonDealIds.includes(a.deal_id));
    console.log("Analytics entry for Won Deals:", JSON.stringify(analyticsWonStatus));

  } catch (e) {
    console.error(e);
  }
}

run();

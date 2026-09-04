const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: deals, error } = await supabase.from('deals').select('id, pipeline_id, status');
    if (error) throw error;
    
    const pipelineCounts = {};
    deals.forEach(d => {
      const pid = d.pipeline_id || 'no-pipeline';
      pipelineCounts[pid] = (pipelineCounts[pid] || 0) + 1;
    });

    console.log(JSON.stringify({
      totalDealsInTable: deals.length,
      pipelineCounts
    }));
  } catch (e) {
    console.error(e);
  }
}

run();

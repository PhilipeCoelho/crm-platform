const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting SQL reset...");
  
  // 1. Delete deals that are not active
  const { data: deleted, error: err1 } = await supabase.rpc('execute_sql', { 
    sql_query: "DELETE FROM public.deals WHERE status NOT IN ('active', 'open');"
  });
  
  // 2. Clear analytics
  await supabase.rpc('execute_sql', { sql_query: "DELETE FROM public.deal_analytics;" });

  // 3. Re-populate
  await supabase.rpc('execute_sql', { 
    sql_query: `
      INSERT INTO public.deal_analytics (deal_id, created_at, status_final, stage_atual, updated_at)
      SELECT d.id, d.created_at, 'open', s.name, NOW()
      FROM public.deals d
      LEFT JOIN public.stages s ON d.stage_id = s.id
      ON CONFLICT (deal_id) DO NOTHING;
    `
  });

  console.log("Reset complete.");
}
run();

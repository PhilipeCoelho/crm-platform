const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking brevo_sync_status values in database...");
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, email, brevo_sync_status')
      .limit(10);

    if (error) {
      console.error(error);
    } else {
      console.log("Sample records:", data);
      
      const { data: counts, error: countErr } = await supabase
        .from('contacts')
        .select('brevo_sync_status');
      
      if (!countErr && counts) {
        const stats = {};
        counts.forEach(c => {
          const val = c.brevo_sync_status;
          stats[val] = (stats[val] || 0) + 1;
        });
        console.log("Sync Status distribution in DB:", stats);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
run();

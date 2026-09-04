const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Resetting brevo_sync_status in database...");
  const sql = `
    ALTER TABLE public.contacts ALTER COLUMN brevo_sync_status DROP DEFAULT;
    UPDATE public.contacts SET brevo_sync_status = NULL;
  `;
  try {
    const { error } = await supabase.rpc('execute_sql', { sql_query: sql });
    if (error) {
      console.error("Error executing SQL:", error);
    } else {
      console.log("SQL executed successfully! Column reset completed.");
    }
  } catch (err) {
    console.error("Exception occurred:", err);
  }
}
run();

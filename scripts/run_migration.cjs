const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFile = 'supabase_insights_comerciais.sql';
  console.log(`Running SQL migration from ${sqlFile}...`);
  try {
    const sql = fs.readFileSync(sqlFile, 'utf8');
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    if (error) {
      console.error("Error executing SQL via RPC:", error);
      process.exit(1);
    } else {
      console.log("SQL executed successfully.");
      console.log("Result:", data);
    }
  } catch (err) {
    console.error("Migration failed with exception:", err);
    process.exit(1);
  }
}
run();

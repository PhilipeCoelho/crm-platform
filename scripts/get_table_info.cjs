const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking columns of insights_comerciais in database...");
  
  // We can call an RPC or run a query on info schema if allowed, or check the PostgREST OpenAPI spec we saved earlier!
  // Wait, info schema might be locked, but let's try querying it.
  const { data, error } = await supabase
    .from('insights_comerciais')
    .select('*')
    .limit(1);
    
  console.log("Direct select result:", data, "Error:", error);
}
run();

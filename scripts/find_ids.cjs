const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function find() {
  console.log("Querying deals...");
  const { data: deals, error: dealErr } = await supabase.from('deals').select('id, user_id').limit(5);
  console.log("Deals:", deals, "Error:", dealErr);

  console.log("Querying profiles...");
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id').limit(5);
  console.log("Profiles:", profiles, "Error:", profErr);
}
find();

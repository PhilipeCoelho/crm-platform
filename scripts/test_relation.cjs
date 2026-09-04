const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching first deal ID...");
  const { data: deals } = await supabase.from('deals').select('id').limit(1);
  if (!deals || deals.length === 0) {
    console.error("No deals found.");
    process.exit(1);
  }
  const dealId = deals[0].id;
  console.log("Using deal ID:", dealId);
  
  // Test 1: contact:contacts(*)
  const { data: d1, error: e1 } = await supabase
    .from('deals')
    .select('*, contact:contacts(*)')
    .eq('id', dealId)
    .single();
  console.log("Test 1 (contact:contacts(*)):", d1 ? "Success" : "Failed", e1 || "");
  
  // Test 2: contacts(*)
  const { data: d2, error: e2 } = await supabase
    .from('deals')
    .select('*, contacts(*)')
    .eq('id', dealId)
    .single();
  console.log("Test 2 (contacts(*)):", d2 ? "Success" : "Failed", e2 || "");

  // Test 3: contact:contact_id(*)
  const { data: d3, error: e3 } = await supabase
    .from('deals')
    .select('*, contact:contact_id(*)')
    .eq('id', dealId)
    .single();
  console.log("Test 3 (contact:contact_id(*)):", d3 ? "Success" : "Failed", e3 || "");
}

run();

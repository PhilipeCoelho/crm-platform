const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUsers() {
  const { data: deals, error: dErr } = await supabase.from('deals').select('id, user_id, title').limit(5);
  console.log('Sample deals with user_id:', deals, dErr);

  const { data: stages, error: sErr } = await supabase.from('stages').select('*').limit(5);
  console.log('Sample stages:', stages, sErr);
}

inspectUsers();

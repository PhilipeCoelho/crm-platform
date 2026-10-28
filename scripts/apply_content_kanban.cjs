const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Applying supabase_content_kanban.sql to Supabase...');
  const sql = fs.readFileSync('supabase_content_kanban.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing SQL via execute_sql RPC:', error);
  } else {
    console.log('✅ supabase_content_kanban.sql applied successfully to remote database!');
  }
}

run();

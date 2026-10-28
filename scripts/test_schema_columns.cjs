const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  // Test insert with dummy data to see what columns fail or succeed
  const testCol = {
    name: 'Coluna Teste',
    order_index: 0
  };
  const { data, error } = await supabase.from('content_columns').insert(testCol).select();
  console.log('Insert test without user_id:', { data, error });

  if (error && error.message.includes('user_id')) {
    console.log('Requires user_id or RLS policy');
  }
}

testInsert();

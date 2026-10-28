const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUser() {
  const userId = '9469fb08-7de5-405e-a4e7-d83cf818ea1e';
  const { data: cols, error: errCols } = await supabase.from('content_columns').select('*').eq('user_id', userId);
  console.log('Columns for user:', cols, errCols);

  const { data: cards, error: errCards } = await supabase.from('content_cards').select('*').eq('user_id', userId);
  console.log('Cards for user:', cards, errCards);
}

testUser();

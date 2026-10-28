const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const userId = '9469fb08-7de5-405e-a4e7-d83cf818ea1e';
  // Sem autenticação de sessão (apenas anon key), vamos ver o erro exato
  const { data, error } = await supabase.from('content_columns').insert({
    user_id: userId,
    name: 'Ideias',
    order_index: 0
  }).select();

  console.log('Insert result:', { data, error });
}

testInsert();

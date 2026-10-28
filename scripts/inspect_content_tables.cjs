const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: cols, error: errCols } = await supabase.from('content_columns').select('*');
  console.log('content_columns:', { count: cols ? cols.length : 0, error: errCols });
  
  const { data: cards, error: errCards } = await supabase.from('content_cards').select('*');
  console.log('content_cards:', { count: cards ? cards.length : 0, error: errCards });
}

inspect();

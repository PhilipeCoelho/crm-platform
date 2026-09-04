import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('deals')
    .select('id, title, status')
    .eq('status', 'lost');
    
  console.log('Lost Deals:', data?.length || 0);
  
  const { data: acts } = await supabase
    .from('activities')
    .select('deal_id, title, notes')
    .eq('type', 'status_change')
    .ilike('notes', 'Motivo:%');
    
  console.log('Status change activities with motivo:', acts?.length || 0);
}

run();

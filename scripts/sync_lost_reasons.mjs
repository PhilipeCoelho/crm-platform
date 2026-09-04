import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching lost deals...');
  const { data: deals, error: dealsErr } = await supabase
    .from('deals')
    .select('id, lost_reason, status, stage_id')
    .eq('status', 'lost');

  if (dealsErr) {
    console.error('Error fetching deals:', dealsErr);
    return;
  }
  
  console.log(`Found ${deals.length} lost deals.`);
  let count = 0;

  for (const deal of deals) {
    if (deal.lost_reason) {
      console.log(`Updating analytics for deal ${deal.id} with reason: ${deal.lost_reason}`);
      const { error } = await supabase
        .from('deal_analytics')
        .update({ motivo_perda: deal.lost_reason })
        .eq('deal_id', deal.id);
      
      if (error) {
        console.error(`Error updating deal ${deal.id}:`, error);
      } else {
        count++;
      }
    }
  }
  console.log(`Successfully updated ${count} deal_analytics records.`);
}

run();

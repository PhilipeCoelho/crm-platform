import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching...");
  const { count, error } = await supabase.from('deals').select('*', { count: 'exact', head: true });
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Total deals:", count);
  }
}
run();

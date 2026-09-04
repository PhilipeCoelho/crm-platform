const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Resetting brevo_sync_status to null for all contacts...");
  try {
    const { data, error } = await supabase
      .from('contacts')
      .update({ brevo_sync_status: null })
      .not('id', 'is', null);

    if (error) {
      console.error("Error updating contacts:", error);
    } else {
      console.log("Reset successful!");
    }
  } catch (err) {
    console.error("Exception occurred:", err);
  }
}
run();

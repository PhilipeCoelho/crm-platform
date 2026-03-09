const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sql = fs.readFileSync('supabase_campaigns_manual.sql', 'utf8');
    console.log("Running SQL...");
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    if (error) {
        console.error("Error executing SQL:", error);
    } else {
        console.log("SQL executed successfully. Result:", data);
    }
}
run();

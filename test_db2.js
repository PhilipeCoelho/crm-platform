const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
console.log(process.env.VITE_SUPABASE_URL);

async function main() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: error } = await supabase.from('deal_analytics').select('status_final, closed_at');
    console.log(error);
}
main();

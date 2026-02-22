import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });
dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if(!supabaseUrl || !supabaseKey) { console.error("Missing keys"); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: user, error: userError } = await supabase.auth.signInWithPassword({
        email: 'philipecoelho@example.com', // wait, we don't have their login. let's just do a select from the table, maybe RLS allows reading schema or empty?
    });
    
    // Actually we can just do a select without auth. It will return empty but if the table or column is missing we get an error!
    const { data, error } = await supabase.from('user_dashboard_widgets').select('position').limit(1);
    console.log("Select 'position' error:", error?.message || error?.code);

    const { data: data2, error: error2 } = await supabase.from('user_dashboard_widgets').select('order_position').limit(1);
    console.log("Select 'order_position' error:", error2?.message || error2?.code);
}
test();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';

console.log('Connecting to Supabase at:', supabaseUrl);
console.log('Using Key starting with:', supabaseAnonKey.substring(0, 15) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        const { data, error } = await supabase.from('contacts').select('count').limit(1);
        if (error) {
            console.error('Database connection / query failed:', error);
        } else {
            console.log('Successfully queried database! Result:', data);
        }
    } catch (e) {
        console.error('Exception during test:', e);
    }
}

testConnection();

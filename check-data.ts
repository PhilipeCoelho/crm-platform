import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env file manually since Vite handles it normally
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1]] = match[2];
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- DATA CHECK ---');

    // Check Deals
    const { count: dealsCount, error: dealsError } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true });

    console.log('Total Deals in DB:', dealsCount);

    // Check Analytics
    const { count: analyticsCount, error: analyticsError } = await supabase
        .from('deal_analytics')
        .select('*', { count: 'exact', head: true });

    console.log('Total Analytics Rows in DB:', analyticsCount);

    // Fetch sample deals
    const { data: dealsSample } = await supabase.from('deals').select('id, title, status').limit(5);
    console.log('\nSample Deals:', dealsSample);

    // Fetch stages
    const { data: stagesData } = await supabase.from('stages').select('id, name');
    console.log('\nStages in DB:', stagesData);
}

checkData();

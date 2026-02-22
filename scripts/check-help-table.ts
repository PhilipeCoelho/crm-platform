import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkHelpContent() {
    console.log('--- Checking help_content table ---');
    try {
        const { data, error } = await supabase
            .from('help_content')
            .select('*');

        if (error) {
            console.error('Error fetching help_content:', error.message);
            if (error.message.includes('relation "public.help_content" does not exist')) {
                console.log('TABLE MISSING: help_content does not exist in the database.');
            }
        } else {
            console.log(`Success! Found ${data?.length || 0} rows in help_content.`);
            if (data && data.length > 0) {
                data.forEach(row => console.log(`- ${row.module_name}: ${row.title}`));
            }
        }
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

checkHelpContent();

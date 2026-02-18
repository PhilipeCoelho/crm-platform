import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkColumns() {
    const { data, error } = await supabase
        .from('deals')
        .select('instagram_url, ad_library_url')
        .limit(1);

    if (error) {
        console.log('COLUMNS_MISSING', error.message);
    } else {
        console.log('COLUMNS_EXIST');
    }
}

checkColumns();

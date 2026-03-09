import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
    // try to sign in with user to get their token
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: process.env.SMTP_USER,
        password: process.env.SMTP_PASS // Just to see if we can get a session, wait, this might not be the user's supabase password.
    });

    // Alternatively, just try to select
    const { data, error } = await supabase.from('campaigns').select('*').limit(1);
    console.log('Select Campaigns Error:', error);
    console.log('Data:', data);

    // Check if the table even has the columns by calling it
    const { error: error2 } = await supabase.from('campaigns').insert({
        name: 'Test',
        subject: 'Test subject',
        // created_by is missing so RLS will reject or violate foreign key, but we want to see if columns exist
        from_name: 'test',
        from_email: 'test@example.com',
        content: 'hello'
    });
    console.log('Insert Error:', error2);
}

testInsert();

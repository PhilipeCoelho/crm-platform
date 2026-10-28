import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const dealIds = [
    { id: '5b0f44c1-57d3-4a30-8de5-7df432207b34', name: 'Clínica Dentária Diniz Salgueiro' },
    { id: '2ee3b134-a111-4624-81b8-c9eef850b5ed', name: 'C Clinic Leiria' },
    { id: '3c3fa28c-9d7d-43e9-9ec5-664508a1bb72', name: 'DentalCare Lisboa' }
];

async function check() {
    for (const d of dealIds) {
        console.log(`\n======================================================`);
        console.log(`🔍 NEGÓCIO: ${d.name} (${d.id})`);
        console.log(`======================================================`);
        
        const { data: deal } = await supabase.from('deals').select('*').eq('id', d.id).single();
        console.log('Deal:', {
            id: deal.id,
            title: deal.title,
            status: deal.status,
            stage_id: deal.stage_id,
            lost_reason: deal.lost_reason,
            lost_at: deal.lost_at,
            created_at: deal.created_at,
            contact_id: deal.contact_id
        });
        
        let contact = null;
        if (deal.contact_id) {
            const { data: c } = await supabase.from('contacts').select('*').eq('id', deal.contact_id).single();
            contact = c;
            console.log('Contact:', {
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                role: c.role,
                notes: c.notes
            });
        }
        
        const { data: activities } = await supabase.from('activities').select('*').eq('deal_id', d.id).order('date', { ascending: true });
        console.log(`Atividades (${activities?.length || 0}):`);
        activities?.forEach((a, i) => {
            console.log(`  [${i+1}] ${a.date?.slice(0,10)} | Type: ${a.type} | Title: "${a.title}" | Notes: "${(a.notes || '').slice(0, 150)}" | Resp: ${a.houve_resposta}`);
        });
        
        const { data: logs } = await supabase.from('deal_logs').select('*').eq('deal_id', d.id).order('created_at', { ascending: true });
        console.log(`Logs (${logs?.length || 0}):`);
        logs?.forEach((l, i) => {
            console.log(`  [${i+1}] ${l.created_at?.slice(0,10)} | Type: ${l.log_type} | Content: "${(l.content || '').slice(0, 150)}"`);
        });
    }
}

check().catch(console.error);

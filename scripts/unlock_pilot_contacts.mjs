import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function unlockContacts() {
    console.log('🔓 [Desbloqueio de Contactos] Verificando lista de supressão ativa...');
    const suppPath = path.resolve(process.cwd(), 'data', 'sdr_suppression_active.json');
    let suppressedPhones = [];
    if (fs.existsSync(suppPath)) {
        const suppData = JSON.parse(fs.readFileSync(suppPath, 'utf8'));
        suppressedPhones = suppData.map(s => (s.telefone_normalizado || '').replace(/\D/g, '')).filter(Boolean);
    }
    console.log(`• Telefones com opt-out real mantidos em supressão: ${suppressedPhones.length}`);

    const { data: contacts, error: fetchErr } = await supabase.from('contacts').select('id, phone, name');
    if (fetchErr) {
        console.error('Erro ao buscar contactos:', fetchErr);
        return;
    }

    const eligibleIds = [];
    for (const c of contacts) {
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        const isSuppressed = suppressedPhones.some(sp => sp && cleanPhone.endsWith(sp.slice(-9)));
        if (!isSuppressed) {
            eligibleIds.push(c.id);
        }
    }

    // Atualização em lotes de 100
    const chunkSize = 100;
    for (let i = 0; i < eligibleIds.length; i += chunkSize) {
        const chunk = eligibleIds.slice(i, i + chunkSize);
        await supabase.from('contacts').update({ marketing_status: 'subscribed' }).in('id', chunk);
    }
    console.log(`✅ [Supabase] ${eligibleIds.length} contactos de clínicas ativados para 'subscribed' (respeitando opt-outs).`);

    // Reset seguro de aiAutonomySuspended em data/sdr_recovery_pipeline.json
    const pipePath = path.resolve(process.cwd(), 'data', 'sdr_recovery_pipeline.json');
    if (fs.existsSync(pipePath)) {
        const pipeData = JSON.parse(fs.readFileSync(pipePath, 'utf8'));
        let unfreezed = 0;
        for (const [id, deal] of Object.entries(pipeData.deals || {})) {
            const isDesq = (deal.lostReason || '').toLowerCase().includes('desqualificad');
            const isHandoff = deal.stage === 'agendamento_pendente_humano' || deal.stage === 'pronto_reabrir';
            if (!isDesq && !isHandoff) {
                deal.aiAutonomySuspended = false;
                deal.isHumanInterventionPending = false;
                deal.stage = 'recuperavel';
                deal.eligibilityStatus = 'Elegível';
                deal.eligibilityReason = null;
                unfreezed++;
            }
        }
        fs.writeFileSync(pipePath, JSON.stringify(pipeData, null, 2), 'utf8');
        console.log(`✅ [Pipeline Local] ${unfreezed} negócios restaurados para 'recuperavel' com autonomia da IA ativa.`);
    }
}

unlockContacts().catch(console.error);

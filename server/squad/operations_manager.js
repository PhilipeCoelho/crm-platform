/**
 * server/squad/operations_manager.js
 * ============================================================================
 * JONH — GERENTE DE OPERAÇÕES (REVOPS CONTROLLER)
 * ============================================================================
 * - Presta contas diretamente ao JARVIS (O Chefão): passa métricas, resultados e gargalos.
 * - Cuida de toda a operação de campo e comanda os agentes especializados:
 *   1. Hunter / Prospector (validação no CRM e deduplicação)
 *   2. Investigador Forense (site + Meta Ad Library)
 *   3. SDR Outbound (abordagem em 3 linhas sem jargão)
 *   4. Ghosting Buster (quebra de silêncio com Chris Voss e micro-áudio)
 *   5. Gatekeeper Navigator (secretárias e e-mail em 60s)
 *   6. Closer (4 objeções e Cal.com 20 min)
 *   7. Anti No-Show (lembretes pré-reunião 24h e 2h)
 * - Controla teto seguro (5 a 10 envios/dia), janela útil (09h–18h Lisboa) e
 *   garante que NENHUM negócio fique sem Próximo Passo Agendado com data e hora.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { validateDispatchTiming } from '../sdr_business_hours.js';
import { isClinicAutoReply } from '../sdr_auto_reply_filter.js';
import { buildGhostingMessage, selectGhostingTactic } from './ghosting_buster.js';

function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

export const JONH_IDENTITY = {
    name: 'Jonh',
    role: 'Gerente de Operações / RevOps Controller',
    boss: 'Jarvis (O Chefão)',
    subordinates: [
        'Jack Hunter (Hunter & Prospector)',
        'Investigador Forense',
        'SDR Outbound',
        'Ghosting Buster',
        'Gatekeeper Navigator',
        'Closer',
        'Anti No-Show'
    ]
};

export const OPS_CONFIG = {
    DAILY_MIN_SAFE_OUTBOUND: 5,
    DAILY_MAX_SAFE_OUTBOUND: 10,
    OPERATOR_PHONE: '351964094865'
};

/**
 * JONH FISCALIZAÇÃO DE DADOS:
 * Inspeciona rigorosamente se o Prospect possui os devidos campos preenchidos
 * antes de permitir que qualquer robô de campo entre em ação.
 */
export function validateProspectFields(deal, contact = {}, company = {}) {
    const missing = [];
    const clinicName = (deal?.title || company?.name || '').replace(/^(Negócio|Clinica|Clínica)\s+/i, '').trim();
    if (!clinicName || clinicName.length < 3) {
        missing.push('Nome da Clínica');
    }

    const rawPhone = (contact?.phone || company?.phone || '').replace(/\D/g, '');
    let phoneType = 'INVALID';
    if (rawPhone.length >= 9) {
        const clean = rawPhone.startsWith('351') ? rawPhone.slice(3) : rawPhone;
        if (/^9\d{8}$/.test(clean)) {
            phoneType = 'MOBILE'; // Telemóvel (apto para WhatsApp)
        } else if (/^2\d{8}$/.test(clean)) {
            phoneType = 'LANDLINE'; // Telefone Fixo (apenas chamada ou e-mail)
        } else {
            phoneType = 'OTHER_VALID';
        }
    } else {
        missing.push('Telefone de Contacto Válido');
    }

    const digitalPresence = Boolean(
        deal?.instagram_url || 
        deal?.ad_library_url || 
        company?.website || 
        contact?.email
    );

    if (!digitalPresence) {
        missing.push('Presença Digital (Website, Instagram ou E-mail)');
    }

    const isReady = missing.length === 0 && phoneType === 'MOBILE';

    return {
        valid: missing.length === 0,
        readyForWhatsAppOutbound: isReady,
        phoneType,
        missingFields: missing,
        clinicName,
        phone: rawPhone
    };
}

/**
 * Jonh audita toda a fila de Prospects no CRM e separa os prontos dos que têm campos em falta.
 */
export async function auditProspectsDataHygiene() {
    const supabase = getSupabaseClient();
    if (!supabase) return { ready: [], incomplete: [] };

    try {
        const { data: prospects, error } = await supabase
            .from('deals')
            .select('id, title, stage_id, status, contact_id, company_id, instagram_url, ad_library_url, created_at')
            .eq('status', 'open')
            .neq('stage_id', 'contacted')
            .neq('stage_id', 'new');

        if (error) throw error;

        // Coletar IDs para busca em lote ultra-rápida (batch query)
        const contactIds = prospects.map(p => p.contact_id).filter(Boolean);
        const companyIds = prospects.map(p => p.company_id).filter(Boolean);

        const [contactsRes, companiesRes] = await Promise.all([
            contactIds.length > 0 ? supabase.from('contacts').select('id, name, phone, email').in('id', contactIds) : { data: [] },
            companyIds.length > 0 ? supabase.from('companies').select('id, name, website, phone').in('id', companyIds) : { data: [] }
        ]);

        const contactsMap = new Map((contactsRes.data || []).map(c => [c.id, c]));
        const companiesMap = new Map((companiesRes.data || []).map(comp => [comp.id, comp]));

        const ready = [];
        const incomplete = [];

        for (const p of (prospects || [])) {
            const contact = contactsMap.get(p.contact_id) || {};
            const company = companiesMap.get(p.company_id) || {};

            const check = validateProspectFields(p, contact, company);
            if (check.readyForWhatsAppOutbound) {
                ready.push({ dealId: p.id, title: p.title, check });
            } else {
                incomplete.push({ dealId: p.id, title: p.title, check });
            }
        }

        console.log(`📋 [Jonh Fiscalização] Auditoria Concluída em lote: ${ready.length} aptos para WhatsApp, ${incomplete.length} com campos pendentes/fixos.`);
        return { ready, incomplete, totalAudited: prospects?.length || 0 };
    } catch (err) {
        console.error('❌ [Jonh] Erro ao fiscalizar dados dos prospects:', err.message);
        return { ready: [], incomplete: [], error: err.message };
    }
}

/**
 * Jonh garante a Regra de Ouro: Todo o negócio em aberto deve ter um próximo passo pendente.
 */
export async function ensureNextStepActivity(dealId, {
    title = 'Próximo Passo Comercial',
    type = 'task',
    dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    notes = 'Agendado pelo Gerente de Operações Jonh',
    userId = null
} = {}) {
    const supabase = getSupabaseClient();
    if (!supabase || !dealId) return { success: false, error: 'INVALID_PARAMS' };

    try {
        const { data: existing, error: exErr } = await supabase
            .from('activities')
            .select('id, title, date, status')
            .eq('deal_id', dealId)
            .eq('status', 'pending')
            .limit(1);

        if (exErr) throw exErr;

        if (existing && existing.length > 0) {
            return { success: true, updated: false, existingActivityId: existing[0].id };
        }

        let resolvedUserId = userId;
        if (!resolvedUserId) {
            const { data: deal } = await supabase
                .from('deals')
                .select('user_id')
                .eq('id', dealId)
                .single();
            resolvedUserId = deal?.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e';
        }

        const { data: created, error: crErr } = await supabase
            .from('activities')
            .insert([{
                user_id: resolvedUserId,
                deal_id: dealId,
                title,
                type,
                date: dueDate,
                status: 'pending',
                completed: false,
                notes,
                is_automatic: true
            }])
            .select()
            .single();

        if (crErr) throw crErr;

        return { success: true, updated: true, activityId: created.id };
    } catch (err) {
        console.error(`❌ [Jonh] Falha ao assegurar próximo passo para deal ${dealId}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Jonh assegura em lote (ultra-rápido) a Regra de Ouro:
 * Identifica quais dos negócios não possuem atividade pendente e insere de uma só vez.
 */
export async function enforceNextStepActivitiesInBatch(deals = []) {
    const supabase = getSupabaseClient();
    if (!supabase || !deals.length) return { checked: 0, created: 0 };

    try {
        const dealIds = deals.map(d => d.id).filter(Boolean);
        if (!dealIds.length) return { checked: 0, created: 0 };

        // 1. Busca todas as atividades pendentes existentes para esses deals de uma só vez
        const { data: existingActivities, error: exErr } = await supabase
            .from('activities')
            .select('deal_id')
            .in('deal_id', dealIds)
            .eq('status', 'pending');

        if (exErr) throw exErr;

        const dealsWithPending = new Set((existingActivities || []).map(a => a.deal_id));
        const missingDeals = deals.filter(d => !dealsWithPending.has(d.id));

        if (missingDeals.length === 0) {
            return { checked: deals.length, created: 0, message: 'Todos os negócios já possuem próximo passo agendado.' };
        }

        // 2. Prepara inserção em massa
        const defaultUserId = '9469fb08-7de5-405e-a4e7-d83cf818ea1e';
        const dueDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

        const activitiesToInsert = missingDeals.map(deal => ({
            user_id: deal.user_id || defaultUserId,
            deal_id: deal.id,
            title: `Acompanhamento Jonh: ${deal.title}`,
            type: deal.stage_id === 'contacted' ? 'task' : 'message',
            date: dueDate,
            status: 'pending',
            completed: false,
            notes: `Garantido pelo Gerente de Operações Jonh para dar vazão à etapa '${deal.stage_id}'`,
            is_automatic: true
        }));

        // Inserção em chunks de 50 para máxima robustez
        const chunkSize = 50;
        let totalInserted = 0;
        for (let i = 0; i < activitiesToInsert.length; i += chunkSize) {
            const chunk = activitiesToInsert.slice(i, i + chunkSize);
            const { error: insErr } = await supabase
                .from('activities')
                .insert(chunk);

            if (insErr) {
                console.warn(`⚠️ [Jonh Batch NextStep] Erro ao inserir lote de atividades:`, insErr.message);
            } else {
                totalInserted += chunk.length;
            }
        }

        console.log(`🛡️ [Jonh Regra de Ouro] Fiscalização concluída: ${totalInserted} novos passos criados de ${deals.length} analisados.`);
        return { checked: deals.length, created: totalInserted };
    } catch (err) {
        console.error('❌ [Jonh Batch NextStep] Erro fatal:', err.message);
        return { checked: deals.length, created: 0, error: err.message };
    }
}

/**
 * Jonh registra formalmente a ação realizada em activities e deal_logs.
 */
export async function recordFactualAction(dealId, {
    activityTitle,
    activityType = 'message',
    logContent,
    logType = 'activity_note',
    userId = null
} = {}) {
    const supabase = getSupabaseClient();
    if (!supabase || !dealId) return { success: false };

    try {
        let resolvedUserId = userId;
        if (!resolvedUserId) {
            const { data: deal } = await supabase
                .from('deals')
                .select('user_id')
                .eq('id', dealId)
                .single();
            resolvedUserId = deal?.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e';
        }

        const { data: act, error: actErr } = await supabase
            .from('activities')
            .insert([{
                user_id: resolvedUserId,
                deal_id: dealId,
                title: activityTitle,
                type: activityType,
                status: 'completed',
                completed: true,
                completed_at: new Date().toISOString(),
                date: new Date().toISOString(),
                notes: logContent,
                is_automatic: true
            }])
            .select()
            .single();

        if (actErr) console.warn('⚠️ [Jonh] Aviso ao gravar atividade:', actErr.message);

        const { error: logErr } = await supabase
            .from('deal_logs')
            .insert([{
                deal_id: dealId,
                activity_id: act?.id || null,
                content: logContent,
                log_type: logType
            }]);

        if (logErr) console.warn('⚠️ [Jonh] Aviso ao gravar log:', logErr.message);

        return { success: true, activityId: act?.id };
    } catch (err) {
        console.error('❌ [Jonh] Erro ao gravar registro factual:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Jonh avança o negócio de etapa no CRM dando vazão ao fluxo até ao GANHO.
 * Prioridade: sempre empurrar quem está mais perto de fechar (Lead Engajado -> Cal.com -> Ganho).
 */
export async function advanceDealStage(dealId, targetStage, { reason = 'Avanço de etapa pelo Jonh' } = {}) {
    const supabase = getSupabaseClient();
    if (!supabase || !dealId || !targetStage) return { success: false, error: 'INVALID_PARAMS' };

    try {
        const updateData = { stage_id: targetStage };
        if (targetStage === 'won' || targetStage === 'ganho') {
            updateData.status = 'won';
            updateData.won_at = new Date().toISOString();
        } else if (targetStage === 'lost' || targetStage === 'perdido') {
            updateData.status = 'lost';
            updateData.lost_at = new Date().toISOString();
            updateData.lost_reason = reason;
        }

        const { data, error } = await supabase
            .from('deals')
            .update(updateData)
            .eq('id', dealId)
            .select()
            .single();

        if (error) throw error;

        // Registrar atividade de mudança de etapa
        await recordFactualAction(dealId, {
            activityTitle: `Etapa avançada para: ${targetStage}`,
            activityType: 'status_change',
            logContent: `Jonh deu vazão ao negócio no CRM avançando para a etapa '${targetStage}'. Motivo: ${reason}`
        });

        console.log(`🚀 [Jonh] Vazão dada ao Deal [${dealId}]: avançou para '${targetStage}'!`);
        return { success: true, deal: data };
    } catch (err) {
        console.error(`❌ [Jonh] Erro ao avançar etapa do deal ${dealId}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Jonh obtém os negócios abertos ordenados rigorosamente por maior probabilidade de GANHO:
 * 1. Onda 1 (Lead Engajado - 4): Já falaram, máxima chance de fechar reunião agora!
 * 2. Onda 2 (Lead - 15): 1 mensagem enviada, requer quebra de silêncio para avançar.
 * 3. Onda 3 (Prospect - 215): Fila fria de base (5 a 10 por dia).
 */
export async function getOpenDealsByPriorityWaves() {
    const supabase = getSupabaseClient();
    if (!supabase) return { onda1: [], onda2: [], onda3: [] };

    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, stage_id, status, contact_id, company_id, user_id, created_at')
        .eq('status', 'open');

    if (error) {
        console.error('❌ [Jonh] Erro ao carregar negócios abertos:', error.message);
        return { onda1: [], onda2: [], onda3: [] };
    }

    const onda1 = deals.filter(d => d.stage_id === 'contacted');
    const onda2 = deals.filter(d => d.stage_id === 'new');
    const onda3 = deals.filter(d => d.stage_id !== 'contacted' && d.stage_id !== 'new');

    return {
        manager: JONH_IDENTITY.name,
        onda1, // Lead Engajado (4)
        onda2, // Lead (15)
        onda3, // Prospect (215)
        total: deals.length
    };
}

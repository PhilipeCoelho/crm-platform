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
        'Hunter / Prospector',
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
 * Jonh garante a Regra de Ouro: Todo o negócio em aberto deve ter um próximo passo pendente.
 */
export async function ensureNextStepActivity(dealId, {
    title = 'Próximo Passo Comercial',
    type = 'task',
    dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    notes = 'Agendado pelo Gerente de Operações Jonh'
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

        const { data: created, error: crErr } = await supabase
            .from('activities')
            .insert([{
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
 * Jonh registra formalmente a ação realizada em activities e deal_logs.
 */
export async function recordFactualAction(dealId, {
    activityTitle,
    activityType = 'message',
    logContent,
    logType = 'activity_note'
} = {}) {
    const supabase = getSupabaseClient();
    if (!supabase || !dealId) return { success: false };

    try {
        const { data: act, error: actErr } = await supabase
            .from('activities')
            .insert([{
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
        .select('id, title, stage_id, status, contact_id, company_id, created_at')
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

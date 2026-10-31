/**
 * server/squad/operations_manager.js
 * ============================================================================
 * GERENTE DE OPERAÇÕES (REVOPS CONTROLLER)
 * ============================================================================
 * Responsável por:
 * 1. Controlar rigidamente a segurança do WhatsApp (5 a 10 novos disparos/dia).
 * 2. Aplicar horários comerciais portugueses (09h00-18h00 Lisboa) e cadência de 7 dias.
 * 3. Garantir a REGRA DO PRÓXIMO PASSO OBRIGATÓRIO (todo negócio tem atividade com data e hora).
 * 4. Garantir a REGRA DO REGISTRO FACTUAL (toda ação grava em activities e deal_logs).
 * 5. Orquestrar a fila de execução em 3 ondas cirúrgicas:
 *    - Onda 1: Lead Engajado (4 negócios)
 *    - Onda 2: Lead (15 negócios)
 *    - Onda 3: Prospect (215 negócios)
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

export const OPS_CONFIG = {
    DAILY_MIN_SAFE_OUTBOUND: 5,
    DAILY_MAX_SAFE_OUTBOUND: 10,
    OPERATOR_PHONE: '351964094865'
};

/**
 * Garante a Regra de Ouro: Todo o negócio em aberto deve ter um próximo passo pendente.
 */
export async function ensureNextStepActivity(dealId, {
    title = 'Próximo Passo Comercial',
    type = 'task',
    dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    notes = 'Agendado pelo Gerente de Operações'
} = {}) {
    const supabase = getSupabaseClient();
    if (!supabase || !dealId) return { success: false, error: 'INVALID_PARAMS' };

    try {
        // Verificar se já existe uma atividade pendente para este negócio
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

        // Criar a atividade obrigatória de próximo passo
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
        console.error(`❌ [Gerente Ops] Falha ao assegurar próximo passo para deal ${dealId}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Registra formalmente a ação realizada em activities e deal_logs.
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
        // 1. Criar atividade concluída
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

        if (actErr) console.warn('⚠️ [Gerente Ops] Aviso ao gravar atividade:', actErr.message);

        // 2. Criar log histórico do negócio
        const { error: logErr } = await supabase
            .from('deal_logs')
            .insert([{
                deal_id: dealId,
                activity_id: act?.id || null,
                content: logContent,
                log_type: logType
            }]);

        if (logErr) console.warn('⚠️ [Gerente Ops] Aviso ao gravar log:', logErr.message);

        return { success: true, activityId: act?.id };
    } catch (err) {
        console.error('❌ [Gerente Ops] Erro ao gravar registro factual:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Obtém os negócios abertos ordenados pelas 3 ondas prioritárias.
 */
export async function getOpenDealsByPriorityWaves() {
    const supabase = getSupabaseClient();
    if (!supabase) return { onda1: [], onda2: [], onda3: [] };

    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, stage_id, status, contact_id, company_id, created_at')
        .eq('status', 'open');

    if (error) {
        console.error('❌ [Gerente Ops] Erro ao carregar negócios abertos:', error.message);
        return { onda1: [], onda2: [], onda3: [] };
    }

    const onda1 = deals.filter(d => d.stage_id === 'contacted');
    const onda2 = deals.filter(d => d.stage_id === 'new');
    const onda3 = deals.filter(d => d.stage_id !== 'contacted' && d.stage_id !== 'new');

    return {
        onda1, // Lead Engajado (4)
        onda2, // Lead (15)
        onda3, // Prospect (215)
        total: deals.length
    };
}

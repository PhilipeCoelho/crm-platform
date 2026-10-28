/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — CONTROLADOR CENTRAL DE CUSTOS & LIMITES (B.14.2)
 * ============================================================================
 * Gestor orçamental atómico que valida e reserva limites antes de qualquer
 * execução que consuma recursos da OpenAI ou da Meta WhatsApp Cloud API.
 * 
 * Regras:
 * 1. Não assume preços fixos universais nem quotas gratuitas.
 * 2. Verifica limites por contacto, dia e mês.
 * 3. Mantém reserva de segurança inatingível por automações (15%).
 * 4. Bloqueia preventivamente execuções quando limites são atingidos.
 * 5. Garante atomicidade contra condições de corrida entre tarefas concorrentes.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

const COSTS_STATE_FILE = path.resolve(process.cwd(), 'data', 'sdr_costs_state.json');

// ============================================================================
// CONFIGURAÇÕES ORÇAMENTAIS (CONSERVADORAS E CONFIGURÁVEIS)
// ============================================================================

export const COST_LIMITS = {
    // OpenAI Limits (EUR)
    MAX_OPENAI_COST_PER_DAY: parseFloat(process.env.SDR_MAX_OPENAI_COST_PER_DAY || '1.50'),
    MAX_OPENAI_COST_PER_MONTH: parseFloat(process.env.SDR_MAX_OPENAI_COST_PER_MONTH || '30.00'),

    // WhatsApp Limits (EUR)
    MAX_WHATSAPP_COST_PER_DAY: parseFloat(process.env.SDR_MAX_WHATSAPP_COST_PER_DAY || '3.00'),
    MAX_WHATSAPP_COST_PER_MONTH: parseFloat(process.env.SDR_MAX_WHATSAPP_COST_PER_MONTH || '50.00'),

    // Contact Limits
    MAX_MESSAGES_PER_CONTACT: parseInt(process.env.SDR_MAX_MESSAGES_PER_CONTACT || '3', 10),
    MAX_ATTEMPTS_WITHOUT_RESPONSE: parseInt(process.env.SDR_MAX_ATTEMPTS_WITHOUT_RESPONSE || '3', 10),
    MAX_NEW_CONTACTS_PER_DAY: parseInt(process.env.SDR_MAX_NEW_CONTACTS_PER_DAY || '10', 10),

    // Limite de Custo Máximo Acumulado por Negócio / Lead (€)
    // Para gastar o mínimo possível com o maior retorno (ex: tokens GPT + envio)
    MAX_COST_PER_DEAL: parseFloat(process.env.SDR_MAX_COST_PER_DEAL || '0.15'),

    // Concurrency Limit
    MAX_CONCURRENT_TASKS: parseInt(process.env.SDR_MAX_CONCURRENT_TASKS || '3', 10),

    // Reserva de segurança obrigatória (15% do orçamento diário não pode ser consumido automaticamente)
    BUDGET_SAFETY_BUFFER_PERCENT: parseFloat(process.env.SDR_BUDGET_SAFETY_BUFFER_PERCENT || '15'),

    // Tarifas de referência (podem ser calibradas pela conta Meta real)
    WHATSAPP_RATES: {
        MARKETING_PT: parseFloat(process.env.WHATSAPP_RATE_MARKETING_PT || '0.0485'),
        UTILITY_PT: parseFloat(process.env.WHATSAPP_RATE_UTILITY_PT || '0.0250'),
        SERVICE_PT: parseFloat(process.env.WHATSAPP_RATE_SERVICE_PT || '0.0300'),
        FREE_TIER_SERVICE_REPLY: 0.0000 // Respostas dentro de janela de serviço com créditos gratuitos
    },

    OPENAI_RATES: {
        GPT4O_MINI_PROMPT_PER_1K: 0.00015,
        GPT4O_MINI_COMPLETION_PER_1K: 0.00060
    }
};

/**
 * Lê o estado do controlador de custos
 */
export function readCostsState() {
    try {
        if (!fs.existsSync(COSTS_STATE_FILE)) {
            return getDefaultCostsState();
        }
        return JSON.parse(fs.readFileSync(COSTS_STATE_FILE, 'utf8'));
    } catch {
        return getDefaultCostsState();
    }
}

function getDefaultCostsState() {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    return {
        today,
        month,
        openai: {
            todayCost: 0,
            todayTokens: 0,
            monthCost: 0,
            monthTokens: 0,
            callsCountToday: 0
        },
        whatsapp: {
            todayCost: 0,
            todayDispatches: 0,
            monthCost: 0,
            monthDispatches: 0
        },
        contacts: {},       // phone -> { count, attemptsWithoutResponse, firstContactAt, lastContactAt }
        reservations: {},   // resId -> { type, amount, status: 'reserved'|'confirmed'|'released', expiresAt }
        activeLocks: 0,
        blockedReasons: []
    };
}

/**
 * Grava o estado de custos
 */
export function writeCostsState(state) {
    try {
        fs.writeFileSync(COSTS_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [Cost Controller] Falha ao gravar estado de custos:', e.message);
        return false;
    }
}

/**
 * Limpa e reseta datas se virou o dia ou o mês e purga reservas expiradas
 */
export function cleanupExpiredReservations(state) {
    if (!state.reservations) {
        state.reservations = {};
        return;
    }
    const now = Date.now();
    for (const [resId, res] of Object.entries(state.reservations)) {
        if (!res.expiresAt || new Date(res.expiresAt).getTime() <= now) {
            delete state.reservations[resId];
        }
    }
}

/**
 * Retorna o montante total de reservas ativas (não expiradas) para um recurso
 */
export function getActiveReservedAmount(state, resourceType) {
    cleanupExpiredReservations(state);
    return Object.values(state.reservations || {})
        .filter(r => r.type === resourceType)
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

/**
 * Cancela/liberta imediatamente uma reserva não consumida (ex: fora de horário comercial ou erro)
 */
export function cancelReservation(reservationId) {
    if (!reservationId) return false;
    const state = readCostsState();
    if (state.reservations && state.reservations[reservationId]) {
        delete state.reservations[reservationId];
        writeCostsState(state);
        return true;
    }
    return false;
}

function refreshDateBuckets(state) {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    cleanupExpiredReservations(state);

    if (state.today !== today) {
        state.today = today;
        state.openai.todayCost = 0;
        state.openai.todayTokens = 0;
        state.openai.callsCountToday = 0;
        state.whatsapp.todayCost = 0;
        state.whatsapp.todayDispatches = 0;
        state.whatsapp.todayDelivered = 0;
        state.reservations = {};
    }

    if (state.month !== month) {
        state.month = month;
        state.openai.monthCost = 0;
        state.openai.monthTokens = 0;
        state.whatsapp.monthCost = 0;
        state.whatsapp.monthDispatches = 0;
        state.whatsapp.monthDelivered = 0;
    }
}

// ============================================================================
// VALIDAÇÃO E RESERVA ATÓMICA DE ORÇAMENTO OPENAI
// ============================================================================

/**
 * Valida se existe saldo e reserva preventivamente orçamento para chamada GPT
 * 
 * @param {Object} options
 * @param {number} options.estimatedTokens - Estimativa de tokens para a chamada
 * @returns {Object} { allowed: boolean, reservationId?: string, reason?: string }
 */
export function checkAndReserveOpenAIBudget({ estimatedTokens = 1500 } = {}) {
    const state = readCostsState();
    refreshDateBuckets(state);

    const estCost = (estimatedTokens / 1000) * COST_LIMITS.OPENAI_RATES.GPT4O_MINI_COMPLETION_PER_1K;
    const safetyBufferRatio = 1 - (COST_LIMITS.BUDGET_SAFETY_BUFFER_PERCENT / 100);

    const maxDayWithBuffer = COST_LIMITS.MAX_OPENAI_COST_PER_DAY * safetyBufferRatio;
    const maxMonthWithBuffer = COST_LIMITS.MAX_OPENAI_COST_PER_MONTH * safetyBufferRatio;

    // Concorrência: somar reservas ativas pendentes que ainda não foram confirmadas nem expiraram
    const activeReserved = getActiveReservedAmount(state, 'OPENAI');

    // Verificar se já excedeu ou excederá com a reserva
    if ((state.openai.todayCost + activeReserved + estCost) > maxDayWithBuffer) {
        const reason = `Limite diário OpenAI atingido (€${(state.openai.todayCost + activeReserved).toFixed(4)}/€${maxDayWithBuffer.toFixed(2)} com buffer de 15%).`;
        addBlockedReason(state, 'OPENAI_DAILY_LIMIT', reason);
        writeCostsState(state);
        return { allowed: false, reason, error: 'OPENAI_DAILY_BUDGET_EXCEEDED' };
    }

    if ((state.openai.monthCost + activeReserved + estCost) > maxMonthWithBuffer) {
        const reason = `Limite mensal OpenAI atingido (€${(state.openai.monthCost + activeReserved).toFixed(4)}/€${maxMonthWithBuffer.toFixed(2)}).`;
        addBlockedReason(state, 'OPENAI_MONTHLY_LIMIT', reason);
        writeCostsState(state);
        return { allowed: false, reason, error: 'OPENAI_MONTHLY_BUDGET_EXCEEDED' };
    }

    // Criar reserva atómica
    const reservationId = `res_oai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    state.reservations[reservationId] = {
        type: 'OPENAI',
        amount: estCost,
        tokens: estimatedTokens,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString() // 60s timeout
    };

    writeCostsState(state);
    return {
        allowed: true,
        reservationId,
        estimatedCost: Number(estCost.toFixed(5))
    };
}

/**
 * Confirma e taxa o custo real da chamada OpenAI após resposta
 */
export function recordOpenAICost({ reservationId, dealId = null, usage = null, estimatedTokens = 1500 } = {}) {
    const state = readCostsState();
    refreshDateBuckets(state);

    let actualCost = 0;
    let totalTokens = estimatedTokens;

    if (usage) {
        totalTokens = usage.total_tokens || (usage.prompt + usage.completion) || estimatedTokens;
        const promptCost = ((usage.prompt_tokens || usage.prompt || 0) / 1000) * COST_LIMITS.OPENAI_RATES.GPT4O_MINI_PROMPT_PER_1K;
        const completionCost = ((usage.completion_tokens || usage.completion || 0) / 1000) * COST_LIMITS.OPENAI_RATES.GPT4O_MINI_COMPLETION_PER_1K;
        actualCost = promptCost + completionCost;
    } else {
        actualCost = (estimatedTokens / 1000) * COST_LIMITS.OPENAI_RATES.GPT4O_MINI_COMPLETION_PER_1K;
    }

    // Atualizar estado
    state.openai.todayCost += actualCost;
    state.openai.todayTokens += totalTokens;
    state.openai.monthCost += actualCost;
    state.openai.monthTokens += totalTokens;
    state.openai.callsCountToday += 1;

    // Atualizar custo acumulado do negócio se informado
    if (dealId) {
        state.dealsCost = state.dealsCost || {};
        state.dealsCost[dealId] = Number(((state.dealsCost[dealId] || 0) + actualCost).toFixed(5));
    }

    // Libertar reserva
    if (reservationId && state.reservations[reservationId]) {
        delete state.reservations[reservationId];
    }

    writeCostsState(state);
    return {
        success: true,
        cost: Number(actualCost.toFixed(5)),
        tokens: totalTokens,
        todayCost: Number(state.openai.todayCost.toFixed(4)),
        monthCost: Number(state.openai.monthCost.toFixed(4))
    };
}

// ============================================================================
// VALIDAÇÃO E RESERVA ATÓMICA DE ORÇAMENTO WHATSAPP
// ============================================================================

/**
 * Valida limites por contacto, dia e mês antes de enviar mensagem WhatsApp
 * 
 * @param {Object} options
 * @param {string} options.phone - Número de telefone do destinatário
 * @param {string} options.dealId - ID do negócio
 * @param {string} options.category - 'MARKETING' | 'UTILITY' | 'SERVICE'
 * @param {boolean} options.isWithin24h - Se está dentro da janela de 24h
 * @returns {Object} { allowed: boolean, reservationId?: string, reason?: string }
 */
export function checkAndReserveWhatsAppBudget({ phone, dealId, category = 'MARKETING', isWithin24h = false } = {}) {
    if (!phone) return { allowed: false, reason: 'Telefone ausente', error: 'MISSING_PHONE' };

    const state = readCostsState();
    refreshDateBuckets(state);

    const clean = phone.replace(/\D/g, '');
    const contactInfo = state.contacts[clean] || { count: 0, attemptsWithoutResponse: 0 };

    // 1. Limite de mensagens por contacto
    if (contactInfo.count >= COST_LIMITS.MAX_MESSAGES_PER_CONTACT) {
        const reason = `Limite máximo de ${COST_LIMITS.MAX_MESSAGES_PER_CONTACT} mensagens para este contacto atingido.`;
        return { allowed: false, reason, error: 'CONTACT_MESSAGE_LIMIT_REACHED' };
    }

    // 2. Limite de tentativas consecutivas sem resposta
    if (contactInfo.attemptsWithoutResponse >= COST_LIMITS.MAX_ATTEMPTS_WITHOUT_RESPONSE) {
        const reason = `Contacto com ${contactInfo.attemptsWithoutResponse} tentativas sem resposta. Cadência pausada para evitar saturação e desperdício financeiro.`;
        return { allowed: false, reason, error: 'CONSECUTIVE_UNANSWERED_LIMIT_REACHED' };
    }

    // 2b. Limite de Custo Total por Negócio (Trava de Valor por Lead)
    state.dealsCost = state.dealsCost || {};
    const dealKey = dealId || clean;
    const currentDealCost = state.dealsCost[dealKey] || 0;
    if (currentDealCost >= COST_LIMITS.MAX_COST_PER_DEAL) {
        const reason = `Teto financeiro de €${COST_LIMITS.MAX_COST_PER_DEAL.toFixed(2)} por negócio atingido (gasto atual: €${currentDealCost.toFixed(3)}). Envio bloqueado para maximizar ROI.`;
        addBlockedReason(state, 'DEAL_BUDGET_CAP_REACHED', reason);
        writeCostsState(state);
        return { allowed: false, reason, error: 'DEAL_BUDGET_CAP_REACHED' };
    }

    // 3. Determinar custo aplicável
    let messageRate = COST_LIMITS.WHATSAPP_RATES.MARKETING_PT;
    if (category === 'UTILITY') messageRate = COST_LIMITS.WHATSAPP_RATES.UTILITY_PT;
    if (category === 'SERVICE' && isWithin24h) messageRate = COST_LIMITS.WHATSAPP_RATES.SERVICE_PT;

    const safetyBufferRatio = 1 - (COST_LIMITS.BUDGET_SAFETY_BUFFER_PERCENT / 100);
    const maxDayWithBuffer = COST_LIMITS.MAX_WHATSAPP_COST_PER_DAY * safetyBufferRatio;
    const maxMonthWithBuffer = COST_LIMITS.MAX_WHATSAPP_COST_PER_MONTH * safetyBufferRatio;

    // Concorrência: somar reservas ativas pendentes que ainda não foram confirmadas nem expiraram
    const activeReserved = getActiveReservedAmount(state, 'WHATSAPP');

    // 4. Limite diário de custo WhatsApp
    if ((state.whatsapp.todayCost + activeReserved + messageRate) > maxDayWithBuffer) {
        const reason = `Limite diário WhatsApp atingido (€${(state.whatsapp.todayCost + activeReserved).toFixed(2)}/€${maxDayWithBuffer.toFixed(2)} com buffer de 15%).`;
        addBlockedReason(state, 'WHATSAPP_DAILY_LIMIT', reason);
        writeCostsState(state);
        return { allowed: false, reason, error: 'WHATSAPP_DAILY_BUDGET_EXCEEDED' };
    }

    // 5. Limite mensal de custo WhatsApp
    if ((state.whatsapp.monthCost + activeReserved + messageRate) > maxMonthWithBuffer) {
        const reason = `Limite mensal WhatsApp atingido (€${(state.whatsapp.monthCost + activeReserved).toFixed(2)}/€${maxMonthWithBuffer.toFixed(2)}).`;
        addBlockedReason(state, 'WHATSAPP_MONTHLY_LIMIT', reason);
        writeCostsState(state);
        return { allowed: false, reason, error: 'WHATSAPP_MONTHLY_BUDGET_EXCEEDED' };
    }

    // Criar reserva atómica
    const reservationId = `res_wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    state.reservations[reservationId] = {
        type: 'WHATSAPP',
        phone: clean,
        dealId,
        amount: messageRate,
        category,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString()
    };

    writeCostsState(state);
    return {
        allowed: true,
        reservationId,
        rate: messageRate
    };
}

/**
 * Confirma o envio de WhatsApp, atualiza contadores e custo real
 */
export function recordWhatsAppCost({ reservationId, phone, dealId, category = 'MARKETING', isDelivered = false } = {}) {
    const state = readCostsState();
    refreshDateBuckets(state);

    // Se é apenas confirmação de entrega (delivery receipt), não duplica custos
    if (isDelivered) {
        state.whatsapp.todayDelivered = (state.whatsapp.todayDelivered || 0) + 1;
        state.whatsapp.monthDelivered = (state.whatsapp.monthDelivered || 0) + 1;
        writeCostsState(state);
        return {
            success: true,
            isDelivered: true,
            todayDelivered: state.whatsapp.todayDelivered,
            monthDelivered: state.whatsapp.monthDelivered,
            todayCost: Number(state.whatsapp.todayCost.toFixed(4)),
            monthCost: Number(state.whatsapp.monthCost.toFixed(4))
        };
    }

    const reservation = reservationId ? state.reservations[reservationId] : null;
    const clean = (phone || reservation?.phone || '').replace(/\D/g, '');
    const cost = reservation?.amount || COST_LIMITS.WHATSAPP_RATES.MARKETING_PT;

    const isEstimated = !process.env.META_WA_OFFICIAL_RATE;
    const rateSource = process.env.META_WA_OFFICIAL_RATE ? 'meta_account_rate' : 'meta_estimated_rate_pt';

    state.whatsapp.todayCost += cost;
    state.whatsapp.todayDispatches += 1;
    state.whatsapp.monthCost += cost;
    state.whatsapp.monthDispatches += 1;

    if (clean) {
        if (!state.contacts[clean]) {
            state.contacts[clean] = {
                count: 0,
                attemptsWithoutResponse: 0,
                firstContactAt: new Date().toISOString(),
                lastContactAt: new Date().toISOString()
            };
        }
        state.contacts[clean].count += 1;
        state.contacts[clean].attemptsWithoutResponse += 1; // Incrementa até haver resposta inbound
        state.contacts[clean].lastContactAt = new Date().toISOString();
    }

    // Atualizar custo acumulado por negócio (Trava de Valor por Lead)
    state.dealsCost = state.dealsCost || {};
    const dKey = dealId || clean;
    if (dKey) {
        state.dealsCost[dKey] = Number(((state.dealsCost[dKey] || 0) + cost).toFixed(4));
    }

    if (reservationId && state.reservations[reservationId]) {
        delete state.reservations[reservationId];
    }

    writeCostsState(state);
    return {
        success: true,
        cost,
        rateSource,
        isEstimated,
        todayCost: Number(state.whatsapp.todayCost.toFixed(4)),
        monthCost: Number(state.whatsapp.monthCost.toFixed(4)),
        contactMessagesCount: clean ? state.contacts[clean]?.count : null
    };
}

/**
 * Zera o contador de tentativas sem resposta quando o contacto responde
 */
export function recordContactResponse(phone) {
    if (!phone) return;
    const state = readCostsState();
    const clean = phone.replace(/\D/g, '');
    if (state.contacts[clean]) {
        state.contacts[clean].attemptsWithoutResponse = 0;
        state.contacts[clean].lastResponseAt = new Date().toISOString();
        writeCostsState(state);
    }
}

/**
 * Regista motivo de bloqueio no histórico para auditoria
 */
function addBlockedReason(state, code, description) {
    if (!state.blockedReasons) state.blockedReasons = [];
    state.blockedReasons.unshift({
        code,
        description,
        timestamp: new Date().toISOString()
    });
    if (state.blockedReasons.length > 20) state.blockedReasons.splice(20);
}

/**
 * Retorna o estado consolidado do controlador de custos
 */
export function getCostControllerStatus() {
    const state = readCostsState();
    refreshDateBuckets(state);

    const safetyBufferRatio = 1 - (COST_LIMITS.BUDGET_SAFETY_BUFFER_PERCENT / 100);

    return {
        date: state.today,
        month: state.month,
        openai: {
            todayCost: Number(state.openai.todayCost.toFixed(4)),
            todayLimit: COST_LIMITS.MAX_OPENAI_COST_PER_DAY,
            todayEffectiveLimit: Number((COST_LIMITS.MAX_OPENAI_COST_PER_DAY * safetyBufferRatio).toFixed(2)),
            todayTokens: state.openai.todayTokens,
            monthCost: Number(state.openai.monthCost.toFixed(4)),
            monthLimit: COST_LIMITS.MAX_OPENAI_COST_PER_MONTH,
            callsCountToday: state.openai.callsCountToday
        },
        whatsapp: {
            todayCost: Number(state.whatsapp.todayCost.toFixed(4)),
            todayLimit: COST_LIMITS.MAX_WHATSAPP_COST_PER_DAY,
            todayEffectiveLimit: Number((COST_LIMITS.MAX_WHATSAPP_COST_PER_DAY * safetyBufferRatio).toFixed(2)),
            todayDispatches: state.whatsapp.todayDispatches,
            todayDelivered: state.whatsapp.todayDelivered || 0,
            monthCost: Number(state.whatsapp.monthCost.toFixed(4)),
            monthLimit: COST_LIMITS.MAX_WHATSAPP_COST_PER_MONTH,
            isRateEstimated: !process.env.META_WA_OFFICIAL_RATE,
            rateSource: process.env.META_WA_OFFICIAL_RATE ? 'meta_account_rate' : 'meta_estimated_rate_pt'
        },
        safetyBufferPercent: COST_LIMITS.BUDGET_SAFETY_BUFFER_PERCENT,
        activeReservationsCount: Object.keys(state.reservations || {}).length,
        activeReservations: {
            count: Object.keys(state.reservations || {}).length,
            openaiReserved: Number(getActiveReservedAmount(state, 'OPENAI').toFixed(4)),
            whatsappReserved: Number(getActiveReservedAmount(state, 'WHATSAPP').toFixed(4))
        },
        contactsTrackedCount: Object.keys(state.contacts || {}).length,
        recentBlockedReasons: state.blockedReasons?.slice(0, 5) || []
    };
}

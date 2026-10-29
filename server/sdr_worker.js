/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — EXECUTOR AUTÓNOMO EM BACKGROUND (FASE B.14.1)
 * ============================================================================
 * Executor em background independente da interface do browser.
 * 
 * Funcionalidades:
 * 1. Agendamento em horário comercial português (09h00-17h00 Seg-Sex)
 * 2. Triage e alimentação da fila a partir do CRM Vamuss
 * 3. Processamento de tarefas com lock atómico contra concorrência
 * 4. Circuit Breaker (proteção contra falhas consecutivas de APIs externas)
 * 5. Kill Switch (SDR_KILL_SWITCH=true para paragem de emergência imediata)
 * 6. Limite diário de abordagens (Daily Rate Limiting)
 * 7. Salvaguardas fail-closed de supressão e Gate Legal imediatamente antes do envio
 * 8. Handshake e transição fluida entre SDR e Closer
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

import {
    readTaskQueue,
    writeTaskQueue,
    enqueueTask,
    lockNextReadyTasks,
    recoverOrphanedTasks,
    completeTask,
    failTask,
    pauseTask,
    getTaskQueueStats,
    TASK_STATES,
    TASK_TYPES
} from './sdr_task_queue.js';
import { readReconciliationStore } from './sdr_eligibility_reconciler.js';

import {
    getSDRWorkQueue,
    reconstructFactualHistory,
    validateContactIdentity,
    classifyLossReason,
    calculateRecoverabilityScore,
    selectStrategy,
    runGPTDiagnosisAndStrategy,
    generateDeterministicStrategy,
    handleRecordOutcome,
    isMobilePhone
} from './sdr_engine.js';

import {
    isPhoneSuppressedLocally,
    addLocalSuppression
} from './suppression_store.js';

import {
    calculateInteractionCost,
    selectABVariant,
    getLearningContextForDeal,
    WHATSAPP_COST_PER_MESSAGE
} from './sdr_learning.js';

import {
    runConversationalDecisionGPT,
    checkWhatsApp24hWindow
} from './sdr_conversational_engine.js';

import {
    checkAndReserveWhatsAppBudget,
    recordWhatsAppCost,
    cancelReservation,
    getCostControllerStatus
} from './sdr_cost_controller.js';

import {
    getWhatsAppWebStatus,
    sendWhatsAppWebMessage
} from './whatsapp_web.js';

import {
    isWithinBusinessHours,
    validateDispatchTiming,
    getNextBusinessWindow
} from './sdr_business_hours.js';

import {
    recordFirstMessageDispatch,
    updateDealOutcome,
    recordLeadObjection,
    generateWeeklyLearningReport,
    formatWeeklyReportForWhatsApp
} from './sdr_learning_analytics.js';

const STATE_FILE = path.resolve(process.cwd(), 'data', 'sdr_worker_state.json');

// Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Lê o estado do worker (contadores diários, circuit breaker, etc.)
 */
export function readWorkerState() {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return getDefaultWorkerState();
        }
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return getDefaultWorkerState();
    }
}

function getDefaultWorkerState() {
    return {
        dailyDispatchesCount: 0,
        dailyDateBucket: new Date().toISOString().slice(0, 10),
        consecutiveErrorsCount: 0,
        circuitBreakerTripped: false,
        circuitBreakerTrippedUntil: null,
        circuitBreakerReason: null,
        lastHeartbeat: new Date().toISOString(),
        totalTasksProcessed: 0,
        totalTasksSucceeded: 0,
        totalTasksFailed: 0
    };
}

/**
 * Grava o estado do worker no disco
 */
export function writeWorkerState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
        return true;
    } catch {
        return false;
    }
}

/**
 * B.14.2.1: Centralizado via api/sdr_business_hours.js (09h00-17h00 Seg-Sex, feriados excluídos)
 */
export const isPortugalBusinessHours = isWithinBusinessHours;

/**
 * Classe Central do Executor Autónomo SDR
 */
const NOTIFICATIONS_FILE = path.resolve(process.cwd(), 'data', 'sdr_operator_notifications.json');

function readOperatorNotifications() {
    try {
        if (fs.existsSync(NOTIFICATIONS_FILE)) {
            return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
        }
    } catch {}
    return { notifications: {} };
}

function writeOperatorNotifications(store) {
    try {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(store, null, 2), 'utf8');
        return true;
    } catch {
        return false;
    }
}

/**
 * Notifica o operador (Philipe) via WhatsApp quando um lead quer agendar reunião
 * Inclui verificação estrita de idempotência para evitar mensagens duplicadas.
 */
export async function notifyOperatorOnMeetingInterest({
    clinicName,
    contactPerson,
    phone,
    inboundText,
    reason,
    dealId,
    spinDossier = null,
    spinSummary = null,
    historySummary = null
}) {
    const operatorPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
    const store = readOperatorNotifications();
    const cleanInbound = (inboundText || '').trim().toLowerCase();
    const inboundHash = crypto.createHash('md5').update(cleanInbound).digest('hex').substring(0, 8);
    const notificationKey = `handoff_${dealId || 'nodeal'}_${inboundHash}`;

    if (store.notifications[notificationKey]) {
        console.log(`🔁 [Alerta Operador] Notificação ${notificationKey} já foi registada anteriormente. Evitando duplicação.`);
        return {
            success: true,
            delivered: store.notifications[notificationKey].status === 'delivered',
            duplicated: true,
            notificationKey
        };
    }

    const alertMessage = `🚨 *VAMUSS: LEAD QUER AGENDAR REUNIÃO!*\n\n` +
        `• *Clínica:* ${clinicName || 'Clínica Dentária'}\n` +
        `• *Contacto:* ${contactPerson || 'Doutor(a)'} (${phone || 'N/A'})\n` +
        `• *Deal ID:* ${dealId || 'N/A'}\n` +
        `• *Mensagem do Lead:* "${inboundText}"\n\n` +
        `${spinSummary ? `${spinSummary}\n\n` : ''}` +
        `📋 *Contexto & Dossiê:*\n` +
        `• *Problema Identificado:* ${spinDossier?.problema || reason || 'Captação de pacientes particulares para tratamentos rentáveis'}\n` +
        `• *Necessidade:* ${spinDossier?.necessidadeSolucao || 'Diagnóstico de viabilidade no Google sem dependência de convenções'}\n` +
        `• *Histórico:* ${historySummary || 'O lead demonstrou abertura clara para falar sobre o sistema.'}\n\n` +
        `✅ *AÇÃO AUTÓNOMA EXECUTADA:* O Closer já enviou o link do Cal.com (https://cal.com/philipecoelho/diagnostico-vamuss) diretamente ao lead!\n\n` +
        `👉 *Próximo passo:* O lead foi convidado a escolher a vaga. Quando marcar, serás notificado com a confirmação! Se não marcar em 24h, o Closer enviará um único lembrete de cortesia.`;

    try {
        const waWebStatus = getWhatsAppWebStatus();
        if (waWebStatus.isConnected) {
            await sendWhatsAppWebMessage(operatorPhone, alertMessage);
            console.log(`🔔 [Alerta Operador] Notificação de reunião enviada com sucesso para Philipe (+${operatorPhone})!`);
            store.notifications[notificationKey] = {
                dealId,
                operatorPhone,
                status: 'delivered',
                deliveredAt: new Date().toISOString(),
                inboundText
            };
            writeOperatorNotifications(store);
            return { success: true, delivered: true, notificationKey };
        } else {
            console.warn(`⚠️ [Alerta Operador] WhatsApp Web não conectado no momento. Guardando pendência para retry.`);
            store.notifications[notificationKey] = {
                dealId,
                operatorPhone,
                status: 'failed',
                error: 'WHATSAPP_WEB_NOT_CONNECTED',
                failedAt: new Date().toISOString(),
                inboundText
            };
            writeOperatorNotifications(store);
            return { success: false, delivered: false, error: 'WHATSAPP_WEB_NOT_CONNECTED', notificationKey };
        }
    } catch (e) {
        console.warn('⚠️ [Alerta Operador] Não foi possível enviar notificação WhatsApp para o operador:', e.message);
        store.notifications[notificationKey] = {
            dealId,
            operatorPhone,
            status: 'failed',
            error: e.message,
            failedAt: new Date().toISOString(),
            inboundText
        };
        writeOperatorNotifications(store);
        return { success: false, delivered: false, error: e.message, notificationKey };
    }
}

/**
 * Alerta imediato ao Philipe em caso de opt-out agressivo ou ameaça de queixa
 */
export async function notifyOperatorOnAggressiveComplaint(phone, messageText) {
    try {
        const opPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
        const msg = `🚨 *[ALERTA DE RECLAMAÇÃO / OPTOUT AGRESSIVO]*\n\n` +
            `• *Contacto:* +${phone}\n` +
            `• *Mensagem:* "${messageText}"\n\n` +
            `⚠️ O número foi adicionado à lista de supressão ativa e o envio foi cancelado de imediato.`;
        const waWebStatus = getWhatsAppWebStatus();
        if (waWebStatus.isConnected) {
            await sendWhatsAppWebMessage(opPhone, msg);
        }
    } catch (e) {
        console.warn('Aviso ao notificar reclamação:', e.message);
    }
}

/**
 * Envia o resumo diário das 17h30 para o WhatsApp do Philipe
 */
export async function sendDailySummaryToOperator() {
    try {
        const costs = readCostsState();
        const { getRecoveryPipelineData } = await import('./sdr_recovery_pipeline.js');
        const pipelineData = await getRecoveryPipelineData();
        const allTasks = readTaskQueue();
        const todayStr = new Date().toISOString().slice(0, 10);
        
        const tasksToday = allTasks.filter(t => (t.created_at || '').startsWith(todayStr));
        const dispatchesToday = tasksToday.filter(t => t.task_type === TASK_TYPES.DISPATCH_MESSAGE && t.state === TASK_STATES.EXECUTADA).length;
        const responsesToday = tasksToday.filter(t => t.task_type === TASK_TYPES.EVALUATE_INBOUND).length;
        const bookingsRequestedToday = tasksToday.filter(t => t.task_type === TASK_TYPES.EVALUATE_INBOUND && t.result?.classification === 'INTENCAO_AGENDAMENTO').length;
        const optoutsToday = tasksToday.filter(t => t.result?.classification === 'OPTOUT_OU_OPOSICAO').length;
        const failedTasksToday = tasksToday.filter(t => t.state === TASK_STATES.FALHADA).length;
        
        const totalEur = ((costs.whatsapp?.todayCost || 0) + (costs.openai?.todayCost || 0)).toFixed(4);

        const summaryMsg = `📊 *RESUMO DIÁRIO VAMUSS SDR + CLOSER (17h30)*\n\n` +
            `• *Mensagens Enviadas:* ${dispatchesToday}\n` +
            `• *Respostas Recebidas:* ${responsesToday}\n` +
            `• *Pedidos de Reunião:* ${bookingsRequestedToday}\n` +
            `• *Reuniões Marcadas (Cal.com):* ${pipelineData.metrics?.meetingsConfirmed || 0}\n` +
            `• *Opt-outs:* ${optoutsToday}\n` +
            `• *Falhas Registadas:* ${failedTasksToday}\n` +
            `• *Custos Acumulados Hoje:* €${totalEur} (OpenAI: €${(costs.openai?.todayCost || 0).toFixed(4)} / WA: €${(costs.whatsapp?.todayCost || 0).toFixed(2)})\n\n` +
            `O expediente comercial encerrou às 17h00. O robô retomará novas abordagens amanhã às 09h00!`;

        const opPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
        const wa = getWhatsAppWebStatus();
        if (wa.isConnected) {
            await sendWhatsAppWebMessage(opPhone, summaryMsg);
            console.log('📊 [Resumo Diário] Resumo das 17h30 enviado para o Philipe com sucesso.');
        }
    } catch (err) {
        console.error('Erro ao enviar resumo diário das 17h30:', err.message);
    }
}

export class SDROperationalWorker {
    constructor({
        workerId = `sdr_worker_${process.pid}_${Math.random().toString(36).substring(2, 6)}`,
        dailyDispatchLimit = parseInt(process.env.SDR_DAILY_DISPATCH_LIMIT, 10) || 20,
        circuitBreakerThreshold = 5,
        circuitBreakerCooldownMinutes = 15,
        stagingSimulationMode = process.env.SDR_LEGAL_GATE !== 'LIVE_AUTHORIZED'
    } = {}) {
        this.workerId = workerId;
        this.dailyDispatchLimit = dailyDispatchLimit;
        this.circuitBreakerThreshold = circuitBreakerThreshold;
        this.circuitBreakerCooldownMinutes = circuitBreakerCooldownMinutes;
        this.stagingSimulationMode = stagingSimulationMode;
        this.isRunning = false;
        this.intervalHandle = null;
    }

    /**
     * Verifica se o Kill Switch está ativo
     */
    isKillSwitchActive() {
        return process.env.SDR_KILL_SWITCH === 'true';
    }

    /**
     * Retorna o estado operacional consolidado do worker
     */
    getStatus() {
        const state = readWorkerState();
        const cb = this.checkCircuitBreaker(state);
        const reconciliationData = readReconciliationStore();
        return {
            workerId: this.workerId,
            isRunning: this.isRunning,
            isPortugalBusinessHours: isPortugalBusinessHours(),
            killSwitchActive: this.isKillSwitchActive(),
            legalGate: process.env.SDR_LEGAL_GATE || 'FAIL_CLOSED',
            operationalMode: this.isKillSwitchActive()
                ? 'BLOCKED_KILL_SWITCH'
                : (cb.active
                    ? 'PAUSED_CIRCUIT_BREAKER'
                    : (this.isRunning ? 'ACTIVE_RUNNING' : 'IDLE_STANDBY')),
            circuitBreaker: {
                tripped: cb.active,
                until: cb.until || null,
                reason: cb.reason || null,
                consecutiveErrors: state.consecutiveErrorsCount || 0,
                threshold: this.circuitBreakerThreshold
            },
            dailyDispatches: {
                count: state.dailyDispatchesCount || 0,
                limit: this.dailyDispatchLimit,
                dateBucket: state.dailyDateBucket
            },
            stagingSimulationMode: this.stagingSimulationMode,
            lastHeartbeat: state.lastHeartbeat,
            totalTasksProcessed: state.totalTasksProcessed || 0,
            totalTasksSucceeded: state.totalTasksSucceeded || 0,
            totalTasksFailed: state.totalTasksFailed || 0,
            queueStats: getTaskQueueStats(),
            costController: getCostControllerStatus(),
            reconciliationStats: reconciliationData?.summary || null,
            reconciliationLastRun: reconciliationData?.lastRun || null
        };
    }

    /**
     * Verifica e atualiza o estado do Circuit Breaker
     */
    checkCircuitBreaker(state) {
        const now = Date.now();
        if (state.circuitBreakerTripped) {
            if (state.circuitBreakerTrippedUntil && now > new Date(state.circuitBreakerTrippedUntil).getTime()) {
                console.log('🟢 [SDR Worker] Cooldown do Circuit Breaker concluído. Restaurando operação normal.');
                state.circuitBreakerTripped = false;
                state.circuitBreakerTrippedUntil = null;
                state.circuitBreakerReason = null;
                state.consecutiveErrorsCount = 0;
                writeWorkerState(state);
                return { active: false };
            }
            return {
                active: true,
                reason: state.circuitBreakerReason,
                until: state.circuitBreakerTrippedUntil
            };
        }
        return { active: false };
    }

    /**
     * Regista uma falha e aciona o Circuit Breaker se o limiar for excedido
     */
    recordFailure(errorMessage) {
        const state = readWorkerState();
        state.consecutiveErrorsCount = (state.consecutiveErrorsCount || 0) + 1;
        state.totalTasksFailed = (state.totalTasksFailed || 0) + 1;

        if (state.consecutiveErrorsCount >= this.circuitBreakerThreshold) {
            state.circuitBreakerTripped = true;
            state.circuitBreakerTrippedUntil = new Date(Date.now() + this.circuitBreakerCooldownMinutes * 60 * 1000).toISOString();
            state.circuitBreakerReason = `Excedido o limite de ${this.circuitBreakerThreshold} falhas consecutivas: ${errorMessage}`;
            console.error(`🚨 [SDR Worker] CIRCUIT BREAKER ATIVADO! Pausando execuções por ${this.circuitBreakerCooldownMinutes} min.`);
        }

        writeWorkerState(state);
    }

    /**
     * Regista sucesso e zera o contador de falhas consecutivas
     */
    recordSuccess() {
        const state = readWorkerState();
        state.consecutiveErrorsCount = 0;
        state.totalTasksSucceeded = (state.totalTasksSucceeded || 0) + 1;
        state.lastHeartbeat = new Date().toISOString();
        writeWorkerState(state);
    }

    /**
     * Executa a varredura do CRM e agenda tarefas para negócios elegíveis
     */
    async triageEligibleDeals(limit = 10) {
        try {
            console.log(`🔎 [SDR Worker] Varrendo CRM para identificação de negócios elegíveis (Limite: ${limit})...`);
            const reconciliationData = readReconciliationStore();
            const reconItems = reconciliationData?.items || {};

            let enqueuedCount = 0;

            // 1. Prioridade Máxima: Oportunidades que exigem o Closer (HUMAN_CLOSER_REQUIRED)
            for (const [dealId, recon] of Object.entries(reconItems)) {
                if (enqueuedCount >= limit) break;
                if (recon.status === 'HUMAN_CLOSER_REQUIRED') {
                    const res = enqueueTask({
                        dealId,
                        contactId: recon.contactId,
                        taskType: TASK_TYPES.CLOSER_QUALIFICATION,
                        channel: 'CALL',
                        priority: 'ALTA',
                        payload: {
                            dealId,
                            reason: recon.reason,
                            evidence: recon.evidence
                        }
                    });
                    if (res.success && !res.duplicated) {
                        enqueuedCount++;
                    }
                }
            }

            // 2. Varredura de candidatos do CRM
            const queueData = await getSDRWorkQueue({ limit: 150 });
            const candidates = queueData.candidates || [];

            // Limite estrito de Piloto Controlado: Iniciar exatamente até 5 novos leads frios por dia útil
            const pilotLimit = parseInt(process.env.SDR_PILOT_NEW_LEADS_LIMIT || '5', 10);
            const allTasks = readTaskQueue();
            const todayStr = new Date().toISOString().slice(0, 10);
            const startedPilotDeals = new Set(
                allTasks
                    .filter(t => (t.task_type === TASK_TYPES.DISPATCH_MESSAGE && t.result?.dispatched) && t.created_at?.slice(0, 10) === todayStr)
                    .map(t => t.deal_id)
            );

            if (startedPilotDeals.size >= pilotLimit) {
                console.log(`🛑 [SDR Worker Piloto] Limite diário de 5 novos leads atingido (${startedPilotDeals.size}/${pilotLimit}) para ${todayStr}. Foco 100% no fluxo conversacional das clínicas ativas.`);
                return { success: true, enqueuedCount: 0, pilotLimitReached: true };
            }

            const maxToEnqueue = Math.min(limit, pilotLimit - startedPilotDeals.size);

            for (const cand of candidates) {
                if (enqueuedCount >= maxToEnqueue) break;

                const recon = reconItems[cand.dealId];

                // Regra B.14.3.2: Nunca processar negócios desqualificados
                const isDesqualificado = (cand.lostReason || '').toLowerCase().includes('desqualificad') || recon?.status === 'BLOCKED_DESQUALIFIED';
                if (isDesqualificado) continue;

                // Regra de Suspensão da IA: Se já estiver em agendamento pendente humano ou pronto para reabrir, não reabordar!
                const { readRecoveryPipelineStore } = await import('./sdr_recovery_pipeline.js');
                const pipelineStore = readRecoveryPipelineStore();
                const pipelineItem = pipelineStore.deals[cand.dealId];
                if (pipelineItem?.stage === 'agendamento_pendente_humano' || pipelineItem?.stage === 'pronto_reabrir') {
                    continue;
                }

                // Verificar se é elegível para abordagem móvel WhatsApp autónoma
                const isAutonomousEligible = cand.isReadyForApproach && !cand.isSuppressed && !cand.legalGateBlocked && cand.isMobile;

                if (isAutonomousEligible) {
                    const res = enqueueTask({
                        dealId: cand.dealId,
                        contactId: cand.contactId,
                        taskType: TASK_TYPES.ANALYZE_DEAL,
                        channel: 'WHATSAPP',
                        priority: cand.priorityTier,
                        payload: {
                            clinicName: cand.clinicName,
                            contactPerson: cand.contactPerson,
                            phone: cand.phone,
                            lostReason: cand.lostReason,
                            daysSinceLost: cand.daysSinceLost,
                            isNonMessaging: false,
                            isPilotOutbound: true
                        }
                    });

                    if (res.success && !res.duplicated) {
                        enqueuedCount++;
                    }
                }
            }

            console.log(`📋 [SDR Worker] Varredura concluída: ${enqueuedCount} novas tarefas enfileiradas.`);
            return { success: true, enqueuedCount };
        } catch (err) {
            console.error('❌ [SDR Worker] Erro durante a varredura do CRM:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Processa uma única tarefa da fila com salvaguardas estritas
     */
    async processTask(task, options = {}) {
        if (this.isKillSwitchActive()) {
            console.warn(`⛔ [SDR Worker] Interrompendo tarefa ${task.id}: Kill Switch ativo (SDR_KILL_SWITCH=true).`);
            return { success: false, stoppedByKillSwitch: true, error: 'KILL_SWITCH_ACTIVE' };
        }

        console.log(`⚙️ [SDR Worker] Processando tarefa ${task.id} (${task.task_type}) para Deal: ${task.deal_id}`);

        try {
            switch (task.task_type) {
                // ------------------------------------------------------------
                // 1. ANÁLISE DE NEGÓCIO E PREPARAÇÃO DE ABORDAGEM
                // ------------------------------------------------------------
                case TASK_TYPES.ANALYZE_DEAL: {
                    const analyzeStartTime = Date.now();
                    let deal = null;
                    if (supabase) {
                        try {
                            const { data: d } = await supabase.from('deals').select('*').eq('id', task.deal_id).single();
                            deal = d;
                        } catch {
                            deal = null;
                        }
                    }

                    if (!deal && (task.payload?.clinicName || task.payload?.deal)) {
                        deal = task.payload.deal || {
                            id: task.deal_id,
                            title: task.payload.clinicName,
                            contact_id: task.contact_id || 'test_contact_01',
                            lost_reason: task.payload.lostReason || 'Sem resposta',
                            status: 'lost',
                            updated_at: new Date(Date.now() - (task.payload.daysSinceLost || 45) * 86400000).toISOString()
                        };
                    }

                    if (!deal) {
                        failTask(task.id, 'Negócio não encontrado no CRM', { allowRetry: false });
                        return { success: false, error: 'DEAL_NOT_FOUND' };
                    }

                    // Regra B.14.3.2: Bloqueio definitivo de desqualificados
                    const dealLostReason = (deal.lost_reason || task.payload?.lostReason || '').toLowerCase();
                    if (dealLostReason.includes('desqualificad')) {
                        console.warn(`🛑 [SDR Worker] Tarefa ${task.id} cancelada: Deal ${deal.id} está desqualificado.`);
                        failTask(task.id, 'BLOQUEADO_DESQUALIFICADO: Negócio desqualificado na origem.', { allowRetry: false });
                        return { success: false, blocked: true, error: 'BLOQUEADO_DESQUALIFICADO' };
                    }

                    let contact = null;
                    if (supabase && deal.contact_id) {
                        try {
                            const { data: c } = await supabase.from('contacts').select('*').eq('id', deal.contact_id).single();
                            contact = c;
                        } catch {
                            contact = null;
                        }
                    }

                    if (!contact && (task.payload?.contactPerson || task.payload?.phone)) {
                        contact = {
                            id: deal.contact_id || 'test_contact_01',
                            name: task.payload.contactPerson || 'Dr. Responsável Clínico',
                            phone: task.payload.phone,
                            email: task.payload.email || 'contacto@clinicasaojeronimo.pt',
                            role: 'Diretor Clínico'
                        };
                    }

                    // Regra B.14.3.5: Se for unsubscribed, marca como isNonMessaging para permitir análise e diagnóstico internos sem envio de mensagens
                    const isUnsubscribed = (contact?.marketing_status || task.payload?.marketing_status) === 'unsubscribed';
                    if (task.payload?.blockAnalysisOnUnsubscribed && isUnsubscribed) {
                        console.warn(`🛑 [SDR Worker] Tarefa ${task.id} cancelada: Contacto do Deal ${deal.id} possui marketing_status='unsubscribed'.`);
                        failTask(task.id, 'BLOQUEADO_SUPRESSAO_UNSUBSCRIBED: Contacto com marketing_status=unsubscribed no CRM.', { allowRetry: false });
                        return { success: false, blocked: true, error: 'BLOQUEADO_SUPRESSAO_UNSUBSCRIBED' };
                    }
                    if (isUnsubscribed) {
                        task.payload = task.payload || {};
                        task.payload.isNonMessaging = true;
                    }

                    let activities = [];
                    if (supabase) {
                        try {
                            const { data: acts } = await supabase.from('activities').select('*').eq('deal_id', deal.id).order('date', { ascending: true });
                            activities = acts || [];
                        } catch {
                            activities = [];
                        }
                    }

                    // Reconstrução factual e validações
                    const factualHistory = reconstructFactualHistory(activities, []);
                    const contactValidation = validateContactIdentity(contact, deal, []);
                    const lossClassification = classifyLossReason(deal.lost_reason || '', activities, []);

                    // Respiro comercial
                    const daysSinceLost = deal.updated_at 
                        ? Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
                        : 999;

                    const recoverability = calculateRecoverabilityScore({
                        deal,
                        contact,
                        activities,
                        daysSinceLost,
                        lossClassification,
                        contactValidation,
                        previousAttempts: []
                    });

                    // Seleção deliberada de estratégia
                    const selectedStrategy = selectStrategy(factualHistory, lossClassification, contactValidation, []);

                    // Se a estratégia for PAUSA_EVITAR_SATURACAO, pausa a tarefa
                    if (selectedStrategy.strategy === 'PAUSA_EVITAR_SATURACAO') {
                        pauseTask(task.id, 'Pausa comercial ativada para evitar saturação do lead');
                        return { success: true, paused: true, strategyResult: selectedStrategy };
                    }

                    // B.14.1.5: Consultar aprendizagens antes do GPT
                    const learningContext = getLearningContextForDeal({
                        segment: lossClassification.category || '',
                        lossClassification: lossClassification.category || '',
                        strategy: selectedStrategy.strategy || ''
                    });

                    // B.14.1.5: Verificar se existe teste A/B ativo
                    const abVariant = selectABVariant(deal.id, lossClassification.category || '');

                    // Gerar proposta de diagnóstico e cópia comercial
                    const gptDiagnosis = await runGPTDiagnosisAndStrategy({
                        deal,
                        contact,
                        activities,
                        daysSinceLost,
                        lossClassification,
                        recoverability,
                        factualHistory,
                        contactValidation,
                        selectedStrategy,
                        previousAttempts: []
                    });

                    // Enfileirar a tarefa de disparo subsequente
                    const recommendedText = gptDiagnosis.mensagem_sdr_pt_pt?.texto_recomendado || gptDiagnosis.mensagem_sdr_pt_pt?.texto;
                    const channel = gptDiagnosis.mensagem_sdr_pt_pt?.canal_sugerido || task.channel || 'WHATSAPP';

                    // B.14.1.5: Construir metadata enriquecido para rastreio de aprendizagem
                    const learningMetadata = {
                        segment: lossClassification.category || 'DESCONHECIDO',
                        approach_type: selectedStrategy.strategy || 'DESCONHECIDO',
                        message_variant: abVariant?.variant_id || 'default',
                        gpt_decision: gptDiagnosis.estrategia_comercial?.estrategia_selecionada || selectedStrategy.strategy,
                        gpt_justification: (gptDiagnosis.raciocinio_interno?.porque_esta_abordagem || selectedStrategy.reasoning?.join(' ') || '').substring(0, 500),
                        openai_token_usage: gptDiagnosis.openai_token_usage || null,
                        whatsapp_cost_est: channel === 'WHATSAPP' ? WHATSAPP_COST_PER_MESSAGE : 0,
                        time_spent_seconds: Number(((Date.now() - analyzeStartTime) / 1000).toFixed(1)),
                        ab_test_id: abVariant?.test_id || null,
                        hypothesis_id: abVariant?.hypothesis_id || null,
                        learning_context_used: learningContext.rules.length > 0 || learningContext.disabledStrategies.length > 0
                    };

                    // Persistência no CRM (Supabase) da Análise e Diagnóstico (sem duplicações)
                    const isNonMessaging = task.payload?.isNonMessaging || (contact?.marketing_status === 'unsubscribed');
                    if (supabase && deal?.id) {
                        try {
                            const { data: existingActs } = await supabase
                                .from('activities')
                                .select('id')
                                .eq('deal_id', deal.id)
                                .ilike('title', '%Diagnóstico SDR Autónomo%')
                                .limit(1);

                            if (!existingActs || existingActs.length === 0) {
                                const angle = recommendedText || 'Abordagem consultiva focada em tratamentos particulares de alto valor';
                                await supabase.from('activities').insert({
                                    user_id: deal.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e',
                                    deal_id: deal.id,
                                    type: 'system',
                                    title: `Diagnóstico SDR Autónomo [${selectedStrategy.strategy}] (Score: ${recoverability.score}/100)`,
                                    notes: `Estratégia: ${selectedStrategy.strategy}\nScore de Recuperabilidade: ${recoverability.score}/100 (${recoverability.priorityTier})\nCanal: ${channel}\nEstado: ${isNonMessaging ? 'PREPARADO_INTERNAMENTE_SEM_DISPARO' : 'PRONTO_PARA_DISPARO'}\nÂngulo Clínico: ${angle.substring(0, 500)}`,
                                    date: new Date().toISOString(),
                                    completed: true,
                                    is_automatic: true
                                });
                            }

                            // Atualizar prioridade do deal no CRM com base no score
                            const crmPriority = recoverability.priorityTier === 'ALTA' ? 'high' : recoverability.priorityTier === 'MEDIA' ? 'medium' : 'low';
                            await supabase.from('deals').update({ priority: crmPriority }).eq('id', deal.id);
                        } catch (crmErr) {
                            console.warn('⚠️ [SDR Worker] Aviso ao persistir análise no CRM:', crmErr.message);
                        }
                    }

                    // B.14.3.5: Se o Gate Legal estiver travado (FAIL_CLOSED), armazena a preparação interna sem agendar disparo
                    const isLegalGateLive = process.env.SDR_LEGAL_GATE === 'LIVE_AUTHORIZED';
                    const hasExplicitSuppression = isPhoneSuppressedLocally(contact?.phone || task.payload?.phone, deal.id, contact?.id);

                    if (!isLegalGateLive || hasExplicitSuppression) {
                        completeTask(task.id, {
                            strategy: selectedStrategy.strategy,
                            channel: channel,
                            score: recoverability.score,
                            nextTask: hasExplicitSuppression ? 'HELD_SUPPRESSED' : 'INTERNAL_PREPARATION_STORED',
                            status: hasExplicitSuppression ? 'BLOQUEADO_OPTOUT_SUPRESSAO' : 'PREPARADO_INTERNAMENTE_SEM_DISPARO',
                            learningMetadata: learningMetadata,
                            gptDiagnosis: gptDiagnosis
                        });
                        this.recordSuccess();
                        return {
                            success: true,
                            score: recoverability.score,
                            strategy: selectedStrategy.strategy,
                            preparedInternally: true,
                            messagingHeld: true
                        };
                    }

                    // Se a validação de identidade exigir revisão humana para o envio, sinaliza na tarefa subsequente
                    const requiresReviewForSend = !contactValidation.canSend;

                    const nextEnq = enqueueTask({
                        dealId: deal.id,
                        contactId: contact?.id || null,
                        taskType: TASK_TYPES.DISPATCH_MESSAGE,
                        channel: channel,
                        requiresHumanReview: requiresReviewForSend,
                        payload: {
                            clinicName: contact?.name || deal.title,
                            phone: contact?.phone || task.payload?.phone,
                            messageText: recommendedText,
                            strategy: selectedStrategy.strategy,
                            gptDiagnosis: gptDiagnosis,
                            learningMetadata: learningMetadata,
                            isPilotOutbound: task.payload?.isPilotOutbound || true,
                            humanReviewReason: requiresReviewForSend ? contactValidation.issues.join('; ') : null
                        }
                    });

                    completeTask(task.id, {
                        strategy: selectedStrategy.strategy,
                        channel: channel,
                        score: recoverability.score,
                        nextTask: 'DISPATCH_MESSAGE',
                        learningMetadata: learningMetadata
                    });

                    this.recordSuccess();
                    return {
                        success: true,
                        taskType: TASK_TYPES.ANALYZE_DEAL,
                        strategyResult: selectedStrategy,
                        nextTaskId: nextEnq.taskId,
                        learningMetadata: learningMetadata
                    };
                }

                // ------------------------------------------------------------
                // 2. DISPARO DE MENSAGEM COM SALVAGUARDAS FAIL-CLOSED
                // ------------------------------------------------------------
                case TASK_TYPES.DISPATCH_MESSAGE: {
                    const phone = task.payload?.phone;
                    const messageText = task.payload?.messageText;
                    const strategy = task.payload?.strategy || 'REGISTO_OPERACIONAL';

                    // 1. Validação de elegibilidade móvel
                    if (!isMobilePhone(phone)) {
                        failTask(task.id, 'Canal inelegível: Telefone não é um telemóvel móvel português válido (deve iniciar por 9)', { allowRetry: false });
                        return { success: false, error: 'INELIGIBLE_CHANNEL' };
                    }

                    // 2. Verificação Fail-Closed da lista de supressão (Local + Supabase)
                    const cleanPhoneDigits = (phone || '').replace(/\D/g, '');
                    if (isPhoneSuppressedLocally(cleanPhoneDigits, task.deal_id, task.contact_id)) {
                        failTask(task.id, 'Contacto ou negócio consta da lista de supressão ativa', { allowRetry: false });
                        return { success: false, error: 'CONTACT_SUPPRESSED' };
                    }

                    // 2.1 B.14.2: Verificação e Reserva Atómica de Orçamento e Limites por Contacto
                    const budgetReservation = checkAndReserveWhatsAppBudget({
                        phone: cleanPhoneDigits,
                        dealId: task.deal_id,
                        category: task.payload?.category || 'MARKETING'
                    });
                    if (!budgetReservation.allowed) {
                        pauseTask(task.id, `Execução pausada por controlo de custos: ${budgetReservation.reason}`);
                        return { success: false, error: budgetReservation.error || 'BUDGET_LIMIT_REACHED', reason: budgetReservation.reason };
                    }

                    // 3. Verificação de Horário Comercial Centralizado (09h00-17h00 Seg-Sex, exceto feriados)
                    const bypassHours = options.forceSimulateHour || process.env.NODE_ENV === 'test';
                    const timing = validateDispatchTiming(new Date());
                    if (!timing.permitido && !bypassHours) {
                        // Libertar reserva orçamental
                        if (budgetReservation?.reservationId) {
                            cancelReservation(budgetReservation.reservationId);
                        }
                        // Reagendar para a próxima janela útil com reavaliação de contexto
                        const nextWindow = timing.proxima_janela_util || getNextBusinessWindow(new Date()).toISOString();
                        const tasks = readTaskQueue();
                        const t = tasks.find(x => x.id === task.id);
                        if (t) {
                            t.state = TASK_STATES.PENDENTE;
                            t.locked_at = null;
                            t.locked_by = null;
                            t.next_run_at = nextWindow;
                            t.error = `Aguardando abertura de expediente (${timing.motivo}: ${timing.detalhe})`;
                            writeTaskQueue(tasks);
                        }
                        return { success: false, error: 'OUTSIDE_BUSINESS_HOURS', timing };
                    }

                    // 3.1 B.14.2: Verificação da Janela de 24 horas da Meta WhatsApp Cloud API
                    const window24h = checkWhatsApp24hWindow(task.payload?.lastInboundDate);
                    const requiresTemplate = window24h.requiresTemplate && !task.payload?.templateName;

                    // 4. Verificação do Gate Legal Fail-Closed
                    const isLegalGateOpen = process.env.SDR_LEGAL_GATE === 'LIVE_AUTHORIZED';

                    if (!isLegalGateOpen) {
                        // Modo Staging Simulation Protegido:
                        // O worker NÃO dispara na Meta API real, mas executa o registo de staging auditado
                        console.log(`🛡️ [SDR Worker] Gate Legal em FAIL-CLOSED. Executando simulação protegida para Deal: ${task.deal_id}`);
                        
                        const outcomeResult = await handleRecordOutcome({
                            dealId: task.deal_id,
                            contactId: task.contact_id,
                            phone: phone,
                            outcome: 'EXECUTADA',
                            channel: task.channel || 'WHATSAPP',
                            strategy: strategy,
                            notes: `[Simulação Staging / Gate Fail-Closed] Mensagem preparada: "${messageText?.slice(0, 80)}..."`,
                            executedBy: `SDR Autonomous Worker (${this.workerId})`,
                            metadata: {
                                ...(task.payload?.learningMetadata || {}),
                                staging_simulation: true
                            }
                        });

                        completeTask(task.id, {
                            dispatched: false,
                            simulation: true,
                            reason: 'GATE_LEGAL_FAIL_CLOSED_SIMULATION',
                            outcomeResult: outcomeResult
                        });

                        this.recordSuccess();
                        return {
                            success: true,
                            simulated: true,
                            isStagingSimulation: true,
                            messageId: `sim_wamid_${Date.now()}`
                        };
                    }

                    // 5. Se o Gate Legal estiver aberto (LIVE_AUTHORIZED): Disparo real via Meta Cloud API
                    const state = readWorkerState();
                    if ((state.dailyDispatchesCount || 0) >= this.dailyDispatchLimit) {
                        pauseTask(task.id, `Limite diário de disparos atingido (${this.dailyDispatchLimit}/dia)`);
                        return { success: false, error: 'DAILY_LIMIT_REACHED' };
                    }

                    const cleanDigits = (phone || '').replace(/\D/g, '');
                    const recipientPhone = cleanDigits.startsWith('351') ? cleanDigits : `351${cleanDigits}`;

                    const waWebStatus = getWhatsAppWebStatus();
                    let messageId = null;
                    let isWebDispatch = false;

                    // PRIORIDADE 1: Se o WhatsApp Web do Philipe estiver conectado via QR Code, dispara diretamente pela sessão real!
                    if (waWebStatus.isConnected) {
                        console.log(`📤 [SDR Worker] Disparando via WhatsApp Web (Sessão do Philipe) para +${recipientPhone}...`);
                        try {
                            const webRes = await sendWhatsAppWebMessage(recipientPhone, messageText);
                            messageId = webRes.messageId;
                            isWebDispatch = true;
                            console.log(`✅ [SDR Worker] Mensagem enviada pelo WhatsApp Web! ID: ${messageId}`);
                        } catch (webErr) {
                            console.error(`❌ [SDR Worker] Falha no WhatsApp Web: ${webErr.message}`);
                            failTask(task.id, `Falha no envio via WhatsApp Web: ${webErr.message}`, { allowRetry: true });
                            return { success: false, error: 'WHATSAPP_WEB_ERROR', details: webErr.message };
                        }
                    } else {
                        // PRIORIDADE 2: Fallback para Meta Cloud API oficial
                        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
                        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

                        // Regra da Meta: início de conversa outbound exige template aprovado
                        const templateName = task.payload?.templateName || (requiresTemplate ? 'hello_world' : null);
                        const metaPayload = {
                            messaging_product: 'whatsapp',
                            recipient_type: 'individual',
                            to: recipientPhone,
                            type: templateName ? 'template' : 'text'
                        };

                        if (templateName) {
                            metaPayload.template = {
                                name: templateName,
                                language: { code: templateName === 'hello_world' ? 'en_US' : 'pt_PT' }
                            };
                        } else {
                            metaPayload.text = {
                                preview_url: false,
                                body: messageText
                            };
                        }

                        console.log(`📤 [SDR Worker] Disparando Meta WhatsApp Cloud API para +${recipientPhone}...`);

                        let metaResponse = null;
                        let metaData = null;
                        try {
                            metaResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(metaPayload)
                            });
                            metaData = await metaResponse.json();
                        } catch (netErr) {
                            failTask(task.id, `Falha de rede ao conectar à Meta API: ${netErr.message}`, { allowRetry: true });
                            return { success: false, error: 'META_NETWORK_ERROR', details: netErr.message };
                        }

                        if (!metaResponse.ok || metaData.error) {
                            const errMsg = metaData?.error?.message || `Meta API HTTP ${metaResponse.status}`;
                            console.error(`❌ [SDR Worker] Erro da Meta API: ${errMsg} (Code: ${metaData?.error?.code})`);
                            failTask(task.id, `Meta API Erro: ${errMsg}`, { allowRetry: false });
                            this.recordFailure(errMsg);
                            return {
                                success: false,
                                error: 'META_API_ERROR',
                                code: metaData?.error?.code,
                                message: errMsg,
                                details: metaData
                            };
                        }

                        messageId = metaData.messages?.[0]?.id || `wamid_${Date.now()}`;
                        console.log(`✅ [SDR Worker] Mensagem disparada com sucesso! WAMID: ${messageId}`);
                    }

                    // Incrementar contador diário
                    state.dailyDispatchesCount = (state.dailyDispatchesCount || 0) + 1;
                    writeWorkerState(state);

                    const outcomeResult = await handleRecordOutcome({
                        dealId: task.deal_id,
                        contactId: task.contact_id,
                        phone: phone,
                        outcome: 'EXECUTADA',
                        channel: task.channel || 'WHATSAPP',
                        strategy: strategy,
                        notes: `[Disparo Real WhatsApp ${isWebDispatch ? 'Web' : 'Cloud API'}] Mensagem enviada para ${phone} (ID: ${messageId})`,
                        executedBy: `SDR Autonomous Worker (${this.workerId})`,
                        metadata: {
                            ...(task.payload?.learningMetadata || {}),
                            staging_simulation: false,
                            provider: isWebDispatch ? 'whatsapp_web' : 'meta_cloud_api',
                            whatsapp_cost_actual: isWebDispatch ? 0 : WHATSAPP_COST_PER_MESSAGE,
                            wamid: messageId
                        }
                    });

                    // B.15.3: Registar primeira abordagem no rastreador de testes A/B e aprendizagem
                    recordFirstMessageDispatch({
                        dealId: task.deal_id,
                        contactId: task.contact_id,
                        phone: recipientPhone,
                        clinicName: task.payload?.clinicName || '',
                        variant: task.payload?.learningMetadata?.message_variant || 'A',
                        angle: strategy,
                        lossReason: task.payload?.lossReason || 'Perda anterior',
                        usedWebFact: task.payload?.learningMetadata?.usedWebFact || null,
                        messageText: messageText
                    });

                    // Registar atividade no CRM Supabase
                    if (supabase && task.deal_id) {
                        try {
                            const { data: d } = await supabase.from('deals').select('user_id').eq('id', task.deal_id).single();
                            await supabase.from('activities').insert({
                                user_id: d?.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e',
                                deal_id: task.deal_id,
                                type: 'whatsapp',
                                title: `Mensagem Enviada via WhatsApp ${isWebDispatch ? 'Web' : 'Cloud API'}`,
                                notes: messageText || 'Mensagem enviada com sucesso',
                                date: new Date().toISOString(),
                                completed: true
                            });
                        } catch (crmErr) {
                            console.warn('⚠️ [SDR Worker] Aviso ao persistir atividade de envio no CRM:', crmErr.message);
                        }
                    }

                    completeTask(task.id, {
                        dispatched: true,
                        channel: task.channel,
                        recipient: phone,
                        messageId: messageId,
                        outcomeResult: outcomeResult
                    });

                    this.recordSuccess();
                    return { success: true, dispatched: true, messageId: messageId, isStagingSimulation: false };
                }

                // ------------------------------------------------------------
                // 3. AVALIAÇÃO INTELIGENTE DE RESPOSTA INBOUND
                // ------------------------------------------------------------
                case TASK_TYPES.EVALUATE_INBOUND: {
                    const text = task.payload?.textContent || '';
                    const dealId = task.deal_id;
                    const fromPhone = task.payload?.fromPhone || '';

                    console.log(`📥 [SDR Worker] Avaliando resposta inbound para Deal ${dealId} com Inteligência Conversacional: "${text}"`);

                    // 1. Obter dados de contexto
                    let deal = null;
                    if (supabase && dealId && !dealId.startsWith('deal_inbound_')) {
                        try {
                            const { data: d } = await supabase.from('deals').select('*').eq('id', dealId).single();
                            deal = d;
                        } catch {}
                    }
                    if (!deal) {
                        deal = { id: dealId, title: task.payload?.clinicName || 'Contacto Inbound', lost_reason: task.payload?.lostReason || 'Inbound' };
                    }

                    let contact = null;
                    if (supabase && task.contact_id) {
                        try {
                            const { data: c } = await supabase.from('contacts').select('*').eq('id', task.contact_id).single();
                            contact = c;
                        } catch {}
                    }
                    if (!contact) {
                        contact = { id: task.contact_id, phone: fromPhone, name: 'Contacto WhatsApp' };
                    }

                    // Regra B.14.3.2: Inbound recebido de negócio desqualificado NÃO gera automação nem cadência
                    const inboundDealReason = (deal.lost_reason || task.payload?.lostReason || '').toLowerCase();
                    if (inboundDealReason.includes('desqualificad')) {
                        console.warn(`🛑 [SDR Worker] Inbound de Deal desqualificado ${dealId}. Nenhuma automação será executada.`);
                        completeTask(task.id, {
                            blocked: true,
                            reason: 'BLOQUEADO_DESQUALIFICADO',
                            message: 'Inbound factual registado, mas automações desativadas para negócios desqualificados.'
                        });
                        return { success: true, blocked: true, reason: 'BLOQUEADO_DESQUALIFICADO' };
                    }

                    // Apenas bloqueia se o contacto estiver na lista de supressão ativa (Opt-out explícito)
                    const cleanFromPhone = (fromPhone || '').replace(/\D/g, '');
                    const isExplicitlySuppressed = isPhoneSuppressedLocally(cleanFromPhone, dealId, task.contact_id);
                    if (isExplicitlySuppressed) {
                        console.warn(`🛑 [SDR Worker] Inbound de Contacto suprimido (+${cleanFromPhone}). Automação bloqueada por Opt-out.`);
                        completeTask(task.id, {
                            blocked: true,
                            reason: 'SUPRESSAO_OPTOUT_ATIVA',
                            message: 'Inbound factual registado na timeline, mas automação bloqueada por supressão expressa.'
                        });
                        return { success: true, blocked: true, reason: 'SUPRESSAO_OPTOUT_ATIVA' };
                    }

                    // 2. Buscar histórico cronológico de atividades para contextualizar o GPT
                    let recentActivities = [];
                    if (supabase && dealId) {
                        try {
                            const { data: acts } = await supabase
                                .from('activities')
                                .select('*')
                                .eq('deal_id', dealId)
                                .order('date', { ascending: false })
                                .limit(10);
                            recentActivities = acts || [];
                        } catch {}
                    }

                    // 3. Invocar Motor Conversacional GPT Grounded com Gestão de Custos
                    const decision = await runConversationalDecisionGPT({
                        inboundText: text,
                        deal,
                        contact,
                        recentActivities,
                        lastInboundDate: task.payload?.receivedAt || new Date().toISOString(),
                        stageId: deal.stage_id || 'stage_lead_identificado'
                    });

                    console.log(`🧠 [SDR Worker] Decisão conversacional: [${decision.intencao_identificada}] -> Ação: ${decision.proxima_acao}`);

                    // B.15.3: Catalogar objeção ou resposta real no repositório de inteligência
                    recordLeadObjection({
                        dealId: dealId,
                        clinicName: contact?.name || deal?.title,
                        text: text,
                        isAudioTranscript: Boolean(task.payload?.isAudio),
                        classification: decision.intencao_identificada
                    });

                    // 4. Encaminhamento Estruturado por Intenção:
                    
                    // 4.1. Opt-out explícito ou Oposição
                    if (decision.intencao_identificada === 'OPTOUT_OU_OPOSICAO') {
                        addLocalSuppression({
                            dealId: dealId,
                            contactId: task.contact_id,
                            telefoneNormalizado: fromPhone,
                            motivoBloqueio: 'OPTOUT_EXPLICITO'
                        });

                        updateDealOutcome({
                            dealId: dealId,
                            phone: fromPhone,
                            newOutcome: 'OPTOUT',
                            inboundText: text
                        });

                        const { executeRecoveryAction } = await import('./sdr_recovery_pipeline.js');
                        try {
                            await executeRecoveryAction({
                                dealId,
                                action: 'close_lost_unrecovered',
                                payload: { reason: `Opt-out solicitado: "${text}"` }
                            });
                        } catch {}

                        await handleRecordOutcome({
                            dealId: dealId,
                            contactId: task.contact_id,
                            phone: fromPhone,
                            outcome: 'OPTOUT',
                            notes: `Opt-out expressamente solicitado: "${text}"`,
                            executedBy: `SDR Conversational Agent (${this.workerId})`,
                            metadata: {
                                complaint_flag: true,
                                opposition_flag: true,
                                inbound_text: text,
                                response_classification: 'OPTOUT',
                                conversational_decision: decision
                            }
                        });

                        completeTask(task.id, { evaluation: 'OPTOUT_ACTIVATED', decision });
                        this.recordSuccess();
                        return { success: true, evaluation: 'OPTOUT', classification: 'OPTOUT', decision };
                    }

                    // 4.2. ⭐ INTENÇÃO EXPLÍCITA DE AGENDAMENTO DE REUNIÃO / CONVERSA ⭐
                    // O cliente manifestou interesse em agendar! O Closer envia o link do Cal.com de imediato, suspende a IA e avisa o Philipe!
                    if (decision.intencao_identificada === 'INTENCAO_AGENDAMENTO' || decision.funnel_event === 'MEETING_REQUESTED_HANDOFF') {
                        console.log(`⭐ [SDR Worker] INTENÇÃO DE AGENDAMENTO DETETADA para Deal ${dealId}! Enviando link do Cal.com...`);

                        // 1. Atualizar Pipeline de Recuperação para agendamento_pendente_humano e suspender IA
                        const { triggerCloserHandoff } = await import('./sdr_recovery_pipeline.js');
                        const handoffResult = await triggerCloserHandoff({
                            dealId,
                            reason: 'Intenção de agendamento manifestada pelo lead',
                            triggerMessage: text
                        });

                        // 2. Disparar link do Cal.com diretamente para o lead via WhatsApp Web
                        const calcomMsg = decision.mensagem_sugerida || `Excelente, Dr(a)! Para agendarmos a nossa Reunião de Diagnóstico de 20 minutos com a máxima conveniência para a sua agenda, pode escolher diretamente o melhor dia e horário aqui: https://cal.com/philipecoelho/diagnostico-vamuss\n\nFico a aguardar a sua confirmação!`;
                        try {
                            const waStatus = getWhatsAppWebStatus();
                            if (waStatus.isConnected) {
                                await sendWhatsAppWebMessage(fromPhone, calcomMsg);
                                console.log(`📤 [Closer Autónomo] Link do Cal.com enviado com sucesso para +${fromPhone}!`);
                            }
                        } catch (sendErr) {
                            console.error('Erro ao enviar link do Cal.com:', sendErr.message);
                        }

                        // 3. Enfileirar lembrete único de 24 horas caso o lead não marque no link
                        enqueueTask({
                            dealId: dealId,
                            contactId: task.contact_id,
                            taskType: TASK_TYPES.CALCOM_24H_REMINDER,
                            channel: 'WHATSAPP',
                            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                            payload: {
                                clinicName: contact?.name || deal?.title,
                                phone: fromPhone,
                                dealId: dealId
                            }
                        });

                        // 4. Registar Desfecho Factual no CRM e Aprendizagem
                        updateDealOutcome({
                            dealId: dealId,
                            phone: fromPhone,
                            newOutcome: 'LINK_CALCOM_ENVIADO',
                            inboundText: text
                        });

                        await handleRecordOutcome({
                            dealId: dealId,
                            contactId: task.contact_id,
                            phone: fromPhone,
                            outcome: 'INTENCAO_AGENDAMENTO',
                            notes: `Intenção de agendamento manifestada: "${text}". Link do Cal.com enviado ao cliente.`,
                            evidence: `Mensagem recebida do cliente: "${text}"`,
                            executedBy: `SDR Conversational Agent (${this.workerId})`,
                            metadata: {
                                inbound_text: text,
                                response_classification: 'INTENCAO_AGENDAMENTO',
                                calcom_link_sent: true,
                                handoff: true,
                                conversational_decision: decision
                            }
                        });

                        // 5. Registar atividade no Supabase CRM (se ativo)
                        if (supabase && dealId) {
                            try {
                                const { data: d } = await supabase.from('deals').select('user_id').eq('id', dealId).single();
                                await supabase.from('activities').insert({
                                    user_id: d?.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e',
                                    deal_id: dealId,
                                    type: 'meeting',
                                    title: '⭐ Reunião Solicitada — Link do Cal.com Enviado ao Lead',
                                    notes: `O lead demonstrou interesse em agendar conversa!\nResposta exata: "${text}"\n\nO Closer enviou o link do Cal.com (https://cal.com/philipecoelho/diagnostico-vamuss) ao lead. Lembrete único programado para 24h caso não haja agendamento.`,
                                    date: new Date().toISOString(),
                                    completed: false,
                                    is_automatic: true
                                });
                                await supabase.from('deal_logs').insert({
                                    deal_id: dealId,
                                    content: `Intenção de agendamento detetada: "${text}". Link do Cal.com enviado ao cliente. Handoff notificado ao operador.`,
                                    log_type: 'system'
                                });
                            } catch (e) {
                                console.warn('⚠️ Erro ao gravar atividade de handoff no Supabase:', e.message);
                            }
                        }

                        // 6. Disparar notificação imediata via WhatsApp para o Philipe (com garantia de idempotência)
                        const notifResult = await notifyOperatorOnMeetingInterest({
                            clinicName: contact?.name || deal?.title,
                            contactPerson: contact?.name || deal?.title,
                            phone: fromPhone,
                            inboundText: text,
                            dealId: dealId,
                            reason: decision.justificacao_comercial,
                            spinSummary: decision.spin_summary || null,
                            spinDossier: {
                                problema: 'Captação de pacientes particulares para tratamentos de rentabilidade (implantes/reabilitação)',
                                necessidadeSolucao: 'Diagnóstico de 20 min sobre viabilidade no Google sem dependência de convenções'
                            },
                            historySummary: recentActivities.slice(0, 3).map(a => `• [${a.type || 'WhatsApp'}] ${a.title || a.notes}`).join('\n')
                        });

                        completeTask(task.id, {
                            evaluation: 'MEETING_INTENT_DETECTED_HANDOFF',
                            handoff: true,
                            calcomSent: true,
                            notification: notifResult,
                            decision
                        });
                        this.recordSuccess();
                        return {
                            success: true,
                            evaluation: 'INTENCAO_AGENDAMENTO',
                            classification: 'INTENCAO_AGENDAMENTO',
                            handoff: true,
                            calcomSent: true,
                            notification: notifResult,
                            decision
                        };
                    }

                    // 4.3. Necessidade de Revisão Humana (assuntos clínicos complexos, reclamações)
                    if (decision.intervencao_humana_necessaria) {
                        const tasks = readTaskQueue();
                        const t = tasks.find(x => x.id === task.id);
                        if (t) {
                            t.state = TASK_STATES.AGUARDANDO_REVISAO_HUMANA;
                            t.error = decision.motivo_intervencao || 'Revisão humana necessária para interpretar resposta';
                            t.locked_at = null;
                            t.locked_by = null;
                            t.updated_at = new Date().toISOString();
                            writeTaskQueue(tasks);
                        }

                        await handleRecordOutcome({
                            dealId: dealId,
                            contactId: task.contact_id,
                            phone: fromPhone,
                            outcome: 'RESPOSTA_POSITIVA',
                            notes: `Resposta requer intervenção humana: "${text}"`,
                            evidence: text,
                            executedBy: `SDR Conversational Agent (${this.workerId})`,
                            metadata: {
                                human_intervention: true,
                                inbound_text: text,
                                response_classification: decision.intencao_identificada,
                                conversational_decision: decision
                            }
                        });

                        this.recordSuccess();
                        return { success: true, requiresHumanReview: true, decision };
                    }

                    // 4.4. Interesse Genuíno / Curiosidade (Sem pedido explícito de reunião ainda)
                    // O Closer conduz o diálogo com qualificação SPIN e respostas consultivas!
                    if (decision.intencao_identificada === 'INTERESSE_GENUINO') {
                        updateDealOutcome({
                            dealId: dealId,
                            phone: fromPhone,
                            newOutcome: 'RESPOSTA_POSITIVA',
                            inboundText: text
                        });

                        await handleRecordOutcome({
                            dealId: dealId,
                            contactId: task.contact_id,
                            phone: fromPhone,
                            outcome: 'RESPOSTA_POSITIVA',
                            notes: `Interesse genuíno em resposta inbound: "${text}"`,
                            evidence: `Mensagem recebida do cliente: "${text}"`,
                            executedBy: `SDR Conversational Agent (${this.workerId})`,
                            metadata: {
                                inbound_text: text,
                                response_classification: 'INTERESSE_GENUINO',
                                conversational_decision: decision
                            }
                        });

                        const { executeRecoveryAction } = await import('./sdr_recovery_pipeline.js');
                        try {
                            await executeRecoveryAction({
                                dealId,
                                action: 'move_stage',
                                payload: { stage: 'em_conversa' }
                            });
                        } catch {}

                        // Enfileira a resposta consultiva do Closer via WhatsApp Web
                        let replyTaskId = null;
                        if (decision.mensagem_sugerida && decision.mensagem_sugerida.trim() !== '') {
                            console.log(`💬 [Closer SPIN] Enfileirando resposta consultiva para +${fromPhone}: "${decision.mensagem_sugerida.slice(0, 60)}..."`);
                            const replyRes = enqueueTask({
                                dealId: dealId,
                                contactId: task.contact_id,
                                taskType: TASK_TYPES.DISPATCH_MESSAGE,
                                channel: 'WHATSAPP',
                                priority: 'ALTA',
                                payload: {
                                    clinicName: contact?.name || deal?.title,
                                    phone: fromPhone,
                                    messageText: decision.mensagem_sugerida,
                                    strategy: 'CONVERSACIONAL_QUALIFICACAO_SPIN',
                                    inboundReference: text
                                }
                            });
                            replyTaskId = replyRes.taskId;
                        }

                        completeTask(task.id, { evaluation: 'QUALIFIED_INTEREST_CLOSER_ENGAGED', decision, replyTaskId });
                        this.recordSuccess();
                        return {
                            success: true,
                            evaluation: 'INTERESSE_GENUINO',
                            classification: 'INTERESSE_GENUINO',
                            replyTaskId,
                            decision
                        };
                    }

                    // 4.5. Objeção, Pedido de Informação ou Timing -> Responder e Continuar a Conversa
                    const outcomeType = decision.intencao_identificada === 'RECUSA_EDUCADA' ? 'RESPOSTA_NEGATIVA' : 'RESPOSTA_POSITIVA';
                    updateDealOutcome({
                        dealId: dealId,
                        phone: fromPhone,
                        newOutcome: decision.intencao_identificada === 'RECUSA_EDUCADA' ? 'RECUSA' : 'RESPOSTA_NEUTRA',
                        inboundText: text
                    });

                    await handleRecordOutcome({
                        dealId: dealId,
                        contactId: task.contact_id,
                        phone: fromPhone,
                        outcome: outcomeType,
                        notes: `Resposta classificada como ${decision.intencao_identificada}: "${text}"`,
                        evidence: text,
                        executedBy: `SDR Conversational Agent (${this.workerId})`,
                        metadata: {
                            inbound_text: text,
                            response_classification: decision.intencao_identificada,
                            conversational_decision: decision
                        }
                    });

                    // Atualizar pipeline para em_conversa ou nao_reativado
                    const { executeRecoveryAction } = await import('./sdr_recovery_pipeline.js');
                    try {
                        const targetStage = decision.intencao_identificada === 'RECUSA_EDUCADA' ? 'nao_reativado' : 'em_conversa';
                        await executeRecoveryAction({
                            dealId,
                            action: 'move_stage',
                            payload: { stage: targetStage }
                        });
                    } catch {}

                    // 1. Gravar data de retorno em caso de adiamento ("agora não", "daqui a X meses")
                    if (decision.intencao_identificada === 'ADIAMENTO_OU_TIMING' && decision.returnDate) {
                        try {
                            const { readRecoveryPipelineStore, writeRecoveryPipelineStore } = await import('./sdr_recovery_pipeline.js');
                            const pStore = readRecoveryPipelineStore();
                            if (pStore.deals[dealId]) {
                                pStore.deals[dealId].returnDate = decision.returnDate;
                                pStore.deals[dealId].notes = (pStore.deals[dealId].notes || '') + ` | Retorno agendado: ${decision.returnDate.slice(0, 10)}`;
                                writeRecoveryPipelineStore(pStore);
                            }
                            if (supabase && dealId) {
                                await supabase.from('deals').update({ follow_up_date: decision.returnDate }).eq('id', dealId);
                            }
                            console.log(`📅 [SDR Adiamento] Retorno agendado para ${dealId}: ${decision.returnDate.slice(0, 10)}`);
                        } catch (retErr) {
                            console.warn('Aviso ao gravar data de retorno:', retErr.message);
                        }
                    }

                    // 2. Proteção Anti-Risco: Circuit Breaker sensível para Opt-outs Agressivos / Reclamações
                    if (decision.intencao_identificada === 'OPTOUT_OU_OPOSICAO') {
                        const isAggressive = /(queixa|denúncia|denuncia|bloquear|advogado|cnpd|tribunal|polícia|policia|litígio|litigio)/i.test(text);
                        if (isAggressive) {
                            const workerState = readWorkerState();
                            workerState.aggressiveOptOutsToday = (workerState.aggressiveOptOutsToday || 0) + 1;
                            writeWorkerState(workerState);

                            await notifyOperatorOnAggressiveComplaint(fromPhone, text);

                            if (workerState.aggressiveOptOutsToday >= 2) {
                                console.warn('🚨 [Circuit Breaker Sensível] 2 opt-outs agressivos registados hoje. Pausando novos leads até amanhã 09h00.');
                                workerState.circuitBreakerTripped = true;
                                workerState.circuitBreakerTrippedUntil = getNextBusinessWindow(new Date()).toISOString();
                                workerState.circuitBreakerReason = '2 opt-outs agressivos ou queixas registadas no dia. Envio de novos leads pausado preventivamente.';
                                writeWorkerState(workerState);

                                const opPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
                                const waStatus = getWhatsAppWebStatus();
                                if (waStatus.isConnected) {
                                    await sendWhatsAppWebMessage(opPhone, `🚨 *[CIRCUIT BREAKER SDR ATIVADO]*\n\nForam registados 2 opt-outs agressivos ou queixas no dia de hoje.\nO envio de novos leads frios foi suspenso preventivamente até amanhã às 09h00 para proteger a reputação do teu telemóvel.`);
                                }
                            }
                        }
                    }

                    // 3. Se a IA gerou mensagem de resposta (resposta a dúvidas, tratamento de objeção), enfileira com ATRASO NATURAL (1 a 4 minutos)
                    let followUpTaskId = null;
                    if (decision.mensagem_sugerida && decision.mensagem_sugerida.trim() !== '' && decision.intencao_identificada !== 'RECUSA_EDUCADA' && decision.intencao_identificada !== 'INTENCAO_AGENDAMENTO') {
                        const naturalDelayMs = 60000 + Math.floor(Math.random() * 180000); // 1 a 4 minutos
                        const scheduledAt = new Date(Date.now() + naturalDelayMs).toISOString();

                        console.log(`💬 [SDR Conversacional] Enfileirando resposta para +${fromPhone} com atraso natural de ${(naturalDelayMs / 1000).toFixed(0)}s: "${decision.mensagem_sugerida.slice(0, 60)}..."`);
                        const followUpRes = enqueueTask({
                            dealId: dealId,
                            contactId: task.contact_id,
                            taskType: TASK_TYPES.DISPATCH_MESSAGE,
                            channel: 'WHATSAPP',
                            priority: 'ALTA',
                            scheduledFor: scheduledAt,
                            payload: {
                                clinicName: contact?.name || deal?.title,
                                phone: fromPhone,
                                messageText: decision.mensagem_sugerida,
                                strategy: `CONVERSACIONAL_${decision.proxima_acao}`,
                                inboundReference: text
                            }
                        });
                        followUpTaskId = followUpRes.taskId;
                    }

                    completeTask(task.id, { evaluation: 'CONVERSATIONAL_DECISION_RECORDED', decision, followUpTaskId });
                    this.recordSuccess();
                    return {
                        success: true,
                        evaluation: outcomeType,
                        classification: decision.intencao_identificada,
                        followUpTaskId,
                        decision
                    };
                }

                // ------------------------------------------------------------
                // 4. QUALIFICAÇÃO PELO CLOSER (SPIN SELLING) + ACIONAR OPERADOR
                // ------------------------------------------------------------
                case TASK_TYPES.CLOSER_QUALIFICATION: {
                    console.log(`🤝 [Closer Worker] Iniciando qualificação SPIN para Deal ${task.deal_id}`);
                    
                    const closerDossier = {
                        spinDossier: {
                            situacao: 'Lead respondeu positivamente com prioridade em implantes e pacientes particulares.',
                            problema: 'Dependência de convenções de baixa margem e fluxo imprevisível.',
                            implicacao: 'Cadeiras ociosas em tratamentos de alta rentabilidade.',
                            necessidadeSolucao: 'Sistema Google da Vamuss para captação direta de pacientes pagantes.'
                        },
                        proximaAcaoCloser: 'AGENDAR_REUNIAO_DIAGNOSTICO_20MIN',
                        propostaValorAlinhada: 'Ajudamos clínicas dentárias em Portugal a atrair pacientes particulares para tratamentos rentáveis (implantes e reabilitação) via Google sem dependência de redes sociais.',
                        pitchSugerido: 'Excelente, Dr. O nosso modelo foca-se precisamente na pesquisa ativa no Google para pacientes particulares com necessidade imediata de implantes. Faz sentido reservarmos 20 minutos esta semana para um diagnóstico do potencial da sua zona?'
                    };

                    const clinicName = task.payload?.clinicName || 'Clínica Dentária';
                    const clientPhone = task.payload?.phone || 'Ver CRM';
                    const triggerText = task.payload?.triggerMessage || 'Interesse manifestado no WhatsApp';

                    // Apenas notifica o operador se for intenção explícita de agendamento solicitada
                    if (task.payload?.isBookingIntent || task.payload?.notifyOperator) {
                        await notifyOperatorOnMeetingInterest({
                            clinicName: clinicName,
                            contactPerson: clinicName,
                            phone: clientPhone,
                            dealId: task.deal_id,
                            inboundText: triggerText,
                            reason: closerDossier.spinDossier.problema,
                            spinDossier: closerDossier.spinDossier
                        });
                    }

                    // 2. Persistência no CRM da tarefa para o Closer (o negócio permanece como perdido até reabertura manual pelo Philipe)
                    if (supabase && task.deal_id) {
                        try {
                            const { data: existingCloserTask } = await supabase
                                .from('activities')
                                .select('id')
                                .eq('deal_id', task.deal_id)
                                .ilike('title', '%Ação Closer Requerida%')
                                .eq('completed', false)
                                .limit(1);

                            if (!existingCloserTask || existingCloserTask.length === 0) {
                                const { data: d } = await supabase.from('deals').select('user_id').eq('id', task.deal_id).single();
                                await supabase.from('activities').insert({
                                    user_id: d?.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e',
                                    deal_id: task.deal_id,
                                    type: 'call',
                                    title: 'Reunião de Diagnóstico Solicitada — Aguarda Reabertura Manual pelo Philipe',
                                    notes: `O lead confirmou interesse em agendar conversa!\nResposta: "${triggerText}"\n\nDossiê SPIN:\n- Situação: ${closerDossier.spinDossier.situacao}\n- Problema: ${closerDossier.spinDossier.problema}\n- Implicação: ${closerDossier.spinDossier.implicacao}\n- Necessidade: ${closerDossier.spinDossier.necessidadeSolucao}\n\nPitch Sugerido:\n${closerDossier.pitchSugerido}`,
                                    date: new Date().toISOString(),
                                    completed: false,
                                    is_automatic: true
                                });
                                await supabase.from('deal_logs').insert({
                                    deal_id: task.deal_id,
                                    content: 'Oportunidade qualificada pelo SDR. O lead aceitou agendar conversa. Aguardando reabertura manual do negócio pelo operador no funil de prospeção.',
                                    log_type: 'system'
                                });
                            }
                        } catch (closerErr) {
                            console.warn('⚠️ [Closer Worker] Aviso ao persistir tarefa no CRM:', closerErr.message);
                        }
                    }

                    completeTask(task.id, {
                        closerAction: 'SPIN_ROUTINE_PREPARED',
                        notes: 'Dossiê SPIN preparado e operador notificado para agendamento da Reunião de Diagnóstico.',
                        closerDossier: closerDossier
                    });

                    this.recordSuccess();
                    return {
                        success: true,
                        closerActive: true,
                        closerDossier: closerDossier
                    };
                }

                // ------------------------------------------------------------
                // 5. LEMBRETE ÚNICO DE 24 HORAS PARA LINK CAL.COM
                // ------------------------------------------------------------
                case TASK_TYPES.CALCOM_24H_REMINDER: {
                    const dealId = task.deal_id;
                    const phone = task.payload?.phone;
                    const clinicName = task.payload?.clinicName || 'Clínica Dentária';

                    console.log(`⏰ [Cal.com 24h Reminder] Verificando se o Deal ${dealId} agendou no Cal.com...`);

                    let isAlreadyBooked = false;
                    if (supabase && dealId) {
                        try {
                            const { data: d } = await supabase.from('deals').select('stage_id').eq('id', dealId).single();
                            if (d && (d.stage_id === 'stage_reuniao' || d.stage_id === 'stage_proposta' || d.stage_id === 'stage_fechamento')) {
                                isAlreadyBooked = true;
                            }
                        } catch {}
                    }

                    const { readRecoveryPipelineStore } = await import('./sdr_recovery_pipeline.js');
                    const pStore = readRecoveryPipelineStore();
                    const pItem = pStore.deals[dealId];
                    if (pItem?.stage === 'reuniao_confirmada') {
                        isAlreadyBooked = true;
                    }

                    if (isAlreadyBooked) {
                        console.log(`✅ [Cal.com 24h Reminder] Deal ${dealId} já possui reunião confirmada. Lembrete dispensado.`);
                        completeTask(task.id, { skipped: true, reason: 'ALREADY_BOOKED' });
                        this.recordSuccess();
                        return { success: true, skipped: true };
                    }

                    // Se não marcou, envia um ÚNICO lembrete de cortesia
                    const reminderText = `Boa tarde à equipa da ${clinicName}. Apenas uma breve nota de acompanhamento sobre a nossa conversa de ontem: caso ainda pretendam realizar o diagnóstico de 20 minutos, o link com a disponibilidade da equipa técnica continua disponível: https://cal.com/philipecoelho/diagnostico-vamuss. Bom trabalho para toda a equipa.`;

                    const waStatus = getWhatsAppWebStatus();
                    if (waStatus.isConnected && phone) {
                        await sendWhatsAppWebMessage(phone, reminderText);
                        console.log(`📤 [Cal.com 24h Reminder] Lembrete único enviado para +${phone}. Autonomia encerrada.`);
                    }

                    completeTask(task.id, { dispatched: true, reminderSent: true });
                    this.recordSuccess();
                    return { success: true, dispatched: true };
                }

                default: {
                    completeTask(task.id, { note: `Tarefa do tipo ${task.task_type} concluída sem ação adicional.` });
                    return { success: true };
                }
            }
        } catch (err) {
            console.error(`❌ [SDR Worker] Erro ao processar tarefa ${task.id}:`, err.message);
            this.recordFailure(err.message);
            failTask(task.id, err.message, { allowRetry: true });
            return { success: false, error: err.message };
        }
    }

    /**
     * Executa um ciclo completo de verificação e processamento (Tick do Worker)
     */
    async tick(options = {}) {
        // 1. Verificação do Kill Switch de Emergência
        if (process.env.SDR_KILL_SWITCH === 'true') {
            console.warn('⛔ [SDR Worker] Kill Switch ativo (SDR_KILL_SWITCH=true). Nenhuma tarefa será processada.');
            return { success: false, stoppedByKillSwitch: true };
        }

        const state = readWorkerState();

        // 2. Reset diário de contadores se virou o dia
        const todayBucket = new Date().toISOString().slice(0, 10);
        if (state.dailyDateBucket !== todayBucket) {
            state.dailyDateBucket = todayBucket;
            state.dailyDispatchesCount = 0;
            writeWorkerState(state);
        }

        // 3. Verificação do Circuit Breaker
        const cbStatus = this.checkCircuitBreaker(state);
        if (cbStatus.active) {
            console.warn(`🛑 [SDR Worker] Circuit Breaker ativo até ${cbStatus.until}. Motivo: ${cbStatus.reason}`);
            return { success: false, circuitBreakerTripped: true, reason: cbStatus.reason };
        }

        // 4. Obter tarefas bloqueadas para execução
        const tasksToRun = lockNextReadyTasks(this.workerId, options.batchSize || 5);

        // Se não houver tarefas prontas na fila e a varredura estiver autorizada, realiza triage
        if (tasksToRun.length === 0 && options.autoTriage !== false) {
            const triageRes = await this.triageEligibleDeals(options.triageLimit || 5);
            if (triageRes.enqueuedCount > 0) {
                const newTasks = lockNextReadyTasks(this.workerId, options.batchSize || 5);
                tasksToRun.push(...newTasks);
            }
        }

        const results = [];
        for (const task of tasksToRun) {
            const res = await this.processTask(task, options);
            results.push({ taskId: task.id, ...res });

            // Proteção Anti-Banimento: Se foi um disparo real, aplica delay aleatório humano (45s a 90s)
            if (res.dispatched && task.task_type === TASK_TYPES.DISPATCH_MESSAGE) {
                const delayMs = 45000 + Math.floor(Math.random() * 45000);
                console.log(`🛡️ [Anti-Banimento WhatsApp] Pausa preventiva de ${(delayMs / 1000).toFixed(0)}s para simular digitação humana e proteger o telemóvel...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        return {
            success: true,
            workerId: this.workerId,
            tasksProcessed: tasksToRun.length,
            results: results,
            stats: getTaskQueueStats()
        };
    }

    /**
     * Inicia o loop periódico do worker em background
     */
    start({ intervalMinutes = 5 } = {}) {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`🚀 [SDR Worker] Iniciado em background (${this.workerId}) — Intervalo: ${intervalMinutes} min.`);

        // B.14.3.5: Recuperar imediatamente tarefas travadas de processos anteriores
        try {
            recoverOrphanedTasks();
        } catch (e) {
            console.warn('⚠️ [SDR Worker] Aviso ao recuperar tarefas órfãs:', e.message);
        }

        // Executa imediatamente o primeiro ciclo
        this.tick().catch(err => console.error('❌ Erro no tick inicial do worker:', err));

        // Agenda o ciclo contínuo
        this.intervalHandle = setInterval(() => {
            this.tick().catch(err => console.error('❌ Erro no tick do worker:', err));
        }, intervalMinutes * 60 * 1000);

        // Agendamento dos ciclos de prospeção espaçados (Horário de Lisboa):
        // Em vez de disparar as 5 mensagens de uma vez às 09h, o agente espaça ao longo do dia para testar horários:
        // Slot 1: 10h15 (2 novos leads)
        // Slot 2: 12h30 (1 novo lead — intervalo de almoço)
        // Slot 3: 15h15 (1 novo lead — meio da tarde)
        // Slot 4: 16h40 (1 novo lead + follow-up de silêncio para quem não respondeu)
        try {
            // Slot 1 — 10h15: 2 leads
            cron.schedule('15 10 * * 1-5', async () => {
                console.log('⏰ [Cron 10h15 Seg-Sex] Disparando Slot 1 do Agente SDR (2 leads)...');
                try {
                    const { runAutonomousOutboundCycle } = await import('./vamuss_commercial_agent.js');
                    await runAutonomousOutboundCycle({ limit: 2 });
                } catch (e) {
                    console.warn('⚠️ [SDR Worker] Erro no Slot 1 das 10h15:', e.message);
                }
            }, { timezone: 'Europe/Lisbon' });

            // Slot 2 — 12h30: 1 lead
            cron.schedule('30 12 * * 1-5', async () => {
                console.log('⏰ [Cron 12h30 Seg-Sex] Disparando Slot 2 do Agente SDR (1 lead - almoço)...');
                try {
                    const { runAutonomousOutboundCycle } = await import('./vamuss_commercial_agent.js');
                    await runAutonomousOutboundCycle({ limit: 3 }); // cumulativo até 3
                } catch (e) {
                    console.warn('⚠️ [SDR Worker] Erro no Slot 2 das 12h30:', e.message);
                }
            }, { timezone: 'Europe/Lisbon' });

            // Slot 3 — 15h15: 1 lead
            cron.schedule('15 15 * * 1-5', async () => {
                console.log('⏰ [Cron 15h15 Seg-Sex] Disparando Slot 3 do Agente SDR (1 lead - tarde)...');
                try {
                    const { runAutonomousOutboundCycle } = await import('./vamuss_commercial_agent.js');
                    await runAutonomousOutboundCycle({ limit: 4 }); // cumulativo até 4
                } catch (e) {
                    console.warn('⚠️ [SDR Worker] Erro no Slot 3 das 15h15:', e.message);
                }
            }, { timezone: 'Europe/Lisbon' });

            // Slot 4 — 16h40: 1 lead + follow-ups
            cron.schedule('40 16 * * 1-5', async () => {
                console.log('⏰ [Cron 16h40 Seg-Sex] Disparando Slot 4 do Agente SDR (fecho de quota e follow-ups)...');
                try {
                    const { runAutonomousOutboundCycle } = await import('./vamuss_commercial_agent.js');
                    await runAutonomousOutboundCycle({ limit: 5 }); // completa a quota de 5
                } catch (e) {
                    console.warn('⚠️ [SDR Worker] Erro no Slot 4 das 16h40:', e.message);
                }
            }, { timezone: 'Europe/Lisbon' });

            console.log('📅 [SDR Worker] Cadência espaçada ativa: 10h15, 12h30, 15h15 e 16h40 (Europe/Lisbon).');

            cron.schedule('30 17 * * 1-5', async () => {
                console.log('⏰ [Cron 17h30] Disparando resumo diário operacional para o Philipe...');
                await sendDailySummaryToOperator();
            }, {
                timezone: 'Europe/Lisbon'
            });
            console.log('📅 [SDR Worker] Cron de resumo diário às 17h30 (Europe/Lisbon) ativo.');

            // Agendamento do relatório semanal de aprendizagem e testes A/B às 17h35 de Sexta-feira
            cron.schedule('35 17 * * 5', async () => {
                console.log('⏰ [Cron 17h35 Sexta] Enviando Relatório Semanal de Aprendizagem para o Philipe...');
                try {
                    const report = generateWeeklyLearningReport();
                    const text = formatWeeklyReportForWhatsApp(report);
                    const operatorPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
                    const wa = getWhatsAppWebStatus();
                    if (wa.isConnected) {
                        await sendWhatsAppWebMessage(operatorPhone, text);
                    }
                } catch (e) {
                    console.warn('⚠️ [SDR Worker] Erro ao enviar relatório semanal:', e.message);
                }
            }, {
                timezone: 'Europe/Lisbon'
            });
            console.log('📅 [SDR Worker] Cron de relatório semanal de aprendizagem às sextas 17h35 (Europe/Lisbon) ativo.');
        } catch (cronErr) {
            console.warn('⚠️ [SDR Worker] Aviso ao agendar cron das 17h30:', cronErr.message);
        }
    }

    /**
     * Para o loop do worker
     */
    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        this.isRunning = false;
        console.log(`⏹️ [SDR Worker] Parado com sucesso (${this.workerId}).`);
    }
}

// Instância singleton para uso em endpoints da API
export const defaultSDRWorker = new SDROperationalWorker();

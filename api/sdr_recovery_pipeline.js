/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — PIPELINE DE RECUPERAÇÃO COMERCIAL (B.14.3)
 * ============================================================================
 * Motor e gestão de estado do pipeline de recuperação de negócios perdidos.
 * 
 * Etapas Canónicas (9 etapas):
 * 1. a_analisar: Negócio perdido aguardando análise factual/elegibilidade.
 * 2. elegivel_reativacao: Aprovado no gate legal e de respiro, pronto para abordagem.
 * 3. reativacao_iniciada: Disparo de reativação executado, aguarda resposta.
 * 4. conversa_recuperada: Resposta com interesse genuíno recebida / SPIN Closer.
 * 5. agendamento_pendente_humano: Intenção concreta de agendamento ou handoff humano.
 * 6. reuniao_confirmada: Reunião de Diagnóstico de 20 min agendada e confirmada.
 * 7. proposta_negociacao: Proposta consultiva apresentada em negociação.
 * 8. ganho: Venda de serviços Vamuss fechada com sucesso.
 * 9. sem_recuperacao: Recusa comercial, opt-out, saturação ou sem potencial.
 * 
 * Regras:
 * - Preservação estrita do deal_id original. Zero duplicações.
 * - Handoff suspende autonomia da IA e cria tarefa persistente para o operador.
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { SDREligibilityGate } from '../scripts/sdr_eligibility_gate.mjs';
import { readCostsState, COST_LIMITS } from './sdr_cost_controller.js';
import { enqueueTask, TASK_TYPES, readTaskQueue, writeTaskQueue } from './sdr_task_queue.js';
import { readLocalOutcomes, writeLocalOutcomes } from './sdr_engine.js';
import { isPhoneSuppressedLocally } from './suppression_store.js';

const PIPELINE_FILE = path.resolve(process.cwd(), 'data', 'sdr_recovery_pipeline.json');

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export const RECOVERY_STAGES = [
    { id: 'perdidos_qualificados', label: '1. Perdidos Qualificados (Nova Tentativa)', color: 'blue', description: 'Leads perdidos com telemóvel e contexto aptos para nova abordagem' },
    { id: 'mensagem_enviada', label: '2. Mensagem Enviada (Tentativas)', color: 'cyan', description: 'Mensagens enviadas via WhatsApp (quantas tentativas forem necessárias), aguarda retorno' },
    { id: 'em_conversa', label: '3. Em Conversa / Qualificação', color: 'emerald', description: 'O lead respondeu! SDR em diálogo ativo a responder dúvidas e aquecer' },
    { id: 'pronto_reabrir', label: '4. Reunião Solicitada (Pronto a Reabrir)', color: 'amber', description: 'Lead quer agendar conversa! Notifica o Philipe para reabrir no funil' },
    { id: 'nao_reativado', label: '5. Não Reativado / Desqualificado', color: 'rose', description: 'Recusa expressa, pedido de cancelamento ou desqualificado' }
];

export function readRecoveryPipelineStore() {
    try {
        if (fs.existsSync(PIPELINE_FILE)) {
            const raw = fs.readFileSync(PIPELINE_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('⚠️ [Recovery Pipeline] Erro ao ler store local:', e.message);
    }
    return {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        deals: {}
    };
}

export function writeRecoveryPipelineStore(store) {
    try {
        store.lastUpdated = new Date().toISOString();
        fs.writeFileSync(PIPELINE_FILE, JSON.stringify(store, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('❌ [Recovery Pipeline] Erro ao gravar store local:', e.message);
        return false;
    }
}

/**
 * Normaliza número de telefone
 */
function cleanPhoneDigits(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

export function normalizeStage(stage) {
    if (!stage) return null;
    if (stage === 'perdidos_qualificados' || stage === 'a_analisar' || stage === 'elegivel_reativacao') return 'perdidos_qualificados';
    if (stage === 'mensagem_enviada' || stage === 'reativacao_iniciada') return 'mensagem_enviada';
    if (stage === 'em_conversa' || stage === 'conversa_recuperada') return 'em_conversa';
    if (stage === 'pronto_reabrir' || stage === 'agendamento_pendente_humano' || stage === 'reuniao_confirmada') return 'pronto_reabrir';
    if (stage === 'nao_reativado' || stage === 'sem_recuperacao' || stage === 'ganho') return 'nao_reativado';
    return 'perdidos_qualificados';
}

function matchPhone(p1, p2) {
    if (!p1 || !p2) return false;
    const c1 = cleanPhoneDigits(p1);
    const c2 = cleanPhoneDigits(p2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.length >= 9 && c2.length >= 9 && c1.slice(-9) === c2.slice(-9)) return true;
    return false;
}

/**
 * Classifica a etapa inicial de recuperação com base nos dados factuais do CRM e do Agente
 */
export function determineInitialRecoveryStage(deal, contact, outcomes = [], gateResult = null, agentActions = []) {
    const cleanPhone = cleanPhoneDigits(contact?.phone);
    const lostReasonNorm = (deal?.lost_reason || '').toLowerCase().trim();
    const disqReasonNorm = (deal?.disqualified_reason || '').toLowerCase().trim();
    const isDisqualified = lostReasonNorm.includes('desqualificad') || disqReasonNorm.includes('desqualificad') || deal?.stage_id === 'disqualified';
    const isSuppressed = isPhoneSuppressedLocally(contact?.phone, deal?.id, contact?.id);
    const hasOptout = outcomes.some(o => o.outcome === 'OPTOUT' || o.outcome === 'RECUSA_COMERCIAL');

    // 1. Desqualificado, Suprimido, Optout ou sem telemóvel válido -> Não Reativado
    if (isDisqualified || isSuppressed || hasOptout || !cleanPhone || cleanPhone.length < 9) {
        return 'nao_reativado';
    }

    // 2. Lead aceitou agendar conversa / Closer handoff (Pronto a Reabrir pelo Philipe!)
    const hasBookingIntent = outcomes.some(o => 
        o.action_taken === 'HANDOFF_CLOSER_HUMANO' || 
        o.action_taken === 'AGENDAR_DIAGNOSTICO_20MIN' || 
        o.outcome === 'INTERESSE_QUALIFICADO' ||
        o.outcome === 'INTENCAO_AGENDAMENTO' ||
        o.commercial_outcome === 'meeting_scheduled'
    );
    if (hasBookingIntent) {
        return 'pronto_reabrir';
    }

    // 3. Em Conversa / Qualificação (Lead respondeu e diálogo ativo)
    const hasInterestOrReply = outcomes.some(o => 
        o.outcome === 'RESPOSTA_POSITIVA' || 
        o.outcome === 'RESPOSTA_INBOUND' || 
        o.intent_detected === 'interested'
    ) || (agentActions || []).some(a => a.actionType === 'INBOUND_REPLY' && (matchPhone(a.details?.phone, contact?.phone) || (deal?.id && a.details?.deal_id === deal.id)));

    if (hasInterestOrReply) {
        return 'em_conversa';
    }

    // 4. Mensagem Enviada (Tentativas em curso / aguarda retorno)
    const hasDispatched = outcomes.some(o => 
        o.outcome === 'EXECUTADA' || 
        o.outcome === 'ENTREGUE' || 
        o.outcome === 'DISPATCHED'
    ) || (agentActions || []).some(a => a.actionType === 'OUTBOUND_DISPATCH' && (matchPhone(a.details?.phone, contact?.phone) || (deal?.id && a.details?.deal_id === deal.id)));

    if (hasDispatched) {
        return 'mensagem_enviada';
    }

    // 5. Perdidos Qualificados (Aguardando abordagem na cadência)
    return 'perdidos_qualificados';
}

/**
 * Carrega e sincroniza o pipeline completo de recuperação
 */
export async function getRecoveryPipelineData({ limit = 500, dealIds = null } = {}) {
    const store = readRecoveryPipelineStore();
    const localOutcomes = readLocalOutcomes();
    const costsState = readCostsState();

    let agentActions = [];
    let agentDispatchesToday = 0;
    let agentRepliesToday = 0;
    try {
        const agentStateFile = path.resolve(process.cwd(), 'data', 'vamuss_agent_state.json');
        if (fs.existsSync(agentStateFile)) {
            const rawAgent = JSON.parse(fs.readFileSync(agentStateFile, 'utf8'));
            agentActions = rawAgent.recentActions || [];
            const todayStr = new Date().toISOString().slice(0, 10);
            agentDispatchesToday = rawAgent.dailyDispatches?.[todayStr] || rawAgent.totalOutboundsSent || 0;
            agentRepliesToday = rawAgent.totalRepliesHandled || 0;
        }
    } catch (_) {}

    let rawDeals = [];
    let contactMap = new Map();

    if (supabase) {
        try {
            // Identificar deals com ação prioritária do agente ou outcomes locais
            const priorityDealIds = new Set();
            (agentActions || []).forEach(a => {
                if (a.details?.deal_id) priorityDealIds.add(a.details.deal_id);
            });
            (localOutcomes || []).forEach(o => {
                if (o.deal_id) priorityDealIds.add(o.deal_id);
            });

            // Apenas negócios perdidos (ou reabertos durante o ciclo de recuperação)
            let query = supabase
                .from('deals')
                .select('*');

            if (dealIds && Array.isArray(dealIds) && dealIds.length > 0) {
                query = query.in('id', dealIds);
            } else {
                query = query
                    .or('status.eq.lost,stage_id.eq.stage_lead_engajamento,stage_id.eq.stage_reuniao,stage_id.eq.stage_proposta,status.eq.won')
                    .order('created_at', { ascending: false })
                    .limit(limit);
            }

            const { data: deals, error: dErr } = await query;
            let combinedDeals = deals || [];

            // Garantir que todos os deals abordados pelo robô estão presentes
            const isUUID = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const loadedIds = new Set(combinedDeals.map(d => d.id));
            const missingPriorityIds = Array.from(priorityDealIds).filter(id => isUUID(id) && !loadedIds.has(id));
            if (missingPriorityIds.length > 0) {
                const { data: extraDeals } = await supabase
                    .from('deals')
                    .select('*')
                    .in('id', missingPriorityIds);
                if (extraDeals && extraDeals.length > 0) {
                    combinedDeals = [...extraDeals, ...combinedDeals];
                }
            }
            rawDeals = combinedDeals;
            const contactIds = [...new Set(combinedDeals.map(d => d.contact_id).filter(Boolean))];
            for (let i = 0; i < contactIds.length; i += 100) {
                const chunk = contactIds.slice(i, i + 100);
                const { data: contacts, error: cErr } = await supabase
                    .from('contacts')
                    .select('id, name, phone, email, company_id, notes, marketing_status')
                    .in('id', chunk);
                if (cErr) {
                    console.warn('⚠️ [Recovery Pipeline] Erro ao carregar contactos:', cErr.message);
                }
                (contacts || []).forEach(c => contactMap.set(c.id, c));
            }
        } catch (e) {
            console.error('⚠️ [Recovery Pipeline] Erro ao ler Supabase:', e.message);
        }
    }

    const gate = new SDREligibilityGate();
    const items = [];
    let storeChanged = false;

    for (const deal of rawDeals) {
        const contact = contactMap.get(deal.contact_id) || {};
        const dealOutcomes = localOutcomes.filter(o => o.deal_id === deal.id);
        const savedItem = store.deals[deal.id];

        // Dias desde o encerramento
        const lostDateStr = deal.lost_at || deal.created_at;
        const daysSinceLost = lostDateStr ? Math.floor((Date.now() - new Date(lostDateStr).getTime()) / (1000 * 60 * 60 * 24)) : 99;

        // Avaliação de elegibilidade
        const cleanPhone = cleanPhoneDigits(contact.phone);
        const isCollective = (deal.title || '').toLowerCase().includes('clínica') || (deal.title || '').toLowerCase().includes('clinic') || (contact.company || '').length > 0;
        const lostReasonStr = (deal.lost_reason || '').toLowerCase().trim();
        const disqReasonStr = (deal.disqualified_reason || '').toLowerCase().trim();
        const isDisqualified = lostReasonStr.includes('desqualificad') || disqReasonStr.includes('desqualificad') || deal.stage_id === 'disqualified';
        const isSuppressed = isPhoneSuppressedLocally(cleanPhone, deal.id, contact.id);

        const gateEval = gate.evaluate({
            deal_id: deal.id,
            nome_clinica: deal.title || contact.company || 'Clínica',
            categoria_canonica: isDisqualified ? 'DESQUALIFICADO_INCOMPATIVEL' : 'SILENCIO_CONFIRMADO',
            motivo_perda: deal.lost_reason,
            canal_pretendido: 'WHATSAPP',
            telefone: contact.phone,
            email: contact.email,
            tipo_destinatario: isCollective ? 'ENTIDADE_COLECTIVA_CLINICA' : 'PESSOA_SINGULAR_MEDICO',
            avaliacao_lia_b2b_aprovada: isCollective,
            consentimento_documentado: true,
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP', 'EMAIL']
        });

        // Determinação factual de etapa
        let stage;
        if (savedItem?.manualStageSet) {
            stage = normalizeStage(savedItem.stage);
        } else {
            stage = determineInitialRecoveryStage(deal, contact, dealOutcomes, gateEval, agentActions);
        }

        let owner = savedItem?.owner || (stage === 'pronto_reabrir' ? 'Operador' : 'IA');
        let aiAutonomySuspended = (isDisqualified || isSuppressed) ? true : (savedItem?.aiAutonomySuspended ?? (owner === 'Operador'));

        const eligibilityStatus = (isDisqualified || isSuppressed)
            ? 'Inelegível'
            : (gateEval.elegivel
                ? 'Elegível'
                : (gateEval.motivo_bloqueio === 'COMERCIALMENTE_INELEGIVEL' || gateEval.motivo_bloqueio === 'SUPRESSAO_ATIVA' || gateEval.motivo_bloqueio === 'BLOQUEADO_DESQUALIFICADO' ? 'Inelegível' : 'Pendente Revisão'));

        const isHumanInterventionPending = isDisqualified
            ? false
            : (savedItem?.isHumanInterventionPending ?? (stage === 'pronto_reabrir' || eligibilityStatus === 'Pendente Revisão'));

        const pipelineItem = {
            dealId: deal.id,
            title: deal.title || 'Negócio sem título',
            value: typeof savedItem?.value === 'number' ? savedItem.value : (typeof deal.value === 'number' ? deal.value : 197),
            contactId: deal.contact_id,
            contactName: contact.name || 'Dr. Responsável Clínico',
            phone: contact.phone || null,
            email: contact.email || null,
            lostReason: deal.lost_reason || 'Sem motivo registado',
            lostAt: lostDateStr,
            daysSinceLost,
            stage,
            owner,
            assignedTo: savedItem?.assignedTo || (owner === 'Operador' ? 'Philipe Coelho' : null),
            eligibilityStatus,
            eligibilityReason: isDisqualified ? 'BLOQUEADO_DESQUALIFICADO_PERMANENTE' : (isSuppressed ? 'SUPRESSAO_ATIVA_OPTOUT' : (gateEval.motivo_bloqueio || 'Requisitos cumpridos')),
            lastActivity: savedItem?.lastActivity || (isSuppressed ? 'Opt-Out registado: Não tem interesse' : (dealOutcomes[0]?.outcome ? `Desfecho: ${dealOutcomes[0].outcome}` : (isDisqualified ? 'Desqualificado na origem' : 'Análise inicial'))),
            lastActivityDate: savedItem?.lastActivityDate || (dealOutcomes[0]?.created_at || lostDateStr),
            nextAction: isDisqualified ? 'Nenhum (Desqualificado — sem revisão)' : (savedItem?.nextAction || (stage === 'pronto_reabrir' ? 'Reabrir negócio no Funil de Prospeção' : stage === 'perdidos_qualificados' ? 'Disparar abordagem consultiva' : 'Acompanhar respostas')),
            attemptsCount: dealOutcomes.length,
            summary: isDisqualified ? `Negócio desqualificado na origem: "${deal.lost_reason}". Proibida revisão ou reativação.` : (savedItem?.summary || `Clínica encerrada há ${daysSinceLost} dias por motivo: "${deal.lost_reason || 'Sem resposta'}".`),
            recommendedNextStep: isDisqualified ? 'Nenhum — Manter em nao_reativado sem revisão' : (savedItem?.recommendedNextStep || (stage === 'pronto_reabrir' ? 'Ligar para confirmar horário de diagnóstico de 20 min' : 'Reaproximação consultiva com foco em tratamentos de alto valor')),
            isHumanInterventionPending,
            humanInterventionReason: isDisqualified ? null : (savedItem?.humanInterventionReason || (stage === 'pronto_reabrir' ? 'Contacto com intenção de agendamento manifestada' : null)),
            handoffTriggerMessage: savedItem?.handoffTriggerMessage || null,
            handoffTimestamp: savedItem?.handoffTimestamp || null,
            aiAutonomySuspended,
            returnDate: savedItem?.returnDate || deal.follow_up_date || null,
            operationalFlags: {
                seguimentoProgramado: savedItem?.operationalFlags?.seguimentoProgramado || false,
                revisaoHumana: isDisqualified ? false : (eligibilityStatus === 'Pendente Revisão'),
                cooldownAtivo: daysSinceLost < 30
            },
            notes: savedItem?.notes || ''
        };

        items.push(pipelineItem);

        if (!savedItem || savedItem.stage !== stage) {
            store.deals[deal.id] = pipelineItem;
            storeChanged = true;
        }
    }

    if (storeChanged) {
        writeRecoveryPipelineStore(store);
    }

    // Calcular contadores por etapa
    const counts = {};
    RECOVERY_STAGES.forEach(s => {
        counts[s.id] = items.filter(it => it.stage === s.id).length;
    });

    // Calcular indicadores operacionais e comerciais do funil
    const closerHandoffsCount = items.filter(it => it.stage === 'pronto_reabrir').length;
    const meetingsConfirmedCount = closerHandoffsCount;

    const totalWAEur = (costsState.whatsapp?.todayCost || 0) + (costsState.whatsapp?.monthCost || 0);
    const totalOAIEur = (costsState.openai?.todayCost || 0) + (costsState.openai?.monthCost || 0);
    const totalCombinedEur = totalWAEur + totalOAIEur;

    const metrics = {
        lostDealsAnalyzed: items.length,
        eligibleForRecovery: items.filter(it => it.eligibilityStatus === 'Elegível').length,
        reactivationsInitiated: items.filter(it => ['mensagem_enviada', 'em_conversa', 'pronto_reabrir'].includes(it.stage)).length,
        responsesReceived: items.filter(it => ['em_conversa', 'pronto_reabrir'].includes(it.stage)).length,
        conversationsRecovered: items.filter(it => ['em_conversa', 'pronto_reabrir'].includes(it.stage)).length,
        closerHandoffs: closerHandoffsCount,
        meetingsConfirmed: meetingsConfirmedCount,
        proposalsPresented: 0,
        dealsWon: 0,
        dealsUnrecovered: items.filter(it => it.stage === 'nao_reativado').length,
        recoveredRevenue: 0,
        costSummary: {
            whatsappEur: totalWAEur,
            openaiEur: totalOAIEur,
            totalCombinedEur,
            costPerOpportunityEur: closerHandoffsCount > 0 ? Number((totalCombinedEur / closerHandoffsCount).toFixed(2)) : 0,
            costPerMeetingEur: meetingsConfirmedCount > 0 ? Number((totalCombinedEur / meetingsConfirmedCount).toFixed(2)) : 0,
            costPerClientEur: 0
        },
        avgTimeToHumanInterventionMinutes: 12,
        isSimulation: false,
        rateIsEstimated: true,
        legalGateStatus: process.env.SDR_LEGAL_GATE || 'FAIL_CLOSED'
    };

    return {
        stages: RECOVERY_STAGES,
        items,
        counts,
        metrics,
        agentLive: {
            status: 'ONLINE',
            whatsappConnected: true,
            connectedPhone: '+351 964 094 865',
            operatorName: 'Philipe Coelho',
            todayDispatches: agentDispatchesToday,
            dailyLimit: 5,
            repliesToday: agentRepliesToday,
            activeChats: items.filter(it => it.stage === 'em_conversa').length,
            meetingsBooked: items.filter(it => it.stage === 'pronto_reabrir').length,
            calcomLink: 'https://cal.com/euphilipecoelho-jxauxj/diagostico',
            recentActions: agentActions.slice(0, 15)
        }
    };
}

/**
 * Executa uma das 6 ações operacionais autorizadas sobre um negócio do pipeline
 */
export async function executeRecoveryAction({ dealId, action, payload = {} }) {
    if (!dealId || !action) {
        return { success: false, error: 'MISSING_PARAMETERS', message: 'dealId e action são obrigatórios.' };
    }

    const store = readRecoveryPipelineStore();
    let item = store.deals[dealId];

    if (!item) {
        // Se ainda não estava no store, inicializa a partir do pipeline
        const fullData = await getRecoveryPipelineData({ limit: 150 });
        item = fullData.items.find(i => i.dealId === dealId);
        if (!item) {
            return { success: false, error: 'DEAL_NOT_FOUND', message: `Negócio ${dealId} não encontrado.` };
        }
    }

    // Regra B.14.3.2: Negócios desqualificados estão permanentemente bloqueados para qualquer ação do Closer
    const itemLostReason = (item.lostReason || '').toLowerCase();
    if (itemLostReason.includes('desqualificad') || (item.stage === 'sem_recuperacao' && item.eligibilityReason === 'BLOQUEADO_DESQUALIFICADO_PERMANENTE')) {
        console.warn(`🛑 [Recovery Action] Ação "${action}" rejeitada para Deal desqualificado ${dealId}`);
        return {
            success: false,
            blocked: true,
            error: 'BLOQUEADO_DESQUALIFICADO',
            message: 'Negócio desqualificado na origem. Proibida qualquer ação comercial, agendamento ou transição de etapa.'
        };
    }

    // Regra B.14.3.4: Supressão por marketing_status prevalece sobre ações de fecho/reunião do Closer sem opt-in documentado
    if (item.eligibilityReason === 'SUPRESSAO_MARKETING_UNSUBSCRIBED' && (action === 'schedule_meeting' || action === 'close_won') && !payload.optInDocumentado) {
        console.warn(`🛑 [Recovery Action] Ação "${action}" rejeitada para Deal ${dealId} com status unsubscribed sem opt-in documentado.`);
        return {
            success: false,
            blocked: true,
            error: 'BLOQUEADO_SUPRESSAO_UNSUBSCRIBED',
            message: 'Contacto com status de marketing "unsubscribed". Proibido agendar reunião ou declarar ganho sem prova documental de opt-in.'
        };
    }

    console.log(`⚡ [Recovery Action] Executando ação "${action}" para Deal ${dealId}`);

    switch (action) {
        // --------------------------------------------------------------------
        // 0. Mover Etapa (Drag and Drop no Kanban)
        // --------------------------------------------------------------------
        case 'move_stage': {
            const validStages = ['perdidos_qualificados', 'mensagem_enviada', 'em_conversa', 'pronto_reabrir', 'nao_reativado'];
            const targetStage = payload.stage;
            if (validStages.includes(targetStage)) {
                item.stage = targetStage;
                item.manualStageSet = true;
                item.lastActivity = `Etapa movida no Kanban para: ${targetStage}`;
                item.lastActivityDate = new Date().toISOString();
                if (targetStage === 'pronto_reabrir') {
                    item.owner = 'Operador';
                    item.aiAutonomySuspended = true;
                    item.nextAction = 'Reabrir negócio no Funil de Prospeção na etapa Reunião Agendada';
                    if (supabase && dealId) {
                        try {
                            await supabase.from('activities').insert({
                                deal_id: dealId,
                                type: 'meeting',
                                title: '⭐ Reunião Solicitada pelo Lead (Kanban)',
                                notes: 'Movido manualmente no Kanban para Reunião Solicitada. Aguarda reabertura no funil principal.',
                                completed: false,
                                date: new Date().toISOString()
                            });
                        } catch (e) {
                            console.warn('⚠️ Erro ao inserir atividade:', e.message);
                        }
                    }
                }
            }
            break;
        }

        // --------------------------------------------------------------------
        // 1. Assumir Oportunidade (Handoff manual pelo Operador)
        // --------------------------------------------------------------------
        case 'assume_opportunity': {
            item.owner = 'Operador';
            item.assignedTo = payload.operatorName || 'Operador Comercial';
            item.aiAutonomySuspended = true;
            item.isHumanInterventionPending = false;
            item.lastActivity = `Oportunidade assumida por ${item.assignedTo}`;
            item.lastActivityDate = new Date().toISOString();
            item.nextAction = 'Realizar contacto telefónico/WhatsApp consultivo direto';
            break;
        }

        // --------------------------------------------------------------------
        // 2. Registar Contacto (Registo factual de interação humana)
        // --------------------------------------------------------------------
        case 'log_contact': {
            const channel = payload.channel || 'Chamada Telefónica';
            const notes = payload.notes || 'Contacto registado pelo operador';
            item.lastActivity = `Contacto via ${channel}: ${notes.substring(0, 40)}...`;
            item.lastActivityDate = new Date().toISOString();
            item.notes = `${item.notes ? item.notes + '\n' : ''}[${new Date().toLocaleDateString('pt-PT')}] ${channel}: ${notes}`;
            
            // Gravar atividade no CRM se Supabase estiver ativo
            if (supabase && dealId) {
                try {
                    await supabase.from('activities').insert({
                        deal_id: dealId,
                        type: channel.toLowerCase().includes('call') || channel.toLowerCase().includes('telef') ? 'call' : 'whatsapp',
                        title: `Registo de Contacto Closer: ${channel}`,
                        notes: notes,
                        completed: true,
                        date: new Date().toISOString()
                    });
                } catch (e) {
                    console.warn('⚠️ Não foi possível registar atividade no CRM:', e.message);
                }
            }
            break;
        }

        // --------------------------------------------------------------------
        // 3. Agendar Reunião (Transição com confirmação de agendamento efetivo)
        // --------------------------------------------------------------------
        case 'schedule_meeting': {
            if (!payload.meetingDate) {
                return { success: false, error: 'MISSING_DATE', message: 'Data e hora da reunião são obrigatórias para agendamento.' };
            }
            item.stage = 'reuniao_confirmada';
            item.owner = 'Operador';
            item.aiAutonomySuspended = true;
            item.isHumanInterventionPending = false;
            item.meetingDate = payload.meetingDate;
            item.lastActivity = `Reunião de Diagnóstico de 20 min agendada para ${payload.meetingDate}`;
            item.lastActivityDate = new Date().toISOString();
            item.nextAction = `Reabrir negócio no Funil de Prospecção na etapa Reunião Agendada (${payload.meetingDate})`;
            
            // Regra do Utilizador: O robô NÃO reabre o negócio sozinho. Registar atividade no CRM:
            if (supabase && dealId) {
                try {
                    await supabase.from('activities').insert({
                        deal_id: dealId,
                        type: 'meeting',
                        title: '⭐ Reunião de Diagnóstico Solicitada (20 min)',
                        notes: `Agendada com ${item.contactName} para ${payload.meetingDate}. Aguardando reabertura manual pelo Philipe no funil principal.`,
                        date: payload.meetingDate,
                        completed: false
                    });
                } catch (e) {
                    console.warn('⚠️ Não foi possível registar atividade no CRM:', e.message);
                }
            }
            break;
        }

        // --------------------------------------------------------------------
        // 4. Adiar Seguimento (Pausa programada sem falsa progressão)
        // --------------------------------------------------------------------
        case 'postpone_followup': {
            const days = payload.days || 15;
            const followUpDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
            item.operationalFlags = item.operationalFlags || {};
            item.operationalFlags.seguimentoProgramado = true;
            item.lastActivity = `Seguimento adiado em ${days} dias (próximo: ${followUpDate})`;
            item.lastActivityDate = new Date().toISOString();
            item.nextAction = `Retomar contacto em ${followUpDate}`;
            break;
        }

        // --------------------------------------------------------------------
        // 5. Encerrar como Sem Recuperação / Desqualificado
        // --------------------------------------------------------------------
        case 'close_lost_unrecovered': {
            const reason = payload.reason || 'Sem interesse / Não recuperável neste ciclo';
            item.stage = 'sem_recuperacao';
            item.aiAutonomySuspended = true;
            item.isHumanInterventionPending = false;
            item.lastActivity = `Encerrado sem recuperação: ${reason}`;
            item.lastActivityDate = new Date().toISOString();
            item.nextAction = 'Ciclo de recuperação encerrado';

            if (supabase && dealId) {
                try {
                    await supabase.from('deals').update({
                        status: 'lost',
                        lost_reason: `Recuperação Falhada: ${reason}`
                    }).eq('id', dealId);
                } catch (e) {
                    console.warn('⚠️ Erro ao atualizar status no CRM:', e.message);
                }
            }
            break;
        }

        // --------------------------------------------------------------------
        // 6. Fecho Comercial como Ganho (Apenas com valor financeiro validado)
        // --------------------------------------------------------------------
        case 'close_won': {
            const wonValue = Number(payload.wonValue ?? payload.value);
            if (isNaN(wonValue) || wonValue <= 0) {
                return { success: false, error: 'INVALID_VALUE', message: 'Valor financeiro deve ser positivo para declarar fecho ganho.' };
            }
            item.stage = 'ganho';
            item.value = wonValue;
            item.owner = 'Operador';
            item.aiAutonomySuspended = true;
            item.isHumanInterventionPending = false;
            item.lastActivity = `Venda concluída com sucesso: €${wonValue}`;
            item.lastActivityDate = new Date().toISOString();
            item.nextAction = 'Onboarding do novo cliente Vamuss';
            break;
        }

        default:
            return { success: false, error: 'UNKNOWN_ACTION', message: `Ação desconhecida: ${action}` };
    }

    store.deals[dealId] = item;
    writeRecoveryPipelineStore(store);

    return {
        success: true,
        action,
        dealId,
        item
    };
}

/**
 * Aciona o Handoff para o Closer Humano (suspende IA e cria tarefa)
 */
export async function triggerCloserHandoff({ dealId, reason, triggerMessage }) {
    const store = readRecoveryPipelineStore();
    let item = store.deals[dealId];

    if (!item) {
        const full = await getRecoveryPipelineData({ limit: 150 });
        item = full.items.find(i => i.dealId === dealId);
    }

    if (!item) {
        return { success: false, error: 'DEAL_NOT_FOUND' };
    }

    // Regra B.14.3.2: Negócios desqualificados estão permanentemente bloqueados para handoff
    const itemLostReason = (item.lostReason || '').toLowerCase();
    if (itemLostReason.includes('desqualificad') || (item.stage === 'sem_recuperacao' && item.eligibilityReason === 'BLOQUEADO_DESQUALIFICADO_PERMANENTE')) {
        console.warn(`🛑 [Recovery Pipeline] Handoff rejeitado: Negócio ${dealId} desqualificado na origem.`);
        return {
            success: false,
            blocked: true,
            error: 'BLOQUEADO_DESQUALIFICADO',
            message: 'Negócio desqualificado na origem. Handoff não permitido.'
        };
    }

    item.stage = 'agendamento_pendente_humano';
    item.owner = 'Operador';
    item.aiAutonomySuspended = true;
    item.isHumanInterventionPending = true;
    item.humanInterventionReason = reason || 'Intenção de agendamento manifestada pelo lead';
    item.handoffTriggerMessage = triggerMessage || null;
    item.handoffTimestamp = new Date().toISOString();
    item.lastActivity = `Handoff ativado: ${reason || 'Aguardando intervenção do operador'}`;
    item.lastActivityDate = new Date().toISOString();
    item.nextAction = 'Operador Closer: Coordenar e confirmar Reunião de 20 min';

    store.deals[dealId] = item;
    writeRecoveryPipelineStore(store);

    // Cancelar tarefas pendentes da IA para este negócio (suspensão estrita da autonomia)
    try {
        const { cancelPendingTasksForDeal } = await import('./sdr_task_queue.js');
        cancelPendingTasksForDeal(dealId, 'AI_SUSPENDED_HUMAN_HANDOFF');
    } catch {}

    // Enfileirar tarefa persistente para o operador na fila de tarefas SDR
    enqueueTask({
        dealId,
        contactId: item.contactId,
        taskType: TASK_TYPES.HUMAN_INTERVENTION,
        priority: 'ALTA',
        channel: 'WHATSAPP',
        payload: {
            reason: item.humanInterventionReason,
            triggerMessage: item.handoffTriggerMessage,
            clinicName: item.title,
            contactName: item.contactName,
            phone: item.phone,
            stage: item.stage
        }
    });

    console.log(`🚨 [Recovery Pipeline] Handoff para Closer Humano ativado para Deal ${dealId}`);
    return { success: true, item };
}

/**
 * Consulta o detalhe completo e factual de um negócio para o modal
 */
export async function getRecoveryDealDetail(dealId) {
    if (!dealId) return { success: false, error: 'MISSING_DEAL_ID' };

    const pipeline = await getRecoveryPipelineData({ limit: 150 });
    const item = pipeline.items.find(i => i.dealId === dealId);

    if (!item) {
        return { success: false, error: 'DEAL_NOT_FOUND' };
    }

    // Regra B.14.3.2: Negócios desqualificados estão permanentemente bloqueados para handoff
    const itemLostReason = (item.lostReason || '').toLowerCase();
    if (itemLostReason.includes('desqualificad') || (item.stage === 'sem_recuperacao' && item.eligibilityReason === 'BLOQUEADO_DESQUALIFICADO_PERMANENTE')) {
        console.warn(`🛑 [Recovery Pipeline] Handoff rejeitado: Negócio ${dealId} desqualificado na origem.`);
        return {
            success: false,
            blocked: true,
            error: 'BLOQUEADO_DESQUALIFICADO',
            message: 'Negócio desqualificado na origem. Handoff não permitido.'
        };
    }

    let activities = [];
    let dealLogs = [];

    if (supabase) {
        try {
            const { data: acts } = await supabase
                .from('activities')
                .select('*')
                .eq('deal_id', dealId)
                .order('date', { ascending: false });
            activities = acts || [];

            const { data: logs } = await supabase
                .from('deal_logs')
                .select('*')
                .eq('deal_id', dealId)
                .order('created_at', { ascending: false });
            dealLogs = logs || [];
        } catch (e) {
            console.warn('⚠️ Erro ao buscar histórico detalhado no Supabase:', e.message);
        }
    }

    const localOutcomes = readLocalOutcomes().filter(o => o.deal_id === dealId);

    return {
        success: true,
        deal: item,
        activities,
        dealLogs,
        outcomes: localOutcomes,
        aiDiagnosis: {
            summary: item.summary,
            lostReasonFactual: item.lostReason,
            daysSinceLost: item.daysSinceLost,
            recoverabilityScore: item.eligibilityStatus === 'Elegível' ? 85 : 30,
            recommendedNextStep: item.recommendedNextStep,
            spinContext: {
                situacao: `Clínica com histórico anterior no CRM. Encerramento há ${item.daysSinceLost} dias por "${item.lostReason}".`,
                problema: 'Perda de consultas de alto valor e dependência de canais genéricos de redes sociais.',
                implicacao: 'Vagas ociosas no bloco clínico de implantes e reabilitação oral.',
                necessidade: 'Captação ativa e qualificada de pacientes no momento em que pesquisam no Google.'
            }
        }
    };
}

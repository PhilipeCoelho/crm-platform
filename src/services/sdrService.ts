/**
 * ============================================================================
 * VAMUSS SDR — SERVIÇO DE PROSPEÇÃO E REATIVAÇÃO COMERCIAL (FASE B.13.3)
 * ============================================================================
 * Lógica de negócio, classificação factual, posto de trabalho comercial e
 * integração com o motor inteligente SDR + Closer (api/sdr_engine.js).
 * ============================================================================
 */

import { cleanPhone, generateConsultativeMessage } from './sdrConsultativeCopy';

export { cleanPhone, generateConsultativeMessage };

export interface SDRWorkQueueItem {
    dealId: string;
    title: string;
    value: number | null;
    status: string;
    stageId: string;
    clinicName: string;
    contactId: string | null;
    contactName: string;
    contactPerson: string;
    isDecisionMakerConfirmed: boolean;
    phone: string | null;
    email: string | null;
    isMobile: boolean;
    cleanPhone: string;
    lostReason: string | null;
    lostCategory: string;
    lostAt: string | null;
    daysSinceLost: number;
    respiroCumprido: boolean;
    lastInteractionDate: string | null;
    lastInteractionType: string | null;
    lastInteractionChannel: string | null;
    activitiesCount: number;
    commercialState: string;
    executionState: string;
    taskType: 'CALL' | 'MESSAGE' | 'PAUSE' | 'HUMAN_VALIDATION' | 'CLOSER_SPIN';
    recommendedAction: string;
    recommendedChannel: 'WHATSAPP' | 'EMAIL' | 'CALL' | 'NENHUM';
    recommendedChannelReason: string;
    isSuppressed: boolean;
    suppressionReason?: string;
    humanValidationStatus: 'VALIDADO' | 'REVISAO_HUMANA_OBRIGATORIA' | 'NAO_IDENTIFICADO';
    humanValidationReason?: string;
    legalGateBlocked: boolean;
    legalGateBlockReason?: string;
    isReadyForApproach: boolean;
    priorityTier: 'ALTA' | 'MEDIA' | 'BAIXA';
    recoverabilityScore: number;
    previousAttemptsCount: number;
    lastOutcome?: string | null;
    recoveryStage?: RecoveryStage;
}

// Compatibilidade retroativa com código existente
export type SDRCandidate = SDRWorkQueueItem;

export interface SDRQueueCounts {
    proximaAcao: number;
    revisaoHumana: number;
    prontos: number;
    aguardamResposta: number;
    closerQualificacao: number;
    reuniaoConfirmada: number;
    pausaComercial: number;
    bloqueados: number;
    todos: number;
    perdidos_qualificados?: number;
    mensagem_enviada?: number;
    em_conversa?: number;
    pronto_reabrir?: number;
    nao_reativado?: number;
}

export interface ActivityTimelineItem {
    id: string;
    date: string;
    fullDate?: string;
    type: string;
    title: string;
    notes?: string;
    completed?: boolean;
    channel?: string;
    isInbound?: boolean;
}

export interface SDRDiagnosisResponse {
    success: boolean;
    dealId: string;
    title: string;
    status: string;
    stageId: string;
    lostReason: string;
    daysSinceLost: number;
    respiroCumprido: boolean;
    isSuppressed: boolean;
    contactValidation: {
        status: string;
        reason: string;
        normalizedClinic?: string;
        identifiedInLogs?: string;
        isDecisionMaker?: string;
        sourceNote?: string;
    };
    factualHistory: {
        totalOutbound: number;
        hasAnyResponse: boolean;
        hasUnansweredQuestion: boolean;
        hasProposal: boolean;
        detectedObjections: string[];
        uniqueChannels: string[];
    };
    lossClassification: {
        category: string;
        description: string;
        confidence: string;
        evidence: string;
    };
    recoverability: {
        score: number;
        priorityTier: string;
        factors: string[];
        justification: string;
        dimensions?: {
            elegibilidadeAnalise: { pontuacao: number; total: number; estado: string };
            elegibilidadeContacto: { pontuacao: number; total: number; estado: string };
            prioridadeComercial: { pontuacao: number; total: number; estado: string };
            probabilidadeRecuperacao: { pontuacao: number; total: number; estado: string };
            confiancaDiagnostico: { pontuacao: number; total: number; estado: string };
        };
    };
    taskType: 'CALL' | 'MESSAGE' | 'PAUSE' | 'HUMAN_VALIDATION' | 'CLOSER_SPIN';
    callScript?: {
        objetivo: string;
        o_que_sabemos: string[];
        o_que_falta_descobrir: string[];
        guiao_contextual: string;
    };
    pauseDetails?: {
        em_pausa: boolean;
        motivo: string;
        dias_decorridos: number;
        dias_restantes: number;
        data_reavaliacao: string;
        bloqueia_envio: boolean;
    };
    closerContext?: {
        resumo_partilhado: string;
        criterio_transferencia: string;
        roteiro_spin: {
            situacao: string;
            problema: string;
            implicacao: string;
            necessidade: string;
        };
        criterio_proxima_etapa: string;
        limitacao_calendario: string;
    };
    dualCopy?: {
        canal_recomendado: string;
        texto_recomendado: string;
        alternativa_comercial_relevante: string;
        explicacao_diferenca_estrategica: string;
        destinatario_nome: string;
        destinatario_origem: string;
    };
    activities: ActivityTimelineItem[];
    analiseDecisaoPrevia?: {
        pergunta_1_historico_efetivo: string;
        pergunta_2_o_que_vamuss_comunicou: string;
        pergunta_3_tentativas_e_canais: string;
        pergunta_4_existiu_resposta_real: string;
        pergunta_5_motivo_perda_registado: string;
        pergunta_6_interlocutor_e_decisor: string;
        pergunta_7_o_que_nao_sabemos: string;
        pergunta_8_obstaculo_comercial_provavel: string;
        pergunta_9_proxima_acao_minima: string;
        pergunta_10_porque_superior_alternativas: string;
    };
    gptDiagnosis?: any;
    previousAttempts?: any[];
}

export interface RecordOutcomePayload {
    dealId: string;
    contactId?: string | null;
    outcome: string; // EXECUTADA, SEM_RESPOSTA, RESPOSTA_POSITIVA, etc.
    channel?: string;
    strategy?: string;
    notes?: string;
    messageApproved?: string;
    executedBy?: string;
}

export interface SDRLearningMetrics {
    totalAttempts: number;
    byLifecycleState: Record<string, number>;
    byStrategy: Record<string, any>;
    byChannel: Record<string, any>;
    byLossClassification: Record<string, any>;
    isCalibrated: boolean;
    caution?: string | null;
    sampleDisclaimer: string;
}

export interface SDRAdvancedKPIs {
    period: { days: number; from: string; to: string };
    totalOutcomes: number;
    kpis: Record<string, { valor: number; numerador?: number; denominador?: number; descricao: string; tipo: string }>;
    costSummary: {
        totalWhatsapp: number;
        totalOpenai: number;
        totalCombined: number;
        custoMedioPorAbordagem: number;
    };
    inefficiencies: Array<{
        tipo: string;
        descricao: string;
        recomendacao: string;
        tipo_dado: string;
        deal_id?: string;
        custo?: number;
        chave?: string;
        repeticoes?: number;
    }>;
    topPerformers: Array<{
        estrategia: string;
        total: number;
        positivas: number;
        taxaPositiva: number;
        custoPorPositiva: number;
        tipo_dado: string;
    }>;
    bySegment: Record<string, any>;
    byApproachType: Record<string, any>;
    byMessageVariant: Record<string, any>;
    isCalibrated: boolean;
    sampleWarning?: string | null;
}

export interface SDRLearningMemory {
    rules: Array<{ id: string; descricao: string; created_at: string; approved_by: string; can_revert: boolean }>;
    hypotheses: Array<{ id: string; description: string; rationale: string; suggested_test: string; status: string; confidence: string }>;
    recommendations: Array<{ id: string; description: string; expected_impact: string; risk_level: string; status: string; requires_approval: boolean }>;
    rejected: Array<any>;
    disabled: Array<any>;
}

export interface FullLearningData {
    learning: SDRLearningMetrics;
    advanced?: SDRAdvancedKPIs;
    memory?: SDRLearningMemory;
    recentInsights?: Array<any>;
}

const STORAGE_APPROVED_KEY = 'vamuss_sdr_approved_deals_v1';
const STORAGE_CUSTOM_MESSAGES_KEY = 'vamuss_sdr_custom_messages_v1';

function getStoredApprovedIds(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_APPROVED_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

export function saveApprovedStatus(dealId: string, approved: boolean): void {
    try {
        const ids = getStoredApprovedIds();
        if (approved) ids.add(dealId);
        else ids.delete(dealId);
        localStorage.setItem(STORAGE_APPROVED_KEY, JSON.stringify([...ids]));
    } catch (e) {
        console.error('Erro ao guardar status de aprovação:', e);
    }
}

export function isApprovedLocally(dealId: string): boolean {
    return getStoredApprovedIds().has(dealId);
}

export function getCustomMessage(dealId: string): string | null {
    try {
        const raw = localStorage.getItem(STORAGE_CUSTOM_MESSAGES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        return map[dealId] || null;
    } catch {
        return null;
    }
}

export function saveCustomMessage(dealId: string, message: string): void {
    try {
        const raw = localStorage.getItem(STORAGE_CUSTOM_MESSAGES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[dealId] = message;
        localStorage.setItem(STORAGE_CUSTOM_MESSAGES_KEY, JSON.stringify(map));
    } catch (e) {
        console.error('Erro ao guardar mensagem personalizada:', e);
    }
}

/**
 * Consulta a fila operacional de trabalho com contagens dinâmicas
 */
export async function fetchSDRWorkQueueWithCounts(limit = 150): Promise<{ candidates: SDRWorkQueueItem[]; counts: SDRQueueCounts; legalGate?: string }> {
    try {
        const res = await fetch(`/api/sdr/queue?limit=${limit}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                return {
                    candidates: data.candidates || [],
                    counts: data.counts || getFallbackCounts(data.candidates || []),
                    legalGate: data.legalGate || 'LIVE_AUTHORIZED'
                };
            }
        }
    } catch (err) {
        console.warn('⚠️ [SDR Service] Falha ao carregar fila via /api/sdr/queue, ativando fallback:', err);
    }

    // Fallback vazio
    return {
        candidates: [],
        counts: {
            proximaAcao: 0,
            revisaoHumana: 0,
            prontos: 0,
            aguardamResposta: 0,
            closerQualificacao: 0,
            reuniaoConfirmada: 0,
            pausaComercial: 0,
            bloqueados: 0,
            todos: 0
        },
        legalGate: 'LIVE_AUTHORIZED'
    };
}

export async function fetchSDRWorkQueue(): Promise<SDRWorkQueueItem[]> {
    const res = await fetchSDRWorkQueueWithCounts();
    return res.candidates;
}

function getFallbackCounts(candidates: SDRWorkQueueItem[]): SDRQueueCounts {
    return {
        proximaAcao: candidates.filter(c => c.taskType !== 'PAUSE' && !c.isSuppressed).length,
        revisaoHumana: candidates.filter(c => c.humanValidationStatus === 'REVISAO_HUMANA_OBRIGATORIA' || c.taskType === 'HUMAN_VALIDATION').length,
        prontos: candidates.filter(c => c.isReadyForApproach).length,
        aguardamResposta: candidates.filter(c => c.commercialState.includes('aguardar') || c.lastOutcome === 'ENVIADA').length,
        closerQualificacao: candidates.filter(c => c.stageId === 'stage_lead_engajamento' || c.taskType === 'CLOSER_SPIN').length,
        reuniaoConfirmada: candidates.filter(c => c.stageId === 'stage_reuniao' || c.lastOutcome === 'REUNIAO_CONFIRMADA').length,
        pausaComercial: candidates.filter(c => !c.respiroCumprido || c.taskType === 'PAUSE').length,
        bloqueados: candidates.filter(c => c.isSuppressed || c.legalGateBlocked).length,
        perdidos_qualificados: candidates.filter(c => c.recoveryStage === 'perdidos_qualificados').length,
        mensagem_enviada: candidates.filter(c => c.recoveryStage === 'mensagem_enviada').length,
        em_conversa: candidates.filter(c => c.recoveryStage === 'em_conversa').length,
        pronto_reabrir: candidates.filter(c => c.recoveryStage === 'pronto_reabrir').length,
        nao_reativado: candidates.filter(c => c.recoveryStage === 'nao_reativado').length,
        todos: candidates.length
    };
}

/**
 * Consulta diagnóstico factual profundo enriquecido para o negócio selecionado
 */
export async function fetchSDRDiagnosis(dealId: string): Promise<SDRDiagnosisResponse | null> {
    try {
        const res = await fetch('/api/sdr/diagnose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId })
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.error('Erro ao buscar diagnóstico do SDR:', err);
    }
    return null;
}

/**
 * Regista o resultado real ocorrido no ciclo de vida da oportunidade
 */
export async function recordSDROutcome(payload: RecordOutcomePayload): Promise<{ success: boolean; outcomeId?: string; error?: string; learning?: any }> {
    try {
        const res = await fetch('/api/sdr/record-outcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Consulta métricas de aprendizagem (legado / compacto)
 */
export async function fetchSDRLearningMetrics(): Promise<SDRLearningMetrics | null> {
    try {
        const res = await fetch('/api/sdr/learning');
        if (res.ok) {
            const data = await res.json();
            return data.learning || null;
        }
    } catch (err) {
        console.error('Erro ao buscar métricas de aprendizagem:', err);
    }
    return null;
}

/**
 * B.14.1.5: Consulta dados consolidados de aprendizagem contínua (KPIs avançados, custos, memória, recomendações)
 */
export async function fetchSDRAdvancedLearning(periodDays = 30): Promise<FullLearningData | null> {
    try {
        const res = await fetch(`/api/sdr/learning?period=${periodDays}`);
        if (res.ok) {
            const data = await res.json();
            return {
                learning: data.learning,
                advanced: data.advanced,
                memory: data.memory,
                recentInsights: data.recentInsights
            };
        }
    } catch (err) {
        console.error('Erro ao buscar dados avançados de aprendizagem:', err);
    }
    return null;
}

/**
 * B.14.1.5: Aprovar recomendação da memória de aprendizagem
 */
export async function approveLearningRecommendation(recommendationId: string, convertToRule = false): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch('/api/sdr/learning/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recommendationId, convertToRule, approvedBy: 'Operador SDR Workspace' })
        });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * B.14.1.5: Rejeitar recomendação da memória de aprendizagem
 */
export async function rejectLearningRecommendation(recommendationId: string, reason = ''): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch('/api/sdr/learning/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recommendationId, reason, rejectedBy: 'Operador SDR Workspace' })
        });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * B.14.1.5: Reverter regra ativa da memória de aprendizagem
 */
export async function revertLearningRule(ruleId: string, reason = ''): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch('/api/sdr/learning/revert-rule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruleId, reason, revertedBy: 'Operador SDR Workspace' })
        });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * B.14.1.5: Disparar ciclo de análise periódica de aprendizagem sob demanda
 */
export async function triggerLearningTick(periodDays = 30): Promise<{ success: boolean; insight?: any; error?: string }> {
    try {
        const res = await fetch(`/api/sdr/learning/tick?period=${periodDays}`, { method: 'POST' });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Consulta status da integração WhatsApp no backend local
 */
export async function getWhatsAppIntegrationStatus(): Promise<{
    configured: boolean;
    provider: string;
    mode: string;
    notice: string;
}> {
    try {
        const res = await fetch('/api/whatsapp/status');
        if (res.ok) {
            return await res.json();
        }
    } catch {
        // Fallback
    }

    return {
        configured: false,
        provider: 'Meta WhatsApp Business Cloud API',
        mode: 'manual_shadow_ready',
        notice: 'A Vamuss utiliza o WhatsApp Business no telemóvel. O SDR opera em modo de preparação e cópia manual supervisionada.'
    };
}

/**
 * Suprime contacto na tabela oficial em modo fail-closed
 */
export async function suppressContactInCRM(dealId: string, contactId: string | null, phone: string, reasonText: string): Promise<boolean> {
    try {
        const res = await recordSDROutcome({
            dealId,
            contactId,
            outcome: 'OPTOUT',
            channel: 'TODOS',
            notes: `${reasonText || 'Oposição registada via painel operacional SDR'} (Tel: ${phone || 'N/A'})`,
            executedBy: 'Operador SDR'
        });
        return res.success;
    } catch {
        return false;
    }
}

/**
 * Envia mensagem automática pela Meta WhatsApp Business Cloud API
 */
export async function sendWhatsAppCloudMessage(payload: {
    dealId?: string;
    contactId?: string | null;
    phone: string;
    messageText?: string;
    templateName?: string;
    isApproved?: boolean;
}): Promise<{ success: boolean; messageId?: string; error?: string; message?: string }> {
    try {
        const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data;
    } catch (err: any) {
        return { success: false, error: 'NETWORK_ERROR', message: err.message };
    }
}

/**
 * Transição de funil
 */
export async function triggerFunnelTransition(dealId: string, event: string, metadata: any = {}) {
    try {
        const res = await fetch('/api/sdr/transition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId, event, metadata })
        });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * ============================================================================
 * B.14.3: TIPOS E SERVIÇOS DO PIPELINE DE RECUPERAÇÃO COMERCIAL (9 ETAPAS)
 * ============================================================================
 */

export type RecoveryStage =
    | 'perdidos_qualificados'
    | 'mensagem_enviada'
    | 'em_conversa'
    | 'pronto_reabrir'
    | 'nao_reativado';

export interface RecoveryStageConfig {
    id: RecoveryStage;
    label: string;
    color: string;
    description: string;
}

export interface RecoveryDealItem {
    dealId: string;
    title: string;
    value: number;
    contactId: string | null;
    contactName: string;
    phone: string | null;
    email: string | null;
    lostReason: string;
    lostAt: string;
    daysSinceLost: number;
    stage: RecoveryStage;
    owner: 'IA' | 'Operador';
    assignedTo?: string | null;
    eligibilityStatus: 'Elegível' | 'Inelegível' | 'Pendente Revisão';
    eligibilityReason?: string;
    lastActivity: string;
    lastActivityDate?: string;
    nextAction: string;
    attemptsCount: number;
    summary: string;
    recommendedNextStep: string;
    isHumanInterventionPending: boolean;
    humanInterventionReason?: string;
    handoffTriggerMessage?: string;
    handoffTimestamp?: string;
    aiAutonomySuspended: boolean;
    returnDate?: string | null;
    operationalFlags?: {
        seguimentoProgramado?: boolean;
        revisaoHumana?: boolean;
        cooldownAtivo?: boolean;
    };
    notes?: string;
}

export interface RecoveryPipelineResponse {
    success: boolean;
    stages: RecoveryStageConfig[];
    items: RecoveryDealItem[];
    counts: Record<RecoveryStage, number>;
    metrics: {
        lostDealsAnalyzed: number;
        eligibleForRecovery: number;
        reactivationsInitiated: number;
        responsesReceived: number;
        conversationsRecovered: number;
        closerHandoffs: number;
        meetingsConfirmed: number;
        proposalsPresented: number;
        dealsWon: number;
        dealsUnrecovered: number;
        recoveredRevenue: number;
        costSummary: {
            whatsappEur: number;
            openaiEur: number;
            totalCombinedEur: number;
            costPerOpportunityEur: number;
            costPerMeetingEur: number;
            costPerClientEur: number;
        };
        avgTimeToHumanInterventionMinutes: number;
        isSimulation: boolean;
        rateIsEstimated: boolean;
        legalGateStatus: string;
    };
    agentLive?: {
        status: string;
        statusLabel?: string;
        whatsappConnected: boolean;
        whatsappStatus?: string;
        isWithinBusinessHours?: boolean;
        nextBusinessWindow?: string | null;
        connectedPhone: string;
        operatorName: string;
        todayDispatches: number;
        dailyLimit: number;
        extraAuthorizedDispatches?: number;
        hasExtraAuthorizationsLogged?: boolean;
        repliesToday: number;
        activeChats: number;
        meetingsBooked: number;
        calcomLink: string;
        recentActions: Array<{
            timestamp: string;
            actionType: string;
            details: {
                phone?: string;
                clinicName?: string;
                textSnippet?: string;
                snippet?: string;
                agentResolution?: string;
                intent?: string;
                deal_id?: string;
            };
        }>;
    };
}

export async function fetchRecoveryPipeline(limit = 150): Promise<RecoveryPipelineResponse | null> {
    try {
        const res = await fetch(`/api/sdr/recovery-pipeline?limit=${limit}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                return data;
            }
        }
    } catch (e) {
        console.error('Erro ao buscar pipeline de recuperação:', e);
    }
    return null;
}

export async function executeRecoveryPipelineAction(
    dealId: string,
    action: string,
    payload: any = {}
): Promise<{ success: boolean; error?: string; message?: string; item?: RecoveryDealItem }> {
    try {
        const res = await fetch('/api/sdr/recovery-pipeline/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId, action, payload })
        });
        return await res.json();
    } catch (e: any) {
        return { success: false, error: 'NETWORK_ERROR', message: e.message };
    }
}

export async function triggerCloserHandoff(
    dealId: string,
    reason?: string,
    triggerMessage?: string
): Promise<{ success: boolean; error?: string; item?: RecoveryDealItem }> {
    try {
        const res = await fetch('/api/sdr/recovery-pipeline/handoff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId, reason, triggerMessage })
        });
        return await res.json();
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function fetchRecoveryDealDetail(dealId: string): Promise<any> {
    try {
        const res = await fetch(`/api/sdr/recovery-pipeline/deal/${dealId}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error('Erro ao buscar detalhe do negócio no pipeline:', e);
    }
    return null;
}

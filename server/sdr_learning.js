/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — CICLO DE APRENDIZAGEM COMERCIAL CONTÍNUA (B.14.1.5)
 * ============================================================================
 * Motor de aprendizagem que analisa os resultados reais das ações comerciais,
 * identifica padrões, calcula custos por resultado e gera recomendações.
 *
 * Princípios:
 * 1. O CRM (sdr_outcomes) é a única fonte de verdade — sem duplicação.
 * 2. Separa factos observados, classificações do modelo e hipóteses.
 * 3. Não aplica alterações de alto impacto sem autorização explícita.
 * 4. Considera maturação das oportunidades (janela de observação).
 * 5. Não atribui causalidade sem evidência suficiente.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { readLocalOutcomes } from './sdr_engine.js';

// ============================================================================
// CONSTANTES DE CUSTOS E LIMITES
// ============================================================================

/** Custo estimado por mensagem WhatsApp Business API (EUR, categoria marketing PT) */
export const WHATSAPP_COST_PER_MESSAGE = parseFloat(process.env.WHATSAPP_COST_PER_MESSAGE || '0.0485');

/** Custo por 1000 tokens prompt (GPT-4o-mini) */
export const OPENAI_COST_PER_1K_PROMPT_TOKENS = parseFloat(process.env.OPENAI_COST_PER_1K_PROMPT || '0.00015');

/** Custo por 1000 tokens completion (GPT-4o-mini) */
export const OPENAI_COST_PER_1K_COMPLETION_TOKENS = parseFloat(process.env.OPENAI_COST_PER_1K_COMPLETION || '0.0006');

/** Amostra mínima para considerar uma métrica estatisticamente indicativa */
export const MIN_SAMPLE_SIZE = 20;

/** Amostra mínima para permitir uma conclusão forte (recomendação aprovável) */
export const MIN_SAMPLE_FOR_CONCLUSION = 50;

/** Janela de maturação padrão (horas) — um contacto recente sem resposta não é fracasso */
export const MATURATION_WINDOW_HOURS = 72;

/** Limite máximo de mensagens por teste A/B por dia */
export const MAX_AB_MESSAGES_PER_DAY = parseInt(process.env.MAX_AB_MESSAGES_PER_DAY || '10', 10);

/** Limite máximo de custo EUR por teste A/B por dia */
export const MAX_AB_COST_PER_DAY = parseFloat(process.env.MAX_AB_COST_PER_DAY || '5.00');

// ============================================================================
// ARMAZENAMENTO PERSISTENTE DE APRENDIZAGENS
// ============================================================================

const LEARNING_INSIGHTS_FILE = path.resolve(process.cwd(), 'data', 'sdr_learning_insights.json');
const LEARNING_MEMORY_FILE = path.resolve(process.cwd(), 'data', 'sdr_learning_memory.json');
const AB_TESTS_CONFIG_FILE = path.resolve(process.cwd(), 'data', 'sdr_ab_tests.json');

/**
 * Lê os insights de aprendizagem armazenados
 */
export function readLearningInsights() {
    try {
        if (!fs.existsSync(LEARNING_INSIGHTS_FILE)) return [];
        return JSON.parse(fs.readFileSync(LEARNING_INSIGHTS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

/**
 * Grava os insights de aprendizagem
 */
export function writeLearningInsights(insights) {
    try {
        fs.writeFileSync(LEARNING_INSIGHTS_FILE, JSON.stringify(insights, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [SDR Learning] Erro ao gravar insights:', e.message);
        return false;
    }
}

/**
 * Lê a memória de aprendizagem (regras, hipóteses, recomendações)
 */
export function readLearningMemory() {
    try {
        if (!fs.existsSync(LEARNING_MEMORY_FILE)) {
            return {
                rules: [],          // Regras aprovadas para uso activo
                hypotheses: [],     // Hipóteses ainda não confirmadas
                recommendations: [], // Recomendações pendentes de aprovação
                rejected: [],       // Estratégias/recomendações rejeitadas pelo operador
                disabled: [],       // Estratégias desativadas e motivos
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }
        return JSON.parse(fs.readFileSync(LEARNING_MEMORY_FILE, 'utf8'));
    } catch {
        return {
            rules: [], hypotheses: [], recommendations: [],
            rejected: [], disabled: [],
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
}

/**
 * Grava a memória de aprendizagem
 */
export function writeLearningMemory(memory) {
    try {
        memory.updated_at = new Date().toISOString();
        fs.writeFileSync(LEARNING_MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [SDR Learning] Erro ao gravar memória:', e.message);
        return false;
    }
}

/**
 * Lê a configuração de testes A/B
 */
export function readABTestsConfig() {
    try {
        if (!fs.existsSync(AB_TESTS_CONFIG_FILE)) {
            return { tests: [], version: 1, created_at: new Date().toISOString() };
        }
        return JSON.parse(fs.readFileSync(AB_TESTS_CONFIG_FILE, 'utf8'));
    } catch {
        return { tests: [], version: 1, created_at: new Date().toISOString() };
    }
}

/**
 * Grava a configuração de testes A/B
 */
export function writeABTestsConfig(config) {
    try {
        fs.writeFileSync(AB_TESTS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [SDR Learning] Erro ao gravar config A/B:', e.message);
        return false;
    }
}

// ============================================================================
// CÁLCULO DE CUSTOS
// ============================================================================

/**
 * Calcula o custo estimado de uma interação comercial
 */
export function calculateInteractionCost(outcome) {
    const meta = outcome.metadata || {};
    let whatsappCost = 0;
    let openaiCost = 0;

    // Custo WhatsApp
    if (meta.whatsapp_cost_actual != null) {
        whatsappCost = meta.whatsapp_cost_actual;
    } else if (meta.whatsapp_cost_est != null) {
        whatsappCost = meta.whatsapp_cost_est;
    } else if (outcome.channel === 'WHATSAPP' && ['EXECUTADA', 'ENVIADA', 'ENTREGUE'].includes(outcome.outcome)) {
        whatsappCost = WHATSAPP_COST_PER_MESSAGE * (meta.message_count || 1);
    }

    // Custo OpenAI
    if (meta.openai_token_usage) {
        const tokens = meta.openai_token_usage;
        openaiCost = ((tokens.prompt || 0) / 1000 * OPENAI_COST_PER_1K_PROMPT_TOKENS) +
                     ((tokens.completion || 0) / 1000 * OPENAI_COST_PER_1K_COMPLETION_TOKENS);
    }

    return {
        whatsapp: Number(whatsappCost.toFixed(4)),
        openai: Number(openaiCost.toFixed(4)),
        total: Number((whatsappCost + openaiCost).toFixed(4))
    };
}

// ============================================================================
// CÁLCULO DE KPIs AVANÇADOS COM CUSTOS
// ============================================================================

/**
 * Calcula KPIs comerciais avançados a partir dos outcomes existentes.
 * Reutiliza os dados do sdr_outcomes.json (fonte de verdade).
 * Não duplica o cálculo básico de calculateLearningMetrics — estende-o com custos.
 * 
 * @param {Object} options
 * @param {number} options.periodDays - Período a analisar em dias (default: 30)
 * @returns {Object} KPIs avançados com custos e métricas por segmento
 */
export function calculateAdvancedKPIs({ periodDays = 30 } = {}) {
    const outcomes = readLocalOutcomes();
    const now = Date.now();
    const cutoff = now - periodDays * 24 * 60 * 60 * 1000;

    // Filtrar por período
    const relevant = outcomes.filter(o => {
        const ts = new Date(o.attempt_date || o.created_at || 0).getTime();
        return ts >= cutoff;
    });

    const total = relevant.length;
    if (total === 0) {
        return {
            period: { days: periodDays, from: new Date(cutoff).toISOString(), to: new Date().toISOString() },
            totalOutcomes: 0,
            sampleWarning: 'Sem dados no período selecionado.',
            kpis: {},
            bySegment: {},
            byApproachType: {},
            byMessageVariant: {},
            costSummary: { totalWhatsapp: 0, totalOpenai: 0, totalCombined: 0 },
            inefficiencies: [],
            topPerformers: [],
            isCalibrated: false
        };
    }

    // Contadores globais
    let totalSent = 0;
    let totalDelivered = 0;
    let totalResponses = 0;
    let totalPositiveResponses = 0;
    let totalQualified = 0;
    let totalMeetings = 0;
    let totalSalesWon = 0;
    let totalOptouts = 0;
    let totalNegative = 0;
    let totalCostWhatsapp = 0;
    let totalCostOpenai = 0;
    let totalMessages = 0;
    let totalTimeSpent = 0;
    let totalComplaints = 0;
    let totalHumanInterventions = 0;
    let totalErrors = 0;

    // Agrupamentos
    const bySegment = {};
    const byApproachType = {};
    const byMessageVariant = {};
    const byDeal = {};

    // Detecção de ineficiências
    const duplicateMessages = new Map(); // dealId -> count
    const answeredQuestions = new Map();  // dealId -> Set of questions

    for (const o of relevant) {
        const meta = o.metadata || {};
        const cost = calculateInteractionCost(o);
        const segment = meta.segment || o.loss_classification || 'DESCONHECIDO';
        const approachType = meta.approach_type || o.strategy || 'DESCONHECIDO';
        const variant = meta.message_variant || 'default';

        // Contadores globais
        if (['EXECUTADA', 'ENVIADA', 'ENTREGUE'].includes(o.outcome)) totalSent++;
        if (['ENTREGUE', 'EXECUTADA'].includes(o.outcome)) totalDelivered++;
        if (['RESPOSTA_POSITIVA', 'RESPOSTA_NEGATIVA', 'INTERESSE_QUALIFICADO'].includes(o.outcome)) totalResponses++;
        if (['RESPOSTA_POSITIVA', 'INTERESSE_QUALIFICADO'].includes(o.outcome)) totalPositiveResponses++;
        if (o.outcome === 'INTERESSE_QUALIFICADO') totalQualified++;
        if (o.outcome === 'REUNIAO_CONFIRMADA' || o.meeting_confirmed) totalMeetings++;
        if (o.outcome === 'VENDA_GANHA' || o.sale_won) totalSalesWon++;
        if (o.outcome === 'OPTOUT') totalOptouts++;
        if (o.outcome === 'RESPOSTA_NEGATIVA') totalNegative++;
        if (meta.complaint_flag) totalComplaints++;
        if (meta.error_flag) totalErrors++;
        if (o.executed_by?.includes('Operador') || meta.human_intervention) totalHumanInterventions++;

        totalCostWhatsapp += cost.whatsapp;
        totalCostOpenai += cost.openai;
        totalMessages += meta.message_count || (o.outcome === 'EXECUTADA' ? 1 : 0);
        totalTimeSpent += meta.time_spent_seconds || 0;

        // Por deal (para detectar ciclos longos)
        if (!byDeal[o.deal_id]) byDeal[o.deal_id] = { count: 0, cost: 0, responses: 0, qualified: false, won: false };
        byDeal[o.deal_id].count++;
        byDeal[o.deal_id].cost += cost.total;
        if (totalResponses > 0) byDeal[o.deal_id].responses++;
        if (o.outcome === 'INTERESSE_QUALIFICADO') byDeal[o.deal_id].qualified = true;
        if (o.outcome === 'VENDA_GANHA' || o.sale_won) byDeal[o.deal_id].won = true;

        // Por segmento
        if (!bySegment[segment]) bySegment[segment] = createGroupBucket();
        updateGroupBucket(bySegment[segment], o, cost);

        // Por abordagem
        if (!byApproachType[approachType]) byApproachType[approachType] = createGroupBucket();
        updateGroupBucket(byApproachType[approachType], o, cost);

        // Por variante
        if (!byMessageVariant[variant]) byMessageVariant[variant] = createGroupBucket();
        updateGroupBucket(byMessageVariant[variant], o, cost);

        // Deteção de mensagens duplicadas (mesmo deal, mesma mensagem)
        const msgKey = `${o.deal_id}_${(o.message_approved || '').substring(0, 50)}`;
        duplicateMessages.set(msgKey, (duplicateMessages.get(msgKey) || 0) + 1);
    }

    // Calcular taxas
    const totalCombined = totalCostWhatsapp + totalCostOpenai;

    const kpis = {
        taxaResposta: {
            valor: totalSent > 0 ? Number(((totalResponses / totalSent) * 100).toFixed(1)) : 0,
            numerador: totalResponses,
            denominador: totalSent,
            descricao: 'Respostas relevantes / Abordagens enviadas',
            tipo: 'facto'
        },
        taxaInteresseGenuino: {
            valor: totalSent > 0 ? Number(((totalPositiveResponses / totalSent) * 100).toFixed(1)) : 0,
            numerador: totalPositiveResponses,
            denominador: totalSent,
            descricao: 'Respostas positivas / Abordagens enviadas',
            tipo: 'facto'
        },
        taxaQualificacao: {
            valor: totalResponses > 0 ? Number(((totalQualified / totalResponses) * 100).toFixed(1)) : 0,
            numerador: totalQualified,
            denominador: totalResponses,
            descricao: 'Oportunidades qualificadas / Respostas recebidas',
            tipo: 'facto'
        },
        taxaReuniao: {
            valor: totalQualified > 0 ? Number(((totalMeetings / totalQualified) * 100).toFixed(1)) : 0,
            numerador: totalMeetings,
            denominador: totalQualified,
            descricao: 'Reuniões confirmadas / Interesse qualificado',
            tipo: 'facto'
        },
        taxaConversaoVenda: {
            valor: totalMeetings > 0 ? Number(((totalSalesWon / totalMeetings) * 100).toFixed(1)) : 0,
            numerador: totalSalesWon,
            denominador: totalMeetings,
            descricao: 'Vendas conquistadas / Reuniões realizadas',
            tipo: 'facto'
        },
        custoPorOportunidadeQualificada: {
            valor: totalQualified > 0 ? Number((totalCombined / totalQualified).toFixed(2)) : 0,
            descricao: 'Custo total (€) por oportunidade qualificada',
            tipo: 'facto'
        },
        custoPorReuniao: {
            valor: totalMeetings > 0 ? Number((totalCombined / totalMeetings).toFixed(2)) : 0,
            descricao: 'Custo total (€) por reunião realizada',
            tipo: 'facto'
        },
        custoPorClienteConquistado: {
            valor: totalSalesWon > 0 ? Number((totalCombined / totalSalesWon).toFixed(2)) : 0,
            descricao: 'Custo total (€) por cliente conquistado',
            tipo: 'facto'
        },
        mensagensMediasPorOportunidade: {
            valor: Object.keys(byDeal).length > 0
                ? Number((totalMessages / Object.keys(byDeal).length).toFixed(1))
                : 0,
            descricao: 'Mensagens médias por oportunidade contactada',
            tipo: 'facto'
        },
        taxaRejeicao: {
            valor: totalSent > 0 ? Number(((totalNegative / totalSent) * 100).toFixed(1)) : 0,
            numerador: totalNegative,
            denominador: totalSent,
            descricao: 'Respostas negativas / Abordagens enviadas',
            tipo: 'facto'
        },
        taxaOptout: {
            valor: totalSent > 0 ? Number(((totalOptouts / totalSent) * 100).toFixed(1)) : 0,
            numerador: totalOptouts,
            denominador: totalSent,
            descricao: 'Opt-outs / Abordagens enviadas',
            tipo: 'facto'
        },
        taxaReclamacao: {
            valor: totalSent > 0 ? Number(((totalComplaints / totalSent) * 100).toFixed(1)) : 0,
            numerador: totalComplaints,
            denominador: totalSent,
            descricao: 'Reclamações / Abordagens enviadas',
            tipo: 'facto'
        },
        taxaIntervencaoHumana: {
            valor: total > 0 ? Number(((totalHumanInterventions / total) * 100).toFixed(1)) : 0,
            numerador: totalHumanInterventions,
            denominador: total,
            descricao: 'Intervenções humanas / Total de outcomes',
            tipo: 'facto'
        }
    };

    // Identificar ineficiências
    const inefficiencies = [];

    // Deals com muitas mensagens sem progresso
    for (const [dealId, stats] of Object.entries(byDeal)) {
        if (stats.count >= 4 && !stats.qualified && stats.responses === 0) {
            inefficiencies.push({
                tipo: 'CICLO_LONGO_SEM_RESPOSTA',
                deal_id: dealId,
                mensagens: stats.count,
                custo: Number(stats.cost.toFixed(2)),
                descricao: `${stats.count} tentativas sem qualquer resposta. Custo acumulado: €${stats.cost.toFixed(2)}.`,
                recomendacao: 'Considerar pausa definitiva ou abordagem por canal diferente.',
                tipo_dado: 'facto'
            });
        }
    }

    // Mensagens duplicadas
    for (const [key, count] of duplicateMessages) {
        if (count > 2) {
            inefficiencies.push({
                tipo: 'MENSAGEM_DUPLICADA',
                chave: key,
                repeticoes: count,
                descricao: `Mensagem repetida ${count} vezes para o mesmo negócio.`,
                recomendacao: 'Variar o conteúdo ou interromper a abordagem.',
                tipo_dado: 'facto'
            });
        }
    }

    // Estratégias com custo elevado e baixo retorno
    for (const [approach, stats] of Object.entries(byApproachType)) {
        if (stats.total >= 5 && stats.qualified === 0 && stats.costTotal > 1) {
            inefficiencies.push({
                tipo: 'ESTRATEGIA_CARA_SEM_RETORNO',
                estrategia: approach,
                total: stats.total,
                custo: Number(stats.costTotal.toFixed(2)),
                descricao: `Estratégia "${approach}" com ${stats.total} tentativas e €${stats.costTotal.toFixed(2)} gastos sem gerar interesse qualificado.`,
                recomendacao: 'Avaliar a continuidade desta estratégia.',
                tipo_dado: stats.total >= MIN_SAMPLE_SIZE ? 'facto' : 'hipotese'
            });
        }
    }

    // Top performers
    const topPerformers = Object.entries(byApproachType)
        .filter(([, stats]) => stats.total >= 3 && stats.positive > 0)
        .map(([approach, stats]) => ({
            estrategia: approach,
            total: stats.total,
            positivas: stats.positive,
            taxaPositiva: Number(((stats.positive / stats.total) * 100).toFixed(1)),
            custoPorPositiva: stats.positive > 0 ? Number((stats.costTotal / stats.positive).toFixed(2)) : 0,
            tipo_dado: stats.total >= MIN_SAMPLE_SIZE ? 'facto' : 'indicativo'
        }))
        .sort((a, b) => b.taxaPositiva - a.taxaPositiva)
        .slice(0, 5);

    return {
        period: {
            days: periodDays,
            from: new Date(cutoff).toISOString(),
            to: new Date().toISOString()
        },
        totalOutcomes: total,
        kpis,
        bySegment: summarizeGroups(bySegment),
        byApproachType: summarizeGroups(byApproachType),
        byMessageVariant: summarizeGroups(byMessageVariant),
        costSummary: {
            totalWhatsapp: Number(totalCostWhatsapp.toFixed(2)),
            totalOpenai: Number(totalCostOpenai.toFixed(2)),
            totalCombined: Number(totalCombined.toFixed(2)),
            custoMedioPorAbordagem: totalSent > 0 ? Number((totalCombined / totalSent).toFixed(4)) : 0
        },
        inefficiencies,
        topPerformers,
        isCalibrated: total >= MIN_SAMPLE_SIZE,
        sampleWarning: total < MIN_SAMPLE_SIZE
            ? `Amostra de ${total} observações insuficiente para conclusões estatísticas (mínimo: ${MIN_SAMPLE_SIZE}). Dados indicativos.`
            : null
    };
}

// Helpers de agrupamento
function createGroupBucket() {
    return { total: 0, sent: 0, responses: 0, positive: 0, qualified: 0, meetings: 0, sales: 0, optouts: 0, negative: 0, costTotal: 0, messages: 0, complaints: 0, errors: 0 };
}

function updateGroupBucket(bucket, outcome, cost) {
    bucket.total++;
    if (['EXECUTADA', 'ENVIADA', 'ENTREGUE'].includes(outcome.outcome)) bucket.sent++;
    if (['RESPOSTA_POSITIVA', 'RESPOSTA_NEGATIVA', 'INTERESSE_QUALIFICADO'].includes(outcome.outcome)) bucket.responses++;
    if (['RESPOSTA_POSITIVA', 'INTERESSE_QUALIFICADO'].includes(outcome.outcome)) bucket.positive++;
    if (outcome.outcome === 'INTERESSE_QUALIFICADO') bucket.qualified++;
    if (outcome.outcome === 'REUNIAO_CONFIRMADA' || outcome.meeting_confirmed) bucket.meetings++;
    if (outcome.outcome === 'VENDA_GANHA' || outcome.sale_won) bucket.sales++;
    if (outcome.outcome === 'OPTOUT') bucket.optouts++;
    if (outcome.outcome === 'RESPOSTA_NEGATIVA') bucket.negative++;
    bucket.costTotal += cost.total;
    bucket.messages += (outcome.metadata?.message_count || (outcome.outcome === 'EXECUTADA' ? 1 : 0));
    if (outcome.metadata?.complaint_flag) bucket.complaints++;
    if (outcome.metadata?.error_flag) bucket.errors++;
}

function summarizeGroups(groups) {
    const result = {};
    for (const [key, stats] of Object.entries(groups)) {
        result[key] = {
            ...stats,
            costTotal: Number(stats.costTotal.toFixed(2)),
            taxaResposta: stats.sent > 0 ? Number(((stats.responses / stats.sent) * 100).toFixed(1)) : 0,
            taxaPositiva: stats.sent > 0 ? Number(((stats.positive / stats.sent) * 100).toFixed(1)) : 0,
            custoPorPositiva: stats.positive > 0 ? Number((stats.costTotal / stats.positive).toFixed(2)) : 0,
            isCalibrated: stats.total >= MIN_SAMPLE_SIZE
        };
    }
    return result;
}

// ============================================================================
// MOTOR DE ANÁLISE GPT PERIÓDICA
// ============================================================================

/**
 * Executa o job de análise periódica.
 * Lê os outcomes, calcula KPIs, constrói um prompt conciso e pede ao GPT
 * insights, hipóteses e propostas de teste.
 * 
 * Não pede ao GPT para estimar métricas que possam ser calculadas directamente.
 * Utiliza GPT apenas para interpretar padrões e propor melhorias.
 */
export async function runPeriodicLearningAnalysis({ periodDays = 30 } = {}) {
    console.log('🧠 [SDR Learning] Iniciando análise periódica de aprendizagem...');
    const startTime = Date.now();

    const kpis = calculateAdvancedKPIs({ periodDays });

    if (kpis.totalOutcomes === 0) {
        console.log('⚠️ [SDR Learning] Sem outcomes para analisar.');
        return { success: true, noData: true, kpis };
    }

    // Ler memória existente para contexto
    const memory = readLearningMemory();
    const previousInsights = readLearningInsights().slice(0, 3); // últimos 3 ciclos

    // Construir o prompt para análise qualitativa pelo GPT
    const openaiApiKey = process.env.OPENAI_API_KEY;
    let gptInsights = null;
    let gptTokenUsage = null;

    if (openaiApiKey && kpis.totalOutcomes >= 5) {
        try {
            const analysisPrompt = buildAnalysisPrompt(kpis, memory, previousInsights);
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'És o analista comercial da Vamuss. Analisas dados reais de um SDR comercial. Responde em JSON. Não inventes dados. Distingue factos de hipóteses. Não recomiendes aumentar volumes nem alterar limites legais.'
                        },
                        { role: 'user', content: analysisPrompt }
                    ],
                    temperature: 0.3,
                    response_format: { type: 'json_object' }
                })
            });

            if (response.ok) {
                const data = await response.json();
                gptTokenUsage = data.usage || null;
                const contentStr = data.choices?.[0]?.message?.content || '{}';
                gptInsights = JSON.parse(contentStr);
            }
        } catch (err) {
            console.warn('⚠️ [SDR Learning] Erro na análise GPT:', err.message);
        }
    }

    // Construir o relatório de insights
    const insightRecord = {
        id: `insight_${Date.now()}`,
        timestamp: new Date().toISOString(),
        period: kpis.period,
        totalOutcomes: kpis.totalOutcomes,
        isCalibrated: kpis.isCalibrated,
        kpis: kpis.kpis,
        costSummary: kpis.costSummary,
        topPerformers: kpis.topPerformers,
        inefficiencies: kpis.inefficiencies,
        bySegment: kpis.bySegment,
        byApproachType: kpis.byApproachType,
        gptInsights: gptInsights || null,
        gptTokenUsage: gptTokenUsage || null,
        analysisTimeMs: Date.now() - startTime,
        source: gptInsights ? 'deterministic+gpt' : 'deterministic_only'
    };

    // Armazenar o insight (manter os últimos 30 relatórios)
    const insights = readLearningInsights();
    insights.unshift(insightRecord);
    if (insights.length > 30) insights.splice(30);
    writeLearningInsights(insights);

    // Atualizar a memória com hipóteses e recomendações do GPT (sem auto-aplicar)
    if (gptInsights?.hypotheses) {
        for (const h of gptInsights.hypotheses) {
            memory.hypotheses.push({
                id: `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                ...h,
                source: 'gpt_periodic_analysis',
                created_at: new Date().toISOString(),
                status: 'pending',
                sample_size: kpis.totalOutcomes,
                confidence: kpis.isCalibrated ? 'indicative' : 'insufficient_sample'
            });
        }
    }

    if (gptInsights?.recommendations) {
        for (const r of gptInsights.recommendations) {
            memory.recommendations.push({
                id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                ...r,
                source: 'gpt_periodic_analysis',
                created_at: new Date().toISOString(),
                status: 'pending_approval',
                requires_approval: true,
                sample_size: kpis.totalOutcomes,
                can_auto_apply: false // Alto impacto — nunca auto-aplicar
            });
        }
    }

    writeLearningMemory(memory);

    console.log(`✅ [SDR Learning] Análise concluída em ${Date.now() - startTime}ms. ${kpis.totalOutcomes} outcomes, ${kpis.inefficiencies.length} ineficiências, ${(gptInsights?.recommendations || []).length} recomendações.`);

    return {
        success: true,
        insight: insightRecord,
        memoryUpdated: true
    };
}

/**
 * Constrói o prompt de análise para o GPT.
 * Passa apenas dados já calculados — não pede ao GPT para estimar métricas.
 */
function buildAnalysisPrompt(kpis, memory, previousInsights) {
    const approachSummary = Object.entries(kpis.byApproachType)
        .map(([name, stats]) => `  - ${name}: ${stats.total} tentativas, ${stats.positive} positivas (${stats.taxaPositiva}%), custo €${stats.costTotal}`)
        .join('\n');

    const segmentSummary = Object.entries(kpis.bySegment)
        .map(([name, stats]) => `  - ${name}: ${stats.total} tentativas, ${stats.positive} positivas (${stats.taxaPositiva}%)`)
        .join('\n');

    const ineffSummary = kpis.inefficiencies.length > 0
        ? kpis.inefficiencies.map(i => `  - [${i.tipo}] ${i.descricao}`).join('\n')
        : '  Nenhuma ineficiência detetada.';

    const previousRules = memory.rules.length > 0
        ? memory.rules.map(r => `  - ${r.descricao || r.description}`).join('\n')
        : '  Nenhuma regra aprovada.';

    const previousHypotheses = memory.hypotheses.filter(h => h.status === 'pending').slice(0, 5)
        .map(h => `  - ${h.description || h.descricao || JSON.stringify(h)}`)
        .join('\n') || '  Nenhuma hipótese pendente.';

    return `DADOS REAIS DO SDR VAMUSS (Período: ${kpis.period.days} dias, ${kpis.totalOutcomes} interações)
Calibração: ${kpis.isCalibrated ? 'Amostra calibrada' : `Amostra insuficiente (${kpis.totalOutcomes}/${MIN_SAMPLE_SIZE})`}

KPIs CALCULADOS (NÃO ESTIMAR — USAR ESTES VALORES):
- Taxa de resposta: ${kpis.kpis.taxaResposta?.valor}% (${kpis.kpis.taxaResposta?.numerador}/${kpis.kpis.taxaResposta?.denominador})
- Taxa de interesse genuíno: ${kpis.kpis.taxaInteresseGenuino?.valor}%
- Taxa de qualificação: ${kpis.kpis.taxaQualificacao?.valor}%
- Taxa de reunião: ${kpis.kpis.taxaReuniao?.valor}%
- Taxa de conversão venda: ${kpis.kpis.taxaConversaoVenda?.valor}%
- Custo por oportunidade qualificada: €${kpis.kpis.custoPorOportunidadeQualificada?.valor}
- Custo por reunião: €${kpis.kpis.custoPorReuniao?.valor}
- Taxa de opt-out: ${kpis.kpis.taxaOptout?.valor}%
- Taxa de reclamação: ${kpis.kpis.taxaReclamacao?.valor}%
- Taxa de intervenção humana: ${kpis.kpis.taxaIntervencaoHumana?.valor}%

CUSTO TOTAL: €${kpis.costSummary.totalCombined} (WhatsApp: €${kpis.costSummary.totalWhatsapp}, OpenAI: €${kpis.costSummary.totalOpenai})

POR ESTRATÉGIA:
${approachSummary || '  Sem dados.'}

POR SEGMENTO:
${segmentSummary || '  Sem dados.'}

INEFICIÊNCIAS DETETADAS:
${ineffSummary}

REGRAS APROVADAS ANTERIORES:
${previousRules}

HIPÓTESES PENDENTES:
${previousHypotheses}

RESPONDE EM JSON COM ESTA ESTRUTURA EXACTA:
{
  "summary": "string — resumo de 2-3 linhas dos padrões observados",
  "patterns": [
    {
      "description": "string — padrão observado",
      "evidence": "string — factos que sustentam o padrão",
      "confidence": "alta|media|baixa",
      "type": "facto|hipotese"
    }
  ],
  "hypotheses": [
    {
      "description": "string — hipótese a testar",
      "rationale": "string — porquê esta hipótese",
      "suggested_test": "string — como testar",
      "risk": "baixo|medio|alto",
      "type": "hipotese"
    }
  ],
  "recommendations": [
    {
      "description": "string — recomendação concreta",
      "expected_impact": "string — impacto esperado",
      "risk_level": "baixo|medio|alto",
      "requires_approval": true,
      "type": "recomendacao"
    }
  ],
  "cost_optimization": [
    {
      "area": "string — área de otimização",
      "suggestion": "string — sugestão",
      "estimated_saving": "string — poupança estimada"
    }
  ],
  "warnings": ["string — alertas importantes"]
}

NÃO recomendes aumentar volumes, limites de envio ou alterar permissões legais.
NÃO transformes uma observação isolada em regra universal.
NÃO apresentes uma estratégia como vencedora se a amostra for < ${MIN_SAMPLE_FOR_CONCLUSION}.
Distingue SEMPRE factos de hipóteses.`;
}

// ============================================================================
// FRAMEWORK DE TESTES A/B
// ============================================================================

/**
 * Seleciona uma variante de teste A/B para um deal, se aplicável.
 * Usa hash determinístico para garantir consistência (mesmo deal = mesma variante).
 * 
 * @param {string} dealId - ID do negócio
 * @param {string} segment - Segmento comercial
 * @returns {Object|null} - Variante selecionada ou null se sem teste ativo
 */
export function selectABVariant(dealId, segment) {
    const config = readABTestsConfig();
    const activeTests = (config.tests || []).filter(t =>
        t.status === 'active' &&
        (!t.segment || t.segment === segment) &&
        (!t.end_date || new Date(t.end_date) > new Date())
    );

    if (activeTests.length === 0) return null;

    // Verificar limites diários
    const today = new Date().toISOString().slice(0, 10);
    const outcomes = readLocalOutcomes();
    const todayTestOutcomes = outcomes.filter(o =>
        (o.created_at || '').startsWith(today) &&
        o.metadata?.ab_test_id
    );

    const todayMessageCount = todayTestOutcomes.length;
    const todayCost = todayTestOutcomes.reduce((sum, o) => sum + calculateInteractionCost(o).total, 0);

    if (todayMessageCount >= MAX_AB_MESSAGES_PER_DAY) {
        console.log(`⚠️ [SDR A/B] Limite diário de mensagens de teste atingido (${todayMessageCount}/${MAX_AB_MESSAGES_PER_DAY}).`);
        return null;
    }
    if (todayCost >= MAX_AB_COST_PER_DAY) {
        console.log(`⚠️ [SDR A/B] Limite diário de custo de teste atingido (€${todayCost.toFixed(2)}/€${MAX_AB_COST_PER_DAY}).`);
        return null;
    }

    // Selecionar o primeiro teste aplicável
    const test = activeTests[0];

    // Hash determinístico para atribuir variante estável ao deal
    const hash = simpleHash(`${dealId}_${test.id}`);
    const variantIndex = hash % test.variants.length;
    const variant = test.variants[variantIndex];

    // Verificar que este deal não foi já contactado por este teste
    const alreadyTested = outcomes.some(o =>
        o.deal_id === dealId && o.metadata?.ab_test_id === test.id
    );
    if (alreadyTested) return null;

    // Verificar limites do teste
    const testOutcomes = outcomes.filter(o => o.metadata?.ab_test_id === test.id);
    if (test.max_volume && testOutcomes.length >= test.max_volume) {
        return null;
    }

    // Verificar se o teste está a gerar demasiadas recusas
    const testOptouts = testOutcomes.filter(o => o.outcome === 'OPTOUT' || o.outcome === 'RESPOSTA_NEGATIVA');
    if (testOutcomes.length >= 5 && (testOptouts.length / testOutcomes.length) > 0.3) {
        console.warn(`🚨 [SDR A/B] Teste "${test.id}" com ${(testOptouts.length / testOutcomes.length * 100).toFixed(0)}% de recusas. Interrompido automaticamente.`);
        // Desativar o teste
        test.status = 'stopped_high_rejection';
        test.stopped_at = new Date().toISOString();
        test.stop_reason = `Taxa de recusa/optout acima de 30% (${testOptouts.length}/${testOutcomes.length}).`;
        writeABTestsConfig(config);
        return null;
    }

    return {
        test_id: test.id,
        variant_id: variant.id,
        variant_name: variant.name,
        variant_config: variant.config || {},
        hypothesis_id: test.hypothesis_id || null
    };
}

/**
 * Hash simples e determinístico para distribuição de variantes
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// ============================================================================
// CONSULTA DE APRENDIZAGENS PELO GPT
// ============================================================================

/**
 * Retorna um resumo compacto das aprendizagens relevantes para um novo contacto,
 * sem enviar indiscriminadamente todo o histórico ao GPT.
 * 
 * @param {Object} params
 * @param {string} params.segment - Segmento comercial
 * @param {string} params.lossClassification - Classificação da perda
 * @param {string} params.strategy - Estratégia pretendida
 * @returns {Object} Contexto de aprendizagem relevante
 */
export function getLearningContextForDeal({ segment, lossClassification, strategy }) {
    const memory = readLearningMemory();
    const insights = readLearningInsights();
    const latestInsight = insights[0] || null;

    // Regras aprovadas e relevantes
    const relevantRules = memory.rules.filter(r =>
        !r.segment || r.segment === segment ||
        !r.strategy || r.strategy === strategy
    ).slice(0, 5);

    // Estratégias desativadas relevantes
    const disabledStrategies = memory.disabled.filter(d =>
        d.strategy === strategy || d.segment === segment
    ).slice(0, 3);

    // Hipóteses confirmadas sobre este segmento/estratégia
    const confirmedHypotheses = memory.hypotheses.filter(h =>
        h.status === 'confirmed' && (h.segment === segment || h.strategy === strategy)
    ).slice(0, 3);

    // Dados de performance da estratégia pretendida
    let strategyPerformance = null;
    if (latestInsight?.byApproachType?.[strategy]) {
        const perf = latestInsight.byApproachType[strategy];
        strategyPerformance = {
            total: perf.total,
            taxaPositiva: perf.taxaPositiva,
            custoPorPositiva: perf.custoPorPositiva,
            isCalibrated: perf.isCalibrated
        };
    }

    return {
        rules: relevantRules.map(r => r.descricao || r.description),
        disabledStrategies: disabledStrategies.map(d => `${d.strategy}: ${d.motivo || d.reason}`),
        confirmedInsights: confirmedHypotheses.map(h => h.description || h.descricao),
        strategyPerformance,
        lastAnalysisDate: latestInsight?.timestamp || null,
        warnings: latestInsight?.gptInsights?.warnings || []
    };
}

// ============================================================================
// GESTÃO DE RECOMENDAÇÕES (APROVAÇÃO / REJEIÇÃO / REVERSÃO)
// ============================================================================

/**
 * Aprova uma recomendação e opcionalmente converte-a em regra
 */
export function approveRecommendation(recommendationId, { convertToRule = false, approvedBy = 'Operador' } = {}) {
    const memory = readLearningMemory();
    const rec = memory.recommendations.find(r => r.id === recommendationId);
    if (!rec) return { success: false, error: 'Recomendação não encontrada.' };

    rec.status = 'approved';
    rec.approved_at = new Date().toISOString();
    rec.approved_by = approvedBy;

    if (convertToRule) {
        memory.rules.push({
            id: `rule_${Date.now()}`,
            descricao: rec.description || rec.descricao,
            source_recommendation: recommendationId,
            created_at: new Date().toISOString(),
            approved_by: approvedBy,
            sample_size: rec.sample_size,
            can_revert: true
        });
    }

    writeLearningMemory(memory);
    return { success: true, recommendation: rec };
}

/**
 * Rejeita uma recomendação
 */
export function rejectRecommendation(recommendationId, { reason = '', rejectedBy = 'Operador' } = {}) {
    const memory = readLearningMemory();
    const rec = memory.recommendations.find(r => r.id === recommendationId);
    if (!rec) return { success: false, error: 'Recomendação não encontrada.' };

    rec.status = 'rejected';
    rec.rejected_at = new Date().toISOString();
    rec.rejected_by = rejectedBy;
    rec.rejection_reason = reason;

    memory.rejected.push({ ...rec });
    writeLearningMemory(memory);
    return { success: true };
}

/**
 * Reverte uma regra (remove-a do conjunto ativo e arquiva)
 */
export function revertRule(ruleId, { reason = '', revertedBy = 'Operador' } = {}) {
    const memory = readLearningMemory();
    const idx = memory.rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return { success: false, error: 'Regra não encontrada.' };

    const rule = memory.rules.splice(idx, 1)[0];
    memory.disabled.push({
        ...rule,
        status: 'reverted',
        reverted_at: new Date().toISOString(),
        reverted_by: revertedBy,
        motivo: reason
    });

    writeLearningMemory(memory);
    return { success: true };
}

// ============================================================================
// SETUP DE ROTAS EXPRESS
// ============================================================================

/**
 * Registar rotas da camada de aprendizagem no Express
 */
export function setupLearningRoutes(app) {
    console.log('🧠 [SDR Learning] Inicializando rotas de aprendizagem contínua B.14.1.5...');

    /**
     * GET /api/sdr/learning/advanced
     * KPIs avançados com custos, segmentação e ineficiências
     */
    app.get('/api/sdr/learning/advanced', (req, res) => {
        try {
            const periodDays = parseInt(req.query.period || '30', 10);
            const kpis = calculateAdvancedKPIs({ periodDays });
            return res.json({ success: true, ...kpis });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/learning/insights
     * Últimos relatórios de análise (insights históricos)
     */
    app.get('/api/sdr/learning/insights', (req, res) => {
        try {
            const limit = parseInt(req.query.limit || '5', 10);
            const insights = readLearningInsights().slice(0, limit);
            return res.json({ success: true, insights, total: insights.length });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/learning/memory
     * Estado da memória de aprendizagem (regras, hipóteses, recomendações)
     */
    app.get('/api/sdr/learning/memory', (req, res) => {
        try {
            const memory = readLearningMemory();
            return res.json({ success: true, memory });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/learning/approve
     * Aprovar uma recomendação
     */
    app.post('/api/sdr/learning/approve', (req, res) => {
        try {
            const { recommendationId, convertToRule, approvedBy } = req.body;
            if (!recommendationId) return res.status(400).json({ success: false, error: 'recommendationId obrigatório.' });
            const result = approveRecommendation(recommendationId, { convertToRule, approvedBy });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/learning/reject
     * Rejeitar uma recomendação
     */
    app.post('/api/sdr/learning/reject', (req, res) => {
        try {
            const { recommendationId, reason, rejectedBy } = req.body;
            if (!recommendationId) return res.status(400).json({ success: false, error: 'recommendationId obrigatório.' });
            const result = rejectRecommendation(recommendationId, { reason, rejectedBy });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/learning/revert-rule
     * Reverter uma regra ativa
     */
    app.post('/api/sdr/learning/revert-rule', (req, res) => {
        try {
            const { ruleId, reason, revertedBy } = req.body;
            if (!ruleId) return res.status(400).json({ success: false, error: 'ruleId obrigatório.' });
            const result = revertRule(ruleId, { reason, revertedBy });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET & POST /api/sdr/learning/tick
     * Executa manualmente (ou via cron) o ciclo de análise periódica
     */
    const handleLearningTick = async (req, res) => {
        try {
            const periodDays = parseInt(req.query?.period || req.body?.period || '30', 10);
            const result = await runPeriodicLearningAnalysis({ periodDays });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    app.get('/api/sdr/learning/tick', handleLearningTick);
    app.post('/api/sdr/learning/tick', handleLearningTick);

    /**
     * GET /api/sdr/learning/ab-tests
     * Consultar testes A/B configurados
     */
    app.get('/api/sdr/learning/ab-tests', (req, res) => {
        try {
            const config = readABTestsConfig();
            return res.json({ success: true, ...config });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/learning/context
     * Contexto de aprendizagem para uso pelo GPT ao analisar um deal
     */
    app.get('/api/sdr/learning/context', (req, res) => {
        try {
            const { segment, lossClassification, strategy } = req.query;
            const context = getLearningContextForDeal({
                segment: segment || '',
                lossClassification: lossClassification || '',
                strategy: strategy || ''
            });
            return res.json({ success: true, context });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });
}

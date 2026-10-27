/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — APRENDIZADO ANALÍTICO, TESTE A/B E OBJEÇÕES (B.15.3)
 * ============================================================================
 * Regista o desempenho real de cada abordagem, controla testes A/B balanceados,
 * alimenta o repositório de objeções reais e produz o relatório semanal.
 * 
 * Regra estatística estrita:
 * Só declara uma variante vencedora com pelo menos 30 envios por variante
 * (~12 dias úteis a 5 leads/dia).
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

const OUTCOMES_TRACKER_FILE = path.resolve(process.cwd(), 'data', 'sdr_outcomes_learning.json');
const OBJECTIONS_REPO_FILE = path.resolve(process.cwd(), 'data', 'sdr_lead_objections_repository.json');
export const MIN_SAMPLE_FOR_WINNER = 30;

/**
 * Lê o registo de aprendizagem de abordagens e desfechos
 */
export function readOutcomesTracker() {
    try {
        if (!fs.existsSync(OUTCOMES_TRACKER_FILE)) {
            const dir = path.dirname(OUTCOMES_TRACKER_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const initial = { dispatches: [], version: 1 };
            fs.writeFileSync(OUTCOMES_TRACKER_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        return JSON.parse(fs.readFileSync(OUTCOMES_TRACKER_FILE, 'utf8'));
    } catch {
        return { dispatches: [], version: 1 };
    }
}

/**
 * Grava o registo de aprendizagem
 */
export function saveOutcomesTracker(data) {
    try {
        fs.writeFileSync(OUTCOMES_TRACKER_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [Learning Analytics] Erro ao gravar dados de aprendizagem:', e.message);
        return false;
    }
}

/**
 * Lê o repositório de objeções reais
 */
export function readObjectionsRepository() {
    try {
        if (!fs.existsSync(OBJECTIONS_REPO_FILE)) {
            const dir = path.dirname(OBJECTIONS_REPO_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const initial = { objections: [], version: 1 };
            fs.writeFileSync(OBJECTIONS_REPO_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        return JSON.parse(fs.readFileSync(OBJECTIONS_REPO_FILE, 'utf8'));
    } catch {
        return { objections: [], version: 1 };
    }
}

/**
 * Grava o repositório de objeções
 */
export function saveObjectionsRepository(data) {
    try {
        fs.writeFileSync(OBJECTIONS_REPO_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [Learning Analytics] Erro ao gravar repositório de objeções:', e.message);
        return false;
    }
}

/**
 * Determina a próxima variante A/B de forma 50/50 balanceada
 */
export function getNextABVariant(dealId = '') {
    const tracker = readOutcomesTracker();
    const countA = tracker.dispatches.filter(d => d.variant === 'A').length;
    const countB = tracker.dispatches.filter(d => d.variant === 'B').length;

    // Se estiverem empatados, usa hash determinístico do dealId
    if (countA === countB) {
        let sum = 0;
        for (let i = 0; i < dealId.length; i++) sum += dealId.charCodeAt(i);
        return sum % 2 === 0 ? 'A' : 'B';
    }

    // Mantém balanceamento estrito
    return countA <= countB ? 'A' : 'B';
}

/**
 * Regista o disparo da primeira mensagem com todos os metadados de análise
 */
export function recordFirstMessageDispatch({
    dealId,
    contactId,
    phone,
    clinicName,
    variant, // 'A' | 'B'
    angle, // 'CLINIC_SPECIFIC_FACT' | 'GOOGLE_SEARCH' | 'INSURANCE_DEPENDENCE' | 'RECEPTION_BRIDGE' | 'BUDGET_RESTART'
    lossReason,
    usedWebFact, // { factId, fact, source } ou null
    messageText
}) {
    const tracker = readOutcomesTracker();
    const now = new Date();

    const dispatchRecord = {
        id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        dealId,
        contactId,
        phone,
        clinicName,
        variant: variant || 'A',
        angle: angle || 'GOOGLE_SEARCH',
        lossReason: lossReason || 'Não especificado',
        usedWebFact: usedWebFact || null,
        messageLengthChars: (messageText || '').length,
        messageLengthWords: (messageText || '').trim().split(/\s+/).filter(Boolean).length,
        messagePreview: (messageText || '').slice(0, 140),
        fullMessage: messageText || '',
        sentDayOfWeek: now.getDay() === 0 ? 7 : now.getDay(), // 1=Segunda, 7=Domingo
        sentHour: now.getHours(),
        sentAt: now.toISOString(),
        outcome: 'SEM_RESPOSTA', // Estado inicial
        outcomeHistory: [],
        exchangesCount: 0
    };

    tracker.dispatches.push(dispatchRecord);
    saveOutcomesTracker(tracker);
    console.log(`📊 [Learning Analytics] Disparo registado: Deal ${dealId} | Variante ${dispatchRecord.variant} | Ângulo: ${dispatchRecord.angle}`);
    return dispatchRecord;
}

/**
 * Atualiza o desfecho de um deal após interação inbound ou conclusão
 */
export function updateDealOutcome({
    dealId,
    phone,
    newOutcome, // 'RESPOSTA_NEUTRA' | 'RESPOSTA_POSITIVA' | 'PEDIDO_REUNIAO' | 'LINK_CALCOM_ENVIADO' | 'REUNIAO_CALCOM_MARCADA' | 'RECUSA' | 'OPTOUT'
    inboundText,
    exchangesIncrement = 1
}) {
    const tracker = readOutcomesTracker();
    let record = tracker.dispatches.find(d => d.dealId === dealId);
    if (!record && phone) {
        const clean = phone.replace(/\D/g, '');
        record = tracker.dispatches.find(d => (d.phone || '').replace(/\D/g, '').endsWith(clean.slice(-9)));
    }

    if (record) {
        record.outcome = newOutcome;
        record.exchangesCount = (record.exchangesCount || 0) + exchangesIncrement;
        record.outcomeHistory.push({
            outcome: newOutcome,
            timestamp: new Date().toISOString(),
            inboundSnippet: (inboundText || '').slice(0, 120)
        });
        saveOutcomesTracker(tracker);
        console.log(`📈 [Learning Analytics] Desfecho atualizado para Deal ${dealId}: [${newOutcome}] (${record.exchangesCount} trocas)`);
    }
}

/**
 * Regista uma resposta real no repositório de objeções
 */
export function recordLeadObjection({
    dealId,
    clinicName,
    text,
    isAudioTranscript = false,
    classification = 'OUTRO'
}) {
    const repo = readObjectionsRepository();
    const cleanText = (text || '').trim();
    if (!cleanText) return;

    // Categorização automática se não fornecida
    let category = classification;
    const lower = cleanText.toLowerCase();
    if (lower.includes('caro') || lower.includes('custo') || lower.includes('orçamento') || lower.includes('preço')) {
        category = 'PRECO_ORCAMENTO';
    } else if (lower.includes('agência') || lower.includes('agencia') || lower.includes('já temos marketing') || lower.includes('trabalhamos com')) {
        category = 'JA_TEM_AGENCIA_OU_MARKETING';
    } else if (lower.includes('sem tempo') || lower.includes('ocupado') || lower.includes('muito trabalho') || lower.includes('mais tarde')) {
        category = 'FALTA_TEMPO';
    } else if (lower.includes('não tenho interesse') || lower.includes('nao nos interessa') || lower.includes('não quero')) {
        category = 'SEM_INTERESSE_GENERICO';
    } else if (lower.includes('quem vos deu') || lower.includes('como conseguiram') || lower.includes('robô')) {
        category = 'DESCONFIANCA_ORIGEM';
    }

    repo.objections.push({
        id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dealId,
        clinicName: clinicName || 'Clínica',
        category,
        text: cleanText,
        isAudioTranscript: Boolean(isAudioTranscript),
        recordedAt: new Date().toISOString()
    });

    saveObjectionsRepository(repo);
    console.log(`📝 [Learning Analytics] Objeção registada no repositório: [${category}] de "${clinicName}"`);
}

/**
 * Gera o Relatório Semanal Completo de Aprendizagem e Testes A/B
 */
export function generateWeeklyLearningReport() {
    const tracker = readOutcomesTracker();
    const repo = readObjectionsRepository();
    const dispatches = tracker.dispatches || [];

    const totalDispatches = dispatches.length;
    const groupA = dispatches.filter(d => d.variant === 'A');
    const groupB = dispatches.filter(d => d.variant === 'B');

    const isAnswered = d => d.outcome !== 'SEM_RESPOSTA';
    const isPositive = d => ['RESPOSTA_POSITIVA', 'PEDIDO_REUNIAO', 'LINK_CALCOM_ENVIADO', 'REUNIAO_CALCOM_MARCADA'].includes(d.outcome);
    const isMeeting = d => ['LINK_CALCOM_ENVIADO', 'REUNIAO_CALCOM_MARCADA'].includes(d.outcome);
    const isOptout = d => d.outcome === 'OPTOUT';

    // Taxas Variante A
    const rateA = groupA.length > 0 ? (groupA.filter(isAnswered).length / groupA.length * 100).toFixed(1) : '0.0';
    const posA = groupA.length > 0 ? (groupA.filter(isPositive).length / groupA.length * 100).toFixed(1) : '0.0';

    // Taxas Variante B
    const rateB = groupB.length > 0 ? (groupB.filter(isAnswered).length / groupB.length * 100).toFixed(1) : '0.0';
    const posB = groupB.length > 0 ? (groupB.filter(isPositive).length / groupB.length * 100).toFixed(1) : '0.0';

    // Regra Estatística de Decisão
    let abConclusion = '';
    if (groupA.length < MIN_SAMPLE_FOR_WINNER || groupB.length < MIN_SAMPLE_FOR_WINNER) {
        abConclusion = `⚠️ Amostra preliminar em recolha (A: ${groupA.length}/${MIN_SAMPLE_FOR_WINNER}, B: ${groupB.length}/${MIN_SAMPLE_FOR_WINNER}). Dados ainda insuficientes para declarar vencedor estatístico.`;
    } else {
        const diff = parseFloat(rateA) - parseFloat(rateB);
        if (Math.abs(diff) < 5) {
            abConclusion = `⚖️ Empate técnico entre Variante A (${rateA}%) e Variante B (${rateB}%). Nenhuma superou a outra com margem estatística.`;
        } else if (diff > 0) {
            abConclusion = `🏆 Variante A é a vencedora confirmada com ${rateA}% de respostas vs ${rateB}% da Variante B (+${diff.toFixed(1)}%).`;
        } else {
            abConclusion = `🏆 Variante B é a vencedora confirmada com ${rateB}% de respostas vs ${rateA}% da Variante A (+${Math.abs(diff).toFixed(1)}%).`;
        }
    }

    // Análise por Ângulo
    const angles = [...new Set(dispatches.map(d => d.angle))];
    const angleStats = angles.map(ang => {
        const items = dispatches.filter(d => d.angle === ang);
        const respCount = items.filter(isAnswered).length;
        const rate = (respCount / items.length * 100).toFixed(1);
        return { angle: ang, total: items.length, responseRate: `${rate}%` };
    });

    // Análise por Motivo de Perda
    const lossReasons = [...new Set(dispatches.map(d => d.lossReason))];
    const lossStats = lossReasons.map(lr => {
        const items = dispatches.filter(d => d.lossReason === lr);
        const respCount = items.filter(isAnswered).length;
        const rate = (respCount / items.length * 100).toFixed(1);
        return { reason: lr, total: items.length, responseRate: `${rate}%` };
    });

    // Top 3 Mensagens com Melhor Resposta e Top 3 Opt-outs
    const topPositive = dispatches.filter(isPositive).slice(0, 3);
    const topOptouts = dispatches.filter(isOptout).slice(0, 3);

    // Métricas Globais
    const totalMeetings = dispatches.filter(isMeeting).length;
    const totalOptouts = dispatches.filter(isOptout).length;
    const estimatedCostPerMeeting = totalMeetings > 0 ? (totalDispatches * 0.05 / totalMeetings).toFixed(2) : 'N/A';

    return {
        generatedAt: new Date().toISOString(),
        totalDispatches,
        abTestStatus: {
            minSampleSizeRequired: MIN_SAMPLE_FOR_WINNER,
            variantA: {
                label: 'Variante A (com Facto da Pesquisa Web)',
                count: groupA.length,
                responseRate: `${rateA}%`,
                positiveRate: `${posA}%`
            },
            variantB: {
                label: 'Variante B (Baseada no Histórico CRM)',
                count: groupB.length,
                responseRate: `${rateB}%`,
                positiveRate: `${posB}%`
            },
            conclusion: abConclusion
        },
        metrics: {
            totalMeetings,
            totalOptouts,
            estimatedCostPerMeetingEur: estimatedCostPerMeeting
        },
        angleStats,
        lossStats,
        topPositiveMessages: topPositive.map(p => ({ clinic: p.clinicName, preview: p.messagePreview })),
        topOptoutMessages: topOptouts.map(o => ({ clinic: o.clinicName, preview: o.messagePreview })),
        objectionsTotal: repo.objections.length
    };
}

/**
 * Formata o Relatório Semanal em texto amigável para envio WhatsApp / E-mail
 */
export function formatWeeklyReportForWhatsApp(report) {
    const ab = report.abTestStatus;
    return `📈 *Relatório Semanal de Aprendizagem SDR + Closer Vamuss*
Data: ${new Date(report.generatedAt).toLocaleDateString('pt-PT')}

*1. Teste A/B de Abordagem:*
• ${ab.variantA.label}: ${ab.variantA.count} envios | Resp: ${ab.variantA.responseRate} (Pos: ${ab.variantA.positiveRate})
• ${ab.variantB.label}: ${ab.variantB.count} envios | Resp: ${ab.variantB.responseRate} (Pos: ${ab.variantB.positiveRate})
*Decisão Estatística:* ${ab.conclusion}

*2. Resultados Comerciais Globais:*
• Total de Primeiras Abordagens: ${report.totalDispatches}
• Reuniões Solicitadas / Cal.com: ${report.metrics.totalMeetings}
• Opt-outs Registados: ${report.metrics.totalOptouts}
• Custo Médio por Reunião: ${report.metrics.estimatedCostPerMeetingEur} €
• Objeções Catalogadas: ${report.objectionsTotal}

*3. Eficácia por Ângulo:*
${report.angleStats.map(a => `• ${a.angle}: ${a.responseRate} (${a.total} envios)`).join('\n') || '• Sem dados'}

Para consultar as objeções na íntegra, aceda ao arquivo no CRM.`;
}

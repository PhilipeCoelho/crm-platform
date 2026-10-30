/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — MAPA DE QUALIFICAÇÃO SPIN E MATURIDADE (B.15.2)
 * ============================================================================
 * Conduz a qualificação consultiva do Closer passo a passo:
 * 1. Regista o estado SPIN por deal (situação, problema, implicação, necessidade).
 * 2. Avalia a maturidade para receber o link do Cal.com.
 * 3. Garante que é feita apenas UMA pergunta por mensagem.
 * 4. Limita a profundidade da conversa a no máximo 6 trocas.
 * 5. Armazena as evidências e citações reais do lead.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

const SPIN_STATES_FILE = path.resolve(process.cwd(), 'data', 'sdr_spin_states.json');
export const MAX_CLOSER_EXCHANGES = 6;
export const CALCOM_BOOKING_LINK = 'https://cal.com/euphilipecoelho-jxauxj/diagostico';

/**
 * Lê todos os estados SPIN armazenados
 */
export function readSpinStatesStore() {
    try {
        if (!fs.existsSync(SPIN_STATES_FILE)) {
            const dir = path.dirname(SPIN_STATES_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(SPIN_STATES_FILE, JSON.stringify({}, null, 2), 'utf8');
            return {};
        }
        return JSON.parse(fs.readFileSync(SPIN_STATES_FILE, 'utf8'));
    } catch {
        return {};
    }
}

/**
 * Guarda o estado SPIN de um deal
 */
export function saveSpinStateToStore(dealId, state) {
    try {
        const store = readSpinStatesStore();
        store[dealId] = {
            ...state,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(SPIN_STATES_FILE, JSON.stringify(store, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [SPIN Qualifier] Erro ao gravar estado SPIN:', e.message);
        return false;
    }
}

/**
 * Inicializa ou obtém o estado SPIN de um deal
 */
export function getOrCreateSpinState(dealId, clinicName = '') {
    const store = readSpinStatesStore();
    if (store[dealId]) {
        return store[dealId];
    }

    const initialState = {
        dealId,
        clinicName,
        exchangesCount: 0,
        currentStage: 'SITUACAO', // SITUACAO | PROBLEMA | IMPLICACAO | NECESSIDADE | MATURO | CONCLUIDO
        spinState: {
            situacao: { status: 'vazio', leadQuote: null, lastUpdated: null },
            problema: { status: 'vazio', leadQuote: null, lastUpdated: null },
            implicacao: { status: 'vazio', leadQuote: null, lastUpdated: null },
            necessidade: { status: 'vazio', leadQuote: null, lastUpdated: null }
        },
        maturitySignals: {
            directMeetingRequest: false,
            askedHowItWorksOrCost: false,
            confirmedProblemAndWantsSolution: false
        },
        calcomLinkSent: false,
        closedPolitely: false,
        historyOfQuestionsAsked: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    saveSpinStateToStore(dealId, initialState);
    return initialState;
}

/**
 * Banco de perguntas consultivas SPIN especializadas para clínicas dentárias em Portugal
 */
export const SPIN_QUESTION_BANK = {
    SITUACAO: [
        "De onde chegam hoje a maioria das vossas primeiras consultas particulares — é sobretudo por recomendação de pacientes ou já têm canais ativos de pesquisa?",
        "Na vossa rotina clínica atual, que peso têm as consultas de pacientes particulares face aos planos e seguros de saúde?",
        "Hoje em dia, os pacientes que vos procuram para implantes e reabilitação chegam já direcionados para a clínica ou são referenciados?"
    ],
    PROBLEMA: [
        "Muitas clínicas com quem falamos sentem oscilações com gabinetes vazios ou uma dependência grande de tabelas de seguros com margens baixas. Isso também se faz sentir na vossa rotina?",
        "Tem sido um desafio garantir um fluxo consistente de primeiras consultas particulares especificamente para tratamentos de maior valor (como implantes e estética)?",
        "Sentem que o volume de contactos que recebem tem qualidade e poder de compra para fechar planos de tratamento particulares?"
    ],
    IMPLICACAO: [
        "Quando um gabinete fica com horas por preencher ou dependente de acordos de baixa margem, acaba por travar a rentabilidade e o investimento na clínica. Costumam estimar o custo dessa ociosidade?",
        "Se essa dependência de seguradoras continuar, sentem que a margem do corpo clínico fica comprometida face ao custo dos materiais e da equipa?",
        "Não ter previsibilidade de novos pacientes particulares no início de cada mês traz apreensão no planeamento da clínica?"
    ],
    NECESSIDADE: [
        "Se conseguissem atrair de forma previsível 5 a 10 novos pacientes particulares por mês para implantes e reabilitação via Google, que impacto direto teria na gestão da clínica?",
        "Ter a agenda de particulares preenchida com tratamentos de valor sem depender de seguradoras permitiria focar-se mais no acompanhamento clínico e menos em volume?",
        "Faria sentido para a vossa clínica ter um sistema a trabalhar continuamente nos bastidores para gerar primeiras consultas particulares pagas?"
    ]
};

/**
 * Analisa a mensagem do lead e atualiza o mapa SPIN e sinais de maturidade
 */
export function analyzeInboundSpinProgress({ inboundText, currentState }) {
    const text = (inboundText || '').trim();
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const state = JSON.parse(JSON.stringify(currentState));

    // 1. Deteção de Sinais de Maturidade Direta (Gatilhos do Link do Cal.com)
    // Gatilho A: Pedido direto de reunião/conversa
    const isDirectMeetingRequest = (
        lower.includes('reuniao') ||
        lower.includes('podemos falar') ||
        lower.includes('ligar-me') ||
        lower.includes('ligue-me') ||
        lower.includes('vamos marcar') ||
        lower.includes('quando podemos') ||
        lower.includes('qual o melhor dia') ||
        lower.includes('combine com') ||
        lower.includes('pode ser amanha')
    );

    // Gatilho B: Pergunta de interesse operacional ("como funciona", "quanto custa", "como comecar")
    const isAskedHowItWorksOrCost = (
        lower.includes('quanto custa') ||
        lower.includes('qual o valor') ||
        lower.includes('como funciona') ||
        lower.includes('como e que funciona') ||
        lower.includes('quais sao os valores') ||
        lower.includes('como comecar') ||
        lower.includes('o que inclui')
    );

    // Gatilho C: Confirmação de dor + vontade de resolver
    const hasExpressedPain = (
        lower.includes('pouca margem') ||
        lower.includes('seguros') ||
        lower.includes('medis') ||
        lower.includes('multicare') ||
        lower.includes('gabinetes vazios') ||
        lower.includes('dificil') ||
        lower.includes('precisamos') ||
        lower.includes('gostariamos') ||
        lower.includes('queremos mais')
    );

    if (isDirectMeetingRequest) {
        state.maturitySignals.directMeetingRequest = true;
    }
    if (isAskedHowItWorksOrCost) {
        state.maturitySignals.askedHowItWorksOrCost = true;
    }
    if (hasExpressedPain && (lower.includes('sim') || lower.includes('concordo') || lower.includes('exatamente') || lower.includes('queremos'))) {
        state.maturitySignals.confirmedProblemAndWantsSolution = true;
    }

    // 2. Mapeamento das 4 Etapas SPIN com citação do lead
    const nowIso = new Date().toISOString();

    // SITUAÇÃO
    if (lower.includes('recomendacao') || lower.includes('passa a palavra') || lower.includes('seguradora') || lower.includes('pacientes') || lower.includes('temos')) {
        state.spinState.situacao = {
            status: 'confirmado',
            leadQuote: text.slice(0, 150),
            lastUpdated: nowIso
        };
    }

    // PROBLEMA
    if (lower.includes('seguros') || lower.includes('vazio') || lower.includes('tabelas') || lower.includes('margem') || lower.includes('falta') || lower.includes('dificuldade')) {
        state.spinState.problema = {
            status: 'confirmado',
            leadQuote: text.slice(0, 150),
            lastUpdated: nowIso
        };
    }

    // IMPLICAÇÃO
    if (lower.includes('custa') || lower.includes('impacto') || lower.includes('tempo') || lower.includes('dinheiro') || lower.includes('pesa') || lower.includes('preocupa')) {
        state.spinState.implicacao = {
            status: 'confirmado',
            leadQuote: text.slice(0, 150),
            lastUpdated: nowIso
        };
    }

    // NECESSIDADE
    if (lower.includes('seria otimo') || lower.includes('fazia sentido') || lower.includes('ajudaria') || lower.includes('interesse') || lower.includes('interessante')) {
        state.spinState.necessidade = {
            status: 'confirmado',
            leadQuote: text.slice(0, 150),
            lastUpdated: nowIso
        };
    }

    // Incrementa contagem de trocas
    state.exchangesCount += 1;

    // 3. Determina o próximo campo SPIN em falta
    if (state.spinState.situacao.status === 'vazio') {
        state.currentStage = 'SITUACAO';
    } else if (state.spinState.problema.status === 'vazio') {
        state.currentStage = 'PROBLEMA';
    } else if (state.spinState.implicacao.status === 'vazio') {
        state.currentStage = 'IMPLICACAO';
    } else if (state.spinState.necessidade.status === 'vazio') {
        state.currentStage = 'NECESSIDADE';
    } else {
        state.currentStage = 'MATURO';
    }

    return state;
}

/**
 * Seleciona ou formula a próxima pergunta SPIN evitando repetição
 */
export function getNextSpinQuestion(spinState) {
    const stage = spinState.currentStage || 'SITUACAO';
    const questionsForStage = SPIN_QUESTION_BANK[stage] || SPIN_QUESTION_BANK.SITUACAO;

    // Filtra perguntas já efetuadas
    const asked = spinState.historyOfQuestionsAsked || [];
    const available = questionsForStage.filter(q => !asked.includes(q));

    if (available.length > 0) {
        return available[0];
    }
    return questionsForStage[0];
}

/**
 * Constrói a mensagem leve de encerramento amigável caso atinja o limite de 6 trocas sem avanço
 */
export function getGentleDirectPitchMessage(clinicName = '') {
    return `Para não lhe tomar mais tempo com mensagens entre consultas, o mais prático e transparente seria vermos o potencial da clínica numa chamada objetiva de 20 minutos: ${CALCOM_BOOKING_LINK}\n\nSe fizer sentido avaliar, pode escolher o melhor horário. Se neste momento a prioridade for outra, compreendemos perfeitamente e agradecemos a simpatia!`;
}

/**
 * Formata o resumo do estado SPIN para inclusão no alerta WhatsApp do Philipe
 */
export function formatSpinSummaryForAlert(spinState) {
    if (!spinState) return '• Qualificação SPIN: Sem dados registados.';

    const sit = spinState.spinState?.situacao?.status === 'confirmado' ? `✅ (${spinState.spinState.situacao.leadQuote || 'confirmado'})` : '⚪ Vazio';
    const prob = spinState.spinState?.problema?.status === 'confirmado' ? `✅ (${spinState.spinState.problema.leadQuote || 'confirmado'})` : '⚪ Vazio';
    const imp = spinState.spinState?.implicacao?.status === 'confirmado' ? `✅ (${spinState.spinState.implicacao.leadQuote || 'confirmado'})` : '⚪ Vazio';
    const nec = spinState.spinState?.necessidade?.status === 'confirmado' ? `✅ (${spinState.spinState.necessidade.leadQuote || 'confirmado'})` : '⚪ Vazio';

    return `📋 *Mapa de Qualificação SPIN:*\n• Situação: ${sit}\n• Problema: ${prob}\n• Implicação: ${imp}\n• Necessidade: ${nec}\n• Trocas Efetuadas: ${spinState.exchangesCount}/${MAX_CLOSER_EXCHANGES}`;
}

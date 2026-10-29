/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — MOTOR DE DECISÃO CONVERSACIONAL GPT (B.14.2)
 * ============================================================================
 * O cérebro comercial do agente para interpretação de conversas e avanço
 * deliberado de oportunidades.
 * 
 * Funcionalidades:
 * 1. Interpretação semântica profunda de respostas inbound (interesse, objeções,
 *    timing, dúvidas, recusas, mensagens ambíguas).
 * 2. Condução progressiva de SPIN Selling adaptada à realidade de clínicas dentárias.
 * 3. Integração das aprendizagens B.14.1.5 (regras aprovadas, estratégias desativadas).
 * 4. Validação e reserva prévia de orçamento OpenAI e WhatsApp.
 * 5. Verificação da janela de atendimento de 24 horas da Meta WhatsApp Cloud API.
 * 6. Preservação estrita das regras de transição de pipeline do CRM.
 * ============================================================================
 */

import { getLearningContextForDeal } from './sdr_learning.js';
import {
    checkAndReserveOpenAIBudget,
    recordOpenAICost,
    checkAndReserveWhatsAppBudget,
    recordWhatsAppCost,
    recordContactResponse
} from './sdr_cost_controller.js';
import { isMobilePhone } from './sdr_engine.js';
import { isPhoneSuppressedLocally, addLocalSuppression } from './suppression_store.js';
import {
    getOrCreateSpinState,
    analyzeInboundSpinProgress,
    getNextSpinQuestion,
    getGentleDirectPitchMessage,
    formatSpinSummaryForAlert,
    saveSpinStateToStore,
    MAX_CLOSER_EXCHANGES
} from './sdr_spin_qualifier.js';
import { detectAutoReply, AUTO_REPLY_INTENT, BOT_REROUTE_MESSAGE } from './sdr_bot_detector.js';
import { classifySpeaker, SPEAKER_LABELS, SECRETARY_FORWARD_REQUEST } from './sdr_speaker.js';
import { getOrCreateLeadMemory, updateLeadMemory } from './sdr_memory.js';
import { lintSDRMessage } from './sdr_lint.js';
import { evaluateDispatchPolicy, POLICY_VERDICTS } from './sdr_policy.js';
import { generateRecommendedSlots, evaluateSlotChoice } from './sdr_calendar_slots.js';
import { triggerHandoffNotification } from './sdr_handoff.js';

// ============================================================================
// CLASSIFICAÇÃO DE INTENÇÕES CONVERSACIONAIS CANÓNICAS
// ============================================================================

export const CALCOM_BOOKING_LINK = 'https://cal.com/euphilipecoelho-jxauxj/diagostico';

/**
 * Extrai prazo de adiamento ("agora não", "daqui a 3 meses") ou aplica 60 dias por defeito
 */
export function extractPostponementDate(text = '') {
    const norm = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const now = new Date();
    let daysToAdd = 60; // 60 dias por defeito
    let label = '60 dias (padrão)';

    const matchMeses = norm.match(/daqui\s+a\s+(\d+)\s+mes(es)?/);
    if (matchMeses) {
        const m = parseInt(matchMeses[1], 10);
        daysToAdd = m * 30;
        label = `${m} meses`;
    } else if (norm.includes('proximo mes') || norm.includes('no proximo mes')) {
        daysToAdd = 30;
        label = '1 mês';
    } else if (norm.includes('para a semana') || norm.includes('na proxima semana')) {
        daysToAdd = 7;
        label = '1 semana';
    } else if (norm.match(/daqui\s+a\s+(\d+)\s+semana(s)?/)) {
        const w = parseInt(norm.match(/daqui\s+a\s+(\d+)\s+semana(s)?/)[1], 10);
        daysToAdd = w * 7;
        label = `${w} semanas`;
    } else if (norm.includes('ano que vem') || norm.includes('em janeiro')) {
        daysToAdd = 90;
        label = 'próximo ano';
    }

    const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return {
        days: daysToAdd,
        targetDateIso: targetDate.toISOString(),
        formattedDate: targetDate.toISOString().slice(0, 10),
        label
    };
}

export const CONVERSATIONAL_INTENTS = {
    AUTO_REPLY_RECEPCAO: 'Resposta automática de chatbot ou receção sem intervenção humana',
    INTENCAO_AGENDAMENTO: 'Intenção explícita ou manifestação clara de interesse em agendar reunião / falar com a equipa',
    INTERESSE_GENUINO: 'Interesse genérico no serviço / curiosidade positiva sem pedido explícito de marcação imediata',
    PEDIDO_INFORMACAO: 'Pedido de esclarecimento sobre metodologia, agência ou valores',
    OBJECAO_PRECO_OU_AGENCIA: 'Objeção referente a já ter agência, custos ou prioridade',
    ADIAMENTO_OU_TIMING: 'Solicitação de contacto posterior / timing desfavorável momentâneo',
    RECUSA_EDUCADA: 'Recusa polida sem agressividade, mas sem abertura no momento',
    OPTOUT_OU_OPOSICAO: 'Pedido explícito para não voltar a contactar / remoção da lista',
    MENSAGEM_AMBIGUA_OU_INCOMPLETA: 'Resposta vaga, monossilábica, fora de contexto ou sem clareza',
    SOLICITACAO_REVISAO_HUMANA: 'Assunto clínico delicado, reclamação ou complexidade que exige operador'
};

/**
 * Verifica se um contacto está dentro da janela de 24 horas da Meta WhatsApp Cloud API
 * Regra oficial Meta: Textos livres só podem ser enviados dentro de 24h da última mensagem do utilizador.
 * Fora de 24h, apenas templates aprovadas podem ser enviadas.
 * 
 * @param {string|Date} lastInboundTimestamp - Timestamp da última mensagem recebida do cliente
 * @returns {Object} { isWithin24h: boolean, hoursElapsed: number, requiresTemplate: boolean }
 */
export function checkWhatsApp24hWindow(lastInboundTimestamp) {
    if (!lastInboundTimestamp) {
        return { isWithin24h: false, hoursElapsed: 999, requiresTemplate: true };
    }

    const inboundTime = new Date(lastInboundTimestamp).getTime();
    const now = Date.now();
    const diffHours = (now - inboundTime) / (1000 * 60 * 60);

    const isWithin24h = diffHours >= 0 && diffHours < 24;
    return {
        isWithin24h,
        hoursElapsed: Number(diffHours.toFixed(1)),
        requiresTemplate: !isWithin24h
    };
}

/**
 * Motor central de interpretação conversacional e decisão GPT (B.14.2)
 * 
 * @param {Object} params
 * @param {string} params.inboundText - Mensagem recebida do cliente
 * @param {Object} params.deal - Negócio no CRM
 * @param {Object} params.contact - Contacto no CRM
 * @param {Array} params.recentActivities - Histórico factual cronológico
 * @param {Array} params.previousAttempts - Tentativas anteriores
 * @param {string} params.lastInboundDate - Data da última mensagem recebida
 * @param {string} params.stageId - Etapa atual no funil
 * @returns {Promise<Object>} Decisão comercial estruturada
 */
export async function runConversationalDecisionGPT({
    inboundText,
    deal,
    contact,
    recentActivities = [],
    previousAttempts = [],
    lastInboundDate = null,
    stageId = 'stage_lead_identificado'
}) {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    // 1. Verificação prévia de Opt-Out simples por regex (proteção instantânea fail-closed)
    const normalized = (inboundText || '').trim().toUpperCase();
    const isImmediateOptOut = /^(STOP|PARAR|CANCELAR|SAIR|NÃO|NAO|NÃO QUERO|REMOVER|NÃO CONTACTAR)$/i.test(normalized) ||
                              normalized.includes('NÃO CONTACTEM MAIS') || normalized.includes('REMOVER O MEU NÚMERO');

    if (isImmediateOptOut) {
        const phone = contact?.phone || '';
        if (phone) {
            addLocalSuppression({
                deal_id: deal?.id,
                contact_id: contact?.id,
                telefone_normalizado: phone,
                motivo_bloqueio: 'OPTOUT_EXPLICITO'
            });
        }
        return {
            source: 'deterministic_optout_guard',
            intencao_identificada: 'OPTOUT_OU_OPOSICAO',
            evidencias: `Pedido de remoção imediato: "${inboundText}"`,
            grau_confianca: 'ALTA',
            proxima_acao: 'ENCERRAR_COM_OPTOUT',
            mensagem_sugerida: '',
            justificacao_comercial: 'Respeito estrito e imediato pelo pedido de não contacto.',
            informacao_em_falta: 'Nenhuma',
            intervencao_humana_necessaria: false,
            motivo_intervencao: null,
            funnelAction: 'OPTOUT_OR_REFUSAL',
            targetStage: null,
            requiresTemplate: false
        };
    }

    // 1.1 Verificação de Janela WhatsApp 24h
    const window24h = checkWhatsApp24hWindow(lastInboundDate || new Date());

    const cleanClinicName = (deal?.title || contact?.company || contact?.name || 'Clínica Dentária')
        .replace(/^Negócio\s+/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();

    // 1.2 Memória Estruturada do Lead
    const leadMemory = getOrCreateLeadMemory(deal?.id, {
        clinicName: cleanClinicName,
        motivo_perda_original: deal?.lost_reason
    });

    // 1.3 Detetor de Auto-Reply / Robô de Receção (sdr_bot_detector.js)
    const lastOutbound = (recentActivities || []).find(a => a.type === 'outbound' || a.type === 'whatsapp');
    const lastOutboundTime = lastOutbound?.date || lastOutbound?.created_at || null;

    const botDiagnosis = detectAutoReply({
        inboundText,
        inboundTimestamp: lastInboundDate || new Date(),
        lastOutboundTimestamp: lastOutboundTime,
        consecutiveBotCount: leadMemory.consecutive_bot_replies || 0,
        outboundText: lastOutbound?.notes || ''
    });

    if (botDiagnosis.isBot) {
        console.log(`🤖 [Bot Detector] Auto-reply detetado para Deal ${deal?.id}: ${botDiagnosis.reasons.join('; ')}`);
        updateLeadMemory(deal?.id, {
            interlocutor_atual: SPEAKER_LABELS.ROBO,
            consecutive_bot_replies: botDiagnosis.consecutiveBotCount,
            estado: botDiagnosis.isDeadBot ? 'DEAD_BOT' : leadMemory.estado,
            ultima_intencao: AUTO_REPLY_INTENT,
            confianca_intencao: botDiagnosis.confidence
        });

        return {
            source: 'bot_detector_guard',
            intencao_identificada: AUTO_REPLY_INTENT,
            interlocutor: SPEAKER_LABELS.ROBO,
            evidencias: botDiagnosis.reasons.join('; '),
            grau_confianca: 'ALTA',
            proxima_acao: botDiagnosis.isDeadBot ? 'SILENCIO_DEFINITIVO_DEAD_BOT' : 'REENCAMINHAMENTO_RECEPCAO',
            mensagem_sugerida: botDiagnosis.suggestedRerouteMessage,
            justificacao_comercial: botDiagnosis.isDeadBot
                ? 'Robô consecutivo detetado. Silêncio definitivo (DEAD_BOT).'
                : 'Resposta automática de receção. Enfileirar reencaminhamento cortês no próximo dia útil.',
            informacao_em_falta: 'Contacto do Diretor Clínico',
            intervencao_humana_necessaria: false,
            motivo_intervencao: null,
            funnel_event: 'NONE',
            window24h
        };
    }

    // 1.4 Classificador de Interlocutor (sdr_speaker.js)
    const speakerDiagnosis = classifySpeaker({
        inboundText,
        isBot: false,
        previousSpeaker: leadMemory.interlocutor_atual
    });

    updateLeadMemory(deal?.id, {
        interlocutor_atual: speakerDiagnosis.speaker,
        consecutive_bot_replies: 0
    });

    // Se o interlocutor for SECRETÁRIA: ZERO SPIN, ZERO PREÇO, ZERO CAL.COM!
    if (speakerDiagnosis.speaker === SPEAKER_LABELS.SECRETARIA) {
        console.log(`👩‍💼 [Speaker Classifier] Secretária/Receção detetada para Deal ${deal?.id}. Aplicando playbook estrito de reencaminhamento.`);
        return {
            source: 'secretary_playbook_guard',
            intencao_identificada: 'PEDIDO_INFORMACAO',
            interlocutor: SPEAKER_LABELS.SECRETARIA,
            evidencias: speakerDiagnosis.reason,
            grau_confianca: 'ALTA',
            proxima_acao: 'PEDIR_REENCAMINHAMENTO_AO_DIRETOR',
            mensagem_sugerida: SECRETARY_FORWARD_REQUEST,
            justificacao_comercial: 'Interlocutor é a receção. Proibido SPIN, preço ou agendamento direto. Apenas pedido educado de encaminhamento.',
            informacao_em_falta: 'Contacto direto do Diretor Clínico',
            intervencao_humana_necessaria: false,
            motivo_intervencao: null,
            funnel_event: 'NONE',
            window24h
        };
    }

    // 2. Consulta de aprendizagens prévias B.14.1.5 para o segmento
    const segment = deal?.lost_reason || 'SILENCIO';
    const learningContext = getLearningContextForDeal({
        segment,
        lossClassification: segment,
        strategy: 'CONVERSACIONAL_INBOUND'
    });

    // 3. Verificação de Orçamento OpenAI antes da chamada
    const budgetCheck = checkAndReserveOpenAIBudget({ estimatedTokens: 1600 });
    if (!budgetCheck.allowed) {
        console.warn(`🛑 [Conversational Engine] Chamada GPT bloqueada por controlo de custos: ${budgetCheck.reason}`);
        return fallbackDeterministicConversationalDecision({
            inboundText,
            deal,
            contact,
            learningContext,
            window24h,
            costBlockReason: budgetCheck.reason
        });
    }

    if (!openaiApiKey) {
        return fallbackDeterministicConversationalDecision({
            inboundText,
            deal,
            contact,
            learningContext,
            window24h
        });
    }

    // 5. Montagem do Prompt Conversacional Grounded e Qualificação SPIN
    // B.15.2: Gestão do Mapa de Qualificação SPIN e Sinais de Maturidade
    const currentSpin = getOrCreateSpinState(deal?.id || 'deal_inbound', cleanClinicName);
    const updatedSpin = analyzeInboundSpinProgress({ inboundText, currentState: currentSpin });

    // SINAIS DE MATURIDADE: Gatilho imediato de link do Cal.com
    if (updatedSpin.maturitySignals.directMeetingRequest || 
        updatedSpin.maturitySignals.askedHowItWorksOrCost || 
        updatedSpin.maturitySignals.confirmedProblemAndWantsSolution) {
        
        console.log(`⭐ [SPIN Qualifier] Gatilho de maturidade ativado para Deal ${deal?.id}! Enviando slots e link do Cal.com...`);
        updatedSpin.calcomLinkSent = true;
        saveSpinStateToStore(deal?.id || 'deal_inbound', updatedSpin);

        const slots = generateRecommendedSlots();
        const suggestedBookingMessage = `Para agendarmos a nossa Reunião de Diagnóstico de 20 minutos, fica-lhe melhor ${slots.slotA} ou ${slots.slotB}? Se preferir ver todos os horários da minha agenda: ${CALCOM_BOOKING_LINK}`;

        return {
            source: 'spin_maturity_gate',
            intencao_identificada: 'INTENCAO_AGENDAMENTO',
            evidencias: `Gatilho de maturidade ativado (${JSON.stringify(updatedSpin.maturitySignals)}): "${inboundText}"`,
            grau_confianca: 'ALTA',
            proxima_acao: 'ENVIAR_LINK_CALCOM_E_TRANSFERIR',
            mensagem_sugerida: suggestedBookingMessage,
            justificacao_comercial: 'O lead expressou interesse concreto ou dor com vontade de resolver. Sugestão ativa de 2 slots + Cal.com enviada.',
            informacao_em_falta: 'Confirmação do agendamento no Cal.com',
            intervencao_humana_necessaria: false,
            motivo_intervencao: null,
            spin_fase: 'MATURO',
            funnel_event: 'MEETING_REQUESTED_HANDOFF',
            spin_state: updatedSpin,
            spin_summary: formatSpinSummaryForAlert(updatedSpin),
            window24h
        };
    }

    // LIMITE DE PROFUNDIDADE: Se atingiu 6 trocas sem avanço, faz proposta leve e encerra
    if (updatedSpin.exchangesCount >= MAX_CLOSER_EXCHANGES) {
        console.log(`ℹ️ [SPIN Qualifier] Limite de profundidade (${MAX_CLOSER_EXCHANGES} trocas) atingido para Deal ${deal?.id}.`);
        updatedSpin.closedPolitely = true;
        saveSpinStateToStore(deal?.id || 'deal_inbound', updatedSpin);

        return {
            source: 'spin_depth_limit',
            intencao_identificada: 'INTERESSE_GENUINO',
            evidencias: `Teto de ${MAX_CLOSER_EXCHANGES} trocas atingido.`,
            grau_confianca: 'ALTA',
            proxima_acao: 'PROPOSTA_DIRETA_OU_ENCERRAMENTO',
            mensagem_sugerida: getGentleDirectPitchMessage(cleanClinicName),
            justificacao_comercial: `Atingido o limite máximo de ${MAX_CLOSER_EXCHANGES} trocas consultivas. Pitch direto e leve da reunião de 20 minutos com encerramento cordial.`,
            informacao_em_falta: 'Decisão do lead',
            intervencao_humana_necessaria: false,
            motivo_intervencao: null,
            spin_fase: 'CONCLUIDO',
            funnel_event: 'REPLY_WITH_INTEREST',
            spin_state: updatedSpin,
            spin_summary: formatSpinSummaryForAlert(updatedSpin),
            window24h
        };
    }

    // Seleciona a próxima pergunta SPIN em falta (evitando repetições)
    const nextSpinQuestion = getNextSpinQuestion(updatedSpin);

    const chronologicalHistory = recentActivities.slice(0, 8).map(a => 
        `• [${a.date?.slice(0, 10) || a.created_at?.slice(0, 10)}] ${a.type?.toUpperCase()}: ${a.title || ''} — ${a.notes?.slice(0, 120) || ''}`
    ).join('\n') || '• Sem histórico prévio detalhado.';

    const systemPrompt = `És o cérebro comercial do agente SDR e Closer da Agência Vamuss (Portugal).
Missão: Analisar uma resposta recebida de uma clínica dentária e decidir a próxima ação comercial, com base em evidências factuais e no mapa SPIN.

PROPOSTA DE VALOR DA VAMUSS:
Ajudamos clínicas dentárias independentes em Portugal a atrair pacientes particulares para tratamentos rentáveis (implantes, reabilitação oral, estética) via pesquisa ativa no Google, reduzindo a dependência de convenções de baixa margem.
A Vamuss NÃO faz redes sociais ou "posts bonitos". É um sistema focado em consultas particulares rentáveis.

DISTINÇÃO CRÍTICA ENTRE INTERESSE GENÉRICO E INTENÇÃO DE AGENDAMENTO:
1. INTENCAO_AGENDAMENTO: O lead demonstra intenção clara e inequívoca de agendar uma reunião, chamada ou conversa (ex.: "Sim, podemos marcar uma reunião", "Gostava de conversar convosco sobre isso", "Quando poderíamos falar?", "Tenho interesse, podemos combinar uma reunião?", "Podem ligar-me amanhã?").
   -> Neste caso:
      - intencao_identificada: "INTENCAO_AGENDAMENTO"
      - proxima_acao: "ENVIAR_LINK_CALCOM_E_TRANSFERIR"
      - intervencao_humana_necessaria: false
      - motivo_intervencao: "O lead demonstrou interesse claro em agendar. Link do Cal.com enviado diretamente ao lead."
      - mensagem_sugerida: "Excelente, Dr(a)! Para agendarmos a nossa Reunião de Diagnóstico de 20 minutos com a máxima conveniência para a sua agenda, pode escolher diretamente o melhor dia e horário aqui: ${CALCOM_BOOKING_LINK}\n\nFico a aguardar a sua confirmação!"
      - funnel_event: "MEETING_REQUESTED_HANDOFF"

2. INTERESSE_GENUINO: O lead demonstra interesse ou curiosidade genérica sobre os serviços ("Gostava de saber mais", "Como funciona?", "Trabalham com implantes?", "De que se trata?"). NÃO é intenção de agendamento imediato!
   -> Neste caso:
      - intencao_identificada: "INTERESSE_GENUINO"
      - proxima_acao: "QUALIFICACAO_SPIN"
      - intervencao_humana_necessaria: false
      - mensagem_sugerida: Pergunta consultiva SPIN em pt-PT (máximo 2-3 linhas) para aprofundar o problema clínico e despertar a necessidade.
      - funnel_event: "REPLY_WITH_INTEREST"

REGRAS COMERCIAIS INVIOLÁVEIS (B.15.2):
1. NUNCA inventes dados, preços, promessas, garantias ou parcerias não comprovadas.
2. A IA NUNCA confirma ou declara reuniões agendadas ("reuniao_confirmada"). Apenas o operador humano pode confirmar após acordar data/hora reais.
3. OBJEÇÕES: Se o lead disser que "já tem agência de redes sociais", diferencia a Vamuss (Google vs redes sociais).
4. AMBIGUIDADE: Se a mensagem for monossilábica ("olá", "?", "ok"), pede clarificação educada em 1 linha sem pressionar.
5. CASOS COMPLEXOS / RECLAMAÇÕES: Encaminha para revisão humana (intervencao_humana_necessaria: true).
6. RECUSA OU PEDIDO DE NÃO CONTACTO: Respeita imediatamente sem insistência (OPTOUT_OU_OPOSICAO).
7. QUALIFICAÇÃO SPIN: Faz APENAS UMA pergunta por mensagem. NUNCA repitas perguntas anteriores. Adapta a pergunta com empatia.
8. TOM: Português de Portugal (pt-PT), profissional, consultivo, conciso (máximo 3-4 linhas).`;

    const userPrompt = `DADOS DO NEGÓCIO:
- Clínica: "${cleanClinicName}" (Deal ID: ${deal?.id})
- Contacto: ${contact?.name || 'Diretor(a) Clínico'} | Telefone: ${contact?.phone || 'N/A'}
- Etapa Atual no CRM: ${stageId}
- Motivo de Perda Original: ${deal?.lost_reason || 'Não especificado'}
- Janela 24h WhatsApp Ativa: ${window24h.isWithin24h ? 'SIM' : 'NÃO (exige template oficial)'}

MAPA DE QUALIFICAÇÃO SPIN ATUAL:
- Situação: ${updatedSpin.spinState.situacao.status} (Evidência: "${updatedSpin.spinState.situacao.leadQuote || 'nenhuma'}")
- Problema: ${updatedSpin.spinState.problema.status} (Evidência: "${updatedSpin.spinState.problema.leadQuote || 'nenhuma'}")
- Implicação: ${updatedSpin.spinState.implicacao.status} (Evidência: "${updatedSpin.spinState.implicacao.leadQuote || 'nenhuma'}")
- Necessidade: ${updatedSpin.spinState.necessidade.status} (Evidência: "${updatedSpin.spinState.necessidade.leadQuote || 'nenhuma'}")
- Trocas de Mensagens: ${updatedSpin.exchangesCount}/${MAX_CLOSER_EXCHANGES}
- Etapa SPIN Recomendada a Abordar Agora: ${updatedSpin.currentStage}
- Pergunta Base Sugerida: "${nextSpinQuestion}"

HISTÓRICO RECENTE:
${chronologicalHistory}

APRENDIZAGENS B.14.1.5 PREVIAMENTE CONFIRMADAS:
${learningContext.rules.length > 0 ? learningContext.rules.map(r => `• ${r}`).join('\n') : '• Nenhuma regra personalizada ativa.'}
${learningContext.disabledStrategies.length > 0 ? 'Estratégias Descartadas: ' + learningContext.disabledStrategies.join('; ') : ''}

MENSAGEM INBOUND RECEBIDA DO CLIENTE:
"${inboundText}"

Decide e responde em JSON estrito com esta estrutura:
{
  "intencao_identificada": "INTENCAO_AGENDAMENTO|INTERESSE_GENUINO|PEDIDO_INFORMACAO|OBJECAO_PRECO_OU_AGENCIA|ADIAMENTO_OU_TIMING|RECUSA_EDUCADA|OPTOUT_OU_OPOSICAO|MENSAGEM_AMBIGUA_OU_INCOMPLETA|SOLICITACAO_REVISAO_HUMANA",
  "evidencias": "string citando trechos exatos da mensagem",
  "grau_confianca": "ALTA|MEDIA|BAIXA",
  "proxima_acao": "TRANSFERIR_PARA_HUMANO|QUALIFICACAO_SPIN|RESPONDER_DUVIDA|TRATAR_OBJECAO|PAUSA_TEMPORARIA|ENCERRAR_COM_OPTOUT|SOLICITAR_REVISAO_HUMANA",
  "mensagem_sugerida": "string pronta para envio em pt-PT (vazia se INTENCAO_AGENDAMENTO, opt-out ou revisão humana)",
  "justificacao_comercial": "string explicando a lógica da decisão",
  "informacao_em_falta": "string com o que ainda não sabemos",
  "intervencao_humana_necessaria": true|false,
  "motivo_intervencao": "string ou null",
  "spin_fase": "${updatedSpin.currentStage}",
  "funnel_event": "MEETING_REQUESTED_HANDOFF|REPLY_WITH_INTEREST|OPTOUT_OR_REFUSAL|NONE"
}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const contentStr = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(contentStr);

        // Registar e taxar o custo real na contabilidade
        const tokenUsage = data.usage ? {
            prompt: data.usage.prompt_tokens || 0,
            completion: data.usage.completion_tokens || 0,
            total: data.usage.total_tokens || 0
        } : null;

        recordOpenAICost({
            reservationId: budgetCheck.reservationId,
            usage: tokenUsage
        });

        // Atualizar contador de resposta do contacto no controlador de custos
        if (contact?.phone) {
            recordContactResponse(contact.phone);
        }

        // Se intenção for opt-out, adicionar imediatamente à supressão
        if (parsed.intencao_identificada === 'OPTOUT_OU_OPOSICAO' && contact?.phone) {
            addLocalSuppression({
                deal_id: deal?.id,
                contact_id: contact?.id,
                telefone_normalizado: contact.phone,
                motivo_bloqueio: 'OPTOUT_EXPLICITO'
            });
        }

        // Linter Pré-Envio Obrigatório (sdr_lint.js)
        if (parsed.mensagem_sugerida) {
            const lintCheck = lintSDRMessage({
                messageText: parsed.mensagem_sugerida,
                intent: parsed.intencao_identificada,
                intentConfidence: parsed.grau_confianca === 'ALTA' ? 0.9 : 0.6,
                leadAskedPrice: /(pre[cç]o|quanto custa|valor|mensalidade)/i.test(inboundText),
                leadWantsBooking: parsed.intencao_identificada === 'INTENCAO_AGENDAMENTO'
            });

            if (!lintCheck.ok) {
                console.warn(`⚠️ [Linter] Mensagem do GPT reprovada: ${lintCheck.problemas.join('; ')}. Aplicando correção segura.`);
                if (parsed.intencao_identificada === 'INTENCAO_AGENDAMENTO') {
                    const slots = generateRecommendedSlots();
                    parsed.mensagem_sugerida = `Para agendarmos a nossa Reunião de Diagnóstico de 20 minutos, fica-lhe melhor ${slots.slotA} ou ${slots.slotB}? Se preferir ver todos os horários da minha agenda: ${CALCOM_BOOKING_LINK}`;
                } else {
                    parsed.mensagem_sugerida = nextSpinQuestion;
                }
            }
        }

        // B.15.2: Registar a pergunta formulada pelo Closer para evitar repetições
        if (parsed.mensagem_sugerida) {
            updatedSpin.historyOfQuestionsAsked = updatedSpin.historyOfQuestionsAsked || [];
            updatedSpin.historyOfQuestionsAsked.push(parsed.mensagem_sugerida);
            saveSpinStateToStore(deal?.id || 'deal_inbound', updatedSpin);
        }

        // Atualizar memória estruturada do lead
        updateLeadMemory(deal?.id, {
            ultima_intencao: parsed.intencao_identificada,
            confianca_intencao: parsed.grau_confianca === 'ALTA' ? 0.9 : 0.6,
            pergunta_adicional: parsed.mensagem_sugerida || null
        });

        // Se houver necessidade de intervenção humana, acionar handoff estruturado
        if (parsed.intervencao_humana_necessaria) {
            triggerHandoffNotification({
                dealId: deal?.id,
                clinicName: cleanClinicName,
                phone: contact?.phone,
                speaker: speakerDiagnosis?.speaker || 'desconhecido',
                intent: parsed.intencao_identificada,
                reason: parsed.motivo_intervencao || 'Intervenção humana necessária',
                riskLevel: 'medio',
                riskType: 'revisao',
                conversationSummary: chronologicalHistory.slice(0, 300),
                suggestedReply: parsed.mensagem_sugerida || ''
            });
        }

        return {
            source: 'openai_gpt4o_mini_conversational',
            ...parsed,
            spin_state: updatedSpin,
            spin_summary: formatSpinSummaryForAlert(updatedSpin),
            openai_token_usage: tokenUsage,
            window24h
        };

    } catch (err) {
        console.error('❌ [Conversational Engine] Falha na chamada GPT:', err.message);
        return fallbackDeterministicConversationalDecision({
            inboundText,
            deal,
            contact,
            learningContext,
            window24h,
            error: err.message
        });
    }
}

/**
 * Fallback determinístico caso a OpenAI esteja indisponível ou bloqueada por orçamento
 */
export function fallbackDeterministicConversationalDecision({
    inboundText = '',
    deal,
    contact,
    learningContext,
    window24h,
    costBlockReason = null,
    error = null
}) {
    const text = (inboundText || '').trim().toLowerCase();

    // 1. Sinais de Optout (incluindo variações naturais com e sem acentos)
    const isOptout = /(parar|stop|cancelar|sair|remover|não quero|nao quero|não contactar|nao contactar|não me contactem|nao me contactem|não nos contactem|nao nos contactem|não voltem a contactar|nao voltem a contactar|não liguem mais|nao liguem mais|não enviem mais|nao enviem mais|retirem o meu|retirem o nosso|retirem da vossa base|retirem da lista|bloquear|bloqueado|vou fazer queixa)/i.test(text) ||
        /(não|nao)\s+(tenho|temos|há|ha)\s+(qualquer\s+)?interesse.*(não|nao)\s+(me|nos)?\s*(contactem|mandem|enviem)/i.test(text) ||
        /(não|nao)\s+(nos|me)\s+interessa.*(não|nao)\s+(voltem|mandem|enviem)/i.test(text);

    // 2. Sinais explícitos de intenção de agendamento de reunião / conversa com o responsável
    const isBookingIntent = /(marcar|agendar|combinar|reunião|reuniao)\s*(uma\s*reunião|uma\s*reuniao|uma\s*conversa|uma\s*chamada|um\s*diagnóstico|um\s*diagnostico|consigo|convosco|esta\s*semana|amanhã|amanha)?/i.test(text) ||
        /(podemos\s+(marcar|agendar|falar|conversar|reunir))/i.test(text) ||
        /(quando\s+(podemos|poderíamos|poderiamos)\s+(falar|conversar|reunir))/i.test(text) ||
        /(gostaria|gostava)\s+de\s+(conversar|falar|reunir)/i.test(text) ||
        /(tenho\s+interesse.*(reunião|reuniao|conversar|falar|agendar|marcar))/i.test(text) ||
        /(sim.*(marcar|agendar|reunião|reuniao|podemos\s+falar))/i.test(text);

    // 3. Sinais de objeção
    const isObjection = /(já temos|ja temos|outra agência|outra agencia|não temos orçamento|caro|redes sociais|instagram|facebook)/i.test(text);

    // 4. Sinais de timing / adiamento
    const isTiming = /(mais tarde|próximo mês|proximo mes|agora não|ocupado|férias|ferias|para a semana|daqui a|em janeiro|ano que vem)/i.test(text);

    // 5. Recusa educada
    const isPoliteRefusal = /(não temos interesse|nao temos interesse|de momento não|agora não pretendemos)/i.test(text);

    // 6. Sinais de interesse genérico (sem pedido direto de reunião)
    const isInterest = !isBookingIntent && !isPoliteRefusal && !isObjection && !isTiming && /(sim|interesse|gostaria|gostava|quero saber|saber mais|como funciona|o que fazem|trabalham com|valores|preço|preco|de que se trata|explique|informações|informacoes)/i.test(text);

    let intencao = 'MENSAGEM_AMBIGUA_OU_INCOMPLETA';
    let proximaAcao = 'SOLICITAR_REVISAO_HUMANA';
    let mensagemSugerida = '';
    let funnelEvent = 'NONE';
    let precisaHumano = false;
    let motivoIntervencao = null;
    let postponementData = null;

    if (isOptout) {
        intencao = 'OPTOUT_OU_OPOSICAO';
        proximaAcao = 'ENCERRAR_COM_OPTOUT';
        funnelEvent = 'OPTOUT_OR_REFUSAL';
        if (contact?.phone) {
            addLocalSuppression({
                deal_id: deal?.id,
                contact_id: contact?.id,
                telefone_normalizado: contact.phone,
                motivo_bloqueio: 'OPTOUT_EXPLICITO'
            });
        }
    } else if (isBookingIntent) {
        intencao = 'INTENCAO_AGENDAMENTO';
        proximaAcao = 'ENVIAR_LINK_CALCOM_E_TRANSFERIR';
        funnelEvent = 'MEETING_REQUESTED_HANDOFF';
        precisaHumano = false; // Closer responde com link de agenda imediatamente!
        mensagemSugerida = `Excelente, Dr(a)! Para agendarmos a nossa Reunião de Diagnóstico de 20 minutos com a máxima conveniência para a sua agenda, pode escolher diretamente o melhor dia e horário aqui: ${CALCOM_BOOKING_LINK}\n\nFico a aguardar a sua confirmação!`;
        motivoIntervencao = `Intenção de agendamento detetada: "${inboundText}". Link do Cal.com enviado de imediato ao cliente.`;
    } else if (isPoliteRefusal) {
        intencao = 'RECUSA_EDUCADA';
        proximaAcao = 'ENCERRAR_POLIDAMENTE';
        funnelEvent = 'OPTOUT_OR_REFUSAL';
        mensagemSugerida = `Compreendido perfeitamente, Dr(a). Agradecemos a atenção e desejamos o melhor sucesso à equipa da clínica.`;
    } else if (isInterest) {
        intencao = 'INTERESSE_GENUINO';
        proximaAcao = 'QUALIFICACAO_SPIN';
        mensagemSugerida = `Compreendido, Dr(a). O nosso sistema foca-se especificamente na atração de pacientes particulares para tratamentos rentáveis (como implantes e reabilitação) via pesquisa direta no Google. Para vermos a viabilidade para a vossa clínica, realizam tratamentos de implantes atualmente?`;
        funnelEvent = 'REPLY_WITH_INTEREST';
    } else if (isObjection) {
        intencao = 'OBJECAO_PRECO_OU_AGENCIA';
        proximaAcao = 'TRATAR_OBJECAO';
        mensagemSugerida = `Compreendo perfeitamente. Importa referir que a Vamuss não faz redes sociais ou "posts bonitos". O nosso foco exclusivo é posicionar a clínica no topo do Google para quando um paciente na vossa zona pesquisa ativamente tratamentos particulares de valor. Faz sentido perceber a diferença?`;
        funnelEvent = 'REPLY_WITH_INTEREST';
    } else if (isTiming) {
        intencao = 'ADIAMENTO_OU_TIMING';
        proximaAcao = 'PAUSA_TEMPORARIA';
        postponementData = extractPostponementDate(inboundText);
        mensagemSugerida = `Sem qualquer problema, respeitamos a sua disponibilidade clínica. Voltaremos a fazer um contacto pontual daqui a cerca de ${postponementData.label}. Bom trabalho para toda a equipa.`;
        funnelEvent = 'NONE';
    } else {
        precisaHumano = true;
        motivoIntervencao = 'Mensagem ambígua ou incompleta necessita de clarificação';
        mensagemSugerida = `Boa tarde. Agradecemos o seu contacto. Para podermos endereçar a resposta com a informação mais relevante para a direção clínica, em que tratamento gostaria de focar a captação?`;
    }

    return {
        source: 'deterministic_conversational_fallback',
        intencao_identificada: intencao,
        evidencias: `Análise factual por termos da mensagem: "${inboundText}"`,
        grau_confianca: 'MEDIA',
        proxima_acao: proximaAcao,
        mensagem_sugerida: mensagemSugerida,
        justificacao_comercial: costBlockReason ? `Decisão determinística devido a: ${costBlockReason}` : 'Decisão baseada no motor determinístico de regras Vamuss.',
        informacao_em_falta: 'Validação semântica por GPT',
        intervencao_humana_necessaria: precisaHumano,
        motivo_intervencao: precisaHumano ? (costBlockReason ? `Orçamento atingido e mensagem requer interpretação: ${costBlockReason}` : 'Mensagem requer interpretação humana') : null,
        spin_fase: isInterest ? 'SITUACAO' : 'NAO_APLICAVEL',
        funnel_event: funnelEvent,
        postponementData,
        returnDate: postponementData ? postponementData.targetDateIso : null,
        window24h: window24h || { isWithin24h: false, requiresTemplate: true },
        costBlockReason,
        error
    };
}

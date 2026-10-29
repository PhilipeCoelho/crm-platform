/**
 * server/sdr_bot_detector.js
 * ============================================================================
 * VAMUSS SDR — DETETOR DE AUTO-REPLY / ROBÔ DE RECEÇÃO (UPGRADE GROK)
 * ============================================================================
 * Identifica determinística e heuristicamente respostas automáticas de WhatsApp,
 * chatbots de receção e menus interativos de marcação de pacientes.
 * 
 * Regra de Ouro: Robôs não compram consultoria. Tratar robô como humano queima
 * reputação comercial, gasta limites de envio e polui a inteligência do CRM.
 * ============================================================================
 */

export const AUTO_REPLY_INTENT = 'AUTO_REPLY_RECEPCAO';

/**
 * Padrões lexicais de menus, chatbots e auto-responders de clínicas dentárias em pt-PT
 */
export const BOT_PATTERNS = [
    /prima\s+[0-9]/i,
    /digite\s+[0-9]/i,
    /bem[- ]vindo/i,
    /hor[aá]rio\s+de\s+funcionamento/i,
    /marque\s+a\s+sua\s+consulta/i,
    /para\s+marca[cç][oõ]es/i,
    /marca[cç][aã]o\s+de\s+consulta/i,
    /menu/i,
    /escolha\s+a\s+op[cç][aã]o/i,
    /automatizad/i,
    /chatbot/i,
    /fora\s+de\s+hor[aá]rio/i,
    /estamos\s+(de\s+momento\s+)?ausentes/i,
    /responderemos\s+assim\s+que\s+poss[ií]vel/i,
    /obrigado\s+por\s+(nos\s+)?contactar/i,
    /agradecemos\s+(o\s+seu\s+)?contacto/i,
    /assistente\s+virtual/i,
    /mensagem\s+autom[aá]tica/i,
    /resposta\s+autom[aá]tica/i,
    /atendimento\s+autom[aá]tico/i,
    /deixe\s+a\s+sua\s+mensagem/i,
    /em\s+que\s+podemos\s+ajudar/i,
    /selecione\s+uma\s+das\s+op[cç][oõ]es/i,
    /est[aá]\s+a\s+contactar\s+a/i
];

/**
 * Frase única e autorizada para reencaminhamento humano no dia útil seguinte
 */
export const BOT_REROUTE_MESSAGE = 'Pode reencaminhar ao diretor clínico? É sobre a origem das consultas particulares, não é marcação.';

/**
 * Analisa se uma mensagem inbound provém de um bot/auto-reply de receção
 * 
 * @param {Object} params
 * @param {string} params.inboundText - Texto da mensagem recebida
 * @param {string|Date|number} [params.inboundTimestamp] - Momento da mensagem recebida
 * @param {string|Date|number} [params.lastOutboundTimestamp] - Momento do nosso último envio
 * @param {number} [params.consecutiveBotCount=0] - Quantidade de auto-replies consecutivos já registados
 * @param {string} [params.outboundText=''] - Texto que tínhamos enviado
 * @returns {Object} Diagnóstico de auto-atendimento
 */
export function detectAutoReply({
    inboundText = '',
    inboundTimestamp = null,
    lastOutboundTimestamp = null,
    consecutiveBotCount = 0,
    outboundText = ''
}) {
    const text = (inboundText || '').trim();
    if (!text) {
        return { isBot: false, reason: 'Texto vazio', confidence: 0 };
    }

    const reasons = [];
    let isBot = false;
    let confidence = 0;

    // 1. Sinal de Latência Ultra-Rápida (< 15 segundos entre outbound e inbound)
    let latencySeconds = null;
    if (inboundTimestamp && lastOutboundTimestamp) {
        const inTime = new Date(inboundTimestamp).getTime();
        const outTime = new Date(lastOutboundTimestamp).getTime();
        if (!isNaN(inTime) && !isNaN(outTime) && inTime >= outTime) {
            latencySeconds = (inTime - outTime) / 1000;
            if (latencySeconds < 15) {
                isBot = true;
                confidence = Math.max(confidence, 0.95);
                reasons.push(`Latência ultra-rápida (${latencySeconds.toFixed(1)}s < 15s) típica de auto-responder`);
            }
        }
    }

    // 2. Sinal Lexical: Padrões de Menus, Bot e Atendimento Automático
    for (const pattern of BOT_PATTERNS) {
        if (pattern.test(text)) {
            isBot = true;
            confidence = Math.max(confidence, 0.90);
            reasons.push(`Padrão de auto-atendimento detetado: ${pattern.toString()}`);
            break;
        }
    }

    // 3. Sinal Estrutural: Mensagem de Boas-Vindas sem Conexão Semântica com o Outbound
    const isGenericWelcome = /^(ol[aá]|bom dia|boa tarde)!?\s+est[aá]\s+a\s+contatar/i.test(text) ||
                             /^ol[aá]!?\s+obrigad[oa]\s+pelo\s+contacto/i.test(text);
    if (isGenericWelcome && !reasons.length) {
        isBot = true;
        confidence = Math.max(confidence, 0.75);
        reasons.push('Saudação genérica de boas-vindas sem referência ao assunto do envio');
    }

    // 4. Avaliação de Consecutividade (DEAD_BOT)
    const newConsecutiveCount = isBot ? consecutiveBotCount + 1 : 0;
    const isDeadBot = newConsecutiveCount >= 2;

    return {
        isBot,
        isDeadBot,
        intent: isBot ? AUTO_REPLY_INTENT : null,
        confidence: isBot ? confidence : 0,
        latencySeconds,
        consecutiveBotCount: newConsecutiveCount,
        reasons,
        recommendedAction: isDeadBot
            ? 'DEAD_BOT_SILENCE'
            : (isBot ? 'SCHEDULE_NEXT_DAY_FORWARD_REQUEST' : 'PROCESS_HUMAN_INBOUND'),
        suggestedRerouteMessage: isDeadBot ? '' : BOT_REROUTE_MESSAGE
    };
}

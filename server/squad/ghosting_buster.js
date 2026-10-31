/**
 * server/squad/ghosting_buster.js
 * ============================================================================
 * AGENTE ESPECIALISTA EM QUEBRA DE SILÊNCIO (GHOSTING BUSTER)
 * ============================================================================
 * Recupera negócios que pararam de responder (Leads Engajados ou Leads em cadência).
 * Aplica metodologias comprovadas:
 * 1. Tática Chris Voss (Pergunta Negativa orientada ao Não: "Desistiu de...?")
 * 2. Tática de Micro-Áudio / Notificação de Caixa de Entrada ("Caiu no spam?")
 * 3. Tática de Desconexão Elegante (Break-up Touch: Presumo que não seja prioridade)
 * 
 * Regras:
 * - Submete sempre ao lintSDRMessage (zero placeholders, zero clichés).
 * - Registra obrigatoriamente a atividade e log no CRM.
 * ============================================================================
 */

import { lintSDRMessage } from '../sdr_lint.js';

export const GHOSTING_TACTICS = {
    CHRIS_VOSS_NEGATIVE: 'CHRIS_VOSS_NEGATIVE',
    MICRO_AUDIO_PING: 'MICRO_AUDIO_PING',
    ELEGANT_BREAKUP: 'ELEGANT_BREAKUP'
};

/**
 * Avalia o tempo de silêncio e determina a tática ideal de quebra de padrão.
 * @param {number} silenceDays Dias sem resposta
 * @param {number} attemptIndex Tentativa atual de follow-up (1, 2 ou 3)
 */
export function selectGhostingTactic(silenceDays = 3, attemptIndex = 1) {
    if (attemptIndex >= 3 || silenceDays >= 8) {
        return GHOSTING_TACTICS.ELEGANT_BREAKUP;
    }
    if (attemptIndex === 2 || silenceDays >= 5) {
        return GHOSTING_TACTICS.MICRO_AUDIO_PING;
    }
    return GHOSTING_TACTICS.CHRIS_VOSS_NEGATIVE;
}

/**
 * Gera a mensagem calibrada de quebra de silêncio para Clínicas Dentárias ou de Estética.
 */
export function buildGhostingMessage({
    contactName = '',
    clinicName = '',
    tactic = GHOSTING_TACTICS.CHRIS_VOSS_NEGATIVE,
    niche = 'dentaria', // 'dentaria' | 'estetica'
    channel = 'whatsapp' // 'whatsapp' | 'email'
} = {}) {
    // Normalizar primeiro nome e expurgar prefixos formais como Dr/Dra
    const rawClean = (contactName || '').replace(/^(dra?\.?|doutor[a-z]*)\s+/i, '').trim();
    const firstName = rawClean.split(' ')[0] || '';
    const cleanClinic = (clinicName || '').replace(/^(Negócio|Clínica|Clinica)\s+/i, '').trim();

    let rawMessage = '';

    if (tactic === GHOSTING_TACTICS.CHRIS_VOSS_NEGATIVE) {
        const greeting = firstName ? `Olá ${firstName}.` : 'Olá.';
        const focusTopic = niche === 'estetica'
            ? 'estruturar a captação de pacientes para tratamentos de rejuvenescimento'
            : 'organizar a captação de pacientes para consultas de reabilitação e implantes';
        
        rawMessage = `${greeting}\nDesistiram de ${focusTopic} neste trimestre?`;
    } else if (tactic === GHOSTING_TACTICS.MICRO_AUDIO_PING) {
        const greeting = firstName ? `Olá ${firstName}` : 'Olá';
        if (channel === 'email') {
            rawMessage = `${greeting}.\nEnviei-lhe uma mensagem anterior por aqui, mas não sei se ficou esquecida ou se foi para o spam. Conseguiu dar uma vista de olhos?`;
        } else {
            rawMessage = `${greeting}, só para não deixar a nossa conversa esquecida.\nConseguiu dar uma vista de olhos no que tínhamos falado anteriormente?`;
        }
    } else if (tactic === GHOSTING_TACTICS.ELEGANT_BREAKUP) {
        const greeting = firstName ? `Olá ${firstName}` : 'Olá';
        rawMessage = `${greeting}, imagino que a rotina da clínica esteja com prioridades diferentes neste momento.\nPara não incomodar, vou retirar o tema da minha lista ativa. Se no futuro fizer sentido voltarmos a falar, o meu contacto fica por aqui. Um abraço e votos de continuação de bom trabalho!`;
    }

    // Validação estrita via Linter anti-cliché e anti-placeholder
    const lintResult = lintSDRMessage(rawMessage);
    if (!lintResult.ok) {
        throw new Error(`[Ghosting Buster] Mensagem rejeitada pelo linter: ${(lintResult.problemas || []).join(', ')}`);
    }

    return {
        message: rawMessage.trim(),
        tactic,
        channel,
        contactName: firstName,
        clinicName: cleanClinic
    };
}

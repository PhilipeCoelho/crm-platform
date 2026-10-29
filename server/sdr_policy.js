/**
 * server/sdr_policy.js
 * ============================================================================
 * VAMUSS SDR — POLÍTICA DETERMINÍSTICA DE ENVIO (UPGRADE GROK)
 * ============================================================================
 * A autoridade máxima do sistema.
 * 
 * Regra de Ouro: O modelo LLM apenas propõe o texto; as regras determinísticas
 * desta política decidem soberanamente se a mensagem PODE ser transmitida.
 * 
 * Decisões da Política:
 * - ALLOW: Mensagem autorizada para transmissão imediata pelo WhatsApp.
 * - DENY: Envio barrado por motivo de negócio justificado (não é falha de código).
 * - QUEUE: Envio válido, mas fora da janela operacional (enfileirar para 09:05).
 * - HANDOFF: Autonomia da IA suspensa; transferir imediatamente para o Philipe.
 * ============================================================================
 */

import { isWithinBusinessHours } from './sdr_business_hours.js';

export const POLICY_VERDICTS = {
    ALLOW: 'ALLOW',
    DENY: 'DENY',
    QUEUE: 'QUEUE',
    HANDOFF: 'HANDOFF'
};

/**
 * Avalia o contexto completo do turno e devolve a decisão executiva
 * 
 * @param {Object} context
 * @param {string} [context.intent] - Intenção identificada do lead
 * @param {string} [context.speaker='desconhecido'] - Interlocutor (diretor, secretaria, robo, etc.)
 * @param {Object} [context.memory] - Ficha de memória do lead
 * @param {Object} [context.lintResult] - Resultado do linter pré-envio
 * @param {boolean} [context.isSuppressed=false] - Se o telefone está na lista de supressão
 * @param {boolean} [context.isCustomerDeal=false] - Se o contacto é de cliente ganho (exclusão)
 * @param {boolean} [context.isCrmContact=true] - Se o contacto pertence ao CRM (blindagem)
 * @param {number} [context.recoverabilityScore=75] - Score de recuperabilidade do negócio
 * @param {string} [context.inboundText=''] - Texto recebido do cliente
 * @param {number} [context.consecutiveBotReplies=0] - Contagem de respostas automáticas consecutivas
 * @param {number} [context.secretaryForwardAttempts=0] - Tentativas de pedido de reencaminhamento à secretária
 * @returns {Object} { verdict: 'ALLOW'|'DENY'|'QUEUE'|'HANDOFF', reason: string, whyThisMessage: string }
 */
export function evaluateDispatchPolicy(context = {}) {
    const {
        intent = '',
        speaker = 'desconhecido',
        memory = null,
        lintResult = { ok: true, problemas: [] },
        isSuppressed = false,
        isCustomerDeal = false,
        isCrmContact = true,
        recoverabilityScore = 75,
        inboundText = '',
        consecutiveBotReplies = 0,
        secretaryForwardAttempts = 0
    } = context;

    const lowerInbound = (inboundText || '').toLowerCase();

    // 1. VERIFICAÇÃO DE KILL SWITCH GLOBAL
    if (process.env.SDR_KILL_SWITCH === 'true') {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: 'Kill switch de emergência global ativado (SDR_KILL_SWITCH=true).',
            whyThisMessage: 'Envio bloqueado por trava de emergência administrativa.'
        };
    }

    // 2. VERIFICAÇÃO DE BLINDAGEM DE CONTACTOS PESSOAIS
    if (!isCrmContact) {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: 'Contacto pessoal ou número fora do CRM Vamuss. Blindagem total ativa.',
            whyThisMessage: 'Envio bloqueado por isolamento de privacidade.'
        };
    }

    // 3. VERIFICAÇÃO DE SUPRESSÃO PERMANENTE (RGPD / OPT-OUT)
    if (isSuppressed || intent === 'OPTOUT_OU_OPOSICAO') {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: 'Contacto na lista de supressão permanente por pedido expresso de opt-out.',
            whyThisMessage: 'Envio bloqueado em cumprimento estrito da política de privacidade e RGPD.'
        };
    }

    // 4. GATILHOS DE HANDOFF PARA O OPERADOR HUMANO (PHILIPE)
    const isAggressiveOrLegal = /(tribunal|advogado|processo|pol[ií]cia|queixa|livro\s+de\s+reclama[cç][oõ]es|den[uú]ncia|burlar|fraude)/i.test(lowerInbound);
    if (isAggressiveOrLegal) {
        return {
            verdict: POLICY_VERDICTS.HANDOFF,
            reason: 'Tom agressivo, reclamação formal ou ameaça jurídica detetada. IA suspensa de imediato.',
            whyThisMessage: 'Handoff imediato para intervenção do Philipe por risco jurídico/reputacional.'
        };
    }

    if (intent === 'SOLICITACAO_REVISAO_HUMANA') {
        return {
            verdict: POLICY_VERDICTS.HANDOFF,
            reason: 'Assunto clínico sensível ou pedido explícito de falar com responsável humano.',
            whyThisMessage: 'Lead solicitou revisão humana direta.'
        };
    }

    // 5. GATILHOS DE ROBÔ DE RECEÇÃO (AUTO_REPLY_RECEPCAO)
    if (speaker === 'robo' || intent === 'AUTO_REPLY_RECEPCAO') {
        if (consecutiveBotReplies >= 2) {
            return {
                verdict: POLICY_VERDICTS.DENY,
                reason: 'Lead identificado como DEAD_BOT após 2 respostas automáticas consecutivas. Silêncio definitivo.',
                whyThisMessage: 'Conversa encerrada contra bot de atendimento para poupar limite e reputação.'
            };
        }
        // No primeiro auto-reply, permite agendar para o dia útil seguinte o reencaminhamento
        return {
            verdict: POLICY_VERDICTS.QUEUE,
            reason: 'Auto-reply de receção detetado. Enfileirado para envio de reencaminhamento humano no próximo dia útil.',
            whyThisMessage: 'Tentativa de reencaminhamento cortês para o Diretor Clínico via receção.'
        };
    }

    // 6. GATILHOS DE SECRETÁRIA COM MÚLTIPLAS TENTATIVAS SEM RESULTADO
    if (speaker === 'secretaria' && secretaryForwardAttempts >= 2) {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: 'Secretária já foi solicitada 2 vezes para reencaminhamento sem sucesso. Evitar atrito.',
            whyThisMessage: 'Cadência com a receção esgotada sem obtenção do decisor.'
        };
    }

    // 7. TETO DE CADÊNCIA OUTBOUND SEM RESPOSTA HUMANA
    const outboundTouches = memory?.toques_outbound_sem_humano ?? 0;
    if (outboundTouches >= 3) {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: `Teto máximo de 3 abordagens outbound sem resposta humana atingido (${outboundTouches}/3).`,
            whyThisMessage: 'Lead colocado em repouso comercial (NURTURE) para respeitar o contacto.'
        };
    }

    // 8. SCORE DE RECUPERABILIDADE DEMASIADO BAIXO
    if (recoverabilityScore < 20) {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: `Score de recuperabilidade muito baixo (${recoverabilityScore}/100). Prioridade nula.`,
            whyThisMessage: 'Negócio sem viabilidade comercial económica mínima.'
        };
    }

    // 9. RESULTADO DO LINTER PRÉ-ENVIO
    if (!lintResult.ok) {
        return {
            verdict: POLICY_VERDICTS.DENY,
            reason: `Mensagem reprovada pelo linter de qualidade: ${lintResult.problemas.join('; ')}`,
            whyThisMessage: 'Envio bloqueado por violação das regras de redação e conformidade.'
        };
    }

    // 10. VERIFICAÇÃO DE HORÁRIO COMERCIAL (09h00 às 18h00 de Lisboa em dias úteis)
    const inBusinessHours = isWithinBusinessHours();
    if (!inBusinessHours) {
        return {
            verdict: POLICY_VERDICTS.QUEUE,
            reason: 'Fora do horário comercial português (09h às 18h). Enfileirado para abertura às 09:05.',
            whyThisMessage: 'Respeito estrito pelo descanso noturno e fim de semana das clínicas em Portugal.'
        };
    }

    // 11. AUTORIZAÇÃO TOTAL (ALLOW)
    return {
        verdict: POLICY_VERDICTS.ALLOW,
        reason: 'Todos os critérios de elegibilidade, linter, memória e política cumpridos integralmente.',
        whyThisMessage: `Abordagem comercial autorizada para ${speaker} com ângulo estruturado e validação factual.`
    };
}

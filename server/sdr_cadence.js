/**
 * server/sdr_cadence.js
 * ============================================================================
 * VAMUSS SDR — GESTOR DE CADÊNCIA, RESPIRO E TEMPO (UPGRADE GROK)
 * ============================================================================
 * Regula o compasso temporal e o ritmo de contacto com cada lead.
 * 
 * Regras da Cadência sem Resposta Humana:
 * - Dia 0: 1ª abordagem (Abertura com ângulo inicial e saída RGPD).
 * - Dia 2: 2ª abordagem (Ângulo DIFERENTE do anterior, 1 a 2 linhas curtas).
 * - Dia 7: 3ª abordagem (Último toque cordial e encerramento leve).
 * - Após Dia 7: Paragem definitiva. O lead transita para NURTURE ou Arquivo.
 * 
 * Regra Anti-Double-Texting:
 * - NUNCA enviar uma segunda mensagem outbound antes de decorridas pelo menos 24 horas
 *   da anterior, a menos que o lead tenha respondido.
 * 
 * Regra de Resposta Inbound:
 * - Em horário comercial (09h-18h): Responder célere (idealmente < 5 minutos).
 * - Fora de horário comercial: Enfileirar para as 09:05 do próximo dia útil.
 * ============================================================================
 */

import { isWithinBusinessHours, getNextBusinessWindow } from './sdr_business_hours.js';

export const CADENCE_TOUCH_SCHEDULE_DAYS = [0, 2, 7];
export const MAX_OUTBOUND_TOUCHES = 3;
export const MIN_HOURS_BETWEEN_OUTBOUNDS = 24;

/**
 * Avalia se o lead está no momento certo para receber o próximo toque
 * 
 * @param {Object} params
 * @param {number} params.currentTouchCount - Quantos outbounds já foram enviados sem resposta
 * @param {string|Date} [params.lastOutboundDate] - Data/hora do último envio
 * @param {boolean} [params.hasHumanReplied=false] - Se houve resposta humana recente
 * @returns {Object} Diagnóstico de prontidão temporal
 */
export function evaluateCadenceReadiness({
    currentTouchCount = 0,
    lastOutboundDate = null,
    hasHumanReplied = false
}) {
    const now = Date.now();

    // 1. Se já atingiu 3 outbounds sem resposta humana -> Cadência concluída
    if (!hasHumanReplied && currentTouchCount >= MAX_OUTBOUND_TOUCHES) {
        return {
            ready: false,
            action: 'STOP_CADENCE_NURTURE',
            reason: `Teto de cadência atingido (${currentTouchCount}/${MAX_OUTBOUND_TOUCHES} toques sem resposta). Entra em repouso.`,
            nextScheduledWindow: null
        };
    }

    // 2. Se há resposta humana recente: responder imediatamente em horário útil
    if (hasHumanReplied) {
        if (isWithinBusinessHours()) {
            return {
                ready: true,
                action: 'RESPOND_INBOUND_NOW',
                reason: 'Resposta humana recebida dentro do horário comercial. Resposta imediata autorizada.',
                nextScheduledWindow: new Date().toISOString()
            };
        } else {
            const nextWindow = getNextBusinessWindow();
            return {
                ready: false,
                action: 'QUEUE_FOR_NEXT_BUSINESS_DAY',
                reason: 'Resposta humana recebida fora do horário útil. Enfileirado para abertura às 09:05.',
                nextScheduledWindow: nextWindow.windowStartIso
            };
        }
    }

    // 3. Cadência de Outbound Frio (sem resposta):
    if (!lastOutboundDate) {
        // Primeiro toque (Dia 0)
        return {
            ready: isWithinBusinessHours(),
            action: isWithinBusinessHours() ? 'DISPATCH_TOUCH_0' : 'QUEUE_FOR_BUSINESS_HOURS',
            reason: 'Primeiro toque da cadência (Dia 0).',
            nextScheduledWindow: isWithinBusinessHours() ? new Date().toISOString() : getNextBusinessWindow().windowStartIso
        };
    }

    // Cálculo do tempo decorrido desde o último envio
    const lastTime = new Date(lastOutboundDate).getTime();
    const hoursElapsed = (now - lastTime) / (1000 * 60 * 60);
    const daysElapsed = hoursElapsed / 24;

    // Regra Anti-Double-Texting: mínimo 24h
    if (hoursElapsed < MIN_HOURS_BETWEEN_OUTBOUNDS) {
        return {
            ready: false,
            action: 'WAIT_MINIMUM_INTERVAL',
            reason: `Anti-double-texting: passaram apenas ${hoursElapsed.toFixed(1)}h desde o último envio (mínimo: 24h).`,
            nextScheduledWindow: new Date(lastTime + MIN_HOURS_BETWEEN_OUTBOUNDS * 60 * 60 * 1000).toISOString()
        };
    }

    // Avaliação do 2º toque (Dia 2 -> aprox 48h a 72h)
    if (currentTouchCount === 1) {
        if (daysElapsed >= 2) {
            return {
                ready: isWithinBusinessHours(),
                action: isWithinBusinessHours() ? 'DISPATCH_TOUCH_1' : 'QUEUE_FOR_BUSINESS_HOURS',
                reason: `Toque 2 autorizado (decorridos ${daysElapsed.toFixed(1)} dias desde a abertura).`,
                nextScheduledWindow: isWithinBusinessHours() ? new Date().toISOString() : getNextBusinessWindow().windowStartIso
            };
        } else {
            return {
                ready: false,
                action: 'WAIT_FOR_DAY_2',
                reason: `Aguardando janela de Dia 2 (decorridos ${daysElapsed.toFixed(1)}/2 dias).`,
                nextScheduledWindow: new Date(lastTime + 2 * 24 * 60 * 60 * 1000).toISOString()
            };
        }
    }

    // Avaliação do 3º toque (Dia 7 -> aprox 7 dias)
    if (currentTouchCount === 2) {
        if (daysElapsed >= 5) { // 5 dias após o toque 2 ≈ dia 7 total
            return {
                ready: isWithinBusinessHours(),
                action: isWithinBusinessHours() ? 'DISPATCH_TOUCH_2_FINAL' : 'QUEUE_FOR_BUSINESS_HOURS',
                reason: `Toque final de cadência autorizado (decorridos ${daysElapsed.toFixed(1)} dias).`,
                nextScheduledWindow: isWithinBusinessHours() ? new Date().toISOString() : getNextBusinessWindow().windowStartIso
            };
        } else {
            return {
                ready: false,
                action: 'WAIT_FOR_DAY_7',
                reason: `Aguardando respiro para o toque final (decorridos ${daysElapsed.toFixed(1)}/5 dias).`,
                nextScheduledWindow: new Date(lastTime + 5 * 24 * 60 * 60 * 1000).toISOString()
            };
        }
    }

    return {
        ready: false,
        action: 'STOP_CADENCE',
        reason: 'Cadência esgotada.',
        nextScheduledWindow: null
    };
}

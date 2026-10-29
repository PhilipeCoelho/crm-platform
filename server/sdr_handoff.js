/**
 * server/sdr_handoff.js
 * ============================================================================
 * VAMUSS SDR — GESTOR DE ESCALAÇÃO E HANDOFF HUMANO (UPGRADE GROK)
 * ============================================================================
 * Prepara o pacote estruturado de intervenção para o operador (Philipe Coelho)
 * sempre que a IA suspende a autonomia ou quando surge uma oportunidade madura.
 * 
 * Pacote Estruturado:
 * - Resumo da conversa (máximo 5 linhas).
 * - Interlocutor classificado e intenção identificada.
 * - Próxima frase sugerida para o Philipe enviar.
 * - Nível e tipo de risco (opt-out, pessoa errada, negociação de preço, risco legal).
 * - Link direto / identificador da ficha do negócio no CRM.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

const NOTIFICATIONS_FILE = path.resolve(process.cwd(), 'data', 'sdr_operator_notifications.json');

/**
 * Lê as notificações pendentes para o operador
 */
export function readOperatorNotifications() {
    try {
        if (!fs.existsSync(NOTIFICATIONS_FILE)) {
            const dir = path.dirname(NOTIFICATIONS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2), 'utf8');
            return [];
        }
        return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

/**
 * Cria e arquiva um pacote de escalação para o Philipe
 * 
 * @param {Object} params
 * @param {string} params.dealId - ID do negócio
 * @param {string} params.clinicName - Nome da clínica
 * @param {string} params.phone - Telefone
 * @param {string} params.speaker - Interlocutor (diretor, secretaria, etc.)
 * @param {string} params.intent - Intenção identificada
 * @param {string} params.reason - Motivo da escalação
 * @param {string} [params.riskLevel='baixo'] - 'baixo' | 'medio' | 'alto' | 'critico'
 * @param {string} [params.riskType='nenhum'] - 'legal' | 'reclamacao' | 'preco' | 'pessoa_errada' | 'reuniao'
 * @param {string} [params.conversationSummary=''] - Resumo em até 5 linhas
 * @param {string} [params.suggestedReply=''] - Frase recomendada para o Philipe
 * @returns {Object} Notificação registada
 */
export function triggerHandoffNotification({
    dealId,
    clinicName,
    phone,
    speaker = 'desconhecido',
    intent = 'SOLICITACAO_REVISAO_HUMANA',
    reason = 'Intervenção humana necessária',
    riskLevel = 'baixo',
    riskType = 'nenhum',
    conversationSummary = '',
    suggestedReply = ''
}) {
    const notifications = readOperatorNotifications();

    const handoffPackage = {
        id: `handoff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dealId,
        clinicName,
        phone,
        speaker,
        intent,
        reason,
        risk: {
            level: riskLevel,
            type: riskType
        },
        conversationSummary: conversationSummary.slice(0, 500),
        suggestedReply: suggestedReply.slice(0, 300),
        crmUrl: `/sdr?deal=${dealId}`,
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };

    notifications.unshift(handoffPackage);

    try {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications.slice(0, 100), null, 2), 'utf8');
    } catch (e) {
        console.warn('⚠️ [SDR Handoff] Falha ao gravar notificação:', e.message);
    }

    console.log(`🚨 [HANDOFF OPERADOR] Deal ${dealId} (${clinicName}) escalado para o Philipe. Motivo: ${reason}`);
    return handoffPackage;
}

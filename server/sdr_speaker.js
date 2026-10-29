/**
 * server/sdr_speaker.js
 * ============================================================================
 * VAMUSS SDR — CLASSIFICADOR DE INTERLOCUTOR (UPGRADE GROK)
 * ============================================================================
 * Identifica QUEM está a falar do outro lado do WhatsApp.
 * 
 * Labels Obrigatórios:
 * - diretor      (Diretor Clínico, Dr., Dra., médico dentista responsável)
 * - secretaria   (Rececionista, secretária, assistente de atendimento)
 * - socio        (Sócio, administrador executivo, gestor de operações)
 * - robo         (Chatbot, auto-reply detetado)
 * - desconhecido (Interlocutor ainda não identificado com clareza)
 * 
 * Regra de Playbook Estrita:
 * Se o interlocutor for 'secretaria' ou 'robo':
 * -> ZERO SPIN Selling.
 * -> ZERO menção de preço (197 €).
 * -> ZERO envio de link do Cal.com.
 * -> Apenas 1 frase curta com pedido de reencaminhamento ao diretor clínico.
 * ============================================================================
 */

import { detectAutoReply } from './sdr_bot_detector.js';

export const SPEAKER_LABELS = {
    DIRETOR: 'diretor',
    SECRETARIA: 'secretaria',
    SOCIO: 'socio',
    ROBO: 'robo',
    DESCONHECIDO: 'desconhecido'
};

export const SECRETARY_FORWARD_REQUEST = 'Bom dia. Pode encaminhar ao diretor clínico? É sobre a origem das consultas particulares da clínica, não é marcação de paciente.';

/**
 * Padrões que indicam receção, secretária ou marcação de consultas
 */
const SECRETARY_PATTERNS = [
    /rece[cç][aã]o/i,
    /secret[aá]ri[ao]/i,
    /assistente/i,
    /para\s+marcar\s+consulta/i,
    /posso\s+agendar/i,
    /qual\s+o\s+nome\s+do\s+paciente/i,
    /vou\s+passar\s+ao\s+doutor/i,
    /o\s+doutor\s+n[aã]o\s+est[aá]/i,
    /a\s+doutora\s+n[aã]o\s+est[aá]/i,
    /deixe\s+(o\s+)?recado/i,
    /n[aã]o\s+[eé]\s+deste\s+assunto/i,
    /mande\s+por\s+e-?mail/i,
    /envie\s+para\s+o\s+nosso\s+e-?mail/i,
    /aqui\s+[eé]\s+da\s+marca[cç][aã]o/i,
    /quem\s+fala/i
];

/**
 * Padrões que indicam diretor clínico, médico dentista ou responsável
 */
const DIRECTOR_PATTERNS = [
    /sou\s+o\s+dr/i,
    /sou\s+a\s+dra/i,
    /sou\s+o\s+diretor/i,
    /sou\s+a\s+diretora/i,
    /fala\s+o\s+dr/i,
    /fala\s+a\s+dra/i,
    /sou\s+o\s+m[eé]dico/i,
    /sou\s+a\s+m[eé]dica/i,
    /sou\s+o\s+propriet[aá]rio/i,
    /aqui\s+[eé]\s+o\s+dr/i,
    /aqui\s+[eé]\s+a\s+dra/i
];

/**
 * Padrões que indicam sócio, administração ou gerência
 */
const PARTNER_PATTERNS = [
    /sou\s+s[oó]ci[ao]/i,
    /administra[cç][aã]o/i,
    /ger[eê]ncia/i,
    /gestor/i,
    /respons[aá]vel\s+pela\s+cl[ií]nica/i,
    /dire[cç][aã]o\s+geral/i
];

/**
 * Classifica quem está a falar na mensagem inbound
 * 
 * @param {Object} params
 * @param {string} params.inboundText - Mensagem recebida
 * @param {boolean} [params.isBot=false] - Se já foi previamente marcado como bot
 * @param {string} [params.previousSpeaker='desconhecido'] - Label anterior
 * @returns {Object} Classificação do interlocutor
 */
export function classifySpeaker({
    inboundText = '',
    isBot = false,
    previousSpeaker = SPEAKER_LABELS.DESCONHECIDO
}) {
    const text = (inboundText || '').trim();

    // 1. Se foi identificado como bot, o label é robo
    if (isBot) {
        return {
            speaker: SPEAKER_LABELS.ROBO,
            confidence: 0.95,
            reason: 'Identificado como resposta automática/bot',
            allowsCloser: false,
            allowsSpin: false,
            allowsPrice: false,
            allowsCalcom: false,
            mandatoryResponse: null
        };
    }

    // 2. Análise de padrões de Diretor
    for (const pat of DIRECTOR_PATTERNS) {
        if (pat.test(text)) {
            return {
                speaker: SPEAKER_LABELS.DIRETOR,
                confidence: 0.90,
                reason: `Padrão de diretor clínico identificado: ${pat.toString()}`,
                allowsCloser: true,
                allowsSpin: true,
                allowsPrice: true,
                allowsCalcom: true,
                mandatoryResponse: null
            };
        }
    }

    // 3. Análise de padrões de Sócio/Gerência
    for (const pat of PARTNER_PATTERNS) {
        if (pat.test(text)) {
            return {
                speaker: SPEAKER_LABELS.SOCIO,
                confidence: 0.85,
                reason: `Padrão de sócio/administrador identificado: ${pat.toString()}`,
                allowsCloser: true,
                allowsSpin: true,
                allowsPrice: true,
                allowsCalcom: true,
                mandatoryResponse: null
            };
        }
    }

    // 4. Análise de padrões de Secretária/Receção
    for (const pat of SECRETARY_PATTERNS) {
        if (pat.test(text)) {
            return {
                speaker: SPEAKER_LABELS.SECRETARIA,
                confidence: 0.85,
                reason: `Padrão de receção/secretária identificado: ${pat.toString()}`,
                allowsCloser: false,
                allowsSpin: false,
                allowsPrice: false,
                allowsCalcom: false,
                mandatoryResponse: SECRETARY_FORWARD_REQUEST
            };
        }
    }

    // 5. Perguntas de negócio avançadas feitas por interlocutor desconhecido
    const isBusinessInquiry = /(como\s+funciona|quanto\s+custa|valores|qual\s+o\s+sistema|proposta|reuni[aã]o|parceria)/i.test(text);
    if (isBusinessInquiry) {
        return {
            speaker: previousSpeaker !== SPEAKER_LABELS.DESCONHECIDO ? previousSpeaker : SPEAKER_LABELS.DESCONHECIDO,
            confidence: 0.70,
            reason: 'Interlocutor coloca perguntas de negócio; qualificação SPIN autorizada',
            allowsCloser: true,
            allowsSpin: true,
            allowsPrice: true,
            allowsCalcom: true,
            mandatoryResponse: null
        };
    }

    // 6. Default: desconhecido
    return {
        speaker: previousSpeaker !== SPEAKER_LABELS.DESCONHECIDO ? previousSpeaker : SPEAKER_LABELS.DESCONHECIDO,
        confidence: 0.50,
        reason: 'Interlocutor neutro ou não explicitado no texto',
        allowsCloser: previousSpeaker === SPEAKER_LABELS.DIRETOR || previousSpeaker === SPEAKER_LABELS.SOCIO,
        allowsSpin: previousSpeaker === SPEAKER_LABELS.DIRETOR || previousSpeaker === SPEAKER_LABELS.SOCIO,
        allowsPrice: false,
        allowsCalcom: false,
        mandatoryResponse: null
    };
}

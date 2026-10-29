import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ============================================================================
 * VAMUSS SDR — MOTOR CENTRAL DE SUPRESSÃO E CONFORMIDADE LEGAL (FASE B.1)
 * ============================================================================
 * Impede envios comerciais indevidos, garantindo o respeito por:
 * 1. Opt-out explícito (Direito de oposição — RGPD / art. 13º DL 7/2004)
 * 2. Recusa comercial direta ("não temos interesse")
 * 3. Restrições explícitas de canal (proibição de WhatsApp, preferência por email)
 * 4. Desqualificação estrutural (grandes grupos / fora de perfil)
 * ============================================================================
 */

/**
 * Normaliza número de telefone para formato padronizado (E.164 sem pontuação)
 * Suporta formatos portugueses e internacionais comuns:
 * - "+351 912 345 678" -> "351912345678"
 * - "912345678" -> "351912345678"
 * - "21 345 6789" -> "351213456789"
 */
export function normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') return null;
    
    // Remove tudo o que não seja dígito
    let digits = rawPhone.replace(/\D/g, '');
    if (!digits) return null;

    // Se começa por 00 (ex: 00351...), remove os zeros iniciais
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    // Caso de número português de 9 dígitos sem indicativo internacional
    if (digits.length === 9) {
        // Móvel (9X) ou Fixo (2X)
        if (digits.startsWith('9') || digits.startsWith('2')) {
            return `351${digits}`;
        }
    }

    // Já tem indicativo português (351 + 9 dígitos = 12 dígitos)
    if (digits.length === 12 && digits.startsWith('351')) {
        return digits;
    }

    // Outros números internacionais válidos (mínimo 8 dígitos)
    if (digits.length >= 8 && digits.length <= 15) {
        return digits;
    }

    return null;
}

/**
 * Normaliza endereço de e-mail (lowercase, sem espaços, validação de sintaxe básica)
 */
export function normalizeEmail(rawEmail) {
    if (!rawEmail || typeof rawEmail !== 'string') return null;
    const clean = rawEmail.trim().toLowerCase();
    
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(clean)) return null;

    return clean;
}

/**
 * Constrói um registo estruturado de supressão de forma idempotente e validada
 */
export function createSuppressionRecord({
    deal_id = null,
    contact_id = null,
    telefone = null,
    email = null,
    motivo_bloqueio,
    origem_bloqueio,
    canal_bloqueado = 'TODOS',
    evidencia,
    estado = 'ativo',
    organization_id = null
}) {
    const validMotivos = [
        'OPTOUT_EXPLICITO',
        'RECUSA_COMERCIAL',
        'RESTRICAO_CANAL',
        'DESQUALIFICACAO_PORTE',
        'CONTINGENCIA_OPERACIONAL',
        'INTERVENCAO_MANUAL'
    ];
    const validOrigens = [
        'HISTORICO_CRM',
        'RESPOSTA_INBOUND',
        'INTERVENCAO_MANUAL',
        'AUDITORIA_SEGURANCA'
    ];
    const validCanais = ['TODOS', 'WHATSAPP', 'EMAIL', 'TELEFONE'];
    const validEstados = ['ativo', 'em_revisao', 'revogado'];

    if (!validMotivos.includes(motivo_bloqueio)) {
        throw new Error(`motivo_bloqueio inválido: ${motivo_bloqueio}`);
    }
    if (!validOrigens.includes(origem_bloqueio)) {
        throw new Error(`origem_bloqueio inválido: ${origem_bloqueio}`);
    }
    if (!validCanais.includes(canal_bloqueado)) {
        throw new Error(`canal_bloqueado inválido: ${canal_bloqueado}`);
    }
    if (!validEstados.includes(estado)) {
        throw new Error(`estado inválido: ${estado}`);
    }
    if (!evidencia || typeof evidencia !== 'string' || !evidencia.trim()) {
        throw new Error('evidencia é obrigatória e deve conter referência factual');
    }

    const normPhone = normalizePhone(telefone);
    const normEmail = normalizeEmail(email);

    return {
        deal_id: deal_id || null,
        contact_id: contact_id || null,
        organization_id: organization_id || null,
        telefone_normalizado: normPhone,
        email_normalizado: normEmail,
        motivo_bloqueio,
        origem_bloqueio,
        canal_bloqueado,
        evidencia: evidencia.trim(),
        estado,
        data_bloqueio: new Date().toISOString()
    };
}

/**
 * VERIFICAÇÃO DE SUPRESSÃO PRÉ-ENVIO (Firewall Central)
 * Consulta se determinado negócio, telefone ou e-mail está suprimido para o canal pretendido.
 * 
 * Regra:
 * - Se o bloqueio for 'TODOS', bloqueia qualquer tentativa de envio.
 * - Se o bloqueio for 'WHATSAPP', bloqueia se o canal solicitado for 'WHATSAPP' ou 'TODOS'.
 * - Se o bloqueio for 'EMAIL', bloqueia se o canal solicitado for 'EMAIL' ou 'TODOS'.
 * - FAIL-SAFE CLOSED: Em caso de falha de consulta, payload inválido ou exceção, BLOQUEIA PREVENTIVAMENTE.
 * - ISOLAMENTO MULTI-TENANT: Registos de outra organização não interferem se organization_id for especificado.
 */
export function checkSuppression({ deal_id = null, telefone = null, email = null, canal = 'TODOS', organization_id = null } = {}, suppressionList = []) {
    try {
        if (!Array.isArray(suppressionList)) {
            return {
                bloqueado: true,
                motivo: 'FALHA_SISTEMA_FAIL_SAFE_CLOSED',
                canal_bloqueado: 'TODOS',
                origem: 'AUDITORIA_SEGURANCA',
                evidencia: 'Lista de supressão indisponível ou corrompida. Bloqueio preventivo de segurança obrigatório.',
                data_bloqueio: new Date().toISOString(),
                criterio_match: 'fail_safe_closed'
            };
        }

        const targetCanal = (canal || 'TODOS').toUpperCase();
        const targetPhone = normalizePhone(telefone);
        const targetEmail = normalizeEmail(email);

        for (const entry of suppressionList) {
            if (!entry || entry.estado !== 'ativo') continue;

            // Isolamento multi-tenant: se ambos tiverem organization_id definido e forem distintos, não propaga
            if (entry.organization_id && organization_id && entry.organization_id !== organization_id) {
                continue;
            }

            // 1. Verificar compatibilidade de canal
            const entryCanal = (entry.canal_bloqueado || 'TODOS').toUpperCase();
            const canalConflita = entryCanal === 'TODOS' || 
                                  targetCanal === 'TODOS' || 
                                  entryCanal === targetCanal;

            if (!canalConflita) continue;

            // 2. Verificar correspondência por Deal ID
            if (deal_id && entry.deal_id && entry.deal_id === deal_id) {
                return {
                    bloqueado: true,
                    motivo: entry.motivo_bloqueio,
                    canal_bloqueado: entry.canal_bloqueado,
                    origem: entry.origem_bloqueio,
                    evidencia: entry.evidencia,
                    data_bloqueio: entry.data_bloqueio,
                    criterio_match: 'deal_id'
                };
            }

            // 3. Verificar correspondência por Telefone Normalizado
            if (targetPhone && entry.telefone_normalizado && entry.telefone_normalizado === targetPhone) {
                return {
                    bloqueado: true,
                    motivo: entry.motivo_bloqueio,
                    canal_bloqueado: entry.canal_bloqueado,
                    origem: entry.origem_bloqueio,
                    evidencia: entry.evidencia,
                    data_bloqueio: entry.data_bloqueio,
                    criterio_match: 'telefone'
                };
            }

            // 4. Verificar correspondência por Email Normalizado
            if (targetEmail && entry.email_normalizado && entry.email_normalizado === targetEmail) {
                return {
                    bloqueado: true,
                    motivo: entry.motivo_bloqueio,
                    canal_bloqueado: entry.canal_bloqueado,
                    origem: entry.origem_bloqueio,
                    evidencia: entry.evidencia,
                    data_bloqueio: entry.data_bloqueio,
                    criterio_match: 'email'
                };
            }
        }

        return {
            bloqueado: false,
            motivo: null,
            canal_bloqueado: null,
            evidencia: null,
            data_bloqueio: null,
            criterio_match: null
        };
    } catch (err) {
        return {
            bloqueado: true,
            motivo: 'FALHA_SISTEMA_FAIL_SAFE_CLOSED',
            canal_bloqueado: 'TODOS',
            origem: 'AUDITORIA_SEGURANCA',
            evidencia: `Exceção durante consulta de supressão: ${err?.message || err}. Bloqueio preventivo ativado.`,
            data_bloqueio: new Date().toISOString(),
            criterio_match: 'fail_safe_closed'
        };
    }
}

/**
 * Deduplica e consolida uma lista de registos de supressão garantindo idempotência
 */
export function deduplicateSuppressionList(entries = []) {
    const seenByDeal = new Map();
    const seenByPhone = new Map();
    const seenByEmail = new Map();
    const uniqueList = [];

    // Prioridade de severidade do motivo
    const priority = {
        'OPTOUT_EXPLICITO': 10,
        'RECUSA_COMERCIAL': 8,
        'RESTRICAO_CANAL': 6,
        'DESQUALIFICACAO_PORTE': 5,
        'CONTINGENCIA_OPERACIONAL': 4,
        'INTERVENCAO_MANUAL': 3
    };

    for (const item of entries) {
        if (!item || item.estado !== 'ativo') continue;

        let duplicate = false;

        if (item.deal_id) {
            const key = `${item.deal_id}_${item.motivo_bloqueio}_${item.canal_bloqueado}`;
            if (seenByDeal.has(key)) duplicate = true;
            else seenByDeal.set(key, true);
        }

        if (item.telefone_normalizado && !duplicate) {
            const key = `${item.telefone_normalizado}_${item.canal_bloqueado}`;
            if (seenByPhone.has(key)) duplicate = true;
            else seenByPhone.set(key, true);
        }

        if (item.email_normalizado && !duplicate) {
            const key = `${item.email_normalizado}_${item.canal_bloqueado}`;
            if (seenByEmail.has(key)) duplicate = true;
            else seenByEmail.set(key, true);
        }

        if (!duplicate) {
            uniqueList.push(item);
        }
    }

    return uniqueList;
}

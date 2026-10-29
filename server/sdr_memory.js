/**
 * server/sdr_memory.js
 * ============================================================================
 * VAMUSS SDR — MEMÓRIA ESTRUTURADA POR LEAD (UPGRADE GROK)
 * ============================================================================
 * Mantém uma ficha operacional estruturada por cada deal no CRM, persistida
 * em disco (`data/sdr_lead_memory.json`).
 * 
 * Regras Invioláveis:
 * 1. A próxima mensagem outbound deve basear-se nos factos desta ficha.
 * 2. Jamais repetir pergunta já presente na lista `perguntas_ja_feitas`.
 * 3. Se a clínica não lista implantes, o ângulo de implantes fica terminantemente
 *    PROIBIDO para esse lead.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

const LEAD_MEMORY_FILE = path.resolve(process.cwd(), 'data', 'sdr_lead_memory.json');

/**
 * Lê o ficheiro de memória de leads
 */
export function readLeadMemoryStore() {
    try {
        if (!fs.existsSync(LEAD_MEMORY_FILE)) {
            const dir = path.dirname(LEAD_MEMORY_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(LEAD_MEMORY_FILE, JSON.stringify({}, null, 2), 'utf8');
            return {};
        }
        return JSON.parse(fs.readFileSync(LEAD_MEMORY_FILE, 'utf8'));
    } catch {
        return {};
    }
}

/**
 * Grava o ficheiro de memória de leads
 */
export function writeLeadMemoryStore(store) {
    try {
        fs.writeFileSync(LEAD_MEMORY_FILE, JSON.stringify(store, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [SDR Memory] Erro ao gravar memória do lead:', e.message);
        return false;
    }
}

/**
 * Obtém ou inicializa a memória estruturada de um lead
 * 
 * @param {string} dealId - ID do negócio no CRM
 * @param {Object} [initialData={}] - Dados iniciais se for novo
 * @returns {Object} Ficha de memória do lead
 */
export function getOrCreateLeadMemory(dealId, initialData = {}) {
    if (!dealId) return null;
    const store = readLeadMemoryStore();

    if (store[dealId]) {
        return store[dealId];
    }

    const newMemory = {
        dealId,
        clinic_name: initialData.clinicName || 'Clínica',
        tratamentos_confirmados: initialData.tratamentos_confirmados || [],
        tem_site: initialData.tem_site ?? false,
        website_url: initialData.websiteUrl || null,
        decisor_identificado: initialData.decisor || null,
        interlocutor_atual: initialData.interlocutor || 'desconhecido',
        motivo_perda_original: initialData.motivo_perda_original || 'nao_respondeu',
        objecao_atual: null,
        perguntas_ja_feitas: [],
        angulo_usado: initialData.angulo || 'consultas_particulares_google',
        factos_citados: [],
        proximo_contacto_prometido: null,
        toques_outbound_sem_humano: 0,
        consecutive_bot_replies: 0,
        estado: 'COLD', // COLD | OPENED | ENGAGED | QUALIFIED | BOOKING | BOOKED | NURTURE | DEAD | DEAD_BOT | HUMAN_HANDOFF
        ultima_intencao: null,
        confianca_intencao: 0.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    store[dealId] = newMemory;
    writeLeadMemoryStore(store);
    return newMemory;
}

/**
 * Atualiza campos na memória estruturada de um lead
 * 
 * @param {string} dealId
 * @param {Object} updates
 * @returns {Object} Memória atualizada
 */
export function updateLeadMemory(dealId, updates = {}) {
    if (!dealId) return null;
    const store = readLeadMemoryStore();
    const current = store[dealId] || getOrCreateLeadMemory(dealId);

    const merged = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    // Atualização de arrays sem duplicação
    if (updates.pergunta_adicional && !merged.perguntas_ja_feitas.includes(updates.pergunta_adicional)) {
        merged.perguntas_ja_feitas = [...merged.perguntas_ja_feitas, updates.pergunta_adicional];
    }
    if (updates.facto_citado_adicional && !merged.factos_citados.includes(updates.facto_citado_adicional)) {
        merged.factos_citados = [...merged.factos_citados, updates.facto_citado_adicional];
    }

    store[dealId] = merged;
    writeLeadMemoryStore(store);
    return merged;
}

/**
 * Valida se um ângulo ou tratamento pode ser usado para este lead
 * 
 * @param {Object} memory - Ficha de memória do lead
 * @param {string} proposedAngleOrTreatment - Tratamento ou ângulo proposto
 * @returns {Object} { allowed: boolean, reason: string }
 */
export function validateProposedStrategyAgainstMemory(memory, proposedAngleOrTreatment = '') {
    if (!memory) return { allowed: true, reason: 'Sem memória prévia' };

    const norm = (proposedAngleOrTreatment || '').toLowerCase();

    // 1. Proibição de implantes se o site não listar implantes
    if (norm.includes('implante') || norm.includes('implantologia')) {
        const hasImplants = (memory.tratamentos_confirmados || []).some(t => 
            (typeof t === 'string' ? t : t.nome || '').toLowerCase().includes('implante')
        );
        if (!hasImplants) {
            return {
                allowed: false,
                reason: 'Ângulo de implantes REJEITADO: a clínica não lista tratamentos de implantes no dossiê factual do website.'
            };
        }
    }

    // 2. Proibição de insistência em Dead Bot
    if (memory.estado === 'DEAD_BOT') {
        return {
            allowed: false,
            reason: 'Envio REJEITADO: lead marcado como DEAD_BOT após respostas automáticas consecutivas.'
        };
    }

    // 3. Proibição de 4º outbound sem resposta
    if (memory.toques_outbound_sem_humano >= 3) {
        return {
            allowed: false,
            reason: `Envio REJEITADO: teto de cadência atingido (${memory.toques_outbound_sem_humano} outbounds sem resposta humana).`
        };
    }

    return { allowed: true, reason: 'Estratégia autorizada pela memória estruturada' };
}

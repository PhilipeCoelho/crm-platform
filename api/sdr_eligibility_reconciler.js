/**
 * ============================================================================
 * VAMUSS SDR — SERVIÇO DE RECONCILIAÇÃO AUTÓNOMA DE ELEGIBILIDADE (FASE B.14.3.5)
 * ============================================================================
 * Responsável por reconciliar automaticamente o estado de elegibilidade legal,
 * técnica e comercial de cada negócio perdido do CRM, sem depender de 
 * intervenções manuais diárias do operador para tarefas rotineiras.
 * 
 * Classificações Operacionais Explícitas:
 * - ELIGIBLE_AUTONOMOUS: Requisitos legais, comerciais e de canal comprovados.
 * - BLOCKED_OPTOUT: Oposição expressa, recusa direta ou supressão ativa.
 * - BLOCKED_NO_LEGAL_BASIS: Sem base legal ou consentimento documental aplicável.
 * - BLOCKED_DESQUALIFIED: Negócio com motivo 'desqualificado' (bloqueio permanente).
 * - PENDING_EVIDENCE: Faltam dados cadastrais ou evidências para decidir.
 * - ELIGIBLE_NON_MESSAGING: Elegível para análise, diagnóstico e preparação interna, mas sem autorização de mensageria ativa.
 * - HUMAN_CLOSER_REQUIRED: Oportunidade concreta com interesse que requer o Closer.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { isPhoneSuppressedLocally } from './suppression_store.js';
import { SDREligibilityGate } from '../scripts/sdr_eligibility_gate.mjs';

dotenv.config();

const RECONCILIATION_FILE = path.resolve(process.cwd(), 'data', 'sdr_reconciled_eligibility.json');

function getSupabase() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    return (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
}

export const OPERATIONAL_STATUS = {
    ELIGIBLE_AUTONOMOUS: 'ELIGIBLE_AUTONOMOUS',
    BLOCKED_OPTOUT: 'BLOCKED_OPTOUT',
    BLOCKED_NO_LEGAL_BASIS: 'BLOCKED_NO_LEGAL_BASIS',
    BLOCKED_DESQUALIFIED: 'BLOCKED_DESQUALIFIED',
    PENDING_EVIDENCE: 'PENDING_EVIDENCE',
    ELIGIBLE_NON_MESSAGING: 'ELIGIBLE_NON_MESSAGING',
    HUMAN_CLOSER_REQUIRED: 'HUMAN_CLOSER_REQUIRED'
};

/**
 * Lê o repositório persistente de reconciliação
 */
export function readReconciliationStore() {
    try {
        if (!fs.existsSync(RECONCILIATION_FILE)) {
            return { lastRun: null, totalReconciled: 0, items: {} };
        }
        const raw = fs.readFileSync(RECONCILIATION_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { lastRun: null, totalReconciled: 0, items: {} };
    }
}

/**
 * Grava o repositório persistente de reconciliação
 */
export function writeReconciliationStore(store) {
    try {
        const dir = path.dirname(RECONCILIATION_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RECONCILIATION_FILE, JSON.stringify(store, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('❌ [SDR Reconciler] Erro ao gravar store de reconciliação:', e.message);
        return false;
    }
}

/**
 * Reconcilia um negócio individual com base em evidências factuais do CRM
 */
export async function reconcileDealEligibility({ deal, contact = null, activities = [] }) {
    if (!deal || !deal.id) {
        return {
            status: OPERATIONAL_STATUS.PENDING_EVIDENCE,
            reason: 'DEAL_INVALID',
            evidence: 'Identificador do negócio ausente.'
        };
    }

    const titleLower = (deal.title || '').toLowerCase();
    const lostReason = (deal.lost_reason || '').toLowerCase().trim();
    const disqReason = (deal.disqualified_reason || '').toLowerCase().trim();

    // 1. Regra B.14.3.2: Desqualificado permanente
    const isDisqualified = lostReason.includes('desqualificad') || 
                           disqReason.includes('desqualificad') || 
                           deal.stage_id === 'disqualified';

    if (isDisqualified) {
        return {
            dealId: deal.id,
            contactId: deal.contact_id || contact?.id || null,
            status: OPERATIONAL_STATUS.BLOCKED_DESQUALIFIED,
            reason: 'BLOQUEADO_DESQUALIFICADO',
            messagingAllowed: false,
            internalPreparationAllowed: false,
            evidence: `Motivo de perda: "${deal.lost_reason || 'Desqualificado'}"`,
            rule: 'B.14.3.2: Negócios com perda por desqualificação nunca são revistos',
            reconciledAt: new Date().toISOString()
        };
    }

    // 2. Verificar se já existe interesse / oportunidade para o Closer
    const isCloserOpportunity = deal.stage_id === 'stage_reuniao' || 
                                deal.stage_id === 'stage_lead_engajamento' || 
                                activities.some(a => /reunião|proposta|agendad|interesse/i.test(a.title || ''));
    if (isCloserOpportunity) {
        return {
            dealId: deal.id,
            contactId: deal.contact_id || contact?.id || null,
            status: OPERATIONAL_STATUS.HUMAN_CLOSER_REQUIRED,
            reason: 'OPORTUNIDADE_CLOSER_EXISTENTE',
            messagingAllowed: false,
            internalPreparationAllowed: true,
            evidence: 'Negócio possui reunião, proposta ou manifestação de interesse em aberto.',
            rule: 'B.14.3.5: Oportunidades comerciais concretas são conduzidas pelo Closer humano',
            reconciledAt: new Date().toISOString()
        };
    }

    // 3. Verificar oposição explícita / opt-out / STOP
    const phoneClean = (contact?.phone || '').replace(/\D/g, '');
    const isSuppressedLocal = isPhoneSuppressedLocally(phoneClean, deal.id, contact?.id);
    const hasExplicitOptOut = activities.some(a => 
        /STOP|PARAR|CANCELAR|NÃO CONTACTAR|RECLAMAÇÃO|OPTOUT/i.test(a.notes || '') ||
        /STOP|PARAR|CANCELAR|NÃO CONTACTAR|RECLAMAÇÃO|OPTOUT/i.test(a.title || '')
    ) || /optout|oposição|recusa/i.test(lostReason);

    if (isSuppressedLocal || hasExplicitOptOut) {
        return {
            dealId: deal.id,
            contactId: deal.contact_id || contact?.id || null,
            status: OPERATIONAL_STATUS.BLOCKED_OPTOUT,
            reason: 'OPTOUT_EXPLICITO_OU_SUPRESSAO',
            messagingAllowed: false,
            internalPreparationAllowed: false,
            evidence: isSuppressedLocal ? `Lista de supressão ativa (${isSuppressedLocal.motivo})` : 'Registo de oposição expressa (STOP/PARAR/Opt-out) na timeline',
            rule: 'RGPD / Art. 13º DL 7/2004: Direito de oposição incondicional e inviolável',
            reconciledAt: new Date().toISOString()
        };
    }

    // 4. Verificar endpoint e telemóvel móvel português
    const isValidPtMobile = phoneClean.startsWith('3519') ? phoneClean.length === 12 : (phoneClean.startsWith('9') && phoneClean.length === 9);
    if (!isValidPtMobile && !contact?.email) {
        return {
            dealId: deal.id,
            contactId: deal.contact_id || contact?.id || null,
            status: OPERATIONAL_STATUS.PENDING_EVIDENCE,
            reason: 'SEM_ENDPOINT_VALIDO',
            messagingAllowed: false,
            internalPreparationAllowed: false,
            evidence: `Telefone "${contact?.phone}" não é telemóvel móvel PT e não possui e-mail`,
            rule: 'Check 1: Negócio necessita de terminal móvel nacional ou e-mail válido',
            reconciledAt: new Date().toISOString()
        };
    }

    // 5. Determinar natureza do destinatário (Entidade Coletiva vs Pessoa Singular)
    const isCollective = titleLower.includes('clínica') || 
                         titleLower.includes('clinic') || 
                         titleLower.includes('centro') || 
                         titleLower.includes('instituto') || 
                         titleLower.includes('dental') || 
                         Boolean(contact?.company_id);

    if (!isCollective) {
        return {
            dealId: deal.id,
            contactId: deal.contact_id || contact?.id || null,
            status: OPERATIONAL_STATUS.BLOCKED_NO_LEGAL_BASIS,
            reason: 'PESSOA_SINGULAR_SEM_OPTIN',
            messagingAllowed: false,
            internalPreparationAllowed: false,
            evidence: 'Contacto classificado como profissional/médico singular sem consentimento documentado',
            rule: 'RGPD / DL 7/2004 Art. 13º: Pessoas singulares requerem opt-in prévio documentado',
            reconciledAt: new Date().toISOString()
        };
    }

    // 6. Investigar a origem do marketing_status
    const marketingStatus = contact?.marketing_status || 'unsubscribed';
    if (marketingStatus === 'unsubscribed') {
        // Investigação automática: Houve evento de descadastro voluntário ou foi default de migração?
        // Se as atividades não têm qualquer menção de cancelamento, o status proveio da migração do banco
        return {
            dealId: deal.id,
            contactId: deal.contact_id || contact?.id || null,
            status: OPERATIONAL_STATUS.ELIGIBLE_NON_MESSAGING,
            reason: 'SUPRESSAO_TECNICA_MIGRACAO_SEM_DISPARO',
            messagingAllowed: false,
            internalPreparationAllowed: true, // Permite análise, diagnóstico e estratégia autónomos!
            evidence: 'Entidade Coletiva B2B com Legítimo Interesse. Status "unsubscribed" derivado de migração técnica da base de dados, sem oposição ativa. Autorização de mensageria pendente.',
            rule: 'B.14.3.5: Análise e preparação autónomas permitidas; mensagens suspensas até autorização expressa de canal',
            reconciledAt: new Date().toISOString()
        };
    }

    // 7. Se preencher todos os requisitos: Totalmente Elegível Autónomo
    return {
        dealId: deal.id,
        contactId: deal.contact_id || contact?.id || null,
        status: OPERATIONAL_STATUS.ELIGIBLE_AUTONOMOUS,
        reason: 'REQUISITOS_INTEGRAIS_CUMPRIDOS',
        messagingAllowed: true,
        internalPreparationAllowed: true,
        evidence: 'Entidade Coletiva B2B, sem oposição, terminal móvel PT válido e marketing_status ativo.',
        rule: 'Legítimo Interesse B2B (Art. 6º/1/f RGPD) devidamente documentado',
        reconciledAt: new Date().toISOString()
    };
}

/**
 * Executa a reconciliação autónoma de todos os negócios perdidos do CRM
 */
export async function reconcileAllLostDeals({ limit = 500 } = {}) {
    console.log(`🔄 [SDR Reconciler] Iniciando reconciliação autónoma de negócios perdidos (Limite: ${limit})...`);
    const supabaseClient = getSupabase();
    if (!supabaseClient) {
        console.warn('⚠️ [SDR Reconciler] Supabase não configurado.');
        return { success: false, error: 'NO_SUPABASE' };
    }

    const store = readReconciliationStore();

    // 1. Carregar negócios lost do CRM
    const { data: deals, error: dErr } = await supabaseClient
        .from('deals')
        .select('*')
        .eq('status', 'lost')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (dErr || !deals) {
        console.error('❌ [SDR Reconciler] Erro ao carregar deals:', dErr?.message);
        return { success: false, error: dErr?.message };
    }

    // 2. Carregar contactos associados em lote
    const contactIds = [...new Set(deals.map(d => d.contact_id).filter(Boolean))];
    const contactMap = new Map();
    for (let i = 0; i < contactIds.length; i += 100) {
        const chunk = contactIds.slice(i, i + 100);
        const { data: contacts } = await supabaseClient
            .from('contacts')
            .select('id, name, email, phone, role, notes, company_id, marketing_status')
            .in('id', chunk);
        (contacts || []).forEach(c => contactMap.set(c.id, c));
    }

    // 3. Carregar atividades em lote
    const dealIds = deals.map(d => d.id);
    const actsMap = new Map();
    for (let i = 0; i < dealIds.length; i += 100) {
        const chunk = dealIds.slice(i, i + 100);
        const { data: acts } = await supabaseClient
            .from('activities')
            .select('id, deal_id, date, title, type, notes')
            .in('deal_id', chunk)
            .order('date', { ascending: false });
        (acts || []).forEach(a => {
            if (!actsMap.has(a.deal_id)) actsMap.set(a.deal_id, []);
            actsMap.get(a.deal_id).push(a);
        });
    }

    // 4. Executar reconciliação para cada negócio
    const summary = {
        total: deals.length,
        [OPERATIONAL_STATUS.ELIGIBLE_AUTONOMOUS]: 0,
        [OPERATIONAL_STATUS.ELIGIBLE_NON_MESSAGING]: 0,
        [OPERATIONAL_STATUS.BLOCKED_DESQUALIFIED]: 0,
        [OPERATIONAL_STATUS.BLOCKED_OPTOUT]: 0,
        [OPERATIONAL_STATUS.BLOCKED_NO_LEGAL_BASIS]: 0,
        [OPERATIONAL_STATUS.PENDING_EVIDENCE]: 0,
        [OPERATIONAL_STATUS.HUMAN_CLOSER_REQUIRED]: 0
    };

    for (const d of deals) {
        const contact = contactMap.get(d.contact_id) || null;
        const activities = actsMap.get(d.id) || [];

        const rec = await reconcileDealEligibility({ deal: d, contact, activities });
        store.items[d.id] = rec;
        summary[rec.status] = (summary[rec.status] || 0) + 1;
    }

    store.lastRun = new Date().toISOString();
    store.totalReconciled = deals.length;
    store.summary = summary;

    writeReconciliationStore(store);

    console.log(`✅ [SDR Reconciler] Reconciliação concluída para ${deals.length} negócios:`);
    console.log(`   - ELIGIBLE_AUTONOMOUS: ${summary[OPERATIONAL_STATUS.ELIGIBLE_AUTONOMOUS]}`);
    console.log(`   - ELIGIBLE_NON_MESSAGING: ${summary[OPERATIONAL_STATUS.ELIGIBLE_NON_MESSAGING]}`);
    console.log(`   - BLOCKED_DESQUALIFIED: ${summary[OPERATIONAL_STATUS.BLOCKED_DESQUALIFIED]}`);
    console.log(`   - BLOCKED_OPTOUT: ${summary[OPERATIONAL_STATUS.BLOCKED_OPTOUT]}`);
    console.log(`   - BLOCKED_NO_LEGAL_BASIS: ${summary[OPERATIONAL_STATUS.BLOCKED_NO_LEGAL_BASIS]}`);
    console.log(`   - PENDING_EVIDENCE: ${summary[OPERATIONAL_STATUS.PENDING_EVIDENCE]}`);
    console.log(`   - HUMAN_CLOSER_REQUIRED: ${summary[OPERATIONAL_STATUS.HUMAN_CLOSER_REQUIRED]}`);

    return {
        success: true,
        summary,
        lastRun: store.lastRun
    };
}

/**
 * ============================================================================
 * VAMUSS — AGENTE COMERCIAL AUTÓNOMO EXCLUSIVO (SDR + CLOSER)
 * ============================================================================
 * Este é o colaborador comercial digital autónomo da Vamuss (Portugal).
 * Ele opera de ponta a ponta com iniciativa própria:
 * 1. Prospeção ativa: varre deals perdidos no CRM (status = 'lost', >= 30 dias de perda).
 * 2. Leitura profunda de contexto: histórico de atividades, notas, motivos da perda.
 * 3. Pesquisa web factual: website institucional, Google Reviews, tratamentos destacados.
 * 4. Estratégia e abordagem personalizada por WhatsApp (sem templates rígidos).
 * 5. Closer consultivo (SPIN Selling): qualifica respostas, contorna objeções reais.
 * 6. Fecho autónomo: envia o link do Cal.com e confirma a Reunião de Diagnóstico.
 * 
 * Arquitetura: OpenAI Function Calling / Tool-Calling Agent Loop
 * Modelo: GPT-4o / GPT-4o-mini
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppWebMessage, getWhatsAppWebStatus } from './whatsapp_web.js';
import { isWithinBusinessHours, validateDispatchTiming } from './sdr_business_hours.js';
import { isPhoneSuppressedLocally, addLocalSuppression } from './suppression_store.js';
import { generateClinicDossier, readDossiersStore } from './sdr_web_research.js';
import { lintSDRMessage } from './sdr_lint.js';
import {
    getOrCreateSpinState,
    analyzeInboundSpinProgress,
    getNextSpinQuestion,
    formatSpinSummaryForAlert,
    saveSpinStateToStore,
    CALCOM_BOOKING_LINK
} from './sdr_spin_qualifier.js';
import { readRecoveryPipelineStore, writeRecoveryPipelineStore } from './sdr_recovery_pipeline.js';
import { checkAndReserveWhatsAppBudget, recordWhatsAppCost, recordOpenAICost, COST_LIMITS } from './sdr_cost_controller.js';

// Cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Operador e Constantes
export { CALCOM_BOOKING_LINK };
export const OPERATOR_PHONE = '351964094865';
export const OPERATOR_NAME = 'Philipe Coelho';
export const DAILY_OUTBOUND_LIMIT = 5;
export const AGENT_STATE_FILE = path.resolve(process.cwd(), 'data', 'vamuss_agent_state.json');

/**
 * Lê o estado de memória persistente do Agente
 */
export function readAgentState() {
    try {
        if (!fs.existsSync(AGENT_STATE_FILE)) {
            const initial = {
                totalOutboundsSent: 0,
                totalRepliesHandled: 0,
                totalMeetingsBooked: 0,
                dailyDispatches: {},
                recentActions: []
            };
            fs.mkdirSync(path.dirname(AGENT_STATE_FILE), { recursive: true });
            fs.writeFileSync(AGENT_STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        return JSON.parse(fs.readFileSync(AGENT_STATE_FILE, 'utf8'));
    } catch {
        return { totalOutboundsSent: 0, totalRepliesHandled: 0, totalMeetingsBooked: 0, dailyDispatches: {}, recentActions: [] };
    }
}

/**
 * Grava o estado de memória do Agente
 */
export function recordAgentAction(actionType, details) {
    try {
        const state = readAgentState();
        const todayStr = new Date().toISOString().slice(0, 10);
        state.dailyDispatches[todayStr] = state.dailyDispatches[todayStr] || 0;

        if (actionType === 'OUTBOUND_DISPATCH') {
            state.totalOutboundsSent += 1;
            state.dailyDispatches[todayStr] += 1;
        } else if (actionType === 'INBOUND_REPLY') {
            state.totalRepliesHandled += 1;
        } else if (actionType === 'CALCOM_SENT') {
            state.totalMeetingsBooked += 1;
        }

        state.recentActions.unshift({
            timestamp: new Date().toISOString(),
            actionType,
            details
        });

        if (state.recentActions.length > 100) {
            state.recentActions = state.recentActions.slice(0, 100);
        }

        fs.writeFileSync(AGENT_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.warn('⚠️ [Vamuss Agent] Falha ao registar ação do agente:', err.message);
        return false;
    }
}

/**
 * Normaliza número de telemóvel para formato WhatsApp internacional (ex: 351912345678)
 */
export function normalizePhoneNumber(raw) {
    if (!raw) return null;
    let clean = String(raw).replace(/\D/g, '');
    if (clean.length === 9 && clean.startsWith('9')) {
        clean = '351' + clean;
    }
    return clean;
}

/**
 * Verifica se é um telemóvel móvel português
 */
export function isPortugueseMobile(phone) {
    const clean = normalizePhoneNumber(phone);
    if (!clean) return false;
    if (clean.startsWith('351') && clean.length === 12 && clean[3] === '9') return true;
    if (clean.length === 9 && clean.startsWith('9')) return true;
    return false;
}

/**
 * ============================================================================
 * AS FERRAMENTAS DO AGENTE (TOOLS DEFINITION)
 * ============================================================================
 */

export const AGENT_TOOLS_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'scan_crm_lost_deals',
            description: 'Varre o CRM Supabase em busca de negócios perdidos elegíveis para reaquecimento (status lost, móvel português, sem supressão ativa, perda >= 30 dias).',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Quantidade máxima de negócios a retornar (padrão 5)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'fetch_lead_full_dossier',
            description: 'Recupera o histórico factual completo de um negócio: notas, propostas, atividades passadas, motivo de perda e contacto.',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio no CRM'
                    }
                },
                required: ['deal_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'research_clinic_online',
            description: 'Realiza pesquisa web na clínica para extrair factos reais comprovados: tratamentos de alto valor (implantes, ortodontia), presença no Google, avaliações.',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio'
                    },
                    clinic_name: {
                        type: 'string',
                        description: 'Nome da clínica'
                    },
                    city: {
                        type: 'string',
                        description: 'Concelho ou cidade da clínica'
                    },
                    website: {
                        type: 'string',
                        description: 'Website oficial se disponível'
                    }
                },
                required: ['deal_id', 'clinic_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_whatsapp_message',
            description: 'Dispara uma mensagem de WhatsApp via sessão do Philipe. Executa salvaguardas estritas de horário e supressão antes do envio.',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio'
                    },
                    phone: {
                        type: 'string',
                        description: 'Telefone móvel do lead'
                    },
                    message_text: {
                        type: 'string',
                        description: 'Texto completo da mensagem em Português de Portugal'
                    },
                    intent: {
                        type: 'string',
                        enum: ['PRIMEIRA_ABORDAGEM', 'RESPOSTA_SPIN', 'LINK_CALCOM', 'SEGUIMENTO', 'CORTESIA'],
                        description: 'Finalidade da mensagem'
                    }
                },
                required: ['phone', 'message_text', 'intent']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_calcom_booking_link',
            description: 'Envia o convite para a Reunião de Diagnóstico de 20 minutos com o link oficial do Cal.com.',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio'
                    },
                    phone: {
                        type: 'string',
                        description: 'Telefone móvel da clínica'
                    },
                    clinic_name: {
                        type: 'string',
                        description: 'Nome da clínica ou interlocutor'
                    }
                },
                required: ['deal_id', 'phone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_spin_state',
            description: 'Regista o avanço da qualificação SPIN (Situação, Problema, Implicação, Necessidade de Solução) com base no que a clínica disse.',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio'
                    },
                    lead_reply_text: {
                        type: 'string',
                        description: 'Texto recebido da clínica'
                    }
                },
                required: ['deal_id', 'lead_reply_text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'schedule_followup_return',
            description: 'Regista no CRM que o lead pediu para voltar a falar numa data futura (ex: "fale daqui a 2 meses").',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio'
                    },
                    return_date: {
                        type: 'string',
                        description: 'Data sugerida para retorno (YYYY-MM-DD)'
                    },
                    reason: {
                        type: 'string',
                        description: 'Motivo declarado pelo lead'
                    }
                },
                required: ['deal_id', 'return_date']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'register_opt_out',
            description: 'Bloqueia definitivamente qualquer contacto com o número de telemóvel e cancela o negócio (cumprimento estrito de RGPD).',
            parameters: {
                type: 'object',
                properties: {
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio'
                    },
                    phone: {
                        type: 'string',
                        description: 'Telefone do lead'
                    },
                    evidence: {
                        type: 'string',
                        description: 'Frase que originou o pedido de saída'
                    }
                },
                required: ['phone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'alert_philipe_on_whatsapp',
            description: 'Envia um alerta prioritário ao WhatsApp do Philipe Coelho para casos especiais que exigem a sua atenção.',
            parameters: {
                type: 'object',
                properties: {
                    summary: {
                        type: 'string',
                        description: 'Resumo da ocorrência'
                    },
                    clinic_name: {
                        type: 'string',
                        description: 'Nome da clínica'
                    },
                    deal_id: {
                        type: 'string',
                        description: 'ID do negócio se houver'
                    }
                },
                required: ['summary']
            }
        }
    }
];

/**
 * ============================================================================
 * IMPLEMENTAÇÃO REAL DAS FERRAMENTAS DO AGENTE
 * ============================================================================
 */

export const AgentToolImplementations = {
    /**
     * 1. Varre negócios perdidos no CRM
     */
    async scan_crm_lost_deals({ limit = 5 }) {
        if (!supabase) return { success: false, error: 'SUPABASE_UNAVAILABLE' };

        console.log(`🔍 [Vamuss Agent Tool] A varrer CRM por negócios perdidos (limite: ${limit})...`);

        const { data: deals, error } = await supabase
            .from('deals')
            .select('id, user_id, contact_id, title, value, status, stage_id, lost_at, created_at, lost_reason, objection_tags')
            .eq('status', 'lost')
            .not('contact_id', 'is', null)
            .order('lost_at', { ascending: true, nullsFirst: false })
            .limit(100);

        if (error) {
            console.error('❌ [Vamuss Agent Tool] Erro na query de deals:', error.message);
            return { success: false, error: error.message };
        }

        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const candidates = [];

        // Ler pipeline de recuperação para verificar estados prévios
        const pipelineStore = readRecoveryPipelineStore();

        for (const deal of deals || []) {
            if (candidates.length >= limit) break;

            // 1. Respiro comercial de 30 dias
            const lostTimestamp = deal.lost_at ? new Date(deal.lost_at).getTime() : new Date(deal.created_at).getTime();
            if (now - lostTimestamp < thirtyDaysMs) {
                continue;
            }

            // 2. Salvaguarda estrita: NUNCA abordar Odontoclinic (ex-cliente)
            const titleLower = (deal.title || '').toLowerCase();
            const reasonLower = (deal.lost_reason || '').toLowerCase().trim();
            if (
                titleLower.includes('odontoclinic') ||
                titleLower.includes('odontclinic') ||
                reasonLower.includes('encerrou o contrato') ||
                reasonLower.includes('ex-cliente')
            ) {
                continue;
            }

            // 3. Não reativar se desqualificado expressamente ou grandes grupos corporativos
            if (
                reasonLower.includes('desqualificad') ||
                reasonLower.includes('grupo muito grande') ||
                reasonLower.includes('grande grupo') ||
                reasonLower.includes('franquia') ||
                deal.stage_id === 'disqualified'
            ) {
                continue;
            }

            // 4. Mapeamento de contexto do motivo para orientar a estratégia do agente
            let targetCategory = 'GERAL_RECUPERAVEL';
            if (reasonLower.includes('não responde') || reasonLower.includes('nao responde') || reasonLower.includes('sem resposta') || reasonLower.includes('perda de contat')) {
                targetCategory = 'SEM_RESPOSTA';
            } else if (reasonLower.includes('já tem') || reasonLower.includes('agência') || reasonLower.includes('equipa') || reasonLower.includes('anunciam') || reasonLower.includes('fornecedor')) {
                targetCategory = 'FORNECEDOR_ATIVO';
            } else if (!reasonLower || reasonLower === 'sem motivo' || reasonLower === 'sem motivo registrado') {
                targetCategory = 'SEM_MOTIVO';
            } else if (reasonLower.includes('sem fit') || reasonLower.includes('faltam recursos') || reasonLower.includes('momento') || reasonLower.includes('orçamento')) {
                targetCategory = 'FALTA_RECURSOS_TIMING';
            }

            // 3. Obter contacto
            const { data: contact } = await supabase
                .from('contacts')
                .select('id, name, phone, email, notes, role')
                .eq('id', deal.contact_id)
                .single();

            if (!contact || !contact.phone) continue;

            const cleanPhone = normalizePhoneNumber(contact.phone);
            if (!isPortugueseMobile(cleanPhone)) continue;

            // 4. Verificar supressão
            if (isPhoneSuppressedLocally(cleanPhone, deal.id, contact.id)) {
                continue;
            }

            // 5. Trava de Valor / ROI por Negócio (Saturação e Teto de Custo)
            // Se já atingiu o teto financeiro ou limite de tentativas sem resposta, não insiste
            const budgetCheck = checkAndReserveWhatsAppBudget({ phone: cleanPhone, dealId: deal.id });
            if (!budgetCheck.allowed) {
                console.log(`🛡️ [Vamuss Agent Tool] Negócio ${deal.id} (${cleanPhone}) ignorado: ${budgetCheck.reason}`);
                continue;
            }

            // 6. Verificar se já foi contactado ou está em handoff no pipeline
            const pipeEntry = pipelineStore.deals ? pipelineStore.deals[deal.id] : pipelineStore[deal.id];
            if (pipeEntry?.stage === 'mensagem_enviada' || pipeEntry?.stage === 'em_conversa' || pipeEntry?.stage === 'agendamento_pendente_humano' || pipeEntry?.stage === 'reuniao_agendada' || pipeEntry?.stage === 'pronto_reabrir') {
                continue;
            }

            candidates.push({
                deal_id: deal.id,
                contact_id: contact.id,
                title: deal.title,
                clinic_name: contact.name || deal.title.replace(/^Negócio\s+/i, ''),
                phone: cleanPhone,
                email: contact.email,
                target_category: targetCategory,
                lost_reason: deal.lost_reason || 'Sem motivo específico registado',
                lost_at: deal.lost_at || deal.created_at,
                days_since_loss: Math.round((now - lostTimestamp) / (1000 * 60 * 60 * 24))
            });
        }

        console.log(`✅ [Vamuss Agent Tool] Varredura concluída: ${candidates.length} negócios elegíveis encontrados.`);
        return { success: true, count: candidates.length, deals: candidates };
    },

    /**
     * 2. Recupera dossiê completo de um negócio
     */
    async fetch_lead_full_dossier({ deal_id }) {
        if (!supabase) return { success: false, error: 'SUPABASE_UNAVAILABLE' };

        console.log(`📖 [Vamuss Agent Tool] A ler histórico profundo do deal ${deal_id}...`);

        const { data: deal } = await supabase
            .from('deals')
            .select('*')
            .eq('id', deal_id)
            .single();

        if (!deal) return { success: false, error: 'DEAL_NOT_FOUND' };

        const { data: contact } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', deal.contact_id)
            .single();

        // Atividades históricas
        const { data: activities } = await supabase
            .from('activities')
            .select('id, type, title, notes, completed, date, houve_resposta, tooltip_script')
            .eq('deal_id', deal_id)
            .order('date', { ascending: false })
            .limit(10);

        // Logs profundos de interação e anotações reais do CRM (deal_logs)
        const { data: dealLogs } = await supabase
            .from('deal_logs')
            .select('id, deal_id, content, type, created_at')
            .eq('deal_id', deal_id)
            .order('created_at', { ascending: false })
            .limit(15);

        // Classificação e Triagem da Memória do CRM:
        // Distingue o que é histórico de relacionamento factual (mencionável) de notas internas do operador (confidenciais)
        const relationshipFacts = [];
        const confidentialNotes = [];

        // Tratar motivo da perda e notas
        if (deal.lost_reason) {
            confidentialNotes.push({
                tipo: 'NOTA_INTERNA_OPERADOR',
                conteudo: deal.lost_reason,
                regra: 'CONFIDENCIAL — Inteligência interna. NUNCA citar nem confessar à clínica!'
            });
        }

        (activities || []).forEach(act => {
            if (act.type === 'message' || act.type === 'whatsapp' || act.type === 'email') {
                const actDate = act.date ? new Date(act.date) : null;
                const hoursAgo = actDate ? Math.round((Date.now() - actDate.getTime()) / (1000 * 60 * 60)) : 9999;
                relationshipFacts.push({
                    tipo: `CONTACTO_${act.type.toUpperCase()}`,
                    data: act.date?.slice(0, 10),
                    horas_atras: hoursAgo,
                    foi_recente: hoursAgo <= 72,
                    titulo: act.title,
                    resumo: act.notes || 'Mensagem enviada anteriormente'
                });
            } else if (act.type === 'status_change') {
                if (act.notes && !act.notes.includes(deal.lost_reason || '___')) {
                    confidentialNotes.push({
                        tipo: 'REGISTO_STATUS',
                        conteudo: act.notes,
                        regra: 'CONFIDENCIAL — Não citar diretamente.'
                    });
                }
            }
        });

        // Estado SPIN atual
        const spinState = getOrCreateSpinState(deal_id, contact?.name || deal.title);

        return {
            success: true,
            deal: {
                id: deal.id,
                title: deal.title,
                lost_at: deal.lost_at,
                value: deal.value
            },
            contact: {
                id: contact?.id,
                name: contact?.name,
                phone: normalizePhoneNumber(contact?.phone),
                email: contact?.email
            },
            intelligence: {
                relationship_facts: relationshipFacts, // Pode citar com respeito e naturalidade
                confidential_operator_notes: confidentialNotes // NUNCA citar — inteligência silenciosa
            },
            activities: activities || [],
            deal_logs: (dealLogs || []).map(l => ({
                date: l.created_at,
                content: l.content || ''
            })),
            spin_summary: formatSpinSummaryForAlert(spinState),
            is_ready_for_calcom: spinState?.necessidade?.status === 'confirmado' || spinState?.calComOffered || false
        };
    },

    /**
     * 3. Pesquisa factual da clínica na Web e Google
     */
    async research_clinic_online({ deal_id, clinic_name, city = '', website = '' }) {
        console.log(`🌐 [Vamuss Agent Tool] A investigar clinicamente "${clinic_name}" (${city})...`);

        let targetWebsite = website;

        // Se o website não foi passado explicitamente, extrair do e-mail institucional no CRM
        if (!targetWebsite && supabase && deal_id) {
            try {
                const { data: d } = await supabase.from('deals').select('contact_id').eq('id', deal_id).single();
                if (d?.contact_id) {
                    const { data: c } = await supabase.from('contacts').select('email, notes').eq('id', d.contact_id).single();
                    if (c?.email && c.email.includes('@')) {
                        const emailDomain = c.email.split('@')[1]?.toLowerCase().trim();
                        const isGeneric = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'sapo.pt', 'live.com'].includes(emailDomain);
                        if (!isGeneric && emailDomain.includes('.')) {
                            targetWebsite = `https://${emailDomain}`;
                            console.log(`🔎 [Web Research] Domínio institucional descoberto a partir do e-mail (${c.email}): ${targetWebsite}`);
                        }
                    }
                }
            } catch (_) {}
        }

        try {
            const dossier = await generateClinicDossier({
                dealId: deal_id,
                clinicName: clinic_name,
                concelho: city,
                websiteUrl: targetWebsite
            });

            // Filtro rigoroso: nunca permitir ganchos de amador como "não aparece no Google para..."
            const filteredFacts = (dossier.verifiedFacts || []).filter(f => {
                const txt = (f.fact || '').toLowerCase();
                return !txt.includes('não surge na primeira página') && 
                       !txt.includes('não aparece na primeira página') &&
                       !txt.includes('visibilidade orgânica') &&
                       !txt.includes('primeira página do google');
            });

            const topFact = filteredFacts.length > 0 
                ? filteredFacts[0].fact 
                : 'Acompanhamento clínico especializado em tratamentos particulares de valor acrescentado em Portugal.';

            return {
                success: true,
                has_website: Boolean(dossier.siteAnalysis?.hasWebsite),
                website_url: dossier.siteAnalysis?.url || targetWebsite || null,
                treatments: dossier.siteAnalysis?.highlightedTreatments || [],
                rating: dossier.visibilityAnalysis?.rating || null,
                reviews_count: dossier.visibilityAnalysis?.reviewCount || null,
                verified_facts: filteredFacts,
                best_hook_fact: topFact
            };
        } catch (err) {
            console.warn(`⚠️ [Vamuss Agent Tool] Falha na pesquisa online: ${err.message}`);
            return {
                success: false,
                best_hook_fact: null
            };
        }
    },

    /**
     * 4. Envia mensagem de WhatsApp
     */
    async send_whatsapp_message({ deal_id, phone, message_text, intent }) {
        const cleanPhone = normalizePhoneNumber(phone);

        // 0. TRAVA ABSOLUTA: Números pessoais bloqueados NUNCA recebem mensagens
        if (BLOCKED_PERSONAL_PHONES.some(b => cleanPhone.endsWith(b.slice(-9)))) {
            console.warn(`🛑 [Vamuss Agent Tool] Envio BLOQUEADO: +${cleanPhone} é número pessoal bloqueado.`);
            return { success: false, blocked: true, reason: 'PERSONAL_PHONE_BLOCKED' };
        }

        // 1. Salvaguarda fail-closed de supressão
        if (isPhoneSuppressedLocally(cleanPhone, deal_id)) {
            console.warn(`🛑 [Vamuss Agent Tool] Envio rejeitado: número +${cleanPhone} está na lista de supressão.`);
            return { success: false, blocked: true, reason: 'SUPPRESSED' };
        }

        // 1b. TRAVA DE VALOR POR NEGÓCIO & ANTI-REPETIÇÃO:
        // - Retira a proibição rígida de apenas 1 por dia (permite follow-up em horário/dia diferente)
        // - Garante que não envia o mesmo texto (anti-repetição)
        // - Limita o teto financeiro / tentativas totais por negócio para gastar o mínimo com o maior retorno
        const currentState = readAgentState();
        const budgetCheck = checkAndReserveWhatsAppBudget({ phone: cleanPhone, dealId: deal_id });
        if (!budgetCheck.allowed) {
            console.warn(`🛑 [Vamuss Agent Tool] Trava de valor / saturação ativada para +${cleanPhone}: ${budgetCheck.reason}`);
            return { success: false, blocked: true, reason: budgetCheck.error, detail: budgetCheck.reason };
        }

        // 1c. CAMADA DE CRÍTICA RIGOROSA PRÉ-ENVIO (SANITY CHECK):
        // Bloqueia qualquer mensagem que viole as diretrizes de SDR executivo
        const textLower = message_text.toLowerCase();

        // 1. Proibição de citações de notas internas do operador
        const FORBIDDEN_CONFIDENTIAL_CITATIONS = [
            'já estão a anunciar', 'já estao a anunciar', 'já anunciam',
            'já têm uma equipa', 'ja tem uma equipa', 'uma equipa a trabalhar convosco',
            'como tem sido a experiência com eles', 'experiência com as campanhas',
            'fora de perfil', 'grupo muito grande'
        ];
        for (const badPhrase of FORBIDDEN_CONFIDENTIAL_CITATIONS) {
            if (textLower.includes(badPhrase)) {
                console.warn(`🛑 [Sanity Check] REJEITADA: Mensagem citou nota interna confidencial ("${badPhrase}"). Bloqueada.`);
                return { success: false, blocked: true, reason: 'CONFIDENTIAL_NOTE_LEAK', detail: badPhrase };
            }
        }

        // 2. Proibição de ganchos amadores de marketing digital
        const FORBIDDEN_AMATEUR_HOOKS = [
            'primeira página do google', 'primeira pagina do google',
            'visibilidade online', 'alguma novidade interessante este ano',
            'não aparecem no google', 'nao aparecem no google',
            'não surgem na primeira página'
        ];
        for (const badHook of FORBIDDEN_AMATEUR_HOOKS) {
            if (textLower.includes(badHook)) {
                console.warn(`🛑 [Sanity Check] REJEITADA: Mensagem continha gancho amador de marketing ("${badHook}"). Bloqueada.`);
                return { success: false, blocked: true, reason: 'AMATEUR_MARKETING_HOOK', detail: badHook };
            }
        }

        // 3. Proibição de clichês vazios de abertura em qualquer mensagem
        const forbiddenCliches = [
            'espero que esteja tudo bem',
            'espero que esteja bem',
            'espero que estejam bem',
            'espero que estejas bem',
            'tudo bem convosco',
            'tudo bem consigo'
        ];
        if (forbiddenCliches.some(c => textLower.includes(c))) {
            console.warn(`🛑 [Sanity Check] REJEITADA: Cliché vazio proibido detectado na mensagem. Bloqueada.`);
            return { success: false, blocked: true, reason: 'EMPTY_CLICHE_DETECTED' };
        }

        // 4. Proibição estrita de invenção de especialidades clínicas sem suporte factual:
        // Se a mensagem citar tratamentos específicos (implantes, alinhadores, facetas), exige que venha de factos reais
        const specificTreatments = ['implante', 'ortodontia', 'invisalign', 'faceta', 'alinhador', 'reabilitaç'];
        const mentionsSpecificTreatment = specificTreatments.some(t => textLower.includes(t));
        
        // Bloquear frases modelo copiadas integralmente do prompt
        if (textLower.includes('como implantes e reabilitações') || textLower.includes('como implantes e reabilitação')) {
            // Verificar se temos website comprovado que realmente destaca este tratamento
            const dossierStore = readDossiersStore();
            const dealDossier = deal_id ? dossierStore[deal_id] : null;
            const hasVerifiedTreatment = (dealDossier?.verifiedFacts || []).some(f => (f.fact || '').toLowerCase().includes('implante'));
            if (!hasVerifiedTreatment && (!dealDossier?.siteAnalysis?.highlightedTreatments || dealDossier.siteAnalysis.highlightedTreatments.length === 0)) {
                console.warn(`🛑 [Sanity Check] REJEITADA: A abordagem usou a fórmula padrão ("implantes e reabilitações") sem comprovação factual no website da clínica.`);
                return { success: false, blocked: true, reason: 'UNVERIFIED_GENERIC_TREATMENT_FORMULA' };
            }
        }
        // 3.1 Idempotência rígida: se já foi enviada PRIMEIRA_ABORDAGEM para este número ou deal, rejeita novo envio imediato
        if (intent === 'PRIMEIRA_ABORDAGEM') {
            const alreadyApproached = (currentState.recentActions || []).some(
                a => a.actionType === 'OUTBOUND_DISPATCH' &&
                     (a.details?.deal_id === deal_id || 
                      (a.details?.phone && normalizePhoneNumber(a.details.phone).endsWith(cleanPhone.slice(-9))))
            );
            if (alreadyApproached) {
                console.warn(`🛑 [Vamuss Agent Tool] Mensagem rejeitada por idempotência: o número +${cleanPhone} ou Deal ${deal_id} já recebeu PRIMEIRA_ABORDAGEM.`);
                return { success: false, blocked: true, reason: 'ALREADY_APPROACHED_OUTBOUND' };
            }
        }

        // 2. Salvaguarda de horário:
        // - Novos contactos frios (PRIMEIRA_ABORDAGEM): Apenas em dias úteis (09h00-18h00 Lisboa) a partir de segunda-feira às 09h00.
        // - Respostas a quem nos contactou (RESPOSTA_SPIN, envio de Cal.com, esclarecimento):
        //   Permitidas de imediato para manter o fio da conversa e não deixar o lead sem resposta.
        const isColdOutbound = (intent === 'PRIMEIRA_ABORDAGEM');
        if (isColdOutbound) {
            const timing = validateDispatchTiming();
            if (!timing.permitido) {
                console.warn(`⏰ [Vamuss Agent Tool] Novo contacto frio bloqueado fora de horário comercial (${timing.motivo}). Próxima janela: segunda-feira às 09h00.`);
                return { success: false, blocked: true, reason: 'OUTSIDE_BUSINESS_HOURS', nextWindow: timing.proxima_janela_util };
            }
        }

        // 2.5 LINTER OBRIGATÓRIO: Zero tolerância para placeholders [Nome], clichés ou jargão
        const lint = lintSDRMessage({
            messageText: message_text,
            intent: intent,
            outboundCountWithoutHuman: intent === 'PRIMEIRA_ABORDAGEM' ? 0 : 1
        });
        if (!lint.ok) {
            console.error(`🚨 [Vamuss Agent Tool] DISPARO BLOQUEADO POR LINTER DE SEGURANÇA:\n${lint.problemas.join('\n')}`);
            return {
                success: false,
                blocked: true,
                reason: 'LINT_REJECTED',
                errors: lint.problemas
            };
        }

        // 3. Verificar estado do WhatsApp Web
        const waStatus = getWhatsAppWebStatus();
        if (waStatus.status !== 'CONNECTED') {
            console.warn(`📵 [Vamuss Agent Tool] WhatsApp Web não conectado (Estado: ${waStatus.status}).`);
            return { success: false, error: 'WHATSAPP_DISCONNECTED' };
        }

        console.log(`💬 [Vamuss Agent Tool] A enviar WhatsApp para +${cleanPhone} (Intent: ${intent}):\n"${message_text}"`);

        try {
            const result = await sendWhatsAppWebMessage(cleanPhone, message_text);

            // Registar ação na timeline do CRM
            const validDealId = (deal_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deal_id)) ? deal_id : null;
            if (supabase && validDealId) {
                const { data: deal } = await supabase.from('deals').select('user_id').eq('id', validDealId).single();
                if (deal?.user_id) {
                    try {
                        await supabase.from('activities').insert({
                            user_id: deal.user_id,
                            deal_id: validDealId,
                            type: 'whatsapp',
                            title: `SDR Autónomo: ${intent}`,
                            notes: message_text,
                            date: new Date().toISOString(),
                            completed: true,
                            is_automatic: true
                        });
                    } catch (_) {}
                }
            }

            // Atualizar estado de memória do Agente
            recordAgentAction('OUTBOUND_DISPATCH', {
                deal_id: validDealId || deal_id,
                phone: cleanPhone,
                intent,
                snippet: message_text.slice(0, 80)
            });

            // Sincronizar estágio no Recovery Pipeline
            if (validDealId) {
                try {
                    const pipe = readRecoveryPipelineStore();
                    pipe.deals = pipe.deals || {};
                    if (!pipe.deals[validDealId]) {
                        pipe.deals[validDealId] = {
                            dealId: validDealId,
                            title: `Negócio ${cleanPhone}`,
                            stage: intent === 'PRIMEIRA_ABORDAGEM' ? 'mensagem_enviada' : 'em_conversa',
                            phone: cleanPhone,
                            lastContactedAt: new Date().toISOString(),
                            notes: message_text.slice(0, 100)
                        };
                    } else {
                        if (intent === 'PRIMEIRA_ABORDAGEM' && pipe.deals[validDealId].stage === 'perdidos_qualificados') {
                            pipe.deals[validDealId].stage = 'mensagem_enviada';
                        } else if (intent === 'RESPOSTA_SPIN') {
                            pipe.deals[validDealId].stage = 'em_conversa';
                        }
                        pipe.deals[validDealId].lastContactedAt = new Date().toISOString();
                    }
                    writeRecoveryPipelineStore(pipe);
                } catch (_) {}
            }

            // Registar custo contabilístico do envio no controlador financeiro
            try {
                recordWhatsAppCost({ phone: cleanPhone, dealId: validDealId, reservationId: budgetCheck.reservationId });
            } catch (_) {}

            return { success: true, result };
        } catch (err) {
            console.error(`❌ [Vamuss Agent Tool] Erro no envio WhatsApp para +${cleanPhone}:`, err.message);
            return { success: false, error: err.message };
        }
    },

    /**
     * 5. Envia link do Cal.com
     */
    async send_calcom_booking_link({ deal_id, phone, clinic_name = '' }) {
        const cleanPhone = normalizePhoneNumber(phone);
        const inviteMessage = `Ótimo! Para vermos isso com clareza e sem rodeios, o melhor é uma breve Reunião de Diagnóstico de 20 minutos (sem qualquer compromisso).\n\nPode escolher diretamente o horário mais conveniente aqui:\n${CALCOM_BOOKING_LINK}\n\nAssim preparo uma análise específica para a sua clínica antes de falarmos.`;

        console.log(`🎯 [Vamuss Agent Tool] Enviando link do Cal.com para +${cleanPhone}...`);

        const sendRes = await AgentToolImplementations.send_whatsapp_message({
            deal_id,
            phone: cleanPhone,
            message_text: inviteMessage,
            intent: 'LINK_CALCOM'
        });

        if (sendRes.success) {
            // Atualizar pipeline
            const pipe = readRecoveryPipelineStore();
            pipe[deal_id] = {
                ...(pipe[deal_id] || {}),
                stage: 'link_calcom_enviado',
                calcomLinkSentAt: new Date().toISOString()
            };
            writeRecoveryPipelineStore(pipe);

            recordAgentAction('CALCOM_SENT', { deal_id, phone: cleanPhone });

            // Alerta informativo ao Philipe
            await AgentToolImplementations.alert_philipe_on_whatsapp({
                summary: `Link de Reunião de Diagnóstico enviado à clínica ${clinic_name} (+${cleanPhone})!`,
                clinic_name,
                deal_id
            });
        }

        return sendRes;
    },

    /**
     * 6. Atualiza qualificação SPIN
     */
    async update_spin_state({ deal_id, lead_reply_text }) {
        const currentState = getOrCreateSpinState(deal_id);
        const analysis = analyzeInboundSpinProgress({ inboundText: lead_reply_text, currentState });
        saveSpinStateToStore(deal_id, analysis.updatedState);

        return {
            success: true,
            spin_summary: formatSpinSummaryForAlert(analysis.updatedState),
            is_ready_for_calcom: analysis.isReadyForCalCom,
            is_objection: analysis.isObjection,
            objection_type: analysis.objectionType,
            suggested_action: analysis.suggestedAction,
            exchange_count: analysis.updatedState.exchangeCount
        };
    },

    /**
     * 7. Agenda retorno futuro
     */
    async schedule_followup_return({ deal_id, return_date, reason = '' }) {
        console.log(`📅 [Vamuss Agent Tool] Agendando retorno do deal ${deal_id} para ${return_date} (${reason})`);

        const pipe = readRecoveryPipelineStore();
        pipe[deal_id] = {
            ...(pipe[deal_id] || {}),
            stage: 'retorno_agendado',
            scheduledReturnDate: return_date,
            returnReason: reason,
            aiAutonomySuspended: false
        };
        writeRecoveryPipelineStore(pipe);

        if (supabase && deal_id) {
            const { data: deal } = await supabase.from('deals').select('user_id').eq('id', deal_id).single();
            if (deal?.user_id) {
                try {
                    await supabase.from('activities').insert({
                        user_id: deal.user_id,
                        deal_id: deal_id,
                        type: 'follow_up',
                        title: `Retorno Agendado pelo SDR para ${return_date}`,
                        notes: `Lead pediu retorno. Motivo: ${reason}`,
                        date: `${return_date}T09:30:00Z`,
                        completed: false
                    });
                } catch (_) {}
            }
        }

        return { success: true, scheduled: true, return_date };
    },

    /**
     * 8. Regista Opt-Out
     */
    async register_opt_out({ deal_id, phone, evidence = '' }) {
        const cleanPhone = normalizePhoneNumber(phone);
        const validDealId = (deal_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deal_id)) ? deal_id : null;
        console.log(`🛑 [Vamuss Agent Tool] Registando Opt-Out para +${cleanPhone}: "${evidence}"`);

        addLocalSuppression({
            deal_id: validDealId,
            telefone_normalizado: cleanPhone,
            motivo: 'OPTOUT_EXPLICITO',
            motivo_bloqueio: 'OPTOUT_EXPLICITO'
        });

        if (supabase) {
            try {
                await supabase.from('sdr_suppression_list').insert({
                    deal_id: validDealId,
                    telefone_normalizado: cleanPhone,
                    motivo_bloqueio: 'OPTOUT_EXPLICITO',
                    origem_bloqueio: 'AGENTE_AUTONOMO',
                    canal_bloqueado: 'TODOS',
                    evidencia: evidence,
                    estado: 'ativo'
                });
            } catch (_) {}
        }

        // Mover deal no Recovery Pipeline para 'nao_reativado' (para sair de 'mensagem_enviada')
        if (validDealId) {
            try {
                const pipe = readRecoveryPipelineStore();
                if (pipe.deals && pipe.deals[validDealId]) {
                    pipe.deals[validDealId].stage = 'nao_reativado';
                    pipe.deals[validDealId].notes = `Opt-Out registado: ${evidence.slice(0, 100)}`;
                    pipe.deals[validDealId].isSuppressed = true;
                    writeRecoveryPipelineStore(pipe);
                    console.log(`📌 [Vamuss Agent Tool] Deal ${validDealId} movido para 'nao_reativado' no Recovery Pipeline.`);
                }
            } catch (_) {}
        }

        return { success: true, suppressed: true };
    },

    /**
     * 9. Alerta Philipe no WhatsApp
     */
    async alert_philipe_on_whatsapp({ summary, clinic_name = '', deal_id = '' }) {
        const text = `🔔 *[Alerta Vamuss Comercial]*\n${summary}\n${clinic_name ? `• Clínica: ${clinic_name}\n` : ''}${deal_id ? `• Deal ID: ${deal_id}\n` : ''}`;
        try {
            await sendWhatsAppWebMessage(OPERATOR_PHONE, text);
            return { success: true };
        } catch (e) {
            console.warn('⚠️ Não foi possível enviar alerta no WhatsApp do Philipe:', e.message);
            return { success: false, error: e.message };
        }
    }
};

/**
 * ============================================================================
 * SYSTEM PROMPT DO AGENTE COMERCIAL VAMUSS
 * ============================================================================
 */

export const VAMUSS_AGENT_SYSTEM_PROMPT = `
És o Agente Comercial Autónomo da Agência Vamuss (Portugal), atuando em nome de Philipe Coelho.

A TUA POSTURA E FILOSOFIA DE VENDAS:
1. SDR: Volume com velocidade, curiosidade genuína e resiliência. Quem tenta vender na primeira mensagem queima o lead. O teu foco é abrir uma conversa qualificada, humana e fluida.
2. CLOSER: Profundidade, escuta ativa, diagnóstico real e condução segura até ao próximo passo. Fechar é consequência de uma boa conversa e diagnóstico, não de truques.

============================================================
1. PAPEL DO SDR: ABRIR A PORTA (REAQUECIMENTO DE LEADS PERDIDOS)
============================================================
O trabalho do SDR é reabrir o diálogo a partir do histórico do CRM, com base no motivo da perda anterior.
- NUNCA vendas na 1ª mensagem: Não fales de serviços da Vamuss, não apresentes propostas, não peças chamadas logo de início.
- NUNCA uses clichês vazios: Proibido "espero que esteja bem", "olá tudo bem" ou textos padronizados de marketing.
- NUNCA desmereças concorrentes: NUNCA ataques equipas ou agências existentes (proibido falar de "apenas likes e seguidores" ou diminuir ninguém).
- NUNCA incluas avisos de opt-out no texto ("se não fizer sentido retiro o contacto"): isso soa a bot de spam e mata a conversa.
- Abertura curta e cirúrgica: 2 a 3 linhas no máximo, citando o contexto real e terminando com UMA pergunta amigável e fácil de responder.

REGRA DE CADÊNCIA E MEMÓRIA DE DIÁLOGO (PROIBIDO SOAR A AMNÉSIA):
- Se enviaste uma mensagem ontem ou anteontem e a clínica ainda não respondeu:
  • É TERMINANTEMENTE PROIBIDO fingir que o contacto de ontem não existiu ou recomeçar com "Há uns meses falámos..." ou "Em março falaram com o Philipe...".
  • Isso faz parecer que a empresa tem amnésia ou que é um robô desgovernado a disparar scripts frios!
  • Se já abordaste a clínica ontem/recentemente (vê o campo 'foi_recente' ou 'horas_atras' nas atividades), só tens duas opções:
    1. Respeitar o tempo da clínica e NÃO enviar nada (deixar a cadência respirar 48h a 72h).
    2. Se for um toque de acompanhamento leve no final da tarde, sê transparente e natural: "Olá! Apenas um breve toque para garantir que a minha mensagem de ontem não se perdeu na correria das consultas aí na clínica..."
- NUNCA trates como "primeira abordagem de março" um lead a quem mandaste mensagem há 24 horas!

DISTINÇÃO CRÍTICA & BLINDAGEM DE NOTAS INTERNAS DO PHILIPE:
- O campo de motivo da perda no CRM frequentemente contém anotações pessoais e confidenciais do Philipe (ex: "já tem agência", "já anunciam", "já tem equipa", "fora de perfil", "grupo grande").
- É TERMINANTEMENTE PROIBIDO CITAR OU CONFESSAR ESSAS NOTAS DIRETAMENTE À CLÍNICA!
  • NUNCA digas: "Vi que já estão a anunciar", "Notei que já têm uma equipa a trabalhar convosco", "Como tem sido a experiência com a vossa agência?".
  • Isso soa a espionagem rasteira e amadora, destrói a confiança e queima o contacto imediatamente!
- O que fazer com essas notas: Usa-as APENAS como inteligência silenciosa para ti.
  • Se a nota diz "já anunciam" ou "já tem agência": Não menciones anúncios nem agências! Fala apenas de previsibilidade de consultas particulares de alto valor (implantes, ortodontia, reabilitação).
  • Apenas citas palavras da clínica se houver uma RESPOSTA FACTUAL escrita pela clínica no histórico (ex: "em março pediram para retomar contacto mais à frente"). Se for anotação do operador, mantém sigilo absoluto!

PROIBIÇÃO DE GANCHOS DE MARKETING AMADOR (SPAM):
- É TERMINANTEMENTE PROIBIDO usar ganchos do tipo:
  • "Vi que não aparecem na primeira página do Google para [x]"
  • "Como têm lidado com a visibilidade online?"
  • "Alguma novidade interessante este ano?"
  • "Como tem sido o movimento de pacientes particulares este ano?" (pergunta vazia e preguiçosa)
- Nenhuma clínica respeitável responde a abordagens genéricas de agência que parecem tiradas de um guião de estagiário de marketing.

EXEMPLOS REAIS DE ABORDAGEM CONSULTIVA E EXECUTIVA (SDR SÉNIOR VAMUSS):
• Se a clínica já tem agência/anúncios (ex: Santa Zita / Machado Capelas):
  "Dra. / Direção da clínica, boa tarde. Falámos há uns meses sobre a atração de pacientes em [Cidade]. Têm sentido este ano consistência no preenchimento de consultas de tratamentos de maior valor (como implantes/reabilitação) ou o fluxo ainda oscila mês a mês?"
• Se a clínica pediu para falar mais tarde / sem interesse na altura (ex: Mediminho):
  "Bom dia à equipa da clínica. Em março falaram com o Philipe e pediram para retomar o contacto mais à frente. Como tem corrido o segundo semestre aí na clínica a nível de primeiras consultas particulares?"
• Se o contacto anterior foi frio / sem resposta:
  "Doutor(a), boa tarde. Tinha-lhe deixado uma breve nota há uns meses que suspeito ter ficado pelo caminho. Mantêm o foco prioritário no preenchimento de consultas particulares de reabilitação/implantes este trimestre?"

SALVAGUARDA DE EX-CLIENTE (NUNCA ABORDAR):
- A clínica Odontoclinic (ou Odontclinic) foi cliente da Vamuss no passado e está terminantemente BLOQUEADA de qualquer abordagem comercial do SDR ou Closer.

LIBERDADE ESTRATÉGICA E REPERTÓRIO DE ABERTURA DO SDR:
És um consultor autónomo e sénior, NÃO um robô a repetir guiões ou templates fixos. Tens total margem estratégica para analisar o contexto do CRM e a pesquisa da clínica para criar uma abordagem ÚNICA, viva e personalizada.

INTELIGÊNCIA DE CADÊNCIA & ANTI-REPETIÇÃO OBRIGATÓRIA (TENTATIVAS SUBSEQUENTES):
- Como SDR de alta performance, tens autonomia para decidir se aguardas ou se fazes nova tentativa noutro dia ou noutro horário (ex: final da tarde vs. manhã) para tentar obter resposta.
- REGRA DE NÃO-REPETIÇÃO:
  • Se a 1ª abordagem foi pelo ângulo da especialidade (ex: implantes), a próxima tentativa DEVE mudar de ângulo (ex: sazonalidade, equipa, ou evolução do ano).
  • É permitido fazer uma "lembrança de silêncio" educada e simpática, mas USA ISTO COM PARCIMÓNIA (no máximo 1 vez e com leveza natural).
  • Exemplo de lembrança educada e elegante: "Olá Dr./Dra., imagino que esteja a correr entre consultas! Só para garantir que não se perdeu na azáfama do dia..." ou "Boa tarde! Imagino que a semana esteja intensa por aí. Quando tiver 1 minuto sem correrias..."
  • NUNCA uses tons de cobrança fria ou robótica ("Viu a minha mensagem?", "Estou a aguardar o seu retorno", etc.).
- LIMITE MÁXIMO DE 3 TENTATIVAS & SUPRESSÃO AUTOMÁTICA:
  • O lead tem no máximo 3 tentativas sem resposta. Ao atingir a 3ª tentativa sem retorno, o sistema SUPRIME o negócio automaticamente para não queimar o contacto e respeitar o momento da clínica. Não gastes energia nem orçamento onde não há recetividade.

ÂNGULOS DE ABERTURA QUE PODES COMBINAR E EXPLORAR LIVREMENTE:
• Ângulo de Continuidade Histórica: Lembrar com simpatia e elegância o contacto anterior, retomando o fio à meada de forma fluida.
• Ângulo de Especialidade / Foco Clínico: Usar factos reais descobertos na pesquisa web (ex.: tratamentos que a clínica promove, como implantes, ortodontia invisível ou reabilitação) e perguntar sobre o movimento de pacientes particulares nessas áreas.
• Ângulo de Acompanhamento de Fornecedor: Se na altura tinham agência ou equipa, perguntar com curiosidade respeitosa se tem corrido tudo bem e se têm alcançado a consistência e os resultados que esperavam.
• Ângulo de Evolução & Sazonalidade: Perguntar como tem corrido este ano, se têm sentido estabilidade no fluxo de primeiras consultas particulares ou oscilação mês a mês.
• Ângulo de Reestruturação: Se no passado faltavam recursos, tempo ou estrutura, perguntar se as coisas agora estão mais desafogadas e organizadas.

DIRETRIZES FUNDAMENTAIS DA MENSAGEM DO SDR (CONCISÃO EXTREMA DE WHATSAPP):
- CONCISÃO CIRÚRGICA (MÁXIMO 2 A 3 LINHAS): No WhatsApp ninguém lê parágrafos compridos entre consultas. NUNCA despejes todo o histórico ou múltiplos temas na mesma mensagem.
- UMA ÚNICA PERGUNTA: É TERMINANTEMENTE PROIBIDO fazer duas perguntas na 1ª mensagem. Escolhe apenas UMA pergunta de baixo atrito para iniciar o diálogo.
- PING-PONG CONVERSACIONAL: A 1ª mensagem serve apenas para reabrir a porta e obter uma primeira resposta (ex: "Sim, sou eu", "Diga", "Tudo bem"). O aprofundamento do problema e os detalhes da clínica vêm DEPOIS que o lead responder!
- PROIBIÇÃO ABSOLUTA DE LINGUAGEM DEFENSIVA OU SUBMISSA:
  NUNCA coloques frases de encerramento do tipo:
  • "ou prefere que não volte a tocar no assunto?"
  • "ou prefere que não volte a incomodar?"
  • "se não fizer sentido retiro o contacto"
  • "ou diga-me e não chateio mais"
  Isso destrói a postura executiva, transmite insegurança e parece desespero comercial.
- A pergunta final deve ser assertiva, curta e de baixo atrito:
  Exemplos reais de alto nível (2 linhas):
  • "Dra. Catarina, boa tarde. Há uns meses enviei uma nota à sua atenção que suspeito ter ficado na receção da CClinic. Ainda é consigo que vejo a direção estratégica da clínica aí em Leiria?"
  • "Olá Dr. Machado! Lembrei-me da nossa conversa anterior sobre a clínica. Como tem corrido este ano por aí?"
- NUNCA vendas serviços da Vamuss na primeira mensagem, NUNCA peças reuniões na 1ª mensagem, NUNCA ataques concorrentes.

============================================================
2. PAPEL DO CLOSER: DIAGNOSTICAR, CONDUZIR E DECIDIR
============================================================
O Closer entra EM CENA APENAS quando a clínica responde à abordagem do SDR.
- ESCUTA ATIVA & INTELIGÊNCIA EMOCIONAL: Falar menos que o cliente. Ler sinais de compra e preocupações não ditas. Quanto melhor for a pergunta de discovery, menos precisas de "convencer".
- DIAGNÓSTICO PROFUNDO (Discovery): Descobre o problema real, o que já tentaram, o custo de não resolver e o impacto no dia a dia da clínica.
- GESTÃO DE DECISOR (Multi-threading): Identifica se falas com a receção/secretária ou com o decisor clínico. Com a receção, sê impecável e pede encaminhamento; com o decisor, fala de rentabilidade e previsibilidade.
- ENQUADRAR EM RETORNO (ROI): Clínicas dentárias pensam em valor de tratamentos (quanto vale um paciente de implantes ou ortodontia para a clínica), nunca em cliques, CPL ou vaidades.
- FRAME CONTROL & CONTORNO DE OBJEÇÕES CIRÚRGICO:
  • Se perguntar preço de imediato ("Quanto custa?"): Nunca atires um número no vazio nem fujas da pergunta. Reposiciona com elegância e firmeza: "Para lhe dar um valor exato sem adivinhar, preciso de 2 minutos para entender o vosso cenário e tratamentos prioritários. Pode ser?"
  • Se disser "vou pensar" ou "falar com o sócio" (Isolamento da verdade): Diferencia a cortina de fumo da objeção real: "Compreendo perfeitamente. Além de alinhar com o seu sócio, há algum ponto da nossa abordagem que não faça sentido para si hoje?"
  • Se disser "está caro": Acolhe e ancora em perda: "Compreendo. Quando diz caro, em relação a quê? Normalmente uma única reabilitação ou implante por mês cobre todo o investimento da estrutura."
  • Se o lead disser que está 100% satisfeito com a equipa atual: Elogia com sinceridade ("Excelente, fico genuinamente contente! Ter estabilidade e consistência na clínica é o mais importante. Desejo-vos a continuação de muito sucesso!") e encerra com elegância.
  • Se disser "Agora não / contacte daqui a uns meses": Usa 'schedule_followup_return'.
  • Se disser que não tem interesse ou pedir para sair: Usa imediatamente 'register_opt_out'.
- CONTROLO DO PRÓXIMO PASSO (Assertividade Equilibrada):
  Quando o lead demonstra abertura, dor ou pergunta "como funciona?", propõe com confiança e naturalidade a Reunião de Diagnóstico de 20 minutos com o link do Cal.com:
  "Para vermos isso com clareza e sem qualquer compromisso, o ideal seria uma breve conversa de diagnóstico de 20 minutos. Pode escolher o horário mais conveniente aqui: https://cal.com/euphilipecoelho-jxauxj/diagostico"

============================================================
CONSTITUIÇÃO COMERCIAL DA VAMUSS (VALOR E OFERTA DEFINITIVA)
============================================================
- O FUNDADOR: Philipe Coelho (empreendedor brasileiro em Portugal, focado em visão de sistema, processos e métricas).
- A OFERTA REAL: Não vendemos anúncios nem posts bonitos. Vendemos infraestrutura e processos de aquisição e conversão de pacientes particulares.
- O VALOR COMERCIAL: 197 € / mês (gestão e assessoria estratégica). O orçamento de anúncios é pago diretamente pela clínica às plataformas (Google/Meta).
- O QUE NUNCA PROMETEMOS:
  • Nunca prometer número fixo de pacientes ou faturação garantida.
  • Nunca prometer primeiras posições milagrosas no Google.
  • Nunca vender pacotes genéricos sem antes diagnosticar a capacidade de atendimento da clínica.
- QUANDO PERGUNTAREM PREÇO:
  "O nosso modelo de acompanhamento e gestão tem um valor base muito acessível de 197 € mensais, além do investimento que a própria clínica decide colocar nas plataformas. Contudo, antes de falar de valores, o essencial é perceber se a clínica tem capacidade e estrutura para receber novos pacientes. Faz sentido?"

============================================================
3. ESTRATÉGIA PARA ATRAVESSAR A RECEÇÃO (ULTRA PASSAR O GATEKEEPER)
============================================================
Em 80% das clínicas dentárias em Portugal, o WhatsApp é atendido pela receção/assistente. 
O papel da receção é filtrar vendedores e proteger o tempo dos médicos. Se tentares vender para a receção, a conversa morre ali!

COMO O SDR / CLOSER DEVE LIDAR COM A RECEÇÃO:
1. NUNCA trates a rececionista com arrogância ou como um mero obstáculo. Trata-a como aliada com extrema educação, simpatia e respeito.
2. Identificação Imediata do Interlocutor:
   • Se a resposta for padrão de clínica ("Olá, boa tarde, Clínica [X], em que posso ajudar?"): estás a falar com a receção.
3. As 3 Técnicas para Encaminhamento Direto ao Decisor:
   • Técnica do Encaminhamento Respeitoso:
     "Boa tarde! Daqui fala o Philipe Coelho. Tinha deixado uma nota à atenção da direção clínica sobre a organização de consultas particulares. Poderia por favor indicar-me qual é o melhor canal ou número direto para lhe fazer chegar uma mensagem breve, ou consegue encaminhar por aí?"
   • Técnica de Não-Venda para a Receção:
     Se a receção perguntar "do que se trata?", NUNCA expliques marketing ou vendas!
     Resposta: "É sobre a previsão de primeiras consultas particulares e organização do semestre que tínhamos alinhado com a direção. Poderia pedir ao responsável de gestão ou direção clínica para dar uma vista de olhos quando tiver 1 minuto?"
   • Técnica de Transparência Sem Pressão:
     "Compreendo perfeitamente que o dia esteja preenchido. Deixo aqui a nota breve para a direção quando for oportuno. Muito obrigado pela atenção e simpatia!"

============================================================
4. MEMÓRIA CUMULATIVA DE ARGUMENTOS (NUNCA ESQUECER O QUE FUNCIONOU)
============================================================
O agente evolui acumulando inteligência, NUNCA substituindo o que já foi validado:
- O histórico de abordagens bem-sucedidas e respostas positivas é sagrado.
- Cada novo aprendizado soma à base de repertório, não anula os fundamentos:
  • Se um ângulo funcionou (ex: perguntar sobre consultas particulares de implantologia gerou 40% de resposta): esse ângulo é mantido como prioritário para clínicas de cirurgia.
  • Se um argumento contornou com sucesso a objeção "já temos agência": esse argumento torna-se a resposta padrão para esse cenário.
  • Se a receção encaminhou quando pedimos o contacto da direção com educação: essa abordagem passa a ser o script oficial de transposição de receção.

DISCIPLINA DE CRM: Se não está registado, não aconteceu. Utiliza sempre as ferramentas disponíveis para atualizar notas, pipeline e atividades.
`;

/**
 * ============================================================================
 * O MOTOR DE RACIOCÍNIO AGÊNTICO (REASONING & TOOL-CALLING LOOP)
 * ============================================================================
 */

export async function runAgentThinkingLoop(messages, maxIterations = 5) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY ausente no ambiente');
    }

    const conversationHistory = [...messages];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (let i = 0; i < maxIterations; i++) {
        console.log(`🤖 [Vamuss Agent Reasoning] Ciclo de raciocínio ${i + 1}/${maxIterations}...`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: conversationHistory,
                tools: AGENT_TOOLS_DEFINITIONS,
                tool_choice: 'auto',
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Erro na API OpenAI (${response.status}): ${errBody}`);
        }

        const data = await response.json();
        if (data.usage) {
            totalPromptTokens += data.usage.prompt_tokens || 0;
            totalCompletionTokens += data.usage.completion_tokens || 0;
        }

        const choice = data.choices[0];
        const assistantMsg = choice.message;

        conversationHistory.push(assistantMsg);

        // Se o agente decidiu chamar ferramentas
        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
            for (const toolCall of assistantMsg.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

                console.log(`🔧 [Vamuss Agent Executing Tool] "${toolName}" com argumentos:`, toolArgs);

                const executor = AgentToolImplementations[toolName];
                let toolResult = null;

                if (typeof executor === 'function') {
                    try {
                        toolResult = await executor(toolArgs);
                    } catch (toolErr) {
                        toolResult = { error: toolErr.message };
                    }
                } else {
                    toolResult = { error: `Ferramenta desconhecida: ${toolName}` };
                }

                conversationHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                });
            }
            // Continua o loop para o modelo reagir aos resultados das ferramentas
            continue;
        }

        // Se o modelo terminou o raciocínio e respondeu em texto
        const costUsd = (totalPromptTokens * 2.50 / 1000000) + (totalCompletionTokens * 10.00 / 1000000);
        console.log(`💰 [Vamuss Agent Cost] Total de tokens: ${totalPromptTokens + totalCompletionTokens} (Prompt: ${totalPromptTokens}, Completion: ${totalCompletionTokens}) -> Custo estimado: $${costUsd.toFixed(4)} USD (~${(costUsd * 0.92).toFixed(4)} €)`);

        return {
            finalResponse: assistantMsg.content,
            history: conversationHistory,
            usage: {
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
                totalTokens: totalPromptTokens + totalCompletionTokens,
                costUsd,
                costEur: costUsd * 0.92
            }
        };
    }

    const costUsd = (totalPromptTokens * 2.50 / 1000000) + (totalCompletionTokens * 10.00 / 1000000);
    return {
        finalResponse: conversationHistory[conversationHistory.length - 1]?.content || 'Concluído.',
        history: conversationHistory,
        usage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: totalPromptTokens + totalCompletionTokens,
            costUsd,
            costEur: costUsd * 0.92
        }
    };
}

/**
 * ============================================================================
 * CICLOS DE ENTRADA AUTÓNOMOS
 * ============================================================================
 */

/**
 * CICLO 1: PROSPEÇÃO ATIVA DE REAQUECIMENTO (Outbound Autónomo)
 * Varre o CRM, seleciona até ao limite do dia (5), lê histórico profundo, pesquisa e dispara abordagem.
 */
export async function runAutonomousOutboundCycle({ force = false, limit = DAILY_OUTBOUND_LIMIT } = {}) {
    console.log('\n============================================================');
    console.log('🚀 [Vamuss Agent] INICIANDO CICLO AUTÓNOMO DE REAQUECIMENTO...');
    console.log('============================================================');

    // 1. Validar se estamos dentro do horário comercial (09h00-17h00 Seg-Sex)
    const timing = validateDispatchTiming();
    if (!timing.permitido && !force) {
        console.log(`⏰ [Vamuss Agent] Fora do horário comercial português (${timing.motivo}).`);
        console.log(`   Próxima janela de execução: ${timing.proxima_janela_util}`);
        return { success: false, reason: 'OUTSIDE_BUSINESS_HOURS', nextWindow: timing.proxima_janela_util };
    }

    // 2. Verificar quota diária já disparada hoje
    const state = readAgentState();
    const todayStr = new Date().toISOString().slice(0, 10);
    const sentToday = state.dailyDispatches[todayStr] || 0;
    const remainingSlots = force ? limit : Math.max(0, limit - sentToday);

    if (remainingSlots <= 0 && !force) {
        console.log(`🛡️ [Vamuss Agent] Limite diário de segurança atingido (${sentToday}/${limit} leads hoje).`);
        return { success: true, reachedLimit: true, sentToday };
    }

    console.log(`📊 [Vamuss Agent] Vagas disponíveis para hoje: ${remainingSlots} novos leads.`);

    // 3. Executar o ciclo do agente
    const prompt = `
És o Agente Comercial Autónomo da Vamuss no teu PAPEL DE SDR (Reaquecimento Humano e Respeitoso).
Por favor:
1. Usa a ferramenta 'scan_crm_lost_deals' com limite ${remainingSlots} para encontrar negócios perdidos elegíveis.
2. Para cada negócio encontrado:
   a) Usa 'fetch_lead_full_dossier' para ler as notas, atividades antigas e o motivo exato da perda.
   b) Usa 'research_clinic_online' para conhecer a clínica.
   c) Elabora uma mensagem de REAQUECIMENTO DE SDR genuína e sob medida:
      - Cordial, viva, autêntica e em Português de Portugal.
      - Tens total margem estratégica para escolher o melhor ângulo de reabertura (continuidade do histórico, especialidade clínica/pesquisa web, evolução do ano, ou curiosidade respeitosa sobre como tem corrido a equipa/estrutura).
      - NUNCA uses templates fixos nem frases engessadas. Cada clínica deve receber uma abordagem única adaptada ao seu perfil.
      - NUNCA fales de serviços da Vamuss, NUNCA peças reuniões nem compromissos na 1ª mensagem, NUNCA critiques a equipa atual ou concorrentes, e NUNCA incluas frases burocráticas de opt-out.
      - Termina com uma única pergunta aberta e amigável que convide com naturalidade à continuidade da conversa.
   d) Usa 'send_whatsapp_message' com intent 'PRIMEIRA_ABORDAGEM' para enviar pelo WhatsApp.
3. Resume no fim o que fizeste para cada lead.
`;

    try {
        const result = await runAgentThinkingLoop([
            { role: 'system', content: VAMUSS_AGENT_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ]);

        console.log('\n============================================================');
        console.log('✅ [Vamuss Agent] CICLO DE REAQUECIMENTO CONCLUÍDO COM SUCESSO:');
        console.log(result.finalResponse);
        console.log('============================================================\n');

        return { success: true, summary: result.finalResponse, usage: result.usage };
    } catch (err) {
        console.error('❌ [Vamuss Agent] Erro fatal no ciclo autónomo:', err.message);
        return { success: false, error: err.message };
    }
}

// Números pessoais permanentemente bloqueados para o agente SDR
const BLOCKED_PERSONAL_PHONES = [
    '351911830205', '911830205',  // Philipe pessoal
];

/**
 * Deteta rigorosamente se a mensagem recebida é uma resposta automática / auto-reply / ausência
 * de WhatsApp Business ou bot de recepção.
 */
import { isClinicAutoReply, AUTO_REPLY_PATTERNS } from './sdr_auto_reply_filter.js';
export { isClinicAutoReply, AUTO_REPLY_PATTERNS };

/**
 * Validação ultrarrápida para o listener do WhatsApp:
 * Retorna true APENAS se o número for de um negócio perdido do CRM que o Agente abordou.
 * 
 * BLINDAGEM REFORÇADA:
 * 1. Números pessoais bloqueados SEMPRE ignorados.
 * 2. Suprimidos → ignorados.
 * 3. Apenas considera OUTBOUND_DISPATCH de negócios com deal_id (não respostas ad hoc).
 * 4. Valida via Supabase que o deal existe com status='lost'.
 */
export async function isEligibleSdrInboundTarget(phone) {
    try {
        const cleanPhone = normalizePhoneNumber(phone);
        const last9 = cleanPhone.slice(-9);
        const spaced9 = `${last9.slice(0,3)} ${last9.slice(3,6)} ${last9.slice(6)}`;

        // BLINDAGEM ABSOLUTA: números pessoais bloqueados nunca passam
        if (BLOCKED_PERSONAL_PHONES.some(b => cleanPhone.endsWith(b.slice(-9)) || b.endsWith(last9))) {
            console.log(`🛡️ [SDR Guard] Número +${cleanPhone} é número pessoal bloqueado. Ignorado.`);
            return false;
        }

        if (isPhoneSuppressedLocally(cleanPhone)) return false;

        // 1. Verificar no pipeline de recuperação (sdr_recovery_pipeline.json)
        // Se o negócio está em 'mensagem_enviada', 'em_conversa' ou qualquer estágio ativo do SDR, É ELEGÍVEL!
        try {
            const pipelineStore = readRecoveryPipelineStore();
            const pipeDeals = Object.values(pipelineStore.deals || {});
            const matchedPipe = pipeDeals.find(d => {
                const p = (d.phone || '').replace(/\D/g, '');
                return p.endsWith(last9);
            });
            if (matchedPipe) {
                console.log(`🎯 [SDR Guard] Número +${cleanPhone} encontrado no SDR Recovery Pipeline (Deal: ${matchedPipe.dealId}, Stage: ${matchedPipe.stage}). Elegível para Closer.`);
                return true;
            }
        } catch (pipeErr) {
            console.warn('⚠️ [SDR Guard] Erro ao consultar pipeline store:', pipeErr.message);
        }

        // 2. Apenas considera OUTBOUND_DISPATCH que TEM deal_id válido (contatos reais do CRM)
        const agentMem = readAgentState();
        const wasContactedLocally = (agentMem.recentActions || []).some(
            a => a.actionType === 'OUTBOUND_DISPATCH' &&
                 a.details?.deal_id &&
                 a.details?.phone &&
                 normalizePhoneNumber(a.details.phone).endsWith(last9)
        );

        if (wasContactedLocally && supabase) {
            const matchingAction = (agentMem.recentActions || []).find(
                a => a.actionType === 'OUTBOUND_DISPATCH' &&
                     a.details?.deal_id &&
                     a.details?.phone &&
                     normalizePhoneNumber(a.details.phone).endsWith(last9)
            );
            if (matchingAction?.details?.deal_id) {
                const { data: d } = await supabase.from('deals').select('id,status').eq('id', matchingAction.details.deal_id).single();
                if (d && d.status === 'lost') return true;
                console.log(`🛡️ [SDR Guard] Deal ${matchingAction.details.deal_id} não é 'lost' (status: ${d?.status}). Ignorado.`);
                return false;
            }
        }

        if (wasContactedLocally) return true;

        // 3. Fallback Supabase (com suporte a formatos com ou sem espaços: '936028384' ou '936 028 384')
        if (supabase) {
            const { data: contacts } = await supabase
                .from('contacts')
                .select('id')
                .or(`phone.ilike.%${last9}%,phone.ilike.%${spaced9}%`);

            if (contacts && contacts.length > 0) {
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id')
                    .eq('contact_id', contacts[0].id)
                    .eq('status', 'lost')
                    .limit(1);

                if (deals && deals.length > 0) {
                    const { data: acts } = await supabase
                        .from('activities')
                        .select('id')
                        .eq('deal_id', deals[0].id)
                        .or('title.ilike.%SDR Autónomo%,title.ilike.%WhatsApp%')
                        .limit(1);

                    if (acts && acts.length > 0) return true;
                }
            }
        }
        return false;
    } catch (_) {
        return false;
    }
}

/**
 * CICLO 2: TRATAMENTO DE RESPOSTA DO LEAD (Inbound Closer)
 * Chamado quando qualquer clínica responde no WhatsApp (texto ou áudio transcrito).
 */
export async function processInboundLeadTurn({ phone, text, isAudio = false }) {
    const cleanPhone = normalizePhoneNumber(phone);
    console.log(`\n📥 [Vamuss Agent Closer] Processando resposta inbound de +${cleanPhone}: "${text}" (Áudio: ${isAudio})`);

    // 0. BLINDAGEM ABSOLUTA: Números pessoais nunca são processados
    if (BLOCKED_PERSONAL_PHONES.some(b => cleanPhone.endsWith(b.slice(-9)))) {
        console.log(`🛡️ [Vamuss Agent Closer] +${cleanPhone} é número pessoal bloqueado. Ignorado absolutamente.`);
        return { success: false, ignored: true, reason: 'PERSONAL_PHONE_BLOCKED' };
    }

    // 0.2 TRAVA RÍGIDA DE RESPOSTA AUTOMÁTICA / AUTO-REPLY DE CLÍNICA:
    // Se a mensagem for um texto automático de boas-vindas / ausência do WhatsApp Business da clínica,
    // o agente NUNCA deve responder, nem continuar a conversa, nem enviar pedidos repetitivos.
    // O agente DEVE SILENCIAR E AGUARDAR que uma pessoa real responda à primeira abordagem!
    if (isClinicAutoReply(text)) {
        console.log(`🤖 [Vamuss Agent Closer] Resposta automática de WhatsApp Business detetada de +${cleanPhone}: "${text.slice(0, 60)}...".`);
        console.log(`🤫 [Vamuss Agent Closer] SILENCIANDO: O agente não responde a bots/mensagens automáticas. Aguardando contacto de operador humano.`);
        return { success: true, ignored: true, isAutoReply: true, reason: 'CLINIC_AUTO_REPLY_SILENCED' };
    }

    // Procurar o deal correspondente no CRM
    let dealId = null;
    let clinicName = 'Dra./Dr.';
    const last9 = cleanPhone.slice(-9);
    const spaced9 = `${last9.slice(0,3)} ${last9.slice(3,6)} ${last9.slice(6)}`;

    // 0.1 Verificar primeiro no Recovery Pipeline local
    try {
        const pipelineStore = readRecoveryPipelineStore();
        const pipeDeals = Object.values(pipelineStore.deals || {});
        const matchedPipe = pipeDeals.find(d => {
            const p = (d.phone || '').replace(/\D/g, '');
            return p.endsWith(last9);
        });
        if (matchedPipe) {
            dealId = matchedPipe.dealId;
            clinicName = matchedPipe.contactName || matchedPipe.title?.replace(/^Negócio\s+/i, '') || 'Dra./Dr.';
            console.log(`🎯 [Vamuss Agent Closer] Identificado via Recovery Pipeline: Deal ${dealId} (${clinicName})`);
        }
    } catch (_) {}

    if (supabase && !dealId) {
        const { data: contacts } = await supabase
            .from('contacts')
            .select('id, name')
            .or(`phone.ilike.%${last9}%,phone.ilike.%${spaced9}%`);

        if (contacts && contacts.length > 0) {
            clinicName = contacts[0].name;
            const { data: deals } = await supabase
                .from('deals')
                .select('id')
                .eq('contact_id', contacts[0].id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (deals && deals.length > 0) {
                dealId = deals[0].id;
            }
        }
    }

    // 1. Blindagem Pessoal: Se o número NÃO existe no CRM de Clínicas, é um contacto pessoal do Philipe. IGNORAR!
    if (!dealId) {
        console.log(`🛡️ [Vamuss Agent Closer] Número +${cleanPhone} não pertence a nenhum negócio do CRM. Mensagem pessoal ignorada com sucesso.`);
        return { success: false, ignored: true, reason: 'PERSONAL_OR_NON_CRM_CONTACT' };
    }

    // 2. Salvaguarda de Supressão: Se já pediu Opt-Out ou foi suprimido, não responder!
    if (isPhoneSuppressedLocally(cleanPhone, dealId)) {
        console.log(`🛑 [Vamuss Agent Closer] Número +${cleanPhone} está na lista de supressão. Nenhuma resposta será enviada.`);
        return { success: false, suppressed: true, reason: 'LEAD_IS_SUPPRESSED' };
    }

    // 3. Trava Estrita do Philipe: Apenas responder a negócios PERDIDOS do CRM
    let dealData = null;
    if (supabase && dealId) {
        const { data: d } = await supabase.from('deals').select('id, status, title').eq('id', dealId).single();
        dealData = d;
    }

    if (dealData && dealData.status !== 'lost') {
        console.log(`🛡️ [Vamuss Agent Closer] Negócio "${dealData.title}" não é um negócio perdido (Status: ${dealData.status}). Mensagem ignorada.`);
        return { success: false, ignored: true, reason: 'NOT_A_LOST_DEAL' };
    }

    // 4. Trava de Iniciativa do Agente: Só responder se o PRÓPRIO agente/sistema enviou mensagem prévia para este número/deal
    let wasContactedLocally = false;
    try {
        const pipelineStore = readRecoveryPipelineStore();
        const pipeDeals = Object.values(pipelineStore.deals || {});
        wasContactedLocally = pipeDeals.some(d => {
            const p = (d.phone || '').replace(/\D/g, '');
            return (p.endsWith(last9) || d.dealId === dealId) && (d.stage === 'mensagem_enviada' || d.stage === 'em_conversa');
        });
    } catch (_) {}

    if (!wasContactedLocally) {
        const agentMem = readAgentState();
        wasContactedLocally = (agentMem.recentActions || []).some(
            a => a.actionType === 'OUTBOUND_DISPATCH' &&
                 (a.details?.deal_id === dealId || (a.details?.phone && normalizePhoneNumber(a.details.phone).endsWith(last9)))
        );
    }

    let wasContactedInDb = false;
    if (supabase && dealId) {
        const { data: sdrActs } = await supabase
            .from('activities')
            .select('id')
            .eq('deal_id', dealId)
            .or('title.ilike.%SDR Autónomo%,title.ilike.%WhatsApp%')
            .limit(1);

        if (sdrActs && sdrActs.length > 0) {
            wasContactedInDb = true;
        }
    }

    if (!wasContactedLocally && !wasContactedInDb) {
        console.log(`🛡️ [Vamuss Agent Closer] O número +${cleanPhone} pertence ao CRM mas o Agente Comercial NÃO entrou em contacto com ele previamente. Mensagem ignorada.`);
        return { success: false, ignored: true, reason: 'NOT_CONTACTED_BY_AGENT' };
    }

    const prompt = `
A clínica "${clinicName}" (+${cleanPhone}) acabou de responder no WhatsApp:
"${text}"
(Aviso: esta mensagem veio de ${isAudio ? 'um áudio transcrito' : 'texto'}).
${dealId ? `Deal ID no CRM: ${dealId}` : 'Nota: não encontramos dealID no CRM diretamente pelo número.'}

ATENÇÃO CRÍTICA AO CONTEXTO DA RESPOSTA:
1. SE A RESPOSTA FOR UM TEXTO AUTOMÁTICO DE BOAS-VINDAS DA CLÍNICA OU SAUDAÇÃO DA RECEÇÃO:
   Exemplos: "Obrigado por nos contactar! Estamos à sua disposição", "Olá! Em que podemos ajudar?", "Mensagem automática da Clínica".
   - NUNCA respondas fingindo que a receção respondeu à tua pergunta sobre tratamentos!
   - NUNCA digas: "Estava a lembrar-me da nossa última conversa sobre a previsibilidade..." nem repitas a mesma pergunta que acabaste de fazer! Isso parece um robô desajustado em loop!
   - COMO AGIR: Agradece a atenção e pede gentilmente o encaminhamento da mensagem ao responsável ou diretor clínico:
     "Obrigado pela rápida atenção! Tinha deixado a mensagem acima para a direção da clínica sobre a organização de consultas particulares. Conseguem por favor encaminhar ao responsável ou indicar-me o contacto direto?"
2. Se a mensagem for recusa/opt-out, usa imediatamente 'register_opt_out'.
3. Se tiver deal_id, usa 'update_spin_state' para registar a qualificação e verificar a maturidade SPIN.
4. Se o lead pedir para falar mais tarde ou numa data específica, usa 'schedule_followup_return'.
5. Se o lead já estiver pronto ou expressar interesse em ver como funciona, usa 'send_calcom_booking_link'.
6. Se o lead for uma pessoa real a responder à pergunta ou com uma objeção, formula uma resposta consultiva em pt-PT (curta, empática, tratando a objeção com foco em consultas particulares de alto valor) e usa 'send_whatsapp_message' com intent 'RESPOSTA_SPIN'.
`;

    try {
        const result = await runAgentThinkingLoop([
            { role: 'system', content: VAMUSS_AGENT_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ]);

        recordAgentAction('INBOUND_REPLY', {
            phone: cleanPhone,
            clinicName,
            textSnippet: text.slice(0, 60),
            agentResolution: result.finalResponse?.slice(0, 100)
        });

        return { success: true, resolution: result.finalResponse };
    } catch (err) {
        console.error('❌ [Vamuss Agent Closer] Erro ao processar resposta:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * ============================================================================
 * ROTAS HTTP PARA CONTROLO E MONITORIZAÇÃO DO AGENTE
 * ============================================================================
 */
export function setupCommercialAgentRoutes(app) {
    // 1. Estado de memória e métricas do Agente
    app.get('/api/sdr/agent/status', (req, res) => {
        try {
            const state = readAgentState();
            const waStatus = getWhatsAppWebStatus();
            const timing = validateDispatchTiming();
            return res.json({
                success: true,
                status: 'ONLINE',
                operator: { name: OPERATOR_NAME, phone: OPERATOR_PHONE },
                whatsappWebStatus: waStatus.status,
                isWithinBusinessHours: timing.permitido,
                nextBusinessWindow: timing.proxima_janela_util,
                memory: state
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    // 2. Disparo do ciclo autónomo sob demanda
    app.post('/api/sdr/agent/run', async (req, res) => {
        try {
            const force = req.body?.force === true;
            const limit = parseInt(req.body?.limit || `${DAILY_OUTBOUND_LIMIT}`, 10);
            const result = await runAutonomousOutboundCycle({ force, limit });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    // 3. Simulação ou encaminhamento de resposta inbound de teste
    app.post('/api/sdr/agent/reply', async (req, res) => {
        try {
            const { phone, text, isAudio } = req.body;
            if (!phone || !text) {
                return res.status(400).json({ error: 'phone e text são obrigatórios' });
            }
            const result = await processInboundLeadTurn({ phone, text, isAudio: Boolean(isAudio) });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    // 4. Endpoints do Squad Comercial (Chefão, Gerente de Operações e Ghosting Buster)
    app.get('/api/sdr/squad/audit', async (req, res) => {
        try {
            const { auditDailyPerformance } = await import('./squad/boss_agent.js');
            const result = await auditDailyPerformance(req.query.date || new Date());
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/sdr/squad/daily-report', async (req, res) => {
        try {
            const { generateExecutiveReportForPhilipe } = await import('./squad/boss_agent.js');
            const report = await generateExecutiveReportForPhilipe(req.query.date || new Date());
            return res.type('text/markdown').send(report);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/sdr/squad/waves', async (req, res) => {
        try {
            const { getOpenDealsByPriorityWaves } = await import('./squad/operations_manager.js');
            const result = await getOpenDealsByPriorityWaves();
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    // 5. Caça de Novas Skills no GitHub pelo Jarvis
    app.post('/api/sdr/squad/jarvis/hunt', async (req, res) => {
        try {
            const { runJarvisSkillHuntingMission } = await import('./squad/jarvis_github_skill_hunter.js');
            const topic = req.body?.topic || 'b2b sales outbound skills';
            const result = await runJarvisSkillHuntingMission(topic);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/sdr/squad/jarvis/skills', async (req, res) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const skillsDir = path.resolve(process.cwd(), '.agent', 'skills');
            const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
            return res.json({ success: true, count: dirs.length, skills: dirs });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });
}

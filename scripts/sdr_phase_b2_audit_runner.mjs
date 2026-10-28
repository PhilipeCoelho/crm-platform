import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import {
    normalizePhone,
    normalizeEmail,
    createSuppressionRecord,
    checkSuppression,
    deduplicateSuppressionList
} from './sdr_suppression_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env.local') });
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SIMULATION_F3_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json');
const TRIAGE_B1_FILE = path.join(ROOT_DIR, 'data', 'sdr_suppression_historical_triage_405.json');
const OUTPUT_AUDIT_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');

function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Classificador Corretivo Canónico da Fase B.2
 * Aplica regras determinísticas refinadas sobre o dossiê comercial completo
 */
export function classifyDealPhaseB2(deal, activities = [], logs = []) {
    const rawLostReason = deal.lost_reason || '';
    const normReason = normalizeText(rawLostReason);
    const normTitle = normalizeText(deal.title || '');

    // Agregação de textos factuais de notas e logs
    const activitiesNotes = activities
        .map(a => a.notes || '')
        .filter(Boolean)
        .join(' ');
    const logsContent = logs
        .map(l => l.content || '')
        .filter(Boolean)
        .join(' ');

    const combinedAll = normalizeText(`${rawLostReason} ${deal.title || ''} ${activitiesNotes} ${logsContent}`);
    const rawAll = `${rawLostReason} | ${activitiesNotes} | ${logsContent}`.trim();

    // -------------------------------------------------------------------------
    // 1. OPTOUT_EXPLICITO (Direito de oposição legal formal)
    // -------------------------------------------------------------------------
    const isExplicitOptout = 
        combinedAll.includes('nao voltem a contactar') ||
        combinedAll.includes('nao ligar mais') ||
        combinedAll.includes('retirar da lista') ||
        combinedAll.includes('remover da lista') ||
        combinedAll.includes('fazer queixa') ||
        combinedAll.includes('processo judicial') ||
        combinedAll.includes('bloquear contacto');

    if (isExplicitOptout) {
        return {
            categoria_b2: 'OPTOUT_EXPLICITO',
            subcategoria: 'oposicao_legal_formal',
            evidencia: rawLostReason || rawAll,
            bloqueio_sugerido: 'TODOS',
            acao_comercial: 'bloqueio_legal_permanente',
            elegivel_reativacao: false,
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 2. RECUSA_COMERCIAL_DIRETA (Recusa expressa do serviço/proposta)
    // -------------------------------------------------------------------------
    const isExplicitRefusal = 
        normReason.includes('nao teve interesse') ||
        normReason.includes('nao tem interesse') ||
        normReason.includes('nao estamos interessados') ||
        normReason.includes('nao temos interesse') ||
        normReason.includes('sem interesse') ||
        normReason.includes('nao ha interesse') ||
        normReason.includes('dispensamos') ||
        normReason.includes('nao estamos a necessitar de servicos') ||
        normReason.includes('nao sera necessario falar com a pessoa responsavel') ||
        normReason.includes('nao temos interesse em saber mais') ||
        normReason.includes('nao temos interesse em avancar') ||
        combinedAll.includes('nao temos interesse em avancar com este tipo de servico') ||
        combinedAll.includes('nao sera necessario falar com a pessoa responsavel');

    // Casos especiais que continham "não teve interesse" mas eram outra coisa:
    const isActuallyProposalSilence = 
        normReason.includes('depois que recebeu a prosposta parou de responder') ||
        normReason.includes('parou de responder') && normReason.includes('prosposta');

    const isActuallyGatekeeperIssue = 
        normReason.includes('cansada de ligac') && normReason.includes('secretaria');

    const isActuallyMigration = 
        normReason.includes('migracao') || normReason.includes('melhor momento');

    if (isActuallyProposalSilence) {
        return {
            categoria_b2: 'SILENCIO_APOS_PROPOSTA',
            subcategoria: 'silencio_com_proposta_entregue',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'follow_up_consultivo_de_proposta',
            elegivel_reativacao: true,
            revisao_humana: false
        };
    }

    if (isActuallyGatekeeperIssue) {
        return {
            categoria_b2: 'AMBIGUO_OU_GATEKEEPER',
            subcategoria: 'atrito_secretaria_sem_acesso_decisor',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'revisao_humana_estrategia_canal_direto',
            elegivel_reativacao: false,
            revisao_humana: true
        };
    }

    if (isActuallyMigration) {
        return {
            categoria_b2: 'CONTINGENCIA_OU_ADIAMENTO',
            subcategoria: 'migracao_operacional',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'agendar_reavaliacao_apos_migracao',
            elegivel_reativacao: false,
            revisao_humana: false
        };
    }

    // Se é recusa pura sem os casos acima
    if (isExplicitRefusal && !normReason.includes('ja tem agencia') && !normReason.includes('ja anuncia') && !normReason.includes('ja temos nossa equipe')) {
        return {
            categoria_b2: 'RECUSA_COMERCIAL_DIRETA',
            subcategoria: 'declaracao_expressa_desinteresse',
            evidencia: rawLostReason,
            bloqueio_sugerido: 'TODOS',
            acao_comercial: 'bloqueio_comercial_permanente',
            elegivel_reativacao: false,
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 3. RESTRICAO_CANAL (Pedido expresso para não usar WhatsApp / usar e-mail)
    // -------------------------------------------------------------------------
    const isChannelRestriction = 
        combinedAll.includes('canal de atendimento medico') ||
        combinedAll.includes('apenas para marcacoes') ||
        combinedAll.includes('mandar email aos cuidados') ||
        combinedAll.includes('enviar a informacao para o nosso email') ||
        combinedAll.includes('podera enviar email para') ||
        combinedAll.includes('o whatsapp nao e o nosso meio de contacto habitual') ||
        combinedAll.includes('pedimos que nos ligue para') ||
        combinedAll.includes('sara enviar proposta por email');

    if (isChannelRestriction) {
        return {
            categoria_b2: 'RESTRICAO_CANAL',
            subcategoria: 'canal_medico_ou_exclusividade_email_telefone',
            evidencia: rawLostReason || rawAll,
            bloqueio_sugerido: 'WHATSAPP',
            canal_autorizado: 'EMAIL',
            acao_comercial: 'bloquear_whatsapp_avaliar_email_manual',
            elegivel_reativacao: false, // não elegível para disparo automático de WhatsApp
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 4. JA_TEM_AGENCIA_OU_ANUNCIA (Fornecedor ativo / Anúncios ativos)
    // -------------------------------------------------------------------------
    const hasAgencyOrAds = 
        normReason.includes('ja tem agencia') ||
        normReason.includes('ja temos agencia') ||
        normReason.includes('ja temos uma equipe de marketing') ||
        normReason.includes('ja temos nossa equipe de marketing') ||
        normReason.includes('ja temos quem trate') ||
        normReason.includes('ja tem quem faz') ||
        normReason.includes('ja temos uma empresa') ||
        normReason.includes('ja trabalhamos com uma equipa') ||
        normReason.includes('ja tem alguem que cuida do marketing') ||
        normReason.includes('ja tem gestor de redes') ||
        normReason.includes('ja anuncia') ||
        normReason.includes('ja anunciam') ||
        normReason.includes('ja estao anunciando') ||
        normReason.includes('ja tem ads ativos') ||
        normReason.includes('tags de pixel') ||
        normReason.includes('anuncios activos') ||
        normReason.includes('biblioteca de anuncios confirmada');

    if (hasAgencyOrAds) {
        return {
            categoria_b2: 'JA_TEM_AGENCIA_OU_ANUNCIA',
            subcategoria: 'fornecedor_ou_anuncios_ativos',
            evidencia: rawLostReason,
            bloqueio_sugerido: null, // NÃO É SUPRESSÃO PERMANENTE!
            acao_comercial: 'quarentena_benchmark_3_a_6_meses',
            elegivel_reativacao: false, // Não reativar de imediato, aguardar janela
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 5. CONTINGENCIA_OU_ADIAMENTO (Equipa completa / Encaminhado / Em obras)
    // -------------------------------------------------------------------------
    const isContingencyOrPostpone = 
        combinedAll.includes('equipa completa') ||
        combinedAll.includes('em obras') ||
        combinedAll.includes('enviamos a pessoa responsavel') ||
        combinedAll.includes('se houver interesse irao contacta');

    if (isContingencyOrPostpone) {
        return {
            categoria_b2: 'CONTINGENCIA_OU_ADIAMENTO',
            subcategoria: 'capacidade_ou_encaminhamento',
            evidencia: rawLostReason || rawAll,
            bloqueio_sugerido: null,
            acao_comercial: 'agendar_reavaliacao_futura',
            elegivel_reativacao: false,
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 6. DESQUALIFICADO_INCOMPATIVEL (Incompatibilidade técnica / Porte / Fechado)
    // -------------------------------------------------------------------------
    const isDisqualifiedProfile = 
        normReason.includes('fechou permanentemente') ||
        normReason.includes('clinica inexistente') ||
        normReason.includes('grande grupo') ||
        normReason.includes('grupo medis') ||
        normReason.includes('medis') ||
        normReason.includes('grupo muito grande') ||
        normReason.includes('empresa inglesa') ||
        normReason.includes('centro tecnico uma escola') ||
        normReason.includes('clinica medica nao dentaria') ||
        normReason.includes('outra especialidade') ||
        normReason.includes('clinica generalista') ||
        normReason.includes('clinica geral') ||
        normReason.includes('sem presenca digital') ||
        normReason.includes('sem redes sociais') ||
        normReason.includes('perfil pessoal') ||
        normReason.includes('apenas perfil pessoal') ||
        normReason.includes('nao tem nem redes sociais') ||
        normReason.includes('nao existe rede social') ||
        normReason.includes('presenca digital muito fraca') ||
        normReason.includes('redes sociais de 2024') ||
        normReason.includes('presenca digital de 2023') ||
        normReason.includes('ultimo post de') ||
        normReason.includes('fora de perfil') ||
        normReason.includes('fora do perfil') ||
        normReason.includes('nao e o perfil') ||
        normReason.includes('clinica de saude geral fora do perfil') ||
        (normReason === 'desqualificado' && combinedAll.includes('sem redes')) ||
        (normReason === 'desqualificado' && combinedAll.includes('presenca digital'));

    if (isDisqualifiedProfile) {
        let subcat = 'fora_de_perfil';
        if (normReason.includes('fechou') || normReason.includes('inexistente')) subcat = 'fechada_ou_inexistente';
        else if (normReason.includes('grupo') || normReason.includes('medis')) subcat = 'grande_grupo_corporativo';
        else if (normReason.includes('sem presenca') || normReason.includes('sem rede') || normReason.includes('post de')) subcat = 'imaturidade_digital';
        else if (normReason.includes('escola') || normReason.includes('medica') || normReason.includes('generalista')) subcat = 'especialidade_incompativel';

        return {
            categoria_b2: 'DESQUALIFICADO_INCOMPATIVEL',
            subcategoria: subcat,
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'arquivamento_definitivo_sem_abordagem',
            elegivel_reativacao: false,
            revisao_humana: false
        };
    }

    // Desqualificação genérica sem detalhes
    if (normReason === 'desqualificado' || normReason === 'desqualificado') {
        return {
            categoria_b2: 'DESQUALIFICADO_INCOMPATIVEL',
            subcategoria: 'desqualificado_generico_crm',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'arquivamento_desqualificacao_crm',
            elegivel_reativacao: false,
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 7. PROBLEMAS TECNICOS / INATINGIVEL
    // -------------------------------------------------------------------------
    const isUnreachable = 
        normReason.includes('ligacao so da caixa postal') ||
        normReason.includes('nao chama o discador') ||
        normReason.includes('sem whatsapp') ||
        normReason.includes('clinica sem whatsapp para contato') ||
        normReason.includes('teste');

    if (isUnreachable) {
        return {
            categoria_b2: 'INATINGIVEL_TECNICO',
            subcategoria: 'falha_canal_ou_numero_invalido',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'revisao_cadastral_telefone',
            elegivel_reativacao: false,
            revisao_humana: true
        };
    }

    // -------------------------------------------------------------------------
    // 8. RESPOSTA AUTOMATICA PURA
    // -------------------------------------------------------------------------
    const isAutoReplyOnly = 
        normReason.includes('so mensagem automatica sem resposta humana') ||
        normReason.includes('teve um resposta automatica e sumiu') ||
        normReason.includes('atendimento eletronico') ||
        normReason.includes('mensagem automatica');

    if (isAutoReplyOnly) {
        return {
            categoria_b2: 'RESPOSTA_AUTOMATICA',
            subcategoria: 'auto_reply_sem_retorno_humano',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'nova_tentativa_horario_comercial',
            elegivel_reativacao: true,
            revisao_humana: false
        };
    }

    // -------------------------------------------------------------------------
    // 9. CASOS AMBIGUOS
    // -------------------------------------------------------------------------
    const isAmbiguous = 
        normReason.includes('duvido muito') ||
        normReason.includes('ficou de retornar') ||
        normReason.includes('respondeu contato e apagou a mensagem') ||
        normReason.includes('so ficou enrola');

    if (isAmbiguous) {
        return {
            categoria_b2: 'AMBIGUO_OU_GATEKEEPER',
            subcategoria: 'contexto_dubio',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'revisao_humana_obrigatoria',
            elegivel_reativacao: false,
            revisao_humana: true
        };
    }

    // -------------------------------------------------------------------------
    // 10. HISTORICO INCOMPLETO / SEM EVIDENCIA
    // -------------------------------------------------------------------------
    if (!rawLostReason || rawLostReason.trim() === '' || rawLostReason.includes('(sem motivo')) {
        return {
            categoria_b2: 'HISTORICO_INCOMPLETO_SEM_EVIDENCIA',
            subcategoria: 'sem_dados_crm',
            evidencia: '(sem motivo registrado no CRM)',
            bloqueio_sugerido: null,
            acao_comercial: 'revisao_manual_dados',
            elegivel_reativacao: false,
            revisao_humana: true
        };
    }

    // -------------------------------------------------------------------------
    // 11. SILENCIO_CONFIRMADO (Tentativas sem resposta com perfil apto)
    // -------------------------------------------------------------------------
    const isSilence = 
        normReason.includes('nao respondeu') ||
        normReason.includes('nao responde') ||
        normReason.includes('sem resposta') ||
        normReason.includes('nunca respondeu') ||
        normReason.includes('nao obtive resposta') ||
        normReason.includes('parou de responder') ||
        normReason.includes('nao atende');

    if (isSilence) {
        return {
            categoria_b2: 'SILENCIO_CONFIRMADO',
            subcategoria: 'abordagem_sem_resposta',
            evidencia: rawLostReason,
            bloqueio_sugerido: null,
            acao_comercial: 'reativacao_respeitosa_angulo_novo',
            elegivel_reativacao: true,
            revisao_humana: false
        };
    }

    // Fallback defensivo: Qualquer outro caso não mapeado vai para Revisão Humana
    return {
        categoria_b2: 'AMBIGUO_OU_GATEKEEPER',
        subcategoria: 'caso_nao_padronizado',
        evidencia: rawLostReason,
        bloqueio_sugerido: null,
        acao_comercial: 'revisao_humana_obrigatoria',
        elegivel_reativacao: false,
        revisao_humana: true
    };
}

/**
 * Executa a auditoria completa da Fase B.2
 */
export async function runPhaseB2Audit() {
    console.log('🔍 Executando VAMUSS SDR — FASE B.2: Auditoria Corretiva Pré-Produção...');

    // 1. Carregar os 405 negócios do Supabase com contatos
    console.log('📥 Lendo 405 negócios perdidos e respetivos contactos...');
    const { data: deals, error: dealsErr } = await sb
        .from('deals')
        .select('id, title, status, lost_reason, lost_at, created_at, stage_id, contact_id, contacts(id, name, email, phone)')
        .eq('status', 'lost')
        .order('created_at', { ascending: true });

    if (dealsErr) {
        throw new Error(`Erro ao buscar dados no Supabase: ${dealsErr.message}`);
    }

    console.log(`✅ ${deals.length} negócios perdidos carregados com sucesso.`);

    // 2. Carregar a classificação anterior (Fase B.1) para auditoria diferencial
    let previousTriageMap = new Map();
    if (fs.existsSync(TRIAGE_B1_FILE)) {
        const b1Data = JSON.parse(fs.readFileSync(TRIAGE_B1_FILE, 'utf8'));
        (b1Data.resultados_completos || []).forEach(r => {
            previousTriageMap.set(r.identificacao.deal_id, r.classificacao_seguranca.categoria);
        });
        console.log(`📊 Classificação anterior da Fase B.1 carregada (${previousTriageMap.size} registos).`);
    }

    // 3. Mapear Identidades e Cruzamento de Telefones / E-mails
    const phoneToDeals = new Map();
    const emailToDeals = new Map();

    deals.forEach(d => {
        const p = normalizePhone(d.contacts?.phone);
        const e = normalizeEmail(d.contacts?.email);
        if (p) {
            if (!phoneToDeals.has(p)) phoneToDeals.set(p, []);
            phoneToDeals.get(p).push(d.id);
        }
        if (e) {
            if (!emailToDeals.has(e)) emailToDeals.set(e, []);
            emailToDeals.get(e).push(d.id);
        }
    });

    // 4. Executar Reclassificação Corretiva
    const auditResults = [];
    const statsB2 = {
        total_analisado: deals.length,
        distribuicao_b2: {},
        comparacao_com_b1: {
            mantidos: 0,
            alterados: 0,
            detalhe_transicoes: {}
        },
        supressao_estrita_proposta: 0,
        quarentena_comercial_proposta: 0,
        elegiveis_reativacao_imediata: 0,
        revisao_humana_obrigatoria: 0,
        arquivados_desqualificacao: 0
    };

    const proposedSuppressionListB2 = [];

    for (const deal of deals) {
        const prevCat = previousTriageMap.get(deal.id) || 'NAO_CLASSIFICADO';
        const revised = classifyDealPhaseB2(deal);

        statsB2.distribuicao_b2[revised.categoria_b2] = (statsB2.distribuicao_b2[revised.categoria_b2] || 0) + 1;

        // Análise de transição
        if (prevCat === revised.categoria_b2) {
            statsB2.comparacao_com_b1.mantidos++;
        } else {
            statsB2.comparacao_com_b1.alterados++;
            const transKey = `${prevCat} -> ${revised.categoria_b2}`;
            statsB2.comparacao_com_b1.detalhe_transicoes[transKey] = (statsB2.comparacao_com_b1.detalhe_transicoes[transKey] || 0) + 1;
        }

        // Estatísticas agregadas de decisão de negócio
        if (revised.bloqueio_sugerido) {
            statsB2.supressao_estrita_proposta++;
        }
        if (revised.categoria_b2 === 'JA_TEM_AGENCIA_OU_ANUNCIA') {
            statsB2.quarentena_comercial_proposta++;
        }
        if (revised.elegivel_reativacao) {
            statsB2.elegiveis_reativacao_imediata++;
        }
        if (revised.revisao_humana) {
            statsB2.revisao_humana_obrigatoria++;
        }
        if (revised.categoria_b2 === 'DESQUALIFICADO_INCOMPATIVEL') {
            statsB2.arquivados_desqualificacao++;
        }

        const normPhone = normalizePhone(deal.contacts?.phone);
        const normEmail = normalizeEmail(deal.contacts?.email);

        const sharedWithOtherDeals = {
            mesmo_telefone: normPhone && phoneToDeals.get(normPhone)?.length > 1,
            deals_com_mesmo_telefone: normPhone ? phoneToDeals.get(normPhone).filter(id => id !== deal.id) : [],
            mesmo_email: normEmail && emailToDeals.get(normEmail)?.length > 1,
            deals_com_mesmo_email: normEmail ? emailToDeals.get(normEmail).filter(id => id !== deal.id) : []
        };

        const itemResult = {
            deal_id: deal.id,
            nome_clinica: deal.title,
            motivo_perda_original: deal.lost_reason || '(sem motivo)',
            contacto: {
                contact_id: deal.contact_id,
                nome: deal.contacts?.name || null,
                telefone_normalizado: normPhone,
                email_normalizado: normEmail,
                partilhas_e_duplicados: sharedWithOtherDeals
            },
            auditoria_classificacao: {
                fase_b1_anterior: prevCat,
                fase_b2_revisada: revised.categoria_b2,
                subcategoria: revised.subcategoria,
                alterou_classificacao: prevCat !== revised.categoria_b2,
                evidencia_factual: revised.evidencia,
                bloqueio_sugerido: revised.bloqueio_sugerido,
                canal_autorizado: revised.canal_autorizado || null,
                acao_comercial: revised.acao_comercial,
                elegivel_reativacao_imediata: revised.elegivel_reativacao,
                revisao_humana_obrigatoria: revised.revisao_humana
            }
        };

        auditResults.push(itemResult);

        // Se requer bloqueio estrito (OPTOUT, RECUSA ou RESTRICAO_CANAL)
        if (revised.bloqueio_sugerido) {
            proposedSuppressionListB2.push(createSuppressionRecord({
                deal_id: deal.id,
                contact_id: deal.contact_id,
                telefone: normPhone,
                email: normEmail,
                motivo_bloqueio: revised.categoria_b2 === 'RECUSA_COMERCIAL_DIRETA' ? 'RECUSA_COMERCIAL' : revised.categoria_b2,
                origem_bloqueio: 'HISTORICO_CRM',
                canal_bloqueado: revised.bloqueio_sugerido,
                evidencia: `[Auditoria B.2] ${revised.evidencia}`.slice(0, 500),
                estado: 'ativo'
            }));
        }
    }

    // 5. Auditar Conflitos de Oposição Transversal (Se um telefone partilhado tem bloqueio)
    const blockedPhonesMap = new Map();
    const blockedEmailsMap = new Map();

    proposedSuppressionListB2.forEach(sup => {
        if (sup.telefone_normalizado) {
            blockedPhonesMap.set(sup.telefone_normalizado, sup);
        }
        if (sup.email_normalizado) {
            blockedEmailsMap.set(sup.email_normalizado, sup);
        }
    });

    const crossEntityConflicts = [];
    for (const item of auditResults) {
        const phone = item.contacto.telefone_normalizado;
        const email = item.contacto.email_normalizado;

        const conflictByPhone = phone && blockedPhonesMap.has(phone) && item.auditoria_classificacao.bloqueio_sugerido === null;
        const conflictByEmail = email && blockedEmailsMap.has(email) && item.auditoria_classificacao.bloqueio_sugerido === null;

        if (conflictByPhone || conflictByEmail) {
            crossEntityConflicts.push({
                deal_id: item.deal_id,
                nome_clinica: item.nome_clinica,
                status_deal_b2: item.auditoria_classificacao.fase_b2_revisada,
                conflito_telefone: conflictByPhone ? {
                    telefone: phone,
                    bloqueio_herdado: blockedPhonesMap.get(phone).motivo_bloqueio,
                    origem_deal_bloqueado: blockedPhonesMap.get(phone).deal_id
                } : null,
                conflito_email: conflictByEmail ? {
                    email: email,
                    bloqueio_herdado: blockedEmailsMap.get(email).motivo_bloqueio,
                    origem_deal_bloqueado: blockedEmailsMap.get(email).deal_id
                } : null
            });
        }
    }

    // Deduplicação da lista proposta
    const deduplicatedSuppressionList = deduplicateSuppressionList(proposedSuppressionListB2);

    const auditOutput = {
        meta: {
            projeto: 'Vamuss SDR Automático — Fase B.2 (Auditoria Corretiva Pré-Produção)',
            data_execucao: new Date().toISOString(),
            modo: 'auditoria_estrita_read_only_sem_escrita_producao',
            total_negocios_analisados: deals.length
        },
        estatisticas_gerais: statsB2,
        conflitos_identidade_e_oposicao_transversal: {
            total_conflitos_detetados: crossEntityConflicts.length,
            conflitos: crossEntityConflicts
        },
        lista_supressao_estrita_proposta: {
            total_registos_brutos: proposedSuppressionListB2.length,
            total_registos_deduplicados: deduplicatedSuppressionList.length,
            registos: deduplicatedSuppressionList
        },
        revisao_das_28_recusas_anteriores: auditResults.filter(r => r.auditoria_classificacao.fase_b1_anterior === 'RECUSA_COMERCIAL'),
        auditoria_completa_405_negocios: auditResults
    };

    fs.writeFileSync(OUTPUT_AUDIT_FILE, JSON.stringify(auditOutput, null, 2), 'utf8');
    console.log(`\n🎉 Auditoria da Fase B.2 concluída com sucesso! Resultados salvos em:\n   ${OUTPUT_AUDIT_FILE}`);
    return auditOutput;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPhaseB2Audit().catch(err => {
        console.error('❌ Erro na auditoria B.2:', err);
        process.exit(1);
    });
}

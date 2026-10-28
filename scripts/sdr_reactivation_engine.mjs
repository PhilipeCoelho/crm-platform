import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Carregar variáveis do .env manualmente se necessário
function loadEnv() {
    const envPath = path.join(ROOT_DIR, '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [k, ...v] = trimmed.split('=');
                const val = v.join('=').trim().replace(/^["']|["']$/g, '');
                if (!process.env[k.trim()]) {
                    process.env[k.trim()] = val;
                }
            }
        }
    }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ueildehrskvsonnlegtx.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SIMULATION_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation.json');

// ==============================================================================
// 2. FUNÇÕES DE SUPORTE FACTUAL
// ==============================================================================

const ELIGIBLE_APPROACH_TYPES = ['call', 'message', 'instagram', 'email'];

function calculateFirstApproach(activities = []) {
    const eligibleCompleted = (activities || []).filter(a => {
        if (!a) return false;
        const type = (a.type || '').toLowerCase();
        const isEligibleType = ELIGIBLE_APPROACH_TYPES.includes(type);
        const isCompleted = a.completed === true || (a.status || '').toLowerCase() === 'completed';
        return isEligibleType && isCompleted;
    });

    if (eligibleCompleted.length === 0) return { primeira_abordagem_em: null, tipo_canal: null };

    let best = null;
    for (const act of eligibleCompleted) {
        const ts = act.completed_at ? new Date(act.completed_at).getTime() : 
                  (act.date ? new Date(act.date).getTime() : 
                  (act.created_at ? new Date(act.created_at).getTime() : null));
        if (ts && (!best || ts < best.ts)) {
            best = { ts, iso: new Date(ts).toISOString(), canal: act.type };
        }
    }

    return best ? { primeira_abordagem_em: best.iso, tipo_canal: best.canal } : { primeira_abordagem_em: null, tipo_canal: null };
}

// ==============================================================================
// 3. MOTOR COMERCIAL BASEADO EM REGRAS (BASELINE DE SEGURANÇA DETERMINÍSTICO)
// ==============================================================================

export function normalizeText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^\w\s]/g, ' ')       // pontuações viram espaços
        .replace(/\s+/g, ' ')            // colapsa múltiplos espaços
        .trim();
}

export function evaluateCommercialDecision(dossier) {
    const { deal, activities = [], logs = [] } = dossier;
    const cleanClinicName = (deal.title || '').replace(/^Negócio\s+/i, '').trim();
    const rawLostReason = (deal.lost_reason || '').trim();
    const lostReasonNorm = normalizeText(rawLostReason);
    const lostAt = deal.lost_at ? new Date(deal.lost_at) : null;
    const now = new Date('2026-10-09T22:30:00Z'); // timestamp de referência
    const daysSinceLost = lostAt ? Math.round((now.getTime() - lostAt.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const allNotesAndLogsRaw = [
        ...logs.map(l => l.content || ''),
        ...activities.map(a => a.notes || '')
    ].join('\n');
    const allNotesAndLogsNorm = normalizeText(allNotesAndLogsRaw);

    // -------------------------------------------------------------------------
    // PRIORIDADE 1: HARD OPT-OUT & ENCERRAMENTO CATEGÓRICO (Não voltar a contactar)
    // -------------------------------------------------------------------------
    const isHardOptOut = 
        allNotesAndLogsNorm.includes('nao ligar mais') ||
        allNotesAndLogsNorm.includes('nao voltar a contactar') ||
        allNotesAndLogsNorm.includes('remover da lista') ||
        allNotesAndLogsNorm.includes('processo') ||
        allNotesAndLogsNorm.includes('bloquear') ||
        allNotesAndLogsNorm.includes('bloqueou') ||
        allNotesAndLogsNorm.includes('pediu para nao ligar') ||
        allNotesAndLogsNorm.includes('nao telefonar mais') ||
        lostReasonNorm.includes('nao ligar mais') ||
        lostReasonNorm.includes('remover da lista');

    if (isHardOptOut) {
        const justificacao = 'Prospect solicitou explicitamente exclusão ou encerramento categórico de contacto.';
        return {
            decisao: 'nao_reativar',
            potencial_reativacao: 'nulo',
            fundamentacao_potencial: justificacao,
            incertezas: 'Nenhuma. Critério restritivo de opt-out comercial atingido.',
            proxima_acao: {
                objetivo: 'Arquivamento definitivo. Nenhuma ação comercial futura.',
                argumento_comercial: 'Não aplicável.',
                assunto_a_evitar: 'Qualquer abordagem comercial ou envio de mensagens.',
                canal_sugerido: 'nenhum',
                mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - REGISTO NÃO ELEGÍVEL PARA REATIVAÇÃO]',
                justificacao_decisao: justificacao
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 2: ADIAMENTO SOLICITADO / MOMENTO INOPORTUNO / MIGRAÇÃO
    // -------------------------------------------------------------------------
    const isTimingPostponed = 
        lostReasonNorm.includes('nao e o melhor momento') ||
        lostReasonNorm.includes('nao seria o melhor momento') ||
        lostReasonNorm.includes('em migracao') ||
        lostReasonNorm.includes('passa por uma migracao') ||
        lostReasonNorm.includes('contactar mais tarde') ||
        lostReasonNorm.includes('contacte mais tarde') ||
        lostReasonNorm.includes('fale mais tarde') ||
        lostReasonNorm.includes('momento inoportuno') ||
        allNotesAndLogsNorm.includes('nao seria o melhor momento') ||
        allNotesAndLogsNorm.includes('passa por uma migracao');

    if (isTimingPostponed) {
        const justificacao = `Prospect solicitou adiamento por questão temporal ou operacional ("${rawLostReason.slice(0, 80)}"). Respeitar a janela indicada.`;
        return {
            decisao: 'aguardar',
            potencial_reativacao: 'medio',
            fundamentacao_potencial: justificacao,
            incertezas: 'Não se sabe a data exata de conclusão da contingência ou migração interna.',
            proxima_acao: {
                objetivo: 'Aguardar período de maturação antes de nova abordagem.',
                argumento_comercial: 'Retomar contacto apenas após transcorrido o período operacional indicado.',
                assunto_a_evitar: 'Insistir durante o momento declarado como inoportuno.',
                canal_sugerido: 'whatsapp',
                mensagem_proposta_pt_pt: '[AGUARDA PRAZO - Reabordagem recomendada após conclusão da migração ou período indicado]',
                justificacao_decisao: justificacao
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 3: RECUSA EXPRESSA (Definitiva ou Polida)
    // -------------------------------------------------------------------------
    const isPoliteRefusal = 
        lostReasonNorm.includes('sem interesse no momento') ||
        lostReasonNorm.includes('nao estamos interessados no momento') ||
        lostReasonNorm.includes('nao temos interesse no momento') ||
        lostReasonNorm.includes('guardamos o seu contato') ||
        lostReasonNorm.includes('guardamos o contacto') ||
        lostReasonNorm.includes('guardamos o seu contacto') ||
        allNotesAndLogsNorm.includes('sem interesse no momento') ||
        allNotesAndLogsNorm.includes('guardamos o seu contato');

    const isDirectRefusal = 
        lostReasonNorm.includes('nao teve interesse') ||
        lostReasonNorm.includes('nao temos interesse') ||
        lostReasonNorm.includes('nao estamos interessados') ||
        lostReasonNorm.includes('nao tem interesse') ||
        lostReasonNorm.includes('nao tenho interesse') ||
        (lostReasonNorm.includes('sem interesse') && !lostReasonNorm.includes('sem interesse em repassar')) ||
        lostReasonNorm.includes('nao enviar propostas') ||
        allNotesAndLogsNorm.includes('nao teve interesse') ||
        allNotesAndLogsNorm.includes('nao estamos interessados') ||
        allNotesAndLogsNorm.includes('nao temos interesse na proposta');

    if (isPoliteRefusal) {
        const justificacao = `Prospect respondeu educadamente indicando ausência de interesse no momento atual ("${rawLostReason.slice(0, 80)}"). Respeitar a recusa e aguardar ciclo estendido de 180 dias.`;
        return {
            decisao: 'aguardar',
            potencial_reativacao: 'baixo',
            fundamentacao_potencial: justificacao,
            incertezas: 'Não se sabe se haverá abertura para reavaliação em ciclos futuros.',
            proxima_acao: {
                objetivo: 'Aguardar ciclo estendido de 180 dias antes de qualquer nova sondagem.',
                argumento_comercial: 'Não abordar no curto prazo.',
                assunto_a_evitar: 'Pressionar quem pediu para aguardar ou declarou desinteresse.',
                canal_sugerido: 'nenhum',
                mensagem_proposta_pt_pt: '[AGUARDAR PRAZO - Prospect manifestou ausência de interesse no momento atual]',
                justificacao_decisao: justificacao
            }
        };
    }

    if (isDirectRefusal) {
        const justificacao = `Recusa expressa documentada no histórico ("${rawLostReason}"). Prospect manifestou desinteresse ativo no serviço ou proposta.`;
        return {
            decisao: 'nao_reativar',
            potencial_reativacao: 'nulo',
            fundamentacao_potencial: justificacao,
            incertezas: 'Nenhuma. Recusa expressa prevalece sobre qualquer tentativa de reativação.',
            proxima_acao: {
                objetivo: 'Arquivamento comercial. Respeito à decisão do prospect.',
                argumento_comercial: 'Não aplicável.',
                assunto_a_evitar: 'Qualquer contato comercial insistente após recusa.',
                canal_sugerido: 'nenhum',
                mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - REGISTO NÃO ELEGÍVEL POR RECUSA EXPRESSA]',
                justificacao_decisao: justificacao
            }
        };
    }


    // -------------------------------------------------------------------------
    // PRIORIDADE 4: DESQUALIFICAÇÃO ESTRUTURAL COMPROVADA (Biblioteca de Anúncios / Grandes Redes / Inexistente)
    // -------------------------------------------------------------------------
    const isDefinitivelyDisqualified = 
        lostReasonNorm.includes('biblioteca de anuncios confirmada') ||
        lostReasonNorm.includes('esta fora proxima clinica') ||
        lostReasonNorm.includes('clinica inexistente') ||
        lostReasonNorm.includes('fechou') ||
        lostReasonNorm.includes('encerrada') ||
        lostReasonNorm.includes('grande grupo') ||
        lostReasonNorm.includes('grupo muito grande');

    if (isDefinitivelyDisqualified) {
        let motivoDetalhado = '';
        if (lostReasonNorm.includes('biblioteca de anuncios')) motivoDetalhado = 'Desqualificação técnica confirmada: clínica já possui estrutura profissional de anúncios no Meta e agência ativa.';
        else if (lostReasonNorm.includes('grupo muito grande') || lostReasonNorm.includes('grande grupo')) motivoDetalhado = 'Desqualificação estrutural: grande rede corporativa fora do perfil de ticket/serviço da Vamuss.';
        else if (lostReasonNorm.includes('inexistente') || lostReasonNorm.includes('fechou')) motivoDetalhado = 'Clínica encerrada ou inexistente.';
        else motivoDetalhado = `Desqualificação fundamentada no histórico comercial: "${rawLostReason}".`;

        return {
            decisao: 'nao_reativar',
            potencial_reativacao: 'nulo',
            fundamentacao_potencial: motivoDetalhado,
            incertezas: 'Nenhuma. Critério restritivo de segurança comercial atingido.',
            proxima_acao: {
                objetivo: 'Arquivamento definitivo. Nenhuma ação comercial futura.',
                argumento_comercial: 'Não aplicável.',
                assunto_a_evitar: 'Qualquer abordagem comercial ou envio de mensagens.',
                canal_sugerido: 'nenhum',
                mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - REGISTO NÃO ELEGÍVEL PARA REATIVAÇÃO]',
                justificacao_decisao: motivoDetalhado
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 5: ANÚNCIOS OU AGÊNCIA EXISTENTES (Janela de ciclo de contrato)
    // -------------------------------------------------------------------------
    const alreadyHasAgencyOrAds = 
        lostReasonNorm.includes('ja anuncia') ||
        lostReasonNorm.includes('ja anunciam') ||
        lostReasonNorm.includes('estao anunciando') ||
        lostReasonNorm.includes('estao a anunciar') ||
        lostReasonNorm.includes('tem anuncios ativos') ||
        lostReasonNorm.includes('anuncios ativos') ||
        lostReasonNorm.includes('ja tem anuncios') ||
        lostReasonNorm.includes('ja trabalha com mkt') ||
        lostReasonNorm.includes('ja trabalha com marketing') ||
        lostReasonNorm.includes('trata das redes sociais') ||
        lostReasonNorm.includes('quem trate das redes') ||
        lostReasonNorm.includes('ja tem uma agencia') ||
        lostReasonNorm.includes('ja temos agencia') ||
        lostReasonNorm.includes('trabalha com outra agencia') ||
        lostReasonNorm.includes('tem agencia');

    if (alreadyHasAgencyOrAds) {
        const justificacao = `Clínica indicou ter agência ou anúncios ativos no histórico (${daysSinceLost !== null ? daysSinceLost + ' dias atrás' : 'data anterior'}). Contratos de agência costumam ser revistos em ciclos de 3 a 6 meses. Reativação deve aguardar janela de reavaliação de parceiros.`;
        return {
            decisao: 'aguardar',
            potencial_reativacao: 'medio',
            fundamentacao_potencial: justificacao,
            incertezas: 'Não se sabe se o contrato com a agência atual permanece ativo e gerando resultados satisfatórios.',
            proxima_acao: {
                objetivo: 'Sondagem diplomática sobre a satisfação com o volume atual de novas marcações geradas.',
                argumento_comercial: 'Focar em metodologia para primeiras consultas particulares sem confrontar a agência atual.',
                assunto_a_evitar: 'Criticar diretamente a agência ou o trabalho atual da clínica.',
                canal_sugerido: 'whatsapp',
                mensagem_proposta_pt_pt: `Olá, boa tarde! Espero que esteja tudo bem convosco na ${cleanClinicName}. Retomo brevemente o contacto no seguimento da nossa conversa anterior sobre captação de pacientes. Como tem corrido o vosso planeamento para este trimestre? Se fizer sentido conhecer a nossa metodologia para novas primeiras consultas particulares, fico inteiramente à disposição. Um abraço!`,
                justificacao_decisao: justificacao
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 6: DESQUALIFICAÇÃO GENÉRICA OU DE PERFIL
    // -------------------------------------------------------------------------

    const isGenericDisqualification = 
        lostReasonNorm.includes('desqualificado') ||
        lostReasonNorm.includes('fora do perfil') ||
        lostReasonNorm.includes('fora de perfil');

    if (isGenericDisqualification) {
        // Se houver fundamentação clara nas notas de que está fora de perfil:
        if (allNotesAndLogsNorm.includes('sem presenca digital') || allNotesAndLogsNorm.includes('fora do perfil')) {
            const justificacao = `Desqualificação de perfil mantida com base no histórico comercial ("${rawLostReason}").`;
            return {
                decisao: 'nao_reativar',
                potencial_reativacao: 'nulo',
                fundamentacao_potencial: justificacao,
                incertezas: 'Nenhuma. Desqualificação de perfil confirmada no CRM.',
                proxima_acao: {
                    objetivo: 'Arquivamento definitivo.',
                    argumento_comercial: 'Não aplicável.',
                    assunto_a_evitar: 'Abordar perfis desqualificados.',
                    canal_sugerido: 'nenhum',
                    mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - REGISTO FORA DO PERFIL]',
                    justificacao_decisao: justificacao
                }
            };
        }

        // Caso contrário, desqualificação genérica sem evidência factual detalhada -> REVISÃO HUMANA
        const justificacao = `Negócio marcado como "${rawLostReason}", mas com histórico insuficiente no CRM para comprovar factualmente o motivo da exclusão sem risco.`;
        return {
            decisao: 'revisao_humana',
            potencial_reativacao: 'indeterminado',
            fundamentacao_potencial: justificacao,
            incertezas: 'Motivo genérico sem detalhamento de objeção ou validação cadastral nos logs.',
            proxima_acao: {
                objetivo: 'Validação manual prévia pelo consultor antes de qualquer reativação.',
                argumento_comercial: 'Verificar presença no Instagram e perfil societário da clínica.',
                assunto_a_evitar: 'Disparo automático sem verificação do perfil.',
                canal_sugerido: 'nenhum',
                mensagem_proposta_pt_pt: '[AGUARDA REVISÃO HUMANA - Necessário confirmar critério de qualificação]',
                justificacao_decisao: justificacao
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 6: JANELA TEMPORAL (< 30 dias de perda)
    // -------------------------------------------------------------------------
    const lostTooRecently = daysSinceLost !== null && daysSinceLost < 30;
    if (lostTooRecently) {
        const justificacao = `Negócio perdido há apenas ${daysSinceLost} dias. Respeito ao respiro comercial mínimo de 30 dias para evitar insistência excessiva.`;
        return {
            decisao: 'aguardar',
            potencial_reativacao: 'medio',
            fundamentacao_potencial: justificacao,
            incertezas: 'Não se sabe se houve evolução nas prioridades da clínica no último mês.',
            proxima_acao: {
                objetivo: 'Aguardar período de maturação antes de nova abordagem.',
                argumento_comercial: 'Retomar apenas após cumprir o intervalo de respiro comercial.',
                assunto_a_evitar: 'Cobrar resposta sobre contacto recente.',
                canal_sugerido: 'whatsapp',
                mensagem_proposta_pt_pt: `[AGUARDAR PRAZO - Reavaliação recomendada após completar 30 dias de intervalo]`,
                justificacao_decisao: justificacao
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 7: HISTÓRICO INSUFICIENTE (Casos com 0 logs e <= 1 atividade)
    // -------------------------------------------------------------------------
    const hasAlmostNoData = (activities.length === 0 && logs.length === 0) || 
                            (!deal.lost_reason && activities.length <= 1 && logs.length === 0) ||
                            (logs.length === 0 && activities.filter(a => a.completed).length <= 1 && !deal.lost_reason);

    if (hasAlmostNoData) {
        const justificacao = 'Histórico quase inexistente no CRM (sem notas e sem atividades concluídas). Informação insuficiente para decidir de forma segura.';
        return {
            decisao: 'revisao_humana',
            potencial_reativacao: 'indeterminado',
            fundamentacao_potencial: justificacao,
            incertezas: 'Faltam dados de contacto, histórico de abordagem e contexto comercial.',
            proxima_acao: {
                objetivo: 'Revisão manual de cadastro antes de qualquer abordagem.',
                argumento_comercial: 'Investigar histórico da clínica.',
                assunto_a_evitar: 'Abordagem cega sem dados prévios.',
                canal_sugerido: 'nenhum',
                mensagem_proposta_pt_pt: '[AGUARDA REVISÃO HUMANA - Histórico insuficiente]',
                justificacao_decisao: justificacao
            }
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 8: SILÊNCIO PURO E HISTÓRICO HÁBIL (Reativar Agora)
    // -------------------------------------------------------------------------
    const justificacao = `Negócio arquivado por falta de resposta há ${daysSinceLost !== null ? daysSinceLost + ' dias' : 'tempo hábil'}, sem recusa, sem desqualificação e sem impedimento conhecido. Mudança de ângulo viabiliza nova tentativa.`;
    return {
        decisao: 'reativar_agora',
        potencial_reativacao: 'alto',
        fundamentacao_potencial: justificacao,
        incertezas: 'Verificar se o interlocutor de contacto anterior ainda é o responsável pela receção ou direção da clínica.',
        proxima_acao: {
            objetivo: 'Retomar contacto com foco numa pergunta direta e de baixo atrito sobre atração de novos pacientes particulares.',
            argumento_comercial: 'Estratégia focada em pacientes particulares de primeira consulta.',
            assunto_a_evitar: 'Cobrar resposta de mensagens anteriores ou fingir que analisou a agenda/conteúdos da clínica.',
            canal_sugerido: 'whatsapp',
            mensagem_proposta_pt_pt: `Olá, boa tarde! Espero que esteja tudo bem com a equipa da ${cleanClinicName}. Retomo o contacto no seguimento da nossa mensagem anterior sobre atração de novos pacientes particulares. Se fizer sentido reavaliar este tema para os próximos meses, como está a vossa disponibilidade para uma breve troca de ideias? Obrigado pela atenção!`,
            justificacao_decisao: justificacao
        }
    };
}

// ==============================================================================
// 4. MOTOR OPENAI GPT (QUANDO OPENAI_API_KEY FOR CONFIGURADA)
// ==============================================================================

export async function evaluateCommercialDecisionGPT(dossier, apiKey) {
    const { deal, activities = [], logs = [] } = dossier;
    const cleanClinicName = (deal.title || '').replace(/^Negócio\s+/i, '').trim();

    const systemPrompt = `És o SDR Sênior de Estratégia Comercial da Agência Vamuss (Portugal).
A tua missão é analisar negócios perdidos ('lost') do CRM e tomar decisões comerciais fundamentadas e rigorosas para potencial reativação.

Princípios Comerciais Absolutos:
1. "Lost" não significa que todos devem ser reativados. Apenas negócios com fundamento legítimo avançam.
2. Não inventar factos, números, interações ou conversas não comprovadas no histórico.
3. Se houver recusa explícita, pedido para não ligar, ou desqualificação estrutural (ex: já investe pesado com agência, fora do perfil, grande rede) -> DECISÃO: "nao_reativar".
4. Se o negócio tiver poucos dados, informações contraditórias ou incerteza relevante -> DECISÃO: "revisao_humana".
5. Se foi perdido recentemente (< 30 dias) ou indicou ter agência ativa recentemente -> DECISÃO: "aguardar".
6. Se arquivado por "não respondeu" há tempo razoável sem rejeição ao serviço -> DECISÃO: "reativar_agora".
7. Toda mensagem proposta DEVE ser em Português de Portugal (pt-PT), consultiva, elegante, focada em gerar conversa e NUNCA vendedora agressiva.

Responde ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "decisao": "reativar_agora" | "aguardar" | "nao_reativar" | "revisao_humana",
  "potencial_reativacao": "alto" | "medio" | "baixo" | "nulo" | "indeterminado",
  "fundamentacao_potencial": "string detalhada",
  "incertezas": "string",
  "proxima_acao": {
    "objetivo": "string",
    "argumento_comercial": "string",
    "assunto_a_evitar": "string",
    "canal_sugerido": "whatsapp" | "email" | "instagram" | "telefone" | "nenhum",
    "mensagem_proposta_pt_pt": "string (proposta em pt-PT ou aviso se não elegível)",
    "justificacao_decisao": "string"
  }
}`;

    const userPayload = {
        negocio_id: deal.id,
        clinica: cleanClinicName,
        motivo_perda: deal.lost_reason || '(sem motivo especificado)',
        data_perda: deal.lost_at || null,
        data_criacao: deal.created_at || null,
        total_atividades: activities.length,
        atividades_resumo: activities.map(a => ({
            tipo: a.type,
            titulo: a.title,
            concluida: a.completed,
            data_conclusao: a.completed_at || a.date,
            houve_resposta_flag: a.houve_resposta || false,
            notas: a.notes ? a.notes.slice(0, 200) : null
        })),
        total_logs: logs.length,
        logs_historico: logs.map(l => ({
            tipo: l.log_type,
            conteudo: l.content ? l.content.slice(0, 300) : null,
            data: l.created_at
        }))
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(userPayload) }
            ]
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed;
}

// ==============================================================================
// 5. PIPELINE PRINCIPAL DE SIMULAÇÃO
// ==============================================================================

export async function runSimulation({ sampleSize = 25, useGptIfAvailable = true, forceAll = false, outputFile = null } = {}) {
    console.log('🚀 Iniciando Motor de Inteligência SDR Vamuss — Fase A.3 (Simulação Integral)...');
    console.log(`   Configuração: Supabase=${SUPABASE_URL.slice(0, 25)}... | OpenAI Key Presente=${!!OPENAI_API_KEY}`);

    const targetOutputFile = outputFile ? path.resolve(ROOT_DIR, outputFile) : 
        (forceAll ? path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json') : SIMULATION_FILE);

    // Carregar progresso anterior se existir
    let previousResults = {};
    if (fs.existsSync(targetOutputFile)) {
        try {
            const fileData = JSON.parse(fs.readFileSync(targetOutputFile, 'utf8'));
            if (fileData.resultados_individuais && Array.isArray(fileData.resultados_individuais)) {
                fileData.resultados_individuais.forEach(r => {
                    previousResults[r.identificacao.deal_id] = r;
                });
                console.log(`   🔁 Encontrados ${Object.keys(previousResults).length} negócios já analisados em execuções anteriores.`);
            }
        } catch (e) {
            console.warn('   ⚠️ Não foi possível ler cache anterior, iniciando do zero.');
        }
    }

    // 1. Obter negócios perdidos
    console.log('📥 Consultando negócios perdidos (status=lost) no Supabase...');
    const { data: lostDeals, error: dealsErr } = await sb
        .from('deals')
        .select('id, title, status, lost_reason, lost_at, created_at, stage_id')
        .eq('status', 'lost')
        .order('created_at', { ascending: true });

    if (dealsErr) throw new Error(`Erro ao buscar deals no Supabase: ${dealsErr.message}`);

    const totalDealsFound = lostDeals.length;
    console.log(`   ✅ Encontrados exatamente ${totalDealsFound} negócios perdidos no CRM.`);

    // Deduplicação estrita de IDs
    const uniqueDealsMap = new Map();
    lostDeals.forEach(d => uniqueDealsMap.set(d.id, d));
    const uniqueDeals = Array.from(uniqueDealsMap.values());

    const targetList = forceAll ? uniqueDeals : uniqueDeals.slice(0, sampleSize);
    console.log(`🎯 Universo selecionado para esta execução: ${targetList.length} negócios.`);

    // 2. Processar em lotes e enriquecer dossiês
    const dealIds = targetList.map(d => d.id);
    const activitiesByDeal = {};
    const logsByDeal = {};

    console.log('📦 Carregando histórico completo de atividades e logs em chunks...');
    for (let i = 0; i < dealIds.length; i += 80) {
        const chunk = dealIds.slice(i, i + 80);
        const { data: acts } = await sb.from('activities').select('id, deal_id, type, title, completed, completed_at, date, houve_resposta, notes').in('deal_id', chunk);
        const { data: logs } = await sb.from('deal_logs').select('id, deal_id, content, log_type, created_at').in('deal_id', chunk);

        (acts || []).forEach(a => {
            if (!activitiesByDeal[a.deal_id]) activitiesByDeal[a.deal_id] = [];
            activitiesByDeal[a.deal_id].push(a);
        });
        (logs || []).forEach(l => {
            if (!logsByDeal[l.deal_id]) logsByDeal[l.deal_id] = [];
            logsByDeal[l.deal_id].push(l);
        });
    }

    // 3. Execução das decisões
    const results = [];
    const stats = {
        total_encontrados: totalDealsFound,
        total_analisado: 0,
        total_falhas: 0,
        por_decisao: {
            reativar_agora: 0,
            aguardar: 0,
            nao_reativar: 0,
            revisao_humana: 0
        },
        motivos_mais_frequentes: {},
        amostra_estimada_tokens: {
            input_tokens_estimados: 0,
            output_tokens_estimados: 0,
            custo_estimado_usd: 0
        }
    };

    for (let i = 0; i < targetList.length; i++) {
        const deal = targetList[i];
        const acts = activitiesByDeal[deal.id] || [];
        const logs = logsByDeal[deal.id] || [];

        // Verificar se já temos em cache
        if (previousResults[deal.id]) {
            const cached = previousResults[deal.id];
            results.push(cached);
            stats.total_analisado++;
            stats.por_decisao[cached.decisao] = (stats.por_decisao[cached.decisao] || 0) + 1;
            continue;
        }

        const dossier = { deal, activities: acts, logs };
        const cleanClinicName = (deal.title || '').replace(/^Negócio\s+/i, '').trim();

        // Calcular última data de atividade
        let lastActivityDate = deal.lost_at || deal.created_at;
        acts.forEach(a => {
            const d = a.completed_at || a.date;
            if (d && (!lastActivityDate || new Date(d) > new Date(lastActivityDate))) {
                lastActivityDate = d;
            }
        });

        let decisionObj = null;
        try {
            if (OPENAI_API_KEY && useGptIfAvailable) {
                decisionObj = await evaluateCommercialDecisionGPT(dossier, OPENAI_API_KEY);
            } else {
                decisionObj = evaluateCommercialDecision(dossier);
            }
        } catch (err) {
            console.error(`   ❌ Falha ao analisar deal ${deal.id} (${cleanClinicName}): ${err.message}`);
            stats.total_falhas++;
            decisionObj = {
                decisao: 'revisao_humana',
                potencial_reativacao: 'indeterminado',
                fundamentacao_potencial: `Erro durante inferência técnica: ${err.message}`,
                incertezas: 'Falha técnica na análise.',
                proxima_acao: {
                    objetivo: 'Revisão manual devido a falha de execução.',
                    argumento_comercial: 'Não aplicável.',
                    assunto_a_evitar: 'Qualquer contacto até resolução.',
                    canal_sugerido: 'nenhum',
                    mensagem_proposta_pt_pt: '[ERRO NA EXECUÇÃO - EXIGE REVISÃO]',
                    justificacao_decisao: 'Falha durante o processamento do dossiê.'
                }
            };
        }

        // Montar o contrato oficial de saída estruturado
        const record = {
            identificacao: {
                deal_id: deal.id,
                nome: cleanClinicName,
                estado_atual: deal.status,
                motivo_perda_registrado: deal.lost_reason || '(sem motivo registrado)',
                data_ultima_atividade_conhecida: lastActivityDate
            },
            interpretacao_comercial: {
                resumo_factual_historico: `Criado em ${deal.created_at ? deal.created_at.slice(0, 10) : 'n/d'}, com ${acts.length} atividades e ${logs.length} notas no histórico.`,
                ultima_interacao_relevante: acts.length > 0 ? (acts[0].title || 'Atividade') : (deal.lost_reason || 'Nenhuma'),
                resposta_explicita_verificavel: acts.some(a => a.houve_resposta === true) || logs.some(l => (l.content || '').includes('~') || (l.content || '').includes('disse')),
                detalhe_resposta: logs.length > 0 ? (logs[0].content || '').slice(0, 100) : 'Nenhum registo direto de fala.',
                objecoes_ou_motivos_perda_identificados: deal.lost_reason ? [deal.lost_reason] : [],
                potencial_reativacao: decisionObj.potencial_reativacao || 'indeterminado',
                fundamentacao_potencial: decisionObj.fundamentacao_potencial,
                incertezas_e_dados_em_falta: decisionObj.incertezas || 'Nenhuma.'
            },
            decisao: decisionObj.decisao,
            proxima_acao: decisionObj.proxima_acao
        };

        results.push(record);
        stats.total_analisado++;
        stats.por_decisao[record.decisao] = (stats.por_decisao[record.decisao] || 0) + 1;

        const reasonKey = deal.lost_reason ? deal.lost_reason.trim() : '(sem motivo)';
        stats.motivos_mais_frequentes[reasonKey] = (stats.motivos_mais_frequentes[reasonKey] || 0) + 1;

        // Persistência progressiva para suportar retomada segura
        if ((i + 1) % 10 === 0 || i === targetList.length - 1) {
            fs.writeFileSync(targetOutputFile, JSON.stringify({
                ultima_atualizacao: new Date().toISOString(),
                estatisticas: stats,
                resultados_individuais: results
            }, null, 2), 'utf8');
        }
    }

    // Estimativa de tokens para a amostra e projeção para os 405 deals
    const avgChars = 522;
    const inputTokensPerDeal = Math.round(avgChars / 4) + 600; // ~730 tokens
    const outputTokensPerDeal = 350; // ~350 tokens
    const totalSampleInput = stats.total_analisado * inputTokensPerDeal;
    const totalSampleOutput = stats.total_analisado * outputTokensPerDeal;
    // Custo gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const costMiniSample = (totalSampleInput * 0.00000015) + (totalSampleOutput * 0.00000060);
    const costMiniUniverse = (405 * inputTokensPerDeal * 0.00000015) + (405 * outputTokensPerDeal * 0.00000060);

    stats.amostra_estimada_tokens = {
        tokens_entrada_por_deal_media: inputTokensPerDeal,
        tokens_saida_por_deal_media: outputTokensPerDeal,
        amostra_tokens_entrada_total: totalSampleInput,
        amostra_tokens_saida_total: totalSampleOutput,
        custo_amostra_gpt_4o_mini_usd: Number(costMiniSample.toFixed(4)),
        projecao_universo_405_deals_usd: Number(costMiniUniverse.toFixed(4))
    };

    // Salvar arquivo consolidado
    const finalReport = {
        meta: {
            projeto: 'Vamuss SDR Automático — Fase A.3 (Simulação Integral dos 405 Negócios)',
            data_execucao: new Date().toISOString(),
            modo: OPENAI_API_KEY ? 'gpt-4o-mini' : 'regras_comerciais_canonicas_vamuss',
            natureza_classificacao: 'triagem_preliminar_elegibilidade_seguranca',
            read_only_confirmado: true
        },
        estatisticas: stats,
        resultados_individuais: results
    };

    fs.writeFileSync(targetOutputFile, JSON.stringify(finalReport, null, 2), 'utf8');
    console.log(`\n🎉 Simulação concluída com sucesso! Resultados gravados em ${targetOutputFile}`);
    return finalReport;
}

// Execução direta via CLI se chamado diretamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const isAll = process.argv.includes('--all');
    const sampleArg = process.argv.find(a => a.startsWith('--sample='));
    const sampleSize = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : 25;
    const outputArg = process.argv.find(a => a.startsWith('--output='));
    const outputFile = outputArg ? outputArg.split('=')[1] : null;

    runSimulation({ sampleSize, forceAll: isAll, outputFile }).catch(err => {
        console.error('Fatal simulation error:', err);
        process.exit(1);
    });
}

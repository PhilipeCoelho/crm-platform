import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Carregar variáveis do .env de forma segura (sem imprimir ou logar segredos)
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

const INPUT_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json');
const DEFAULT_OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a4_58_gpt.json');

export const PILOT_DEAL_IDS = [
    '66eb7c1c-7ff8-4043-8ac1-3f5d64d5a3b6', // 1. Dra. Pamella Pessoa: Silêncio puro padrão ("Não responde ")
    'f2a19616-0297-4480-b7cb-e2ba6044fe4e', // 2. Implantprime Lisboa: Escassez de dados / Sem motivo registado
    'cdee8928-67dd-4117-944f-b84d56ca3ce4', // 3. Hiclinic Dental Care: Caso ambíguo / Fricção de secretária com agências
    '727b2c30-c068-4037-980b-0527cbc2b48d', // 4. Dentibus - Clínica Médica Dentária: Fricção de canal / Redirecionamento para email
    '76c64ba3-a663-46e6-8d62-8da6b758b80c'  // 5. Clínica AM SMILING: Objeção de capacidade operacional ("equipa completa")
];

// Normalizador auxiliar para guardrail determinístico pós-inferência
function normalizeText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Sanitizador estrito de dados sensíveis (PII):
 * Remove e-mails pessoais/comerciais e telefones em diversos formatos portugueses e internacionais.
 */
export function sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        // Remove e-mails
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REMOVIDO]')
        // Remove telefones com indicativo ou formato comum português/internacional
        .replace(/(?:\+351\s*)?(?:9[1236]\d{1}|2\d{2})[\s.-]?\d{3}[\s.-]?\d{3}/g, '[TELEFONE_REMOVIDO]')
        .replace(/\b\d{9}\b/g, '[TELEFONE_REMOVIDO]');
}

/**
 * Sanitiza mensagens de erro para evitar vazamento de chaves ou segredos em logs e relatórios
 */
export function sanitizeErrorMessage(errMessage) {
    if (!errMessage || typeof errMessage !== 'string') return '';
    return errMessage
        .replace(/sk-[a-zA-Z0-9_\-]+/g, '[REDACTED_API_KEY]')
        .replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer [REDACTED_TOKEN]');
}

/**
 * 2. GUARDRAIL DE SEGURANÇA PÓS-INFERÊNCIA
 * Garante que o GPT não consegue ultrapassar bloqueios de segurança comercial:
 * - Inspeciona o HISTÓRICO COMPLETO e NÃO-TRUNCADO (deal, notas, atividades, interpretação comercial prévia).
 * - Se o modelo retornar 'reativar_agora', mas houver evidência de opt-out, recusa, desqualificação, momento inoportuno
 *   ou restrição explícita de canal, a decisão é rebaixada deterministicamente.
 */
export function enforceSafetyGuardrails(rawDecision, dossier) {
    const { deal = {}, activities = [], logs = [], interpretacao_comercial = {} } = dossier;
    const rawReason = (deal.lost_reason || deal.motivo_perda_registrado || '').trim();
    const reasonNorm = normalizeText(rawReason);
    
    // Consulta o histórico COMPLETO não-truncado
    const allNotesAndLogsRaw = [
        rawReason,
        ...logs.map(l => l.content || ''),
        ...activities.map(a => a.notes || ''),
        interpretacao_comercial.detalhe_resposta || '',
        ...(interpretacao_comercial.objecoes_ou_motivos_perda_identificados || []),
        interpretacao_comercial.fundamentacao_potencial || ''
    ].join('\n');
    
    const allNotesAndLogsNorm = normalizeText(allNotesAndLogsRaw);

    const guardrailAudit = {
        guardrail_acionado: false,
        decisao_original_gpt: rawDecision?.decisao || null,
        motivo_intervencao: null
    };

    // 1. Verificação de Hard Opt-out
    const isOptOut = allNotesAndLogsNorm.includes('nao ligar mais') || 
                     allNotesAndLogsNorm.includes('remover da lista') ||
                     allNotesAndLogsNorm.includes('bloquear') ||
                     allNotesAndLogsNorm.includes('bloqueou') ||
                     allNotesAndLogsNorm.includes('processo') ||
                     allNotesAndLogsNorm.includes('pediu para nao ligar') ||
                     allNotesAndLogsNorm.includes('nao telefonar mais');
    if (isOptOut) {
        guardrailAudit.guardrail_acionado = true;
        guardrailAudit.motivo_intervencao = 'Opt-out detectado no histórico. Decisão travada em nao_reativar.';
        return {
            decisao_final: 'nao_reativar',
            elegibilidade_comercial: 'nao_elegivel',
            autorizacao_contacto: 'optout_solicitado',
            adequacao_canal: 'nenhum',
            mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - REGISTO COM OPT-OUT CONFIRMADO]',
            guardrailAudit
        };
    }

    // 2. Verificação de Recusa Expressa
    const isRefusal = reasonNorm.includes('nao teve interesse') ||
                      reasonNorm.includes('nao estamos interessados') ||
                      reasonNorm.includes('nao temos interesse') ||
                      allNotesAndLogsNorm.includes('nao teve interesse') ||
                      allNotesAndLogsNorm.includes('nao estamos interessados') ||
                      allNotesAndLogsNorm.includes('nao temos interesse');
    if (isRefusal && rawDecision?.decisao === 'reativar_agora') {
        guardrailAudit.guardrail_acionado = true;
        guardrailAudit.motivo_intervencao = 'Recusa expressa documentada. Decisão do GPT rebaixada de reativar_agora para nao_reativar.';
        return {
            decisao_final: 'nao_reativar',
            elegibilidade_comercial: 'nao_elegivel',
            autorizacao_contacto: 'recusa',
            adequacao_canal: 'nenhum',
            mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - RECUSA EXPRESSA NO HISTÓRICO]',
            guardrailAudit
        };
    }

    // 3. Verificação de Desqualificação Estrutural / Porte
    const isDisqualified = reasonNorm.includes('grande clinica') ||
                           reasonNorm.includes('perfil muito grande') ||
                           reasonNorm.includes('grande grupo') ||
                           reasonNorm.includes('fora do perfil') ||
                           reasonNorm.includes('fora de perfil') ||
                           allNotesAndLogsNorm.includes('grande clinica') ||
                           allNotesAndLogsNorm.includes('perfil muito grande');
    if (isDisqualified && rawDecision?.decisao === 'reativar_agora') {
        guardrailAudit.guardrail_acionado = true;
        guardrailAudit.motivo_intervencao = 'Incompatibilidade de porte/perfil detectada. Decisão do GPT rebaixada para nao_reativar.';
        return {
            decisao_final: 'nao_reativar',
            elegibilidade_comercial: 'nao_elegivel',
            autorizacao_contacto: 'sem_consentimento_explicito_requer_optin',
            adequacao_canal: 'nenhum',
            mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - REGISTO FORA DO PERFIL DE SERVIÇO]',
            guardrailAudit
        };
    }

    // 4. Verificação de Momento Inoportuno / Migração / Equipa Completa
    const isPostponed = reasonNorm.includes('migracao') || 
                        reasonNorm.includes('equipa completa') ||
                        reasonNorm.includes('nao seria o melhor momento') ||
                        allNotesAndLogsNorm.includes('equipa completa') ||
                        allNotesAndLogsNorm.includes('em migracao');
    if (isPostponed && (rawDecision?.decisao === 'reativar_agora' || rawDecision?.decisao === 'nao_reativar')) {
        guardrailAudit.guardrail_acionado = true;
        guardrailAudit.motivo_intervencao = 'Momento inoportuno ou contingência declarada (equipa completa/migração). Decisão ajustada para aguardar.';
        return {
            decisao_final: 'aguardar',
            elegibilidade_comercial: 'quarentena_aguardar',
            autorizacao_contacto: 'sem_consentimento_explicito_requer_optin',
            adequacao_canal: 'nenhum',
            mensagem_proposta_pt_pt: '[AGUARDAR PRAZO - Contingência operacional temporária indicada no histórico]',
            guardrailAudit
        };
    }

    // 5. Verificação de Atrito de Gatekeeper / Cansaço de Agências
    const isGatekeeperFriction = allNotesAndLogsNorm.includes('cansada de ligacoes') ||
                                 allNotesAndLogsNorm.includes('cansada de agencias');
    if (isGatekeeperFriction && rawDecision?.decisao === 'reativar_agora') {
        guardrailAudit.guardrail_acionado = true;
        guardrailAudit.motivo_intervencao = 'Fricção de secretária/gatekeeper com agências detectada. Decisão rebaixada para revisao_humana.';
        return {
            decisao_final: 'revisao_humana',
            elegibilidade_comercial: 'indeterminado',
            autorizacao_contacto: 'sem_consentimento_explicito_requer_optin',
            adequacao_canal: 'nenhum',
            mensagem_proposta_pt_pt: '[AGUARDA REVISÃO HUMANA - Fricção com receção exige alinhamento prévio]',
            guardrailAudit
        };
    }

    // 6. Verificação de Restrição de Canal (Canal Médico / Apenas Email)
    const isChannelRestricted = allNotesAndLogsNorm.includes('canal de atendimento medico') ||
                                allNotesAndLogsNorm.includes('enviar para o nosso email') ||
                                allNotesAndLogsNorm.includes('apenas por email');
    if (isChannelRestricted && rawDecision?.adequacao_canal === 'whatsapp') {
        guardrailAudit.guardrail_acionado = true;
        guardrailAudit.motivo_intervencao = 'Canal WhatsApp restrito pelo prospect. Forçado canal email e opt-in pendente.';
        return {
            decisao_final: rawDecision.decisao === 'reativar_agora' ? 'aguardar' : rawDecision.decisao,
            elegibilidade_comercial: rawDecision.elegibilidade_comercial || 'indeterminado',
            autorizacao_contacto: 'sem_consentimento_explicito_requer_optin',
            adequacao_canal: 'email',
            mensagem_proposta_pt_pt: '[RESTRIÇÃO DE CANAL - Prospect solicitou contacto exclusivamente por email]',
            guardrailAudit
        };
    }

    // Caso nenhum guardrail tenha sido violado: decisão do modelo é preservada
    return {
        decisao_final: rawDecision?.decisao || 'revisao_humana',
        elegibilidade_comercial: rawDecision?.elegibilidade_comercial || (rawDecision?.decisao === 'reativar_agora' ? 'elegivel' : 'nao_elegivel'),
        autorizacao_contacto: rawDecision?.autorizacao_contacto || 'sem_consentimento_explicito_requer_optin',
        adequacao_canal: rawDecision?.adequacao_canal || (rawDecision?.decisao === 'reativar_agora' ? 'whatsapp' : 'nenhum'),
        mensagem_proposta_pt_pt: rawDecision?.mensagem_proposta_pt_pt || '[NENHUMA MENSAGEM]',
        guardrailAudit
    };
}

/**
 * 3. VALIDADOR DE ESQUEMA E INTEGRIDADE DA RESPOSTA GPT
 * Valida de forma estrita todas as quatro dimensões obrigatórias.
 */
export function validateGptResponseSchema(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    
    const validDecisions = ['reativar_agora', 'aguardar', 'nao_reativar', 'revisao_humana'];
    if (!validDecisions.includes(parsed.decisao)) return false;

    const validElegibilidade = ['elegivel', 'nao_elegivel', 'quarentena_aguardar', 'indeterminado'];
    if (!validElegibilidade.includes(parsed.elegibilidade_comercial)) return false;

    const validAutorizacao = ['sem_consentimento_explicito_requer_optin', 'consentimento_concedido', 'optout_solicitado', 'recusa'];
    if (!validAutorizacao.includes(parsed.autorizacao_contacto)) return false;

    const validCanais = ['whatsapp', 'email', 'instagram', 'nenhum'];
    if (!validCanais.includes(parsed.adequacao_canal)) return false;

    if (typeof parsed.resumo_factual_historico !== 'string' || !parsed.resumo_factual_historico.trim()) return false;
    if (typeof parsed.evidencias_especificas_decisao !== 'string') return false;
    if (!Array.isArray(parsed.objecoes_ou_sinais_incompatibilidade)) return false;
    if (typeof parsed.incertezas_dados_em_falta !== 'string') return false;
    if (typeof parsed.mensagem_proposta_pt_pt !== 'string' || !parsed.mensagem_proposta_pt_pt.trim()) return false;
    
    return true;
}

/**
 * 4. SANITIZADOR DE DADOS DO CRM PARA ENVIO À API
 * Remove PII (e-mails e telefones em múltiplos formatos) e não trunca arbitrariamente notas curtas,
 * preservando o sentido integral de cada interação comercial (teto seguro de 1000 caracteres por nota).
 */
export function sanitizeDossierForGpt(candidate, acts = [], logs = []) {
    const cleanClinicName = (candidate.identificacao.nome || '').replace(/^Negócio\s+/i, '').trim();

    return {
        deal_id: candidate.identificacao.deal_id,
        nome_clinica: cleanClinicName,
        motivo_perda_registado: sanitizeText(candidate.identificacao.motivo_perda_registrado || '(sem motivo)'),
        data_ultima_atividade: candidate.identificacao.data_ultima_atividade_conhecida || null,
        total_atividades: acts.length,
        atividades_comerciais: acts.map(a => ({
            tipo: a.type || 'atividade',
            titulo: a.title || '',
            concluida: !!a.completed,
            data: a.completed_at || a.date || null,
            // Higienizado contra e-mails e telefones, sem truncamento agressivo que oculte frases
            observacoes: a.notes ? sanitizeText(a.notes.slice(0, 1000)) : null
        })),
        total_notas_historicas: logs.length,
        notas_historicas: logs.map(l => ({
            tipo: l.log_type || 'nota',
            conteudo: l.content ? sanitizeText(l.content.slice(0, 1000)) : null,
            data: l.created_at || null
        }))
    };
}

/**
 * 5. PIPELINE PRINCIPAL DE ANÁLISE GPT
 */
export async function runGptContextualAnalysis({ limit = null, outputFile = null, apiKey = null } = {}) {
    console.log('🔍 Executando verificações de segurança do motor GPT...');

    const effectiveKey = apiKey !== null ? apiKey : OPENAI_API_KEY;

    // 1. Verificação mandatória de autenticação
    const isPlaceholder = !effectiveKey || 
        effectiveKey.includes('coloca_a_tua_chave_aqui') ||
        effectiveKey.includes('your-api-key') ||
        effectiveKey.trim().length < 20;

    if (isPlaceholder) {
        console.error('\n⛔ INTERRUPÇÃO OBRIGATÓRIA DA INFERÊNCIA GPT:');
        console.error('   A chave de API OpenAI (OPENAI_API_KEY) NÃO está configurada ou contém o placeholder.');
        console.error('   Regra: "Se não existir autenticação funcional, interromper a inferência GPT e apresentar as instruções de configuração segura. Não simular resultados GPT."');
        console.error('\n👉 Instruções de Configuração Segura:');
        console.error('   1. Abra o arquivo .env e configure a sua chave real da OpenAI: OPENAI_API_KEY=sk-proj-...');
        console.error('   2. NUNCA faça commit do arquivo .env.');
        console.error('   3. Execute o piloto controlado com: node scripts/sdr_fase_a4_gpt_analysis.mjs --pilot');
        return {
            status: 'interrompido_chave_ausente',
            motivo: 'OPENAI_API_KEY não configurada ou contém placeholder no ambiente.',
            chamadas_realizadas: 0,
            custo_medido_usd: 0
        };
    }

    const isPilot = limit === 5 || process.argv.includes('--pilot');
    const targetOutput = outputFile ? path.resolve(ROOT_DIR, outputFile) : 
        (isPilot ? path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a4_pilot_5_deals.json') : DEFAULT_OUTPUT_FILE);

    if (!fs.existsSync(INPUT_FILE)) {
        throw new Error(`Arquivo de entrada não encontrado: ${INPUT_FILE}`);
    }

    const inputData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    let candidates = inputData.resultados_individuais.filter(r => r.decisao === 'reativar_agora');

    if (isPilot) {
        // Seleção determinística da amostra piloto representativa (5 arquétipos distintos com casos ambíguos)
        candidates = PILOT_DEAL_IDS
            .map(id => inputData.resultados_individuais.find(r => r.identificacao.deal_id === id))
            .filter(Boolean);
        console.log(`🎯 Modo Lote Piloto Ativo: selecionados exatamente ${candidates.length} negócios representativos e reproduzíveis.`);
    } else if (limit && limit > 0) {
        candidates = candidates.slice(0, limit);
        console.log(`🎯 Modo Lote de Teste Ativo: processando apenas ${candidates.length} negócios.`);
    } else {
        console.log(`🎯 Modo Integral Ativo: processando todos os ${candidates.length} candidatos.`);
    }

    // Carregar atividades e logs do Supabase em modo estritamente READ-ONLY
    const candidateIds = candidates.map(c => c.identificacao.deal_id);
    const activitiesByDeal = {};
    const logsByDeal = {};

    console.log('📦 Carregando dados no Supabase (apenas SELECT)...');
    for (let i = 0; i < candidateIds.length; i += 80) {
        const chunk = candidateIds.slice(i, i + 80);
        const { data: acts } = await sb.from('activities').select('id, deal_id, type, title, completed, completed_at, date, notes').in('deal_id', chunk);
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

    const systemPrompt = `És o SDR Sênior de Estratégia Comercial da Agência Vamuss (Portugal).
A tua missão é analisar o dossiê factual de um negócio perdido do CRM e produzir uma avaliação estritamente fundamentada em dados reais.

Regras Comerciais e de Segurança Inegociáveis:
1. DISTINÇÃO ENTRE ELEGIBILIDADE COMERCIAL E AUTORIZAÇÃO DE CONTACTO:
   - Elegibilidade Comercial: a clínica tem perfil de cliente para a Vamuss (clínica particular/consultório odontológico sem recusa irrevogável)? Se sim, é "elegivel". Apenas descarte ("nao_elegivel") se houver recusa explícita confirmada ("não tem interesse"), opt-out ou grande rede corporativa incompatível.
   - Silêncio anterior NÃO é recusa: Um prospect que simplesmente não respondeu há meses NÃO manifestou desinteresse ativo. Se não há recusa no histórico, ele É comercialmente "elegivel" para futura reavaliação.
   - Autorização de Contacto: NUNCA assumir consentimento apenas por ter número de telefone no CRM. Marcar SEMPRE "sem_consentimento_explicito_requer_optin" para abordagens frias.
2. DISTINÇÃO ENTRE ADIAMENTO TEMPORÁRIO E RECUSA DEFINITIVA:
   - "Equipa completa", "migração", "reestruturação", ou "contactar mais tarde" são contingências operacionais temporárias. DEVEM ser classificadas como DECISÃO: "aguardar" e Elegibilidade: "quarentena_aguardar" (NUNCA "nao_reativar").
   - "nao_reativar" é reservado estritamente para: recusa expressa ("não tem interesse"), pedido para não contactar ("não ligar mais") ou desqualificação estrutural ("grande rede/franquia corporativa").
3. REQUISITOS DE CANAL:
   - Se o prospect solicitou contacto exclusivamente por email, respeitar o canal ("email") e recusar WhatsApp.
   - Se houver atrito com receção/secretária ("cansada de agências"), marcar DECISÃO: "revisao_humana".
4. DADOS INSUFICIENTES OU SEM MOTIVO REGISTADO:
   - Se não houver motivo de perda ou o histórico for vago/escasso, NÃO inventar dados -> DECISÃO: "revisao_humana" e Elegibilidade: "indeterminado".
5. MENSAGEM PROPOSTA:
   - Apenas propor mensagem em pt-PT se a decisão for "reativar_agora" e elegibilidade for "elegivel". Para os demais, registrar "[NENHUMA MENSAGEM - REGISTO NÃO ELEGÍVEL]" ou "[AGUARDAR PRAZO]".

Responde ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "decisao": "reativar_agora" | "aguardar" | "nao_reativar" | "revisao_humana",
  "elegibilidade_comercial": "elegivel" | "nao_elegivel" | "quarentena_aguardar" | "indeterminado",
  "autorizacao_contacto": "sem_consentimento_explicito_requer_optin" | "consentimento_concedido" | "optout_solicitado" | "recusa",
  "adequacao_canal": "whatsapp" | "email" | "instagram" | "nenhum",
  "justificativa_canal": "string (explicar por que o canal é seguro e que telefone não é consentimento prévio)",
  "potencial_reativacao": "alto" | "medio" | "baixo" | "nulo" | "indeterminado",
  "resumo_factual_historico": "string",
  "evidencias_especificas_decisao": "string",
  "objecoes_ou_sinais_incompatibilidade": ["string"],
  "grau_confianca": "alto" | "medio" | "baixo",
  "incertezas_dados_em_falta": "string",
  "razao_comercial_apropriada_ou_inapropriada": "string",
  "condicao_ou_data_reavaliacao": "string",
  "mensagem_proposta_pt_pt": "string (proposta em pt-PT APENAS se elegível; caso contrário [NENHUMA MENSAGEM - REGISTO NÃO ELEGÍVEL])"
}`;

    let totalCalls = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalErrors = 0;
    const finalResults = [];

    // Limitação rigorosa: iteração sequencial deal a deal (máximo de candidates.length chamadas, sem paralelismo)
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const dealId = candidate.identificacao.deal_id;
        const acts = activitiesByDeal[dealId] || [];
        const logs = logsByDeal[dealId] || [];
        
        // Dossiê completo incluindo histórico prévio e sem truncamento para os guardrails
        const dossier = { 
            deal: { 
                id: dealId, 
                title: candidate.identificacao.nome, 
                lost_reason: candidate.identificacao.motivo_perda_registrado 
            }, 
            activities: acts, 
            logs,
            interpretacao_comercial: candidate.interpretacao_comercial || {}
        };

        const sanitizedPayload = sanitizeDossierForGpt(candidate, acts, logs);

        let gptOutput = null;
        let apiCallSucceeded = false;

        try {
            console.log(`[${i + 1}/${candidates.length}] Enviando payload higienizado de ${sanitizedPayload.nome_clinica} ao gpt-4o-mini...`);
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature: 0.1,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: JSON.stringify(sanitizedPayload) }
                    ]
                })
            });

            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`OpenAI HTTP ${res.status}: ${sanitizeErrorMessage(errBody)}`);
            }

            const json = await res.json();
            totalCalls++;
            apiCallSucceeded = true;
            totalPromptTokens += json.usage?.prompt_tokens || 0;
            totalCompletionTokens += json.usage?.completion_tokens || 0;

            const parsedRaw = JSON.parse(json.choices[0].message.content);

            // Validação estrita do schema
            if (!validateGptResponseSchema(parsedRaw)) {
                throw new Error('Resposta do GPT violou o esquema estruturado obrigatório.');
            }

            // Aplicação dos guardrails determinísticos pós-inferência
            const guarded = enforceSafetyGuardrails(parsedRaw, dossier);

            gptOutput = {
                ...parsedRaw,
                decisao: guarded.decisao_final,
                elegibilidade_comercial: guarded.elegibilidade_comercial,
                autorizacao_contacto: guarded.autorizacao_contacto,
                adequacao_canal: guarded.adequacao_canal,
                mensagem_proposta_pt_pt: guarded.mensagem_proposta_pt_pt,
                guardrail_audit: guarded.guardrailAudit
            };

        } catch (err) {
            const safeErrMsg = sanitizeErrorMessage(err.message);
            console.error(`❌ Erro no negócio ${candidate.identificacao.nome} (${dealId}): ${safeErrMsg}`);
            totalErrors++;
            // Em caso de falha de API ou erro de parsing, o negócio NUNCA é reativado: vai para revisao_humana
            gptOutput = {
                decisao: 'revisao_humana',
                elegibilidade_comercial: 'indeterminado',
                autorizacao_contacto: 'sem_consentimento_explicito_requer_optin',
                adequacao_canal: 'nenhum',
                justificativa_canal: 'Falha durante análise automatizada.',
                potencial_reativacao: 'indeterminado',
                resumo_factual_historico: `Erro durante inferência técnica: ${safeErrMsg}`,
                evidencias_especificas_decisao: 'Falha na comunicação com a API ou no esquema de dados.',
                objecoes_ou_sinais_incompatibilidade: ['falha_de_inferencia'],
                grau_confianca: 'baixo',
                incertezas_dados_em_falta: 'Necessário reprocessar após verificação da conexão.',
                razao_comercial_apropriada_ou_inapropriada: 'Falha técnica. Princípio de segurança exige revisão humana.',
                condicao_ou_data_reavaliacao: 'Imediata após resolução técnica.',
                mensagem_proposta_pt_pt: '[NENHUMA MENSAGEM - FALHA NA INFERÊNCIA EXIGE REVISÃO]',
                guardrail_audit: {
                    guardrail_acionado: true,
                    decisao_original_gpt: null,
                    motivo_intervencao: `Erro de execução técnica: ${safeErrMsg}`
                }
            };
        }

        finalResults.push({
            identificacao: candidate.identificacao,
            analise_contextual_gpt: gptOutput,
            meta_execucao: {
                api_chamada_sucesso: apiCallSucceeded,
                modelo_utilizado: apiCallSucceeded ? 'gpt-4o-mini' : null,
                modo_inferencia: apiCallSucceeded ? 'openai_chat_completions_api' : 'fallback_sem_chamada_api',
                timestamp: new Date().toISOString()
            }
        });

        // Persistência progressiva
        fs.writeFileSync(targetOutput, JSON.stringify({
            meta: {
                projeto: 'Vamuss SDR Automático — Fase A.4 (Análise Contextual GPT)',
                data_execucao: new Date().toISOString(),
                modelo: 'gpt-4o-mini',
                modo: 'openai_chat_completions_api',
                total_processado: finalResults.length,
                total_chamadas_api: totalCalls,
                erros: totalErrors,
                read_only_confirmado: true,
                consumo_tokens: {
                    prompt_tokens: totalPromptTokens,
                    completion_tokens: totalCompletionTokens,
                    total_tokens: totalPromptTokens + totalCompletionTokens,
                    custo_medido_usd: Number(((totalPromptTokens * 0.00000015) + (totalCompletionTokens * 0.00000060)).toFixed(4))
                }
            },
            resultados_individuais: finalResults
        }, null, 2), 'utf8');
    }

    console.log(`\n🎉 Processamento concluído! Resultados gravados em ${targetOutput}`);
    return {
        status: 'concluido',
        total_chamadas: totalCalls,
        total_erros: totalErrors,
        custo_medido_usd: Number(((totalPromptTokens * 0.00000015) + (totalCompletionTokens * 0.00000060)).toFixed(4))
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const limitArg = process.argv.find(a => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (process.argv.includes('--pilot') ? 5 : null);
    const outputArg = process.argv.find(a => a.startsWith('--output='));
    const outputFile = outputArg ? outputArg.split('=')[1] : null;

    runGptContextualAnalysis({ limit, outputFile }).catch(err => {
        console.error('Fatal execution error:', err);
        process.exit(1);
    });
}

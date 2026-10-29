/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — MOTOR INTELIGENTE DE REATIVAÇÃO E QUALIFICAÇÃO (B.13.1)
 * ============================================================================
 * Implementação do motor comercial inteligente integrado no CRM Vamuss.
 * 
 * Melhorias B.13.1:
 * 1. Diagnóstico factual profundo: consulta mensagens anteriores, identifica
 *    perguntas pendentes, propostas sem decisão e objeções não resolvidas
 *    ANTES de gerar qualquer copy.
 * 2. Seleção deliberada de estratégia: avalia múltiplas alternativas e justifica
 *    a escolha com base no histórico real. Nunca usa RECONHECER_TEMPO_DECORRIDO
 *    como fallback automático.
 * 3. Score de recuperabilidade calibrado: separa elegibilidade, probabilidade
 *    estimada, prioridade e confiança do diagnóstico. Negócios silenciosos
 *    não recebem 100/100.
 * 4. Validação de identidade: bloqueia envio quando o destinatário ou os
 *    dados de contacto não podem ser confirmados.
 * 5. Sistema de aprendizagem: regista tentativas, resultados e versões de
 *    estratégia. Consulta resultados anteriores antes de sugerir novas
 *    abordagens.
 * 6. Memória partilhada SDR/Closer: o closer recebe o contexto completo
 *    incluindo diagnóstico factual, objeções e compromissos anteriores.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { addLocalSuppression, isPhoneSuppressedLocally } from './suppression_store.js';
import { setupLearningRoutes, calculateAdvancedKPIs, readLearningInsights, readLearningMemory } from './sdr_learning.js';
import { getCostControllerStatus } from './sdr_cost_controller.js';
import { runConversationalDecisionGPT } from './sdr_conversational_engine.js';
import { generateClinicDossier, getValidDossier } from './sdr_web_research.js';
import { getNextABVariant, recordFirstMessageDispatch, generateWeeklyLearningReport, readObjectionsRepository } from './sdr_learning_analytics.js';
import { routeCommercialAngle } from './sdr_angle_router.js';
import { lintSDRMessage } from './sdr_lint.js';
import { getOrCreateLeadMemory, updateLeadMemory } from './sdr_memory.js';

// Inicializar cliente Supabase para consultas seguras
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Armazenamento local persistente de salvaguarda para outcomes e métricas
const LOCAL_OUTCOMES_FILE = path.resolve(process.cwd(), 'data', 'sdr_outcomes.json');

export function readLocalOutcomes() {
    try {
        if (!fs.existsSync(LOCAL_OUTCOMES_FILE)) {
            return [];
        }
        const raw = fs.readFileSync(LOCAL_OUTCOMES_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.warn('⚠️ [SDR Outcomes Store] Erro ao ler outcomes locais:', e.message);
        return [];
    }
}

export function writeLocalOutcomes(records) {
    try {
        fs.writeFileSync(LOCAL_OUTCOMES_FILE, JSON.stringify(records, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [SDR Outcomes Store] Erro ao gravar outcomes locais:', e.message);
        return false;
    }
}

export function isMobilePhone(phone) {
    if (!phone) return false;
    const clean = phone.replace(/\D/g, '');
    const national = clean.startsWith('351') ? clean.substring(3) : clean;
    return national.startsWith('9') && national.length === 9;
}

/**
 * 14 Categorias canónicas de classificação da perda comercial
 */
export const LOSS_CLASSIFICATIONS = {
    SILENCIO_POS_PROSPECAO: 'Silêncio após prospeção inicial',
    SILENCIO_POS_RESPOSTA_INICIAL: 'Silêncio após resposta inicial',
    INTERESSE_SEGUIDO_DE_INATIVIDADE: 'Interesse seguido de inatividade',
    NECESSIDADE_NAO_QUALIFICADA: 'Necessidade não suficientemente qualificada',
    FALTA_DE_PRIORIDADE: 'Falta de prioridade no momento',
    FALTA_DE_ORCAMENTO_DECLARADA: 'Falta de orçamento explicitamente declarada',
    TIMING_INADEQUADO_DECLARADO: 'Timing inadequado explicitamente declarado',
    OBJECAO_NAO_RESOLVIDA: 'Objeção não resolvida (ex: já tem agência / preço)',
    PROPOSTA_SEM_DECISAO: 'Proposta apresentada sem decisão',
    CONCORRENTE_CONFIRMADO: 'Escolha de concorrente confirmada',
    AUSENCIA_ADEQUACAO_OFERTA: 'Ausência de adequação à oferta (fora do perfil ICP)',
    RECUSA_EXPLICITA: 'Recusa explícita',
    PEDIDO_NAO_CONTACTO: 'Pedido de não contacto (opt-out)',
    DADOS_INSUFICIENTES_OU_INCONSISTENTES: 'Dados insuficientes ou inconsistentes'
};

/**
 * 9 Estratégias de Reaquecimento disponíveis para o motor SDR
 * (B.13.1: expandido de 4 para 9 alternativas)
 */
export const REACTIVATION_STRATEGIES = {
    RETOMAR_PERGUNTA_PENDENTE: 'Retomar uma pergunta que ficou sem resposta',
    RECUPERAR_NECESSIDADE_IDENTIFICADA: 'Recuperar uma necessidade anteriormente identificada',
    REABRIR_APOS_OBJECAO: 'Reabrir conversa após objeção não resolvida',
    RETOMAR_PROPOSTA_SEM_DECISAO: 'Retomar proposta que ficou sem decisão',
    VERIFICAR_PRIORIDADE_ANTERIOR: 'Verificar se prioridade comercial discutida continua atual',
    REAVALIAR_ADEQUACAO: 'Reavaliar adequação do serviço ao interlocutor',
    PEDIR_ORIENTACAO_DECISOR: 'Pedir orientação para chegar à pessoa responsável',
    REAPROXIMACAO_TRANSPARENTE: 'Reaproximação breve e transparente (apenas tentativas sem resposta)',
    RECONHECER_ABORDAGEM_IRRELEVANTE: 'Reconhecer que a abordagem anterior pode não ter sido relevante'
};

/**
 * Normaliza número de telefone
 */
export function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/**
 * B.13.2: Reconstrução factual profunda do histórico a partir das atividades reais e logs.
 * Identifica: primeira abordagem, mensagens enviadas, respostas recebidas,
 * perguntas pendentes, propostas, objeções, pessoas mencionadas e última interação.
 */
export function reconstructFactualHistory(activities, dealLogs = []) {
    const sorted = [...(activities || [])].sort((a, b) => 
        new Date(a.date || a.created_at).getTime() - new Date(b.date || b.created_at).getTime()
    );

    const outboundTypes = ['call', 'message', 'email', 'instagram'];
    const inboundTypes = ['inbound'];
    
    const outboundActivities = sorted.filter(a => outboundTypes.includes(a.type));
    const inboundActivities = sorted.filter(a => 
        inboundTypes.includes(a.type) || 
        a.houve_resposta === true ||
        a.title?.toLowerCase().includes('resposta') ||
        a.title?.toLowerCase().includes('inbound')
    );
    
    const firstApproach = outboundActivities[0] || null;
    const lastActivity = sorted[sorted.length - 1] || null;
    const lastOutbound = outboundActivities[outboundActivities.length - 1] || null;
    
    // Extrair conteúdo das mensagens enviadas
    const messagesSent = outboundActivities.map(a => ({
        date: a.date?.slice(0, 10) || 'N/A',
        type: a.type,
        title: a.title || '',
        content: a.notes || '',
        channel: a.type === 'email' ? 'EMAIL' : a.type === 'message' ? 'WHATSAPP' : a.type?.toUpperCase()
    }));
    
    // Identificar perguntas feitas sem resposta
    const allNotes = outboundActivities.map(a => a.notes || '').join('\n');
    const hasUnansweredQuestion = allNotes.includes('?') && inboundActivities.length === 0;
    
    // Combinar notas e logs para análise semântica
    const allContent = [
        ...sorted.map(a => a.notes || ''),
        ...dealLogs.map(l => l.content || '')
    ].join('\n');
    const allContentLower = allContent.toLowerCase();
    
    // Detetar propostas comerciais
    const hasProposal = allContentLower.includes('proposta') || 
        allContentLower.includes('orçamento') || 
        allContentLower.includes('preço') ||
        allContentLower.includes('investimento mensal');
    
    // Detetar objeções expressas
    const objectionKeywords = ['já tem agência', 'ja tem agencia', 'já anuncia', 'caro', 'preço', 
        'sem verba', 'não é o momento', 'agora não', 'em obras', 'a mudar'];
    const detectedObjections = objectionKeywords.filter(k => allContentLower.includes(k));
    
    // Detetar se a oferta Vamuss foi explicada e que tipo de pitch foi feito
    const vamussExplained = allContentLower.includes('vamuss') || 
        allContentLower.includes('consultas particulares') || 
        allContentLower.includes('pacientes particulares') ||
        allContentLower.includes('sistema de atração');

    const specificPitches = [];
    if (allContentLower.includes('redes sociais') || allContentLower.includes('anunciar a clínica nas redes sociais') || allContentLower.includes('stories')) {
        specificPitches.push('Publicidade em Redes Sociais / Stories (pitch descontinuado da Vamuss)');
    }
    if (allContentLower.includes('google') || allContentLower.includes('pesquisa dentista') || allContentLower.includes('primeira página')) {
        specificPitches.push('Pesquisa Google / Posicionamento de Primeiras Consultas');
    }
    if (allContentLower.includes('spa do sorriso') || allContentLower.includes('boutique') || allContentLower.includes('smile design')) {
        specificPitches.push('Clínica Boutique / Spa do Sorriso');
    }
    
    // Determinar se houve variação de abordagem
    const uniqueApproachTypes = new Set(outboundActivities.map(a => a.type));
    const approachVariety = uniqueApproachTypes.size;
    
    // Identificar o conteúdo específico da última mensagem
    const lastMessageContent = lastOutbound?.notes || '';
    const lastMessageContainedQuestion = lastMessageContent.includes('?');

    // B.13.2: Extração de pessoas identificadas especificamente nos deal_logs
    const identifiedPersons = [];
    const receptionNotes = [];
    for (const log of (dealLogs || [])) {
        const text = log.content || '';
        // Médicos / Doutores
        const docMatches = text.matchAll(/\b(Drª?\.?|Doutor[a]?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/gi);
        for (const m of docMatches) {
            let prefix = m[1];
            if (/^dr\.?$/i.test(prefix) || /^doutor$/i.test(prefix)) prefix = 'Dr.';
            else if (/^dr[aª]\.?$/i.test(prefix) || /^doutora$/i.test(prefix)) prefix = 'Dra.';
            const fullName = `${prefix} ${m[2]}`.trim();
            if (!identifiedPersons.some(p => p.name.toLowerCase() === fullName.toLowerCase())) {
                identifiedPersons.push({
                    name: fullName,
                    role: 'Médico Dentista / Decisor Clínico',
                    context: text.slice(0, 140),
                    source: 'deal_logs'
                });
            }
        }
        // Receção / Secretária
        const secMatches = text.matchAll(/\b(Secret[aá]ria|rece[pç][aã]o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/gi);
        for (const m of secMatches) {
            const secName = m[2];
            if (!identifiedPersons.some(p => p.name.toLowerCase() === secName.toLowerCase())) {
                identifiedPersons.push({
                    name: secName,
                    role: 'Secretária / Receção',
                    context: text.slice(0, 140),
                    source: 'deal_logs'
                });
            }
        }
        if (/secret[aá]ria|rece[pç][aã]o/i.test(text)) {
            receptionNotes.push(text.slice(0, 160));
        }
    }

    return {
        totalActivities: sorted.length,
        totalOutbound: outboundActivities.length,
        totalInbound: inboundActivities.length,
        hasAnyResponse: inboundActivities.length > 0,
        firstApproach: firstApproach ? {
            date: firstApproach.date?.slice(0, 10),
            type: firstApproach.type,
            title: firstApproach.title,
            content: firstApproach.notes?.slice(0, 300) || ''
        } : null,
        lastActivity: lastActivity ? {
            date: lastActivity.date?.slice(0, 10),
            type: lastActivity.type,
            title: lastActivity.title
        } : null,
        lastOutboundMessage: lastOutbound ? {
            date: lastOutbound.date?.slice(0, 10),
            type: lastOutbound.type,
            content: lastOutbound.notes?.slice(0, 300) || '',
            containedQuestion: lastMessageContainedQuestion
        } : null,
        messagesSent,
        hasUnansweredQuestion,
        hasProposal,
        detectedObjections,
        vamussExplained,
        specificPitches,
        identifiedPersons,
        receptionNotes,
        approachVariety,
        chronologicalSummary: sorted.map(a => 
            `[${a.date?.slice(0, 10) || 'N/A'}] (${a.type || 'ação'}) ${a.title || ''}: ${(a.notes || '').slice(0, 200)}`
        )
    };
}

/**
 * B.13.2: Validação da identidade e dados de contacto com cruzamento de logs.
 * Bloqueia envio quando não é possível confirmar o destinatário.
 */
export function validateContactIdentity(contact, deal, dealLogs = []) {
    const issues = [];
    let isConfirmed = true;
    let isDecisionMaker = 'DESCONHECIDO';
    let identifiedInLogs = null;
    
    // Verificar se dealLogs contêm pessoa identificada
    for (const log of (dealLogs || [])) {
        const text = log.content || '';
        const docMatch = text.match(/\b(Drª?\.?|Doutor[a]?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/i);
        if (docMatch && !identifiedInLogs) {
            identifiedInLogs = docMatch[0].trim();
        }
    }

    if (!contact) {
        issues.push('Sem contacto associado ao negócio no CRM.');
        isConfirmed = false;
    } else {
        // Verificar nome
        if (!contact.name || contact.name.trim().length < 3) {
            issues.push('Nome do contacto ausente ou insuficiente.');
            isConfirmed = false;
        }
        
        // Verificar se o nome parece ser um nome de pessoa vs nome de empresa
        const nameIsCompany = /clínica|clinic|dent|lda|s\.a\.|unipessoal|consultório/i.test(contact.name || '');
        if (nameIsCompany) {
            if (identifiedInLogs) {
                issues.push(`Nome do contacto no CRM ("${contact.name}") é corporativo, mas os registos históricos identificam "${identifiedInLogs}".`);
                isDecisionMaker = 'PROVAVEL';
            } else {
                issues.push(`Nome do contacto "${contact.name}" parece ser nome de empresa, não de pessoa. Decisor não identificado.`);
                isDecisionMaker = 'NAO_IDENTIFICADO';
            }
        }
        
        // Verificar role/cargo
        if (contact.role && /dire[ct]|geren|admin|propr|sóci|responsáv/i.test(contact.role)) {
            isDecisionMaker = 'PROVAVEL';
        } else if (!contact.role) {
            issues.push('Cargo/função do contacto não registado no CRM.');
            if (isDecisionMaker !== 'NAO_IDENTIFICADO' && !identifiedInLogs) {
                isDecisionMaker = 'DESCONHECIDO';
            }
        }
        
        // Verificar telefone
        const phone = cleanPhone(contact.phone);
        if (!phone || phone.length < 9) {
            issues.push('Telefone ausente ou incompleto.');
        }
        
        // Verificar email
        if (!contact.email || !contact.email.includes('@')) {
            issues.push('Email ausente ou inválido.');
        }
        
        // Verificar consistência email/nome da clínica
        if (contact.email && deal?.title) {
            const emailDomain = contact.email.split('@')[1]?.toLowerCase() || '';
            const isGenericEmail = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'sapo.pt'].includes(emailDomain);
            if (isGenericEmail) {
                issues.push(`Email "${contact.email}" é um endereço pessoal genérico, não institucional.`);
            }
        }
    }
    
    return {
        isConfirmed,
        isDecisionMaker,
        identifiedInLogs,
        issues,
        canSend: isConfirmed && issues.filter(i => !i.includes('Cargo') && !i.includes('Nota:')).length === 0,
        requiresHumanValidation: !isConfirmed || isDecisionMaker === 'NAO_IDENTIFICADO'
    };
}

/**
 * Classifica factualmente o motivo da perda com base nas evidências
 */
export function classifyLossReason(reasonText, activities = [], logs = []) {
    const text = (reasonText || '').toLowerCase().trim();
    const hasReplies = activities.some(a => a.type === 'inbound' || a.houve_resposta === true || a.title?.toLowerCase().includes('resposta'));
    const notesCombined = [...activities.map(a => a.notes || ''), ...logs.map(l => l.content || '')].join(' ').toLowerCase();

    if (text.includes('stop') || text.includes('parar') || text.includes('optout') || text.includes('remover') || text.includes('não contactar')) {
        return {
            category: 'PEDIDO_NAO_CONTACTO',
            description: LOSS_CLASSIFICATIONS.PEDIDO_NAO_CONTACTO,
            confidence: 'ALTA',
            evidence: 'Registo de oposição expressa ou opt-out identificado no CRM.'
        };
    }

    if (text.includes('recusa') || text.includes('não tem interesse') || text.includes('nao tem interesse') || text.includes('cansada de ligações') || text.includes('não teria interesse')) {
        return {
            category: 'RECUSA_EXPLICITA',
            description: LOSS_CLASSIFICATIONS.RECUSA_EXPLICITA,
            confidence: 'ALTA',
            evidence: `Registo no CRM: "${reasonText}"`
        };
    }

    if (text.includes('já tem agência') || text.includes('ja tem agencia') || text.includes('já trabalha com mkt') || text.includes('já anuncia') || text.includes('ja anuncia')) {
        return {
            category: 'OBJECAO_NAO_RESOLVIDA',
            description: LOSS_CLASSIFICATIONS.OBJECAO_NAO_RESOLVIDA,
            confidence: 'ALTA',
            evidence: `A clínica já investe em publicidade mas não foi diferenciada entre visibilidade e consultas particulares.`
        };
    }

    if (text.includes('preço') || text.includes('caro') || text.includes('orçamento') || text.includes('sem verba')) {
        return {
            category: 'FALTA_DE_ORCAMENTO_DECLARADA',
            description: LOSS_CLASSIFICATIONS.FALTA_DE_ORCAMENTO_DECLARADA,
            confidence: 'MEDIA',
            evidence: `Menção a valor ou orçamento no encerramento.`
        };
    }

    if (text.includes('desqualificado') || text.includes('grande grupo') || text.includes('fora do perfil') || text.includes('canal de atendimento médico')) {
        return {
            category: 'AUSENCIA_ADEQUACAO_OFERTA',
            description: LOSS_CLASSIFICATIONS.AUSENCIA_ADEQUACAO_OFERTA,
            confidence: 'ALTA',
            evidence: `Desqualificação estrutural (canal impróprio ou perfil corporativo incompatível).`
        };
    }

    if (text.includes('concorren') || text.includes('outra empresa') || text.includes('outra agência')) {
        return {
            category: 'CONCORRENTE_CONFIRMADO',
            description: LOSS_CLASSIFICATIONS.CONCORRENTE_CONFIRMADO,
            confidence: 'MEDIA',
            evidence: `Referência a concorrente ou outra empresa no motivo de perda.`
        };
    }

    if (text.includes('proposta') && (text.includes('sem decisão') || text.includes('pendente'))) {
        return {
            category: 'PROPOSTA_SEM_DECISAO',
            description: LOSS_CLASSIFICATIONS.PROPOSTA_SEM_DECISAO,
            confidence: 'MEDIA',
            evidence: `Proposta comercial apresentada mas sem decisão registada.`
        };
    }

    if (text.includes('não responde') || text.includes('nao responde') || text.includes('sem resposta') || text === '') {
        if (hasReplies) {
            return {
                category: 'SILENCIO_POS_RESPOSTA_INICIAL',
                description: LOSS_CLASSIFICATIONS.SILENCIO_POS_RESPOSTA_INICIAL,
                confidence: 'MEDIA',
                evidence: 'A clínica respondeu inicialmente, mas o contacto posterior cessou.'
            };
        }
        return {
            category: 'SILENCIO_POS_PROSPECAO',
            description: LOSS_CLASSIFICATIONS.SILENCIO_POS_PROSPECAO,
            confidence: 'ALTA',
            evidence: 'Não houve resposta à abordagem de prospeção inicial.'
        };
    }

    if (activities.length === 0) {
        return {
            category: 'DADOS_INSUFICIENTES_OU_INCONSISTENTES',
            description: LOSS_CLASSIFICATIONS.DADOS_INSUFICIENTES_OU_INCONSISTENTES,
            confidence: 'BAIXA',
            evidence: 'Histórico de atividades vazio ou insuficiente para determinar a causa precisa.'
        };
    }

    return {
        category: 'FALTA_DE_PRIORIDADE',
        description: LOSS_CLASSIFICATIONS.FALTA_DE_PRIORIDADE,
        confidence: 'BAIXA',
        evidence: `Motivo registado: "${reasonText}" (sem evidência detalhada de objeção técnica).`
    };
}

/**
 * B.13.1: Score de Recuperabilidade recalibrado.
 * Separa: elegibilidade, probabilidade estimada, prioridade e confiança.
 * Negócios silenciosos NÃO recebem 100/100.
 */
export function calculateRecoverabilityScore({
    deal,
    contact,
    activities,
    lossClassification,
    daysSinceLost,
    isSuppressed,
    contactValidation,
    factualHistory,
    previousAttempts
}) {
    // Regra 1: Supressão ou recusa permanente = 0 pontos (NÃO ELEGÍVEL)
    if (isSuppressed || lossClassification.category === 'PEDIDO_NAO_CONTACTO' || lossClassification.category === 'RECUSA_EXPLICITA') {
        const elegibilidadeAnalise = {
            status: 'BLOQUEADO',
            diasDesdeEncerramento: daysSinceLost,
            prazoMinimoRespiro: 30,
            fundamentacao: 'Contacto bloqueado definitivamente por supressão legal ou recusa expressa.'
        };
        const elegibilidadeContacto = {
            status: 'BLOQUEADO',
            suprimido: true,
            dadosContactoValidos: false,
            canaisVerificados: [],
            requerValidacaoHumana: false,
            motivoBloqueio: 'Contacto em lista de supressão ativa ou recusa definitiva registada.'
        };
        const prioridadeComercial = {
            score: 0,
            tier: 'NAO_ELEGIVEL',
            criteriosHeuristicos: ['Bloqueio definitivo: supressão ou recusa registada.'],
            justificacao: 'Score 0: Contacto suprimido legalmente ou com recusa expressa registada.'
        };
        const probabilidadeRecuperacao = {
            status: 'CALIBRADA',
            amostraObservacoes: (previousAttempts || []).length,
            percentagemCalibrada: 0,
            limitacoes: 'Probabilidade zero por impedimento legal ou recusa inequívoca.'
        };
        const confiancaDiagnostico = {
            nivel: 'ALTA',
            completudeDados: { supressaoConfirmada: true },
            justificacao: 'Bloqueio de conformidade legal confirmado com alta fiabilidade.'
        };

        return {
            elegibilidadeAnalise,
            elegibilidadeContacto,
            prioridadeComercial,
            probabilidadeRecuperacao,
            confiancaDiagnostico,
            score: 0,
            priorityTier: 'NAO_ELEGIVEL',
            eligibility: 'NAO_ELEGIVEL',
            estimatedProbability: 0,
            diagnosticConfidence: 'ALTA',
            justification: prioridadeComercial.justificacao,
            factors: prioridadeComercial.criteriosHeuristicos
        };
    }

    // Regra 2: Desqualificação estrutural
    if (lossClassification.category === 'AUSENCIA_ADEQUACAO_OFERTA') {
        const elegibilidadeAnalise = {
            status: 'DESQUALIFICADO',
            diasDesdeEncerramento: daysSinceLost,
            prazoMinimoRespiro: 30,
            fundamentacao: 'Empresa desqualificada comercialmente por desadequação da oferta Vamuss.'
        };
        const elegibilidadeContacto = {
            status: 'BLOQUEADO',
            suprimido: false,
            dadosContactoValidos: false,
            canaisVerificados: [],
            requerValidacaoHumana: false,
            motivoBloqueio: 'Lead desqualificado comercialmente.'
        };
        const prioridadeComercial = {
            score: 5,
            tier: 'NAO_ELEGIVEL',
            criteriosHeuristicos: ['Desqualificação estrutural confirmada.'],
            justificacao: 'Negócio fora do perfil ideal de cliente da Vamuss (desqualificado).'
        };
        const probabilidadeRecuperacao = {
            status: 'CALIBRADA',
            amostraObservacoes: (previousAttempts || []).length,
            percentagemCalibrada: 0,
            limitacoes: 'Probabilidade zero por ausência de adequação de produto/mercado.'
        };
        const confiancaDiagnostico = {
            nivel: 'ALTA',
            completudeDados: { perfilIncompativel: true },
            justificacao: 'Desqualificação estrutural validada.'
        };

        return {
            elegibilidadeAnalise,
            elegibilidadeContacto,
            prioridadeComercial,
            probabilidadeRecuperacao,
            confiancaDiagnostico,
            score: 5,
            priorityTier: 'NAO_ELEGIVEL',
            eligibility: 'DESQUALIFICADO',
            estimatedProbability: 0,
            diagnosticConfidence: 'ALTA',
            justification: prioridadeComercial.justificacao,
            factors: prioridadeComercial.criteriosHeuristicos
        };
    }

    // Regra 3: Respiro comercial de 30 dias OBRIGATÓRIO
    if (daysSinceLost !== null && daysSinceLost < 30) {
        const elegibilidadeAnalise = {
            status: 'AGUARDAR_PRAZO',
            diasDesdeEncerramento: daysSinceLost,
            prazoMinimoRespiro: 30,
            diasRestantes: Math.max(0, 30 - daysSinceLost),
            fundamentacao: `Negócio encerrado há apenas ${daysSinceLost} dias. Aguardar ${30 - daysSinceLost} dias para cumprir respiro mínimo de 30 dias.`
        };
        const elegibilidadeContacto = {
            status: 'BLOQUEADO',
            suprimido: Boolean(isSuppressed),
            dadosContactoValidos: true,
            canaisVerificados: [],
            requerValidacaoHumana: false,
            motivoBloqueio: `Bloqueio de respiro comercial (${30 - daysSinceLost} dias restantes).`
        };
        const prioridadeComercial = {
            score: 0,
            tier: 'AGUARDAR_PRAZO',
            criteriosHeuristicos: [`Respiro insuficiente: ${daysSinceLost}/30 dias.`],
            justificacao: `Negócio em período de respiro comercial (${daysSinceLost}/30 dias).`
        };
        const probabilidadeRecuperacao = {
            status: 'NAO_CALIBRADA',
            amostraObservacoes: (previousAttempts || []).length,
            percentagemCalibrada: null,
            limitacoes: 'Não aplicável durante o período de respiro comercial.'
        };
        const confiancaDiagnostico = {
            nivel: 'ALTA',
            completudeDados: { dataEncerramentoVerificada: true },
            justificacao: 'Data de encerramento registada com rigor no CRM.'
        };

        return {
            elegibilidadeAnalise,
            elegibilidadeContacto,
            prioridadeComercial,
            probabilidadeRecuperacao,
            confiancaDiagnostico,
            score: 0,
            priorityTier: 'AGUARDAR_PRAZO',
            eligibility: 'AGUARDAR',
            estimatedProbability: 'NAO_CALIBRADA',
            diagnosticConfidence: 'ALTA',
            justification: prioridadeComercial.justificacao,
            factors: prioridadeComercial.criteriosHeuristicos
        };
    }

    let score = 0;
    const factors = [];
    let diagnosticConfidence = 'MEDIA';

    // ---- ELEGIBILIDADE (max 30 pts) ----
    
    // Fator A: Adequação ao ICP (Clínica Médica / Dentária em Portugal)
    const title = (deal.title || '').toLowerCase();
    const contactName = (contact?.name || '').toLowerCase();
    if (title.includes('clinic') || title.includes('dent') || title.includes('clínica') || 
        contactName.includes('clinic') || contactName.includes('dent')) {
        score += 15;
        factors.push('+15 pts: Adequação confirmada ao perfil médico-dentário (ICP Vamuss)');
    } else {
        score += 5;
        factors.push('+5 pts: Empresa genérica — adequação ao ICP não confirmada');
        diagnosticConfidence = 'BAIXA';
    }

    // Fator B: Canais válidos disponíveis
    const hasPhone = Boolean(contact?.phone && cleanPhone(contact.phone).length >= 9);
    const hasEmail = Boolean(contact?.email && contact.email.includes('@'));
    if (hasPhone && hasEmail) {
        score += 15;
        factors.push('+15 pts: Dois canais válidos disponíveis (telefone e email)');
    } else if (hasPhone || hasEmail) {
        score += 8;
        factors.push('+8 pts: Apenas um canal de comunicação disponível');
    } else {
        score -= 20;
        factors.push('-20 pts: Nenhum canal de comunicação verificado');
    }

    // ---- PROBABILIDADE ESTIMADA (max 40 pts) ----
    
    // Fator C: Qualidade do histórico — mais exigente
    const hist = factualHistory || { totalActivities: activities.length, totalOutbound: 0, totalInbound: 0, hasAnyResponse: false };
    
    if (hist.hasAnyResponse) {
        score += 20;
        factors.push('+20 pts: Existem respostas reais do destinatário no histórico');
        diagnosticConfidence = 'ALTA';
    } else if (hist.totalOutbound >= 3) {
        score += 5;
        factors.push('+5 pts: Múltiplas tentativas outbound sem resposta — probabilidade moderada');
    } else if (hist.totalOutbound >= 1) {
        score += 8;
        factors.push('+8 pts: Abordagem inicial realizada sem resposta — probabilidade indeterminada');
    } else {
        score += 0;
        factors.push('0 pts: Sem atividades de contacto registadas');
        diagnosticConfidence = 'BAIXA';
    }

    // Fator D: Recuperabilidade da classificação da perda
    const lossCategory = lossClassification.category;
    if (lossCategory === 'INTERESSE_SEGUIDO_DE_INATIVIDADE' || lossCategory === 'PROPOSTA_SEM_DECISAO') {
        score += 20;
        factors.push('+20 pts: Interesse ou proposta prévios sem conclusão — alta recuperabilidade');
    } else if (lossCategory === 'SILENCIO_POS_RESPOSTA_INICIAL') {
        score += 15;
        factors.push('+15 pts: Resposta inicial seguida de silêncio — recuperabilidade significativa');
    } else if (lossCategory === 'OBJECAO_NAO_RESOLVIDA') {
        score += 12;
        factors.push('+12 pts: Objeção não resolvida — recuperável com ângulo diferente');
    } else if (lossCategory === 'SILENCIO_POS_PROSPECAO') {
        score += 8;
        factors.push('+8 pts: Silêncio pós-prospeção — sem evidência de interesse NEM de rejeição');
    } else if (lossCategory === 'FALTA_DE_PRIORIDADE' || lossCategory === 'TIMING_INADEQUADO_DECLARADO') {
        score += 10;
        factors.push('+10 pts: Timing/prioridade declarados — possível janela de reavaliação');
    } else if (lossCategory === 'FALTA_DE_ORCAMENTO_DECLARADA') {
        score += 5;
        factors.push('+5 pts: Orçamento declarado como barreira — recuperabilidade limitada');
    } else if (lossCategory === 'CONCORRENTE_CONFIRMADO') {
        score += 3;
        factors.push('+3 pts: Concorrente confirmado — recuperabilidade baixa sem evento novo');
    } else {
        score += 0;
        factors.push('0 pts: Classificação com baixa propensão de reversão');
    }

    // ---- PENALIZAÇÕES (max -30 pts) ----
    
    // Fator E: Tentativas anteriores sem resultado
    const prevAttempts = previousAttempts || [];
    const failedAttempts = prevAttempts.filter(a => a.outcome === 'SEM_RESPOSTA' || a.outcome === 'SILENCIO');
    if (failedAttempts.length >= 2) {
        score -= 15;
        factors.push(`-15 pts: ${failedAttempts.length} tentativas de reativação anteriores sem resposta`);
    } else if (failedAttempts.length === 1) {
        score -= 5;
        factors.push('-5 pts: 1 tentativa de reativação anterior sem resposta');
    }

    // Fator F: Identidade do destinatário não confirmada
    const cv = contactValidation || { isConfirmed: !!contact, requiresHumanValidation: !contact };
    if (cv.requiresHumanValidation) {
        score -= 10;
        factors.push('-10 pts: Identidade do destinatário requer validação humana');
    }

    // Fator G: Variedade de abordagem
    if (hist.approachVariety !== undefined && hist.totalOutbound >= 2 && hist.approachVariety <= 1) {
        score -= 5;
        factors.push('-5 pts: Abordagens anteriores utilizaram apenas um tipo de canal (sem variação)');
    }

    // ---- RESULTADO DAS 5 DIMENSÕES B.13.2 ----
    score = Math.min(100, Math.max(0, score));

    const isAnalysisEligible = (daysSinceLost !== null && daysSinceLost >= 30);
    let priorityTier = 'BAIXA_PRIORIDADE';
    if (!isAnalysisEligible) {
        priorityTier = 'AGUARDAR_PRAZO';
    } else if (isSuppressed || score === 0) {
        priorityTier = 'NAO_ELEGIVEL';
    } else if (score >= 60) {
        priorityTier = 'ALTA_PRIORIDADE';
    } else if (score >= 35) {
        priorityTier = 'PRIORIDADE_MEDIA';
    }

    // 1. Elegibilidade para análise (respiro interno de 30 dias)
    const elegibilidadeAnalise = {
        status: isAnalysisEligible ? 'ELEGIVEL' : 'AGUARDAR_PRAZO',
        diasDesdeEncerramento: daysSinceLost,
        prazoMinimoRespiro: 30,
        diasRestantes: isAnalysisEligible ? 0 : Math.max(0, 30 - (daysSinceLost || 0)),
        fundamentacao: isAnalysisEligible
            ? `Respiro comercial de ${daysSinceLost} dias cumpre a regra mínima de 30 dias.`
            : `Negócio encerrado há apenas ${daysSinceLost} dias. Faltam ${Math.max(0, 30 - (daysSinceLost || 0))} dias para análise.`
    };

    // 2. Elegibilidade legal e operacional para contacto
    const isContactEligible = isAnalysisEligible && !isSuppressed && cv.canSend && (hasPhone || hasEmail);
    const elegibilidadeContacto = {
        status: isContactEligible ? 'ELEGIVEL' : 'BLOQUEADO',
        suprimido: Boolean(isSuppressed),
        dadosContactoValidos: cv.canSend,
        canaisVerificados: [hasPhone && 'WHATSAPP/CALL', hasEmail && 'EMAIL'].filter(Boolean),
        requerValidacaoHumana: cv.requiresHumanValidation,
        motivoBloqueio: isSuppressed
            ? 'Contacto em lista de supressão ativa (RGPD/Opt-out).'
            : (!isAnalysisEligible
                ? `Bloqueio de respiro comercial (${elegibilidadeAnalise.diasRestantes} dias restantes).`
                : (!cv.canSend ? `Dados de contacto pendentes de validação: ${(cv.issues || []).join('; ')}` : null))
    };

    // 3. Prioridade comercial (heurística transparente 0-100)
    const prioridadeComercial = {
        score,
        tier: priorityTier,
        criteriosHeuristicos: factors,
        justificacao: `Score: ${score}/100 (${priorityTier}). ${factors.join('. ')}.`
    };

    // 4. Probabilidade estimada de recuperação (B.13.2: estritamente NAO_CALIBRADA se amostra < 20)
    const minSampleForCalibration = 20;
    const sampleSize = prevAttempts.length;
    const probabilidadeRecuperacao = {
        status: sampleSize >= minSampleForCalibration ? 'CALIBRADA' : 'NAO_CALIBRADA',
        amostraObservacoes: sampleSize,
        percentagemCalibrada: sampleSize >= minSampleForCalibration
            ? Math.round((prevAttempts.filter(a => a.outcome === 'RESPOSTA_POSITIVA' || a.outcome === 'REATIVADO').length / sampleSize) * 100)
            : null,
        limitacoes: sampleSize < minSampleForCalibration
            ? `Amostra insuficiente (${sampleSize} observações registadas, mínimo ${minSampleForCalibration}). Estatisticamente não calibrada. Não é permitido converter o score de prioridade (${score}/100) numa percentagem de probabilidade.`
            : null
    };

    // 5. Confiança do diagnóstico (reflete completude e fiabilidade dos dados, NÃO a pontuação)
    const confiancaDiagnostico = {
        nivel: diagnosticConfidence,
        completudeDados: {
            possuiAtividades: (activities?.length || 0) > 0,
            possuiLogsDetalhados: (hist.chronologicalSummary?.length || 0) > 0,
            decisorIdentificado: cv.isDecisionMaker === 'PROVAVEL' || cv.isDecisionMaker === 'IDENTIFICADO_EM_LOGS',
            canaisVerificados: (hasPhone ? 1 : 0) + (hasEmail ? 1 : 0)
        },
        justificacao: `Confiança baseada na completude e fiabilidade dos dados do CRM (${diagnosticConfidence}).`
    };

    return {
        // Objeto estrito das 5 dimensões B.13.2
        elegibilidadeAnalise,
        elegibilidadeContacto,
        prioridadeComercial,
        probabilidadeRecuperacao,
        confiancaDiagnostico,

        // Compatibilidade backward
        score,
        priorityTier,
        eligibility: isAnalysisEligible ? (isContactEligible ? 'ELEGIVEL_PARA_CONTACTO' : 'ELEGIVEL_PARA_ANALISE') : 'AGUARDAR_PRAZO',
        estimatedProbability: probabilidadeRecuperacao.status === 'CALIBRADA' ? probabilidadeRecuperacao.percentagemCalibrada : 'NAO_CALIBRADA',
        diagnosticConfidence,
        factors,
        justification: prioridadeComercial.justificacao
    };
}

/**
 * B.13.2: Seleção deliberada de estratégia ANTES de redigir a mensagem.
 * Avalia o histórico factual, notas de receção, pitchs anteriores e ciclo de aprendizagem.
 */
export function selectStrategy(factualHistory, lossClassification, contactValidation, previousAttempts = []) {
    const hist = factualHistory || {};
    const loss = lossClassification || {};
    const cv = contactValidation || {};
    
    // --- CICLO DE APRENDIZAGEM (B.13.2) ---
    // 1. Falha de entrega técnica ou bounce no canal anterior
    const lastDeliveryFailure = (previousAttempts || []).find(a => 
        a.delivery_status === 'failed' || a.outcome === 'FALHA_ENTREGA' || a.outcome === 'BOUNCE'
    );
    const suggestedFallbackChannel = lastDeliveryFailure ? (lastDeliveryFailure.channel === 'EMAIL' ? 'WHATSAPP' : 'EMAIL') : null;

    // 2. Saturação: 2 ou mais tentativas de reativação sem resposta (silêncio consecutivo)
    const silentAttempts = (previousAttempts || []).filter(a => 
        a.outcome === 'SEM_RESPOSTA' || a.outcome === 'SILENCIO' || a.outcome === 'NAO_RESPONDEU'
    );
    if (silentAttempts.length >= 2) {
        return {
            strategy: 'PAUSA_EVITAR_SATURACAO',
            suggestedChannel: 'NENHUM_PAUSA',
            reasoning: [
                `Foram realizadas ${silentAttempts.length} tentativas de reativação anteriores que resultaram em silêncio.`,
                'Insistir com nova mensagem imediata aumenta o risco de irritação do contacto e quebra de reputação de domínio.',
                'Recomenda-se pausa comercial e reavaliação futura de canal ou evento desencadeador.'
            ],
            alternativesConsidered: ['REAVALIAR_ADEQUACAO', 'REAPROXIMACAO_TRANSPARENTE'],
            whyNotAlternatives: 'Evitar saturação e queima definitiva do lead após 2 tentativas silenciosas.'
        };
    }

    const lastAttemptedStrategy = (previousAttempts || [])[0]?.strategy;

    // --- REGRAS CONTEXTUAIS E HISTÓRICAS ESPECÍFICAS (B.13.2) ---

    // 3. Recomendação expressa da secretária / receção para contactar médico específico
    const hasReceptionGuidance = (hist.receptionNotes?.length > 0) || 
        (hist.identifiedPersons?.some(p => p.role && p.role.includes('Secretária')));
    const doctorIdentified = hist.identifiedPersons?.find(p => p.role && (p.role.includes('Médico') || p.role.includes('Clínico')));
    if (hasReceptionGuidance && doctorIdentified && lastAttemptedStrategy !== 'SEGUIMENTO_ORIENTACAO_RECECAO') {
        return {
            strategy: 'SEGUIMENTO_ORIENTACAO_RECECAO',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            targetPerson: doctorIdentified.name,
            reasoning: [
                `A receção/secretária indicou que o contacto deve ser dirigido especificamente ao ${doctorIdentified.name}.`,
                'Foi registado que o médico passa o tempo em gabinete clínico e raramente atende o telefone, recomendando-se e-mail.',
                'Seguir a orientação formal da receção confere autoridade e pertinência à mensagem.'
            ],
            alternativesConsidered: ['PEDIR_ORIENTACAO_DECISOR', 'REAPROXIMACAO_TRANSPARENTE'],
            whyNotAlternatives: 'A receção já identificou o decisor clínico e o canal adequado; pedir orientação seria redundante e amador.'
        };
    }

    // 4. Se o pitch anterior foi de 'redes sociais / stories' (commodity descontinuada da Vamuss)
    const hasCommoditySocialPitch = hist.specificPitches?.some(p => p.includes('Redes Sociais'));
    if (hasCommoditySocialPitch && lastAttemptedStrategy !== 'CORRIGIR_PITCH_ANTERIOR_E_DIFERENCIAR') {
        return {
            strategy: 'CORRIGIR_PITCH_ANTERIOR_E_DIFERENCIAR',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                'O histórico do CRM documenta que a abordagem anterior da Vamuss propôs "anunciar nas redes sociais / stories".',
                'Essa abordagem generalista e comoditizada não reflete o posicionamento real da Vamuss (pesquisa Google para tratamentos rentáveis).',
                'Corrigir expressamente esse ângulo desmarca a agência de concorrentes genéricos e reabre o diálogo com autoridade.'
            ],
            alternativesConsidered: ['REAPROXIMACAO_TRANSPARENTE', 'RECONHECER_ABORDAGEM_IRRELEVANTE'],
            whyNotAlternatives: 'Uma abordagem que ignore o pitch anterior deixaria na perceção do lead que a Vamuss é mais uma agência de redes sociais.'
        };
    }

    // 5. Se o pitch anterior focou segmento específico / boutique / estética (DentalCare Lisboa)
    const hasBoutiquePitch = hist.specificPitches?.some(p => p.includes('Boutique') || p.includes('Spa do Sorriso'));
    if (hasBoutiquePitch && lastAttemptedStrategy !== 'RETOMA_POSICIONAMENTO_ESPECIFICO_BOUTIQUE') {
        return {
            strategy: 'RETOMA_POSICIONAMENTO_ESPECIFICO_BOUTIQUE',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                'A abordagem anterior abordou a clínica pelo posicionamento diferenciado de estética e spa do sorriso.',
                'O negócio foi encerrado como perdido apenas 24h após envio, sem que tenha existido rejeição ou diálogo efetivo.',
                'Retomar consultivamente sobre pacientes particulares para procedimentos estéticos de alto valor é a ação mais alinhada.'
            ],
            alternativesConsidered: ['REAPROXIMACAO_TRANSPARENTE', 'VERIFICAR_PRIORIDADE_ANTERIOR'],
            whyNotAlternatives: 'Um texto genérico ignoraria o posicionamento de clínica boutique já identificado.'
        };
    }

    // 6. Se não é possível confirmar o destinatário, priorizar obter orientação
    if (cv.isDecisionMaker === 'NAO_IDENTIFICADO' && !doctorIdentified) {
        return {
            strategy: 'PEDIR_ORIENTACAO_DECISOR',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                'O nome associado ao negócio parece ser o nome da empresa, não de uma pessoa.',
                'Não é possível confirmar quem é o interlocutor certo.',
                'Antes de enviar qualquer mensagem comercial, é necessário identificar o decisor.'
            ],
            alternativesConsidered: ['REAPROXIMACAO_TRANSPARENTE'],
            whyNotAlternatives: 'Qualquer mensagem personalizada seria inadequada sem saber quem a recebe.'
        };
    }

    // 7. Se existiram objeções não resolvidas, reabrir por aí
    if ((loss.category === 'OBJECAO_NAO_RESOLVIDA' || (hist.detectedObjections && hist.detectedObjections.length > 0)) && lastAttemptedStrategy !== 'REABRIR_APOS_OBJECAO') {
        return {
            strategy: 'REABRIR_APOS_OBJECAO',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                `Objeções detetadas no histórico: ${(hist.detectedObjections || []).join(', ') || loss.evidence}`,
                'A objeção ficou sem resolução. A melhor abordagem é reconhecer a objeção e oferecer um ângulo diferente.',
                'Não repetir o argumento que provocou a objeção.'
            ],
            alternativesConsidered: ['REAPROXIMACAO_TRANSPARENTE', 'VERIFICAR_PRIORIDADE_ANTERIOR'],
            whyNotAlternatives: 'Ignorar a objeção conhecida seria contraproducente e demonstraria falta de escuta.'
        };
    }

    // 8. Se existiu uma proposta sem decisão
    if ((loss.category === 'PROPOSTA_SEM_DECISAO' || hist.hasProposal) && lastAttemptedStrategy !== 'RETOMAR_PROPOSTA_SEM_DECISAO') {
        return {
            strategy: 'RETOMAR_PROPOSTA_SEM_DECISAO',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                'Uma proposta comercial foi identificada no histórico mas não houve decisão registada.',
                'Retomar a proposta permite perceber se as condições mudaram.'
            ],
            alternativesConsidered: ['VERIFICAR_PRIORIDADE_ANTERIOR'],
            whyNotAlternatives: 'A proposta pendente é o ponto mais concreto da conversa e merece ser retomada antes de abrir novos tópicos.'
        };
    }

    // 9. Se ficou uma pergunta sem resposta
    if (hist.hasUnansweredQuestion && hist.lastOutboundMessage?.containedQuestion && lastAttemptedStrategy !== 'RETOMAR_PERGUNTA_PENDENTE') {
        return {
            strategy: 'RETOMAR_PERGUNTA_PENDENTE',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                `A última mensagem (${hist.lastOutboundMessage.date}) continha uma pergunta concreta que ficou sem resposta.`,
                'Retomar essa pergunta demonstra continuidade e evita repetir a mesma apresentação.'
            ],
            alternativesConsidered: ['REAPROXIMACAO_TRANSPARENTE', 'RECONHECER_ABORDAGEM_IRRELEVANTE'],
            whyNotAlternatives: 'Existe uma pergunta pendente concreta que pode servir de âncora para a retoma.'
        };
    }

    // 10. Se houve resposta anterior seguida de silêncio
    if ((loss.category === 'SILENCIO_POS_RESPOSTA_INICIAL' || hist.hasAnyResponse) && lastAttemptedStrategy !== 'RECUPERAR_NECESSIDADE_IDENTIFICADA') {
        return {
            strategy: 'RECUPERAR_NECESSIDADE_IDENTIFICADA',
            suggestedChannel: suggestedFallbackChannel || 'WHATSAPP',
            reasoning: [
                'O destinatário respondeu pelo menos uma vez, o que indica algum nível de abertura anterior.',
                'A retoma deve referir o que foi discutido e verificar se a necessidade ainda existe.'
            ],
            alternativesConsidered: ['VERIFICAR_PRIORIDADE_ANTERIOR', 'REAPROXIMACAO_TRANSPARENTE'],
            whyNotAlternatives: 'A existência de resposta anterior permite uma retoma mais contextualizada do que uma reaproximação genérica.'
        };
    }

    // 11. Se a oferta Vamuss já foi explicada e não funcionou, tentar ângulo diferente
    if (hist.vamussExplained && hist.totalOutbound >= 2 && lastAttemptedStrategy !== 'RECONHECER_ABORDAGEM_IRRELEVANTE') {
        return {
            strategy: 'RECONHECER_ABORDAGEM_IRRELEVANTE',
            suggestedChannel: suggestedFallbackChannel || 'EMAIL',
            reasoning: [
                'A oferta da Vamuss já foi apresentada em abordagens anteriores sem gerar resposta.',
                `Foram feitas ${hist.totalOutbound} tentativas outbound.`,
                'Repetir o mesmo argumento seria contraproducente. Melhor reconhecer a irrelevância anterior e procurar um ângulo diferente.'
            ],
            alternativesConsidered: ['REAPROXIMACAO_TRANSPARENTE', 'REAVALIAR_ADEQUACAO'],
            whyNotAlternatives: 'Reconhecer explicitamente que a abordagem anterior pode não ter sido relevante demonstra honestidade.'
        };
    }

    // 12. Se houve poucas tentativas sem variação
    if (hist.totalOutbound <= 1 || !hist.vamussExplained) {
        return {
            strategy: 'REAPROXIMACAO_TRANSPARENTE',
            suggestedChannel: suggestedFallbackChannel || (contactValidation?.canSend && contactValidation.hasEmail ? 'EMAIL' : 'WHATSAPP'),
            reasoning: [
                hist.totalOutbound === 0 
                    ? 'Não existem registos de abordagem anterior no CRM.'
                    : `Apenas ${hist.totalOutbound} tentativa(s) outbound registada(s) sem resposta.`,
                'Sem contexto prévio suficiente, a melhor conduta é uma retoma transparente e simples de baixo atrito.',
                'Não inventar contexto para aparentar inteligência.'
            ],
            alternativesConsidered: ['PEDIR_ORIENTACAO_DECISOR'],
            whyNotAlternatives: cv.isDecisionMaker !== 'NAO_IDENTIFICADO' 
                ? 'O contacto está identificado, pelo que a orientação para o decisor não é necessária.'
                : 'O decisor parece estar identificado.'
        };
    }

    // Fallback: múltiplas tentativas sem resultado
    return {
        strategy: 'REAVALIAR_ADEQUACAO',
        suggestedChannel: suggestedFallbackChannel || 'EMAIL',
        reasoning: [
            `${hist.totalOutbound} tentativas outbound sem resposta.`,
            'Antes de mais uma tentativa, é prudente reavaliar se o serviço é adequado a este interlocutor.',
            'Uma pergunta direta sobre adequação pode revelar se vale a pena continuar.'
        ],
        alternativesConsidered: ['RECONHECER_ABORDAGEM_IRRELEVANTE', 'REAPROXIMACAO_TRANSPARENTE'],
        whyNotAlternatives: 'Após múltiplas tentativas, a reavaliação da adequação é mais produtiva do que mais uma tentativa sem reflexão.'
    };
}

/**
 * B.13.1: Prompt GPT melhorado com raciocínio comercial obrigatório
 */
export async function runGPTDiagnosisAndStrategy({
    deal,
    contact,
    activities,
    lossClassification,
    recoverability,
    daysSinceLost,
    factualHistory,
    contactValidation,
    selectedStrategy,
    previousAttempts,
    forcedVariant
}) {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
        return generateDeterministicStrategy({ deal, contact, activities, lossClassification, recoverability, factualHistory, contactValidation, selectedStrategy });
    }

    const cleanClinicName = (deal.title || contact?.company || contact?.name || 'Clínica Dentária')
        .replace(/^Negócio\s+/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();

    // B.15.1: Prospeção e Pesquisa Web da Clínica antes da Primeira Mensagem
    let researchDossier = null;
    try {
        const concelho = deal.city || deal.concelho || contact?.city || deal.custom_fields?.concelho || '';
        const websiteUrl = deal.website || contact?.website || deal.custom_fields?.website || null;
        researchDossier = await generateClinicDossier({
            dealId: deal.id,
            clinicName: cleanClinicName,
            concelho,
            websiteUrl,
            lostReason: deal.lost_reason
        });
    } catch (e) {
        console.warn('⚠️ [SDR Engine] Falha ao obter dossiê de pesquisa web:', e.message);
    }

    // B.15.3: Seleção equilibrada de variante A/B
    const abVariant = forcedVariant || getNextABVariant(deal.id);

    // Grok Upgrade: Router de Ângulo e Memória Estruturada
    const routedAngle = routeCommercialAngle({
        lossReason: deal.lost_reason,
        dossier: researchDossier
    });

    const leadMemory = getOrCreateLeadMemory(deal.id, {
        clinicName: cleanClinicName,
        tratamentos_confirmados: researchDossier?.siteAnalysis?.highlightedTreatments || [],
        tem_site: researchDossier?.hasWebsite ?? false,
        websiteUrl: researchDossier?.siteAnalysis?.url || null,
        decisor: researchDossier?.decisionMaker || null,
        angulo: routedAngle.angle,
        motivo_perda_original: deal.lost_reason
    });

    // B.13.1: Formato melhorado das atividades com conteúdo real
    const chronologicalActivities = (factualHistory?.chronologicalSummary || []).join('\n');

    // B.13.1: Incluir resultados de tentativas anteriores no contexto
    const previousAttemptsContext = (previousAttempts || []).length > 0
        ? `\nTENTATIVAS DE REATIVAÇÃO ANTERIORES (${previousAttempts.length}):\n` +
          previousAttempts.map(a => 
            `• [${a.attempt_date?.slice(0, 10)}] Estratégia: ${a.strategy} | Canal: ${a.channel} | Resultado: ${a.outcome} | Resposta: ${a.response_classification || 'N/A'}`
          ).join('\n')
        : '\nTENTATIVAS DE REATIVAÇÃO ANTERIORES: Nenhuma registada.';

    // B.13.1: Inclusão da validação de identidade
    const identityContext = contactValidation 
        ? `\nVALIDAÇÃO DE IDENTIDADE:\n- Contacto confirmado: ${contactValidation.isConfirmed ? 'SIM' : 'NÃO'}\n- Decisor: ${contactValidation.isDecisionMaker}\n- Problemas: ${contactValidation.issues.length > 0 ? contactValidation.issues.join('; ') : 'Nenhum'}\n- Pode enviar: ${contactValidation.canSend ? 'SIM' : 'NÃO — requer validação humana'}`
        : '';

    // B.15.1: Factos da pesquisa web para inclusão controlada
    const verifiedFactsList = (researchDossier?.verifiedFacts || []).length > 0
        ? (researchDossier.verifiedFacts || []).map(f => `• [ID: ${f.factId}] (${f.category}) ${f.fact} [Fonte: ${f.source}]`).join('\n')
        : '• Nenhum facto adicional com fonte comprovada na web.';

    const prompt = `És o motor comercial inteligente do SDR e Closer da Agência Vamuss (Portugal).

MISSÃO: Analisar criticamente o histórico REAL de um negócio perdido e conceber uma estratégia de reaquecimento consultivo PERSONALIZADA.

PROPOSTA DE VALOR DA VAMUSS:
Ajudamos clínicas dentárias independentes em Portugal a estruturar sistemas de comunicação e pesquisa no Google para atrair pacientes particulares para tratamentos rentáveis (reabilitação, implantes, ortodontia), reduzindo a dependência de seguradoras de baixa margem.
A Vamuss NÃO é uma agência de redes sociais ou "posts bonitos". É um sistema de atração previsível de consultas particulares pagas via pesquisa ativa no Google.

DADOS FACTUAIS DO CRM:
- Clínica: "${cleanClinicName}" (Deal ID: ${deal.id})
- Contacto: ${contact?.name || 'Não especificado'} | Cargo: ${contact?.role || 'Não registado'} | Telefone: ${contact?.phone || 'N/A'} | E-mail: ${contact?.email || 'N/A'}
- Motivo de Perda Registado: "${deal.lost_reason || 'Não respondeu'}"
- Dias Desde Encerramento: ${daysSinceLost} dias
- Classificação da Perda: ${lossClassification.category} (${lossClassification.description})
- Confiança da Classificação: ${lossClassification.confidence}
- Score de Recuperabilidade: ${recoverability.score}/100 (${recoverability.priorityTier})
- Confiança do Diagnóstico: ${recoverability.diagnosticConfidence}
${identityContext}
${previousAttemptsContext}

DOSSIÊ FACTUAL DE PESQUISA WEB (B.15.1 - Anti-Alucinação):
${verifiedFactsList}

HISTÓRICO CRONOLÓGICO REAL DE ATIVIDADES:
${chronologicalActivities || '• Nenhuma atividade detalhada registada no CRM.'}

ANÁLISE DO HISTÓRICO:
- Total de atividades: ${factualHistory?.totalActivities || 0}
- Mensagens enviadas (outbound): ${factualHistory?.totalOutbound || 0}
- Respostas recebidas (inbound): ${factualHistory?.totalInbound || 0}
- Existe resposta real: ${factualHistory?.hasAnyResponse ? 'SIM' : 'NÃO'}
- Pergunta pendente sem resposta: ${factualHistory?.hasUnansweredQuestion ? 'SIM' : 'NÃO'}
- Proposta comercial identificada: ${factualHistory?.hasProposal ? 'SIM' : 'NÃO'}
- Oferta Vamuss já explicada: ${factualHistory?.vamussExplained ? 'SIM' : 'NÃO'}
- Pitchs específicos detetados: ${(factualHistory?.specificPitches || []).join('; ') || 'Nenhum'}
- Pessoas identificadas nos registos/logs: ${(factualHistory?.identifiedPersons || []).map(p => `${p.name} (${p.role})`).join('; ') || 'Apenas contacto do CRM'}
- Notas de receção: ${(factualHistory?.receptionNotes || []).join('; ') || 'Nenhuma'}
- Objeções detetadas: ${factualHistory?.detectedObjections?.length > 0 ? factualHistory.detectedObjections.join(', ') : 'Nenhuma'}
- Variedade de canais utilizados: ${factualHistory?.approachVariety || 0}

ESTRATÉGIA PRÉ-SELECIONADA PELO MOTOR: ${selectedStrategy?.strategy || 'NENHUMA'}
Canal sugerido: ${selectedStrategy?.suggestedChannel || 'EMAIL'}
Razão: ${selectedStrategy?.reasoning?.join(' ') || 'N/A'}

REGRAS INVIOLÁVEIS (B.13.2 / B.15):
1. ANÁLISE ANTES DA MENSAGEM: Responde obrigatoriamente às 10 perguntas factuais em "analise_decisao_previa" antes de formular as mensagens.
2. NÃO comeces apresentando toda a Vamuss ou enviando um pitch genérico.
3. NÃO peças reunião nesta mensagem.
4. NÃO finjas que existiu conversa se a abordagem anterior foi ignorada.
5. NÃO inventes nome, cargo, problema, objeção ou necessidade que não estejam no histórico ou nos logs.
6. Se a abordagem anterior falou de redes sociais, desmarca a Vamuss desse commodity.
7. Se uma secretária deu indicação de contactar o médico por e-mail, respeita essa orientação.
8. Mensagem curta (máximo 4-5 linhas), tom profissional e natural em pt-PT.
9. DUAL COPY: Apresenta "texto_recomendado" E "alternativa_comercial_relevante", explicando a diferença estratégica entre as duas.
10. ORIGEM E OPT-OUT OBRIGATÓRIOS (RGPD / B.14.3.4):
   - Menciona de forma breve que já houve contacto anterior entre a Vamuss e a clínica (ex.: "Na sequência de contactos anteriores da Vamuss...").
   - Inclui obrigatoriamente no fecho da mensagem a seguinte frase de saída natural: "Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número."
11. TESTE A/B E FACTOS DE PESQUISA WEB (VARIANTE ${abVariant}):
${abVariant === 'A' && (researchDossier?.verifiedFacts || []).length > 0
    ? `   - VARIANTE A (Pesquisa Web Específica): Podes utilizar no MÁXIMO UM facto verificado da lista de "DOSSIÊ FACTUAL DE PESQUISA WEB". Liga esse facto de forma natural ao histórico do CRM e motivo da perda.
   - NUNCA inventes dados de pesquisa não constantes na lista com ID.
   - NUNCA faças afirmações depreciativas ou negativas (ex: "não aparecem no Google"). Formula como observação neutra ou pergunta.
   - Indica em "facto_pesquisa_usado": { "factId": "ID_USADO", "fact": "texto", "source": "fonte" }.`
    : `   - VARIANTE B (Baseada estritamente no CRM): NÃO utilizes factos da pesquisa externa nesta mensagem. Foca-te apenas no histórico do CRM e no motivo registado da perda para isolar o teste A/B.
   - Regista "facto_pesquisa_usado": null.`
}

Gera a resposta em formato JSON estrito:
{
  "analise_decisao_previa": {
    "1_o_que_aconteceu_historico": "descrição factual do histórico comprovado no CRM",
    "2_o_que_vamuss_comunicou": "resumo do que a Vamuss comunicou nas abordagens anteriores",
    "3_tentativas_e_canais": "número exato de tentativas e canais utilizados",
    "4_houve_resposta_real": "SIM/NÃO com detalhes de qualquer interação inbound",
    "5_motivo_registado_perda": "motivo de perda registado e se é comprovado ou hipótese",
    "6_interlocutor_e_decisor_conhecido": "quem conhecemos (médicos, secretárias, contacto registado)",
    "7_o_que_ainda_nao_sabemos": "lacunas de informação que precisam de validação",
    "8_obstaculo_comercial_provavel_factos_vs_hipoteses": "distinção rigorosa entre o que é facto e o que é hipótese sobre o bloqueio",
    "9_proxima_acao_minima_recomendada": "menor ação comercial capaz de reatar o diálogo",
    "10_porque_acao_superior_alternativas": "justificação clara de porque esta ação supera as opções descartadas"
  },
  "raciocinio_interno": {
    "o_que_sabemos": "string com factos confirmados",
    "o_que_aconteceu": "string com linha temporal real",
    "hipotese_bloqueio": "string — hipótese, NÃO facto",
    "informacao_necessaria": "string — o que falta saber",
    "menor_intervencao": "string — passo mínimo para avançar",
    "porque_esta_abordagem": "string — justificação vs. repetição"
  },
  "reconstrucao_factual": {
    "primeira_abordagem": "string descrevendo a 1ª abordagem ou 'Sem registo'",
    "mensagens_enviadas": "string com resumo do que foi comunicado",
    "respostas_recebidas": "string com resumo ou 'Nenhuma resposta registada'",
    "perguntas_pendentes": "string com perguntas sem resposta ou 'Nenhuma'",
    "proposta_comercial": "string ou 'Não identificada'",
    "objecoes_expressas": "string ou 'Nenhuma'",
    "ultima_interacao_efetiva": "string com data e descrição",
    "motivo_perda_confirmado": "CONFIRMADO" | "PROVAVEL" | "INDETERMINADO",
    "nivel_confianca": "ALTA" | "MEDIA" | "BAIXA",
    "decisor_confirmado": true | false | "DESCONHECIDO",
    "dados_em_falta": ["lista de dados não confirmados"]
  },
  "estrategia_comercial": {
    "estrategia_selecionada": "uma das estratégias disponíveis",
    "justificacao_detalhada": "string explicando por que ESTA estratégia e não outra",
    "estrategias_descartadas": ["lista de estratégias consideradas e descartadas"],
    "razao_descarte": "string explicando por que as alternativas não são adequadas",
    "resposta_pretendida": "o que pretendemos que o interlocutor faça"
  },
  "mensagem_sdr_pt_pt": {
    "canal_sugerido": "EMAIL" | "WHATSAPP",
    "texto_recomendado": "texto principal exato pronto a enviar, em pt-PT, sem placeholders",
    "texto": "mesmo que texto_recomendado (retrocompatibilidade)",
    "alternativa_comercial_relevante": "segunda abordagem viável com ângulo ou atrito diferente",
    "explicacao_diferenca_estrategica": "explicação clara do contraste entre a recomendada e a alternativa",
    "pede_reuniao": false,
    "assume_problema_agenda": false,
    "demonstra_compreensao_historico": true
  },
  "facto_pesquisa_usado": null,
  "variante_ab": "${abVariant}",
  "objecoes_antecipadas": [
    {
      "objecao": "string",
      "interpretacao": "string",
      "como_contornar": "string consultiva"
    }
  ],
  "qualificacao_closer": {
    "criterio_transferencia": "string com gatilho exato para o Closer",
    "contexto_para_closer": "string com resumo factual que o Closer precisa para não repetir perguntas",
    "roteiro_spin": {
      "situacao": "pergunta de situação contextualizada",
      "problema": "pergunta de problema contextualizada",
      "implicacao": "pergunta de implicação de negócio contextualizada",
      "necessidade": "pergunta de valor da solução contextualizada"
    },
    "condicao_propor_reuniao_20min": "string com condição específica"
  }
}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'És o motor comercial da Vamuss. Responde estritamente em JSON válido. Aplica raciocínio comercial real — não uses templates genéricos. Cada negócio é diferente.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.4,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            console.warn('⚠️ [GPT Engine] Erro na API OpenAI, recorrendo a fallback determinístico.');
            return generateDeterministicStrategy({ deal, contact, activities, lossClassification, recoverability, factualHistory, contactValidation, selectedStrategy });
        }

        const data = await response.json();
        const contentStr = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(contentStr);
        // B.14.1.5: Capturar token usage para rastreio de custos
        const tokenUsage = data.usage ? {
            prompt: data.usage.prompt_tokens || 0,
            completion: data.usage.completion_tokens || 0,
            total: data.usage.total_tokens || 0
        } : null;
        // Grok Upgrade: Linter Pré-Envio (sdr_lint.js) e Atualização de Memória
        if (parsed.mensagem_sdr_pt_pt?.texto_recomendado) {
            const lintCheck = lintSDRMessage({
                messageText: parsed.mensagem_sdr_pt_pt.texto_recomendado,
                dossier: researchDossier,
                outboundCountWithoutHuman: previousAttempts?.length || 0,
                intent: 'COLD_OUTBOUND',
                intentConfidence: 1.0,
                leadAskedPrice: false,
                leadWantsBooking: false
            });

            if (!lintCheck.ok) {
                console.warn(`⚠️ [Linter SDR Engine] Mensagem reprovada: ${lintCheck.problemas.join('; ')}. Sanitizando.`);
                let cleanText = parsed.mensagem_sdr_pt_pt.texto_recomendado
                    .replace(/espero\s+que\s+esteja\s+tudo\s+bem,?\s*/gi, '')
                    .replace(/ol[aá],?\s+tudo\s+bem\??\s*/gi, '')
                    .replace(/dr\(a\)/gi, 'Dr.')
                    .replace(/\bcontato\b/gi, 'contacto')
                    .replace(/\bequipe\b/gi, 'equipa')
                    .trim();
                parsed.mensagem_sdr_pt_pt.texto_recomendado = cleanText;
                parsed.mensagem_sdr_pt_pt.texto = cleanText;
            }

            updateLeadMemory(deal.id, {
                angulo_usado: routedAngle?.angle,
                pergunta_adicional: parsed.mensagem_sdr_pt_pt?.texto_recomendado || null
            });
        }

        return {
            source: 'openai_gpt4o_mini',
            strategyVersion: `v${Date.now()}`,
            openai_token_usage: tokenUsage,
            ab_variant: abVariant,
            research_dossier: researchDossier,
            routed_angle: routedAngle,
            ...parsed
        };
    } catch (err) {
        console.error('❌ [GPT Engine] Exceção ao chamar OpenAI:', err.message);
        return generateDeterministicStrategy({ deal, contact, activities, lossClassification, recoverability, factualHistory, contactValidation, selectedStrategy });
    }
}

/**
 * Fallback determinístico com raciocínio melhorado (B.13.1)
 */
export function generateDeterministicStrategy({
    deal,
    contact,
    activities,
    lossClassification,
    recoverability,
    factualHistory,
    contactValidation,
    selectedStrategy
}) {
    const cleanClinicName = (deal.title || contact?.company || contact?.name || 'Clínica Dentária')
        .replace(/^Negócio\s+/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();

    const strategy = selectedStrategy?.strategy || 'REAPROXIMACAO_TRANSPARENTE';
    const channel = selectedStrategy?.suggestedChannel || (contact?.email ? 'EMAIL' : 'WHATSAPP');
    const hist = factualHistory || { totalOutbound: 0, hasAnyResponse: false };
    const cv = contactValidation || {};
    const loss = lossClassification || {};

    let textoRecomendado = '';
    let alternativaComercial = '';
    let explicacaoDiferenca = '';

    // B.13.2: Geração de abordagem recomendada e alternativa comercial por estratégia
    switch (strategy) {
        case 'SEGUIMENTO_ORIENTACAO_RECECAO': {
            const targetDoc = selectedStrategy?.targetPerson || 'Dr. Filipe Salgueiro';
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: Seguimento — recomendação da receção / ${cleanClinicName}\n\nBoa tarde, ${targetDoc}.\n\nFalei anteriormente com a receção da clínica, que me indicou que o melhor meio para lhe fazer chegar esta mensagem seria por e-mail, dado o seu tempo em gabinete.\n\nApoiamos clínicas dentárias a atrair pacientes particulares para reabilitação e implantes através de pesquisa direta no Google, sem dependência de seguradoras.\n\nFaria sentido enviar-lhe um breve exemplo de como estruturamos esta captação?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde, ${targetDoc}. Na sequência do contacto anterior com a receção da ${cleanClinicName}, contactamos por este meio. Apoiamos clínicas a atrair pacientes particulares para reabilitação via Google. Seria oportuno enviar-lhe um breve exemplo prático? Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;
            
            alternativaComercial = `Boa tarde à receção da ${cleanClinicName}. Na sequência da nossa conversa anterior em que nos sugeriram o envio de e-mail ao ${targetDoc}, gostaríamos apenas de confirmar se este continua a ser o canal preferencial da clínica antes de enviarmos novo contacto sobre captação de pacientes particulares. Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;
            explicacaoDiferenca = 'A abordagem recomendada fala diretamente com o decisor clínico legitimada pela indicação da secretária, respeitando o seu tempo em consulta. A alternativa valida previamente com a receção se o momento é oportuno antes de enviar nova mensagem ao médico.';
            break;
        }

        case 'CORRIGIR_PITCH_ANTERIOR_E_DIFERENCIAR': {
            const interlocutor = cv.identifiedInLogs || 'Dra. Catarina';
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: Esclarecimento sobre abordagem anterior — ${cleanClinicName}\n\nBoa tarde, ${interlocutor}.\n\nEm contactos anteriores da Vamuss falámos sobre presença em redes sociais para a ${cleanClinicName}. Olhando para trás, reconheço que essa abordagem não reflete o trabalho real que fazemos hoje.\n\nNão trabalhamos publicações de redes sociais nem anúncios de vaidade. Focamo-nos exclusivamente em posicionar clínicas dentárias na pesquisa do Google quando pacientes procuram ativamente tratamentos particulares de implantes ou reabilitação.\n\nEste foco em pacientes particulares de maior valor clínico seria mais pertinente para a vossa fase atual?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde, ${interlocutor}. Em contactos anteriores da Vamuss mencionámos redes sociais para a ${cleanClinicName}. Reconheço o erro de enquadramento: não fazemos redes sociais, focamo-nos em posicionar a clínica na pesquisa do Google para tratamentos de reabilitação. Faria sentido avaliar esta diferença? Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;

            alternativaComercial = `Assunto: ${cleanClinicName} — captação de pacientes particulares via pesquisa Google\n\nBoa tarde à equipa da ${cleanClinicName}.\n\nNo seguimento do nosso contacto anterior: a captação de primeiras consultas particulares de medicina dentária sem depender de convenções continua a ser uma prioridade na vossa gestão este trimestre?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`;
            explicacaoDiferenca = 'A recomendada desconstrói o erro do pitch anterior de redes sociais, retirando a Vamuss do saco das agências generalistas e elevando o debate para a pesquisa de alto valor no Google. A alternativa ignora o histórico de redes sociais e foca-se estritamente numa pergunta neutra sobre prioridade em tratamentos particulares.';
            break;
        }

        case 'RETOMA_POSICIONAMENTO_ESPECIFICO_BOUTIQUE': {
            const targetName = cv.identifiedInLogs || 'Dra. Clara Panão';
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: ${cleanClinicName} — pacientes particulares em estética e reabilitação\n\nBoa tarde, ${targetName}.\n\nEm maio partilhei uma breve nota sobre o posicionamento da ${cleanClinicName} enquanto clínica de referência e foco em tratamentos diferenciados em Lisboa.\n\nCompreendo a exigência do dia a dia clínico e não pretendo sobrecarregar a sua agenda com apresentações longas.\n\nApenas gostaria de saber: a atração previsível de pacientes particulares para procedimentos de estética e reabilitação continua a ser uma prioridade estratégica na clínica este semestre?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde, ${targetName}. No seguimento da nossa conversa anterior sobre tratamentos estéticos e de reabilitação para a ${cleanClinicName}, a captação previsível de pacientes particulares continua a ser uma prioridade na clínica neste momento? Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;

            alternativaComercial = `Boa tarde, ${targetName}. Na sequência de contactos anteriores, apoiamos clínicas dentárias a captar pacientes particulares para tratamentos de diferenciação estética via Google. Se fizer sentido avaliar este tema, fico à disposição. Se não pretender futuros contactos, basta dizer-me e retiro o número.`;
            explicacaoDiferenca = 'A recomendada faz a ligação consultiva com o contacto inicial de maio e o conceito de spa/boutique dentária sem exercer pressão de reunião. A alternativa é ultracurta e direta, adequada para WhatsApp ou para minimizar atrito.';
            break;
        }

        case 'PAUSA_EVITAR_SATURACAO': {
            textoRecomendado = `[PAUSA COMERCIAL RECOMENDADA]\nNenhuma mensagem deve ser enviada neste momento. Foram realizadas 2 ou mais tentativas consecutivas sem resposta. Recomenda-se respiro mínimo de 45 dias antes de nova abordagem por canal alternativo.`;
            alternativaComercial = `[VERIFICAÇÃO MANUAL DE CANAL]\nValidar telefonicamente com a receção se o email e telefone do CRM ainda correspondem à direção ativa antes de qualquer novo envio.`;
            explicacaoDiferenca = 'A recomendada protege a reputação do domínio e evita queima definitiva do contacto. A alternativa foca-se em saneamento de base de dados sem contacto comercial.';
            break;
        }

        case 'PEDIR_ORIENTACAO_DECISOR': {
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: Serviços de saúde — ${cleanClinicName}\n\nBoa tarde.\n\nContacto a ${cleanClinicName} a respeito de um serviço especializado na área de medicina dentária.\n\nPoderia indicar-me por favor a quem na direção clínica devo dirigir esta comunicação?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde. No seguimento de contacto anterior com a ${cleanClinicName}, gostaria de confirmar a quem na direção clínica devo dirigir esta questão sobre captação de pacientes particulares. Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;

            alternativaComercial = `Boa tarde à receção da ${cleanClinicName}. Gostaria de saber qual o endereço de e-mail institucional mais indicado para apresentar uma breve proposta de gestão de pacientes particulares à administração da clínica. Se não pretender receber contactos, basta avisar.`;
            explicacaoDiferenca = 'A recomendada é neutra e pede a pessoa certa. A alternativa solicita diretamente o canal formal da administração.';
            break;
        }

        case 'REABRIR_APOS_OBJECAO': {
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: ${cleanClinicName} — um ângulo diferente\n\nBoa tarde.\n\nSei que anteriormente mencionaram que já investem nesta área. A razão pela qual volto a contactar é que o que fazemos é diferente da gestão de redes sociais — focamo-nos exclusivamente em consultas particulares pagas que chegam via pesquisa no Google.\n\nSeria relevante para a vossa situação atual?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde à equipa da ${cleanClinicName}. Sei que em contacto anterior mencionaram que já investem em marketing. O que fazemos é diferente — focamo-nos em consultas particulares pagas via pesquisa no Google, não em redes sociais. Faria sentido para a vossa situação atual? Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;

            alternativaComercial = `Assunto: Seguimento — ${cleanClinicName}\n\nBoa tarde. Respeitando o contacto anterior, pergunto apenas se as prioridades em relação a novas consultas particulares se mantêm idênticas às de há alguns meses. Com os melhores cumprimentos, Philipe Coelho | Vamuss`;
            explicacaoDiferenca = 'A recomendada contorna a objeção mostrando diferenciação de canal (Google vs Redes). A alternativa reavalia simplesmente se o tempo alterou a objeção.';
            break;
        }

        case 'RETOMAR_PERGUNTA_PENDENTE': {
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: Seguimento — ${cleanClinicName}\n\nBoa tarde.\n\nEnviei-vos uma mensagem há algum tempo com uma questão sobre a gestão da clínica que ficou sem resposta. Compreendo que as prioridades mudam.\n\nA questão continua pertinente para vós, ou as circunstâncias mudaram entretanto?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde. Enviei uma mensagem à ${cleanClinicName} no âmbito do nosso contacto anterior com uma questão que ficou pendente. Compreendo que as prioridades mudam — continua pertinente ou as circunstâncias são outras agora? Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;

            alternativaComercial = `Boa tarde à equipa da ${cleanClinicName}. Deixei uma pergunta pendente sobre a atração de pacientes particulares há algum tempo. Caso faça sentido retomar o tema sem compromisso, fico à disposição. Se não pretender novos contactos, basta avisar e retiro o número.`;
            explicacaoDiferenca = 'A recomendada assume com naturalidade a falta de resposta e pergunta se a questão é pertinente. A alternativa coloca o ónus no destinatário com convite brando de retoma.';
            break;
        }

        default: {
            textoRecomendado = channel === 'EMAIL'
                ? `Assunto: Contacto — ${cleanClinicName}\n\nBoa tarde.\n\nContacto a ${cleanClinicName} porque apoiamos clínicas dentárias em Portugal na captação de primeiras consultas particulares via pesquisa no Google.\n\nA atração de novos pacientes particulares é uma prioridade na vossa gestão neste momento?\n\nCom os melhores cumprimentos,\nPhilipe Coelho | Vamuss\n[Caso não pretenda receber futuros contactos, basta responder "Parar".]`
                : `Boa tarde à equipa da ${cleanClinicName}. No seguimento de contactos anteriores entre a Vamuss e a clínica, apoiamos clínicas dentárias na captação de consultas particulares via pesquisa no Google. A atração de novos pacientes particulares é uma prioridade na vossa gestão neste momento? Se não fizer sentido receber contactos nossos, diga-me e retiro o seu número.`;

            alternativaComercial = `Boa tarde. Na sequência do nosso contacto anterior, apoiamos clínicas a reduzir a dependência de seguradoras de saúde através de tratamentos particulares planeados. Se este desafio fizer parte das metas da ${cleanClinicName}, terei todo o gosto em partilhar como o fazemos. Se não pretender novos contactos, basta avisar.`;
            explicacaoDiferenca = 'A recomendada pergunta diretamente sobre a prioridade de atração de novos pacientes. A alternativa toca no ângulo da dependência de seguradoras e convenções.';
            break;
        }
    }

    // 10 perguntas factuais estritas antes da redação
    const analiseDecisaoPrevia = {
        "1_o_que_aconteceu_historico": hist.totalOutbound > 0 
            ? `Foram realizadas ${hist.totalOutbound} abordagens outbound registadas no CRM. ${hist.hasAnyResponse ? 'Houve registo de interação inbound.' : 'Nenhuma resposta direta registada no CRM.'}`
            : 'Sem atividades de abordagem detalhadas registadas anteriormente no CRM.',
        "2_o_que_vamuss_comunicou": hist.vamussExplained 
            ? `Apresentou proposta de valor Vamuss. Pitchs detetados: ${(hist.specificPitches || []).join('; ') || 'Geral'}.`
            : 'Comunicações iniciais genéricas sem detalhe profundo da metodologia Vamuss.',
        "3_tentativas_e_canais": `${hist.totalOutbound} tentativas outbound (${hist.approachVariety || 1} tipo(s) de canal).`,
        "4_houve_resposta_real": hist.hasAnyResponse ? 'SIM (resposta registada no histórico)' : 'NÃO (apenas tentativas outbound sem retorno comprovado)',
        "5_motivo_registado_perda": `Motivo no CRM: "${deal.lost_reason || 'Não respondeu'}". Classificação: ${loss.category} (${loss.confidence}).`,
        "6_interlocutor_e_decisor_conhecido": cv.identifiedInLogs 
            ? `Decisor identificado em logs históricos: ${cv.identifiedInLogs}. Contacto registado: ${contact?.name || 'N/A'}.`
            : (cv.isDecisionMaker === 'PROVAVEL' ? `Contacto registado parece decisor (${contact?.name}).` : 'Decisor clínico pessoal desconhecido ou não confirmado.'),
        "7_o_que_ainda_nao_sabemos": 'Prioridade estratégica atual da clínica em tratamentos particulares e disponibilidade do diretor clínico para avaliar novos parceiros.',
        "8_obstaculo_comercial_provavel_factos_vs_hipoteses": `Facto: ausência de resposta às abordagens anteriores. Hipótese provável: falta de urgência, saturação de contactos genéricos ou pitch anterior desalinhado (${(hist.specificPitches || []).join(', ') || 'genérico'}).`,
        "9_proxima_acao_minima_recomendada": `Abordagem consultiva de baixo atrito via ${channel} focada na estratégia ${strategy}, sem pedir reunião.`,
        "10_porque_acao_superior_alternativas": `A estratégia ${strategy} foi selecionada porque respeita as evidências factuais do histórico (${selectedStrategy?.reasoning?.[0] || 'coerência factual'}), evitando a repetição cega de argumentos anteriores.`
    };

    return {
        source: 'deterministic_vamuss_skill_v3_b13_2',
        strategyVersion: `det_b13_2_${Date.now()}`,
        analise_decisao_previa: analiseDecisaoPrevia,
        raciocinio_interno: {
            o_que_sabemos: `Clínica "${cleanClinicName}" perdida com motivo "${deal.lost_reason || 'Não respondeu'}". ${hist.totalOutbound} tentativas outbound, ${hist.hasAnyResponse ? 'com' : 'sem'} respostas registadas.`,
            o_que_aconteceu: hist.totalOutbound > 0 ? `Foram realizadas ${hist.totalOutbound} abordagens no CRM.` : 'Sem atividades detalhadas no CRM.',
            hipotese_bloqueio: 'Falta de contexto ou pitch desajustado na abordagem anterior. Hipótese, não facto.',
            informacao_necessaria: 'Confirmar se a clínica tem prioridade em tratamentos particulares e validar decisor.',
            menor_intervencao: 'Pergunta de baixo atrito sobre prioridade atual.',
            porque_esta_abordagem: `Estratégia "${strategy}" fundamentada nas evidências dos registos.`
        },
        reconstrucao_factual: {
            primeira_abordagem: hist.firstApproach ? `${hist.firstApproach.date} (${hist.firstApproach.type})` : 'Sem registo detalhado',
            mensagens_enviadas: `${hist.totalOutbound} mensagens outbound registadas`,
            respostas_recebidas: hist.hasAnyResponse ? 'Respostas registadas no CRM' : 'Nenhuma resposta registada',
            perguntas_pendentes: hist.hasUnansweredQuestion ? 'Pergunta pendente detetada na última mensagem' : 'Nenhuma',
            proposta_comercial: hist.hasProposal ? 'Identificada no histórico' : 'Não identificada',
            objecoes_expressas: (hist.detectedObjections || []).length > 0 ? hist.detectedObjections.join(', ') : 'Nenhuma',
            ultima_interacao_efetiva: hist.lastActivity ? `${hist.lastActivity.date} (${hist.lastActivity.type})` : 'Sem atividades',
            motivo_perda_confirmado: loss.confidence === 'ALTA' ? 'CONFIRMADO' : 'PROVAVEL',
            nivel_confianca: loss.confidence || 'MEDIA',
            decisor_confirmado: cv.isDecisionMaker === 'PROVAVEL' ? true : cv.isDecisionMaker === 'NAO_IDENTIFICADO' ? false : 'DESCONHECIDO',
            dados_em_falta: ['Prioridade do trimestre atual', 'Disponibilidade para avaliar novos modelos de captação']
        },
        estrategia_comercial: {
            estrategia_selecionada: strategy,
            justificacao_detalhada: selectedStrategy?.reasoning?.join(' ') || 'Abordagem consultiva de baixo atrito.',
            estrategias_descartadas: selectedStrategy?.alternativesConsidered || [],
            razao_descarte: selectedStrategy?.whyNotAlternatives || '',
            resposta_pretendida: 'Validação da prioridade em tratamentos particulares.'
        },
        mensagem_sdr_pt_pt: {
            canal_sugerido: channel,
            texto_recomendado: textoRecomendado,
            texto: textoRecomendado,
            alternativa_comercial_relevante: alternativaComercial,
            explicacao_diferenca_estrategica: explicacaoDiferenca,
            pede_reuniao: false,
            assume_problema_agenda: false,
            demonstra_compreensao_historico: strategy !== 'REAPROXIMACAO_TRANSPARENTE'
        },
        objecoes_antecipadas: [
            {
                objecao: 'Já temos agência / marketing',
                interpretacao: 'A clínica já investe mas pode estar focada em vaidade/redes sociais sem mensurar consultas particulares rentáveis.',
                como_contornar: 'Elogiar a maturidade de investimento e perguntar se conseguem medir o custo por consulta particular fechada em reabilitação ou implantes.'
            }
        ],
        qualificacao_closer: {
            criterio_transferencia: 'Quando a clínica demonstrar abertura ou responder com interesse sobre consultas particulares.',
            contexto_para_closer: `Negócio perdido com classificação ${loss.category}. ${hist.totalOutbound} tentativas outbound. Estratégia: ${strategy}.`,
            roteiro_spin: {
                situacao: 'Como está estruturada hoje a captação de primeiras consultas na clínica?',
                problema: 'A dependência de seguros ou recomendações causa oscilação na agenda?',
                implicacao: 'Quanto custa um gabinete ocioso ou a baixa margem de convenções?',
                necessidade: 'Faria sentido ter um sistema que garanta novas consultas particulares todos os meses?'
            },
            condicao_propor_reuniao_20min: 'Apenas após a qualificação das dores e confirmação de disponibilidade de tempo.'
        }
    };
}

/**
 * B.13.1: Registo de tentativa de reativação no sistema de aprendizagem
 */
/**
 * B.13.1 & B.13.3: Registo de tentativa de reativação no sistema de aprendizagem
 * com salvaguarda persistente local e Supabase
 */
export async function recordReactivationAttempt({
    dealId,
    contactId,
    strategy,
    strategyVersion = 'v2',
    channel = 'WHATSAPP',
    messageText = '',
    lossClassification = 'OPERACIONAL',
    recoverabilityScore = 50,
    diagnosticConfidence = 'MEDIA',
    outcome = 'PENDENTE',
    notes = '',
    executedBy = 'Operador SDR',
    idempotencyKey = null,
    metadata = {}
}) {
    const today = new Date().toISOString().slice(0, 10);
    const key = idempotencyKey || `${dealId}_${outcome}_${channel}_${strategy}_${today}`;

    // Verificação de idempotência local
    const local = readLocalOutcomes();
    const existing = local.find(o => o.idempotency_key === key);
    if (existing) {
        if (metadata && Object.keys(metadata).length > 0) {
            existing.metadata = { ...(existing.metadata || {}), ...metadata };
            writeLocalOutcomes(local);
        }
        return {
            success: true,
            idempotent: true,
            duplicated: true,
            outcomeId: existing.id,
            record: existing,
            storage: existing.synced_to_supabase ? 'supabase' : 'local'
        };
    }

    const attemptRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        idempotency_key: key,
        deal_id: dealId,
        contact_id: contactId || null,
        strategy: strategy || 'DESCONHECIDO',
        strategy_version: strategyVersion || 'v2',
        channel: channel || 'WHATSAPP',
        message_approved: messageText || '',
        loss_classification: lossClassification || 'OPERACIONAL',
        recoverability_score: recoverabilityScore || 0,
        diagnostic_confidence: diagnosticConfidence || 'MEDIA',
        attempt_date: new Date().toISOString(),
        outcome: outcome,
        notes: notes || '',
        metadata: metadata || {},
        executed_by: executedBy,
        synced_to_supabase: false,
        created_at: new Date().toISOString()
    };

    let supabaseSuccess = false;
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ''));

    if (supabase && isUUID(attemptRecord.deal_id)) {
        try {
            // Removemos campos locais que possam não constar no schema original da tabela
            const { idempotency_key, synced_to_supabase, ...supabasePayload } = attemptRecord;
            if (supabasePayload.contact_id && !isUUID(supabasePayload.contact_id)) {
                delete supabasePayload.contact_id;
            }
            const { data, error } = await supabase.from('sdr_outcomes').insert(supabasePayload).select().single();
            if (!error && data) {
                supabaseSuccess = true;
                attemptRecord.id = data.id;
                attemptRecord.synced_to_supabase = true;
            } else if (error && error.message?.includes('metadata')) {
                // Se a tabela remota ainda não tem a coluna metadata, sincroniza os campos base
                const { metadata: _meta, ...fallbackPayload } = supabasePayload;
                const retry = await supabase.from('sdr_outcomes').insert(fallbackPayload).select().single();
                if (!retry.error && retry.data) {
                    supabaseSuccess = true;
                    attemptRecord.id = retry.data.id;
                    attemptRecord.synced_to_supabase = true;
                } else {
                    console.warn('⚠️ [SDR Learning] Supabase sdr_outcomes insert falhou, mantendo buffer local:', retry.error?.message);
                }
            } else if (error) {
                console.warn('⚠️ [SDR Learning] Supabase sdr_outcomes insert falhou, mantendo buffer local:', error.message);
            }
        } catch (e) {
            console.warn('⚠️ [SDR Learning] Exceção Supabase sdr_outcomes:', e.message);
        }
    }

    // Mirror para persistência local
    local.unshift(attemptRecord);
    writeLocalOutcomes(local);

    return {
        success: true,
        idempotent: false,
        outcomeId: attemptRecord.id,
        record: attemptRecord,
        storage: supabaseSuccess ? 'supabase' : 'local'
    };
}

/**
 * B.13.1 & B.13.3: Atualizar resultado de uma tentativa
 */
export async function updateOutcomeResult({
    outcomeId,
    dealId,
    outcome,
    responseClassification,
    deliveryStatus,
    responseText,
    objectionsIdentified,
    nextAction,
    dealReactivated,
    meetingConfirmed,
    proposalPresented,
    saleWon,
    finalReason,
    notes
}) {
    if (!outcomeId && !dealId) return { success: false, error: 'Identificador obrigatório' };

    if (supabase && outcomeId) {
        try {
            await supabase.from('sdr_outcomes').update({
                outcome: outcome || 'DESCONHECIDO',
                response_classification: responseClassification || null,
                delivery_status: deliveryStatus || null,
                response_text: responseText || null,
                objections_identified: objectionsIdentified || null,
                next_action: nextAction || null,
                deal_reactivated: dealReactivated || false,
                meeting_confirmed: meetingConfirmed || false,
                proposal_presented: proposalPresented || false,
                sale_won: saleWon || false,
                final_reason: finalReason || null,
                result_updated_at: new Date().toISOString()
            }).eq('id', outcomeId);
        } catch (e) {
            console.warn('⚠️ [SDR Learning] Update Supabase sdr_outcomes falhou:', e.message);
        }
    }

    const local = readLocalOutcomes();
    let updated = false;
    for (let i = 0; i < local.length; i++) {
        if ((outcomeId && local[i].id === outcomeId) || (dealId && local[i].deal_id === dealId)) {
            local[i] = {
                ...local[i],
                outcome: outcome || local[i].outcome,
                response_classification: responseClassification || local[i].response_classification,
                delivery_status: deliveryStatus || local[i].delivery_status,
                response_text: responseText || local[i].response_text,
                objections_identified: objectionsIdentified || local[i].objections_identified,
                next_action: nextAction || local[i].next_action,
                deal_reactivated: dealReactivated !== undefined ? dealReactivated : local[i].deal_reactivated,
                meeting_confirmed: meetingConfirmed !== undefined ? meetingConfirmed : local[i].meeting_confirmed,
                proposal_presented: proposalPresented !== undefined ? proposalPresented : local[i].proposal_presented,
                sale_won: saleWon !== undefined ? saleWon : local[i].sale_won,
                final_reason: finalReason || local[i].final_reason,
                notes: notes || local[i].notes,
                result_updated_at: new Date().toISOString()
            };
            updated = true;
            break;
        }
    }
    if (!updated && dealId) {
        local.unshift({
            id: outcomeId || (crypto.randomUUID ? crypto.randomUUID() : `out_${Date.now()}`),
            deal_id: dealId,
            outcome: outcome || 'EXECUTADA',
            notes: notes || '',
            result_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        });
    }
    writeLocalOutcomes(local);
    return { success: true };
}

/**
 * B.13.1 & B.13.3: Consultar tentativas anteriores para um deal (aprendizagem)
 */
export async function getPreviousAttempts(dealId) {
    if (!dealId) return [];

    let attempts = [];
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('sdr_outcomes')
                .select('*')
                .eq('deal_id', dealId)
                .order('attempt_date', { ascending: false });

            if (!error && data && data.length > 0) {
                attempts = data;
            }
        } catch {
            // fallback
        }
    }

    if (attempts.length === 0) {
        const local = readLocalOutcomes();
        attempts = local.filter(o => o.deal_id === dealId);
    }

    return attempts;
}

/**
 * B.13.3: Definição canónica dos 10 estados do ciclo de vida em sdr_outcomes
 */
export const SDR_LIFECYCLE_STATES = {
    PREPARADA: 'PREPARADA',
    APROVADA: 'APROVADA',
    ENVIADA: 'ENVIADA',
    EXECUTADA: 'EXECUTADA',
    ENTREGUE: 'ENTREGUE',
    SEM_RESPOSTA: 'SEM_RESPOSTA',
    RESPOSTA_POSITIVA: 'RESPOSTA_POSITIVA',
    RESPOSTA_NEGATIVA: 'RESPOSTA_NEGATIVA',
    OPTOUT: 'OPTOUT',
    INTERESSE_QUALIFICADO: 'INTERESSE_QUALIFICADO',
    REUNIAO_CONFIRMADA: 'REUNIAO_CONFIRMADA',
    PROPOSTA_APRESENTADA: 'PROPOSTA_APRESENTADA',
    VENDA_GANHA: 'VENDA_GANHA',
    VENDA_PERDIDA: 'VENDA_PERDIDA'
};

/**
 * B.13.3: Calcular métricas de aprendizagem com os estados de ciclo de vida
 * e aviso rigoroso de calibração quando N < 20 observações
 */
export async function calculateLearningMetrics() {
    let outcomes = [];
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('sdr_outcomes')
                .select('*');

            if (!error && data && data.length > 0) {
                outcomes = data;
            }
        } catch {
            // fallback
        }
    }
 
    // Unificar registos locais com os da base de dados sem duplicações
    const local = readLocalOutcomes();
    const idSet = new Set(outcomes.map(o => o.id));
    local.forEach(l => {
        if (!idSet.has(l.id)) {
            outcomes.push(l);
            idSet.add(l.id);
        }
    });

    const total = outcomes.length;
    const byLifecycleState = {
        PREPARADA: 0,
        APROVADA: 0,
        ENVIADA: 0,
        EXECUTADA: 0,
        ENTREGUE: 0,
        SEM_RESPOSTA: 0,
        RESPOSTA_POSITIVA: 0,
        RESPOSTA_NEGATIVA: 0,
        OPTOUT: 0,
        INTERESSE_QUALIFICADO: 0,
        REUNIAO_CONFIRMADA: 0,
        PROPOSTA_APRESENTADA: 0,
        VENDA_GANHA: 0,
        VENDA_PERDIDA: 0,
        OUTROS: 0
    };

    const byStrategy = {};
    const byChannel = {};
    const byLossType = {};

    for (const o of outcomes) {
        const st = o.outcome || 'PREPARADA';
        if (byLifecycleState[st] !== undefined) {
            byLifecycleState[st]++;
        } else if (st === 'PENDENTE') {
            byLifecycleState.PREPARADA++;
        } else {
            byLifecycleState.OUTROS++;
        }

        if (o.meeting_confirmed && st !== 'REUNIAO_CONFIRMADA') byLifecycleState.REUNIAO_CONFIRMADA++;
        if (o.sale_won && st !== 'VENDA_GANHA') byLifecycleState.VENDA_GANHA++;

        const s = o.strategy || 'DESCONHECIDO';
        if (!byStrategy[s]) byStrategy[s] = { total: 0, responses: 0, positive: 0, negative: 0, reactivated: 0, meetings: 0, sales: 0, version: o.strategy_version || 'v2' };
        byStrategy[s].total++;
        if (o.outcome === 'RESPOSTA_POSITIVA' || o.outcome === 'RESPOSTA_NEGATIVA' || o.outcome === 'INTERESSE_QUALIFICADO') byStrategy[s].responses++;
        if (o.outcome === 'RESPOSTA_POSITIVA' || o.outcome === 'INTERESSE_QUALIFICADO') byStrategy[s].positive++;
        if (o.outcome === 'RESPOSTA_NEGATIVA' || o.outcome === 'OPTOUT') byStrategy[s].negative++;
        if (o.deal_reactivated) byStrategy[s].reactivated++;
        if (o.meeting_confirmed || o.outcome === 'REUNIAO_CONFIRMADA') byStrategy[s].meetings++;
        if (o.sale_won || o.outcome === 'VENDA_GANHA') byStrategy[s].sales++;

        const c = o.channel || 'DESCONHECIDO';
        if (!byChannel[c]) byChannel[c] = { total: 0, responses: 0, positive: 0 };
        byChannel[c].total++;
        if (o.outcome?.startsWith('RESPOSTA') || o.outcome === 'INTERESSE_QUALIFICADO') byChannel[c].responses++;
        if (o.outcome === 'RESPOSTA_POSITIVA' || o.outcome === 'INTERESSE_QUALIFICADO') byChannel[c].positive++;

        const l = o.loss_classification || 'DESCONHECIDO';
        if (!byLossType[l]) byLossType[l] = { total: 0, responses: 0, reactivated: 0 };
        byLossType[l].total++;
        if (o.outcome?.startsWith('RESPOSTA') || o.outcome === 'INTERESSE_QUALIFICADO') byLossType[l].responses++;
        if (o.deal_reactivated) byLossType[l].reactivated++;
    }

    // Denominadores e Taxas Explícitas por Etapa do Funil (Fase B.13.4)
    const totalApproaches = (byLifecycleState.EXECUTADA || 0) + (byLifecycleState.ENVIADA || 0) + (byLifecycleState.ENTREGUE || 0);
    const deliveredCount = (byLifecycleState.ENTREGUE || 0) + (byLifecycleState.EXECUTADA || 0) + (byLifecycleState.ENVIADA || 0);
    const responseCount = (byLifecycleState.RESPOSTA_POSITIVA || 0) + (byLifecycleState.RESPOSTA_NEGATIVA || 0) + (byLifecycleState.INTERESSE_QUALIFICADO || 0);
    const qualifiedCount = (byLifecycleState.INTERESSE_QUALIFICADO || 0);
    const meetingCount = (byLifecycleState.REUNIAO_CONFIRMADA || 0);
    const salesWonCount = (byLifecycleState.VENDA_GANHA || 0);

    const explicitDenominators = {
        taxaEntrega: {
            denominadorDescricao: 'Total de Abordagens Executadas/Enviadas',
            denominador: totalApproaches,
            numerador: deliveredCount,
            taxaPercentual: totalApproaches > 0 ? Number(((deliveredCount / totalApproaches) * 100).toFixed(1)) : 0
        },
        taxaResposta: {
            denominadorDescricao: 'Total de Abordagens Entregues',
            denominador: deliveredCount,
            numerador: responseCount,
            taxaPercentual: deliveredCount > 0 ? Number(((responseCount / deliveredCount) * 100).toFixed(1)) : 0
        },
        taxaQualificacao: {
            denominadorDescricao: 'Total de Respostas Recebidas',
            denominador: responseCount,
            numerador: qualifiedCount,
            taxaPercentual: responseCount > 0 ? Number(((qualifiedCount / responseCount) * 100).toFixed(1)) : 0
        },
        taxaReuniao: {
            denominadorDescricao: 'Total de Interesses Qualificados',
            denominador: qualifiedCount,
            numerador: meetingCount,
            taxaPercentual: qualifiedCount > 0 ? Number(((meetingCount / qualifiedCount) * 100).toFixed(1)) : 0
        },
        taxaConversaoVenda: {
            denominadorDescricao: 'Total de Reuniões de Diagnóstico Confirmadas',
            denominador: meetingCount,
            numerador: salesWonCount,
            taxaPercentual: meetingCount > 0 ? Number(((salesWonCount / meetingCount) * 100).toFixed(1)) : 0
        }
    };

    return {
        totalAttempts: total,
        byLifecycleState,
        byStrategy,
        byChannel,
        byLossClassification: byLossType,
        explicitDenominators,
        isCalibrated: total >= 20,
        caution: total < 20 ? `Amostra insuficiente para conclusões estatísticas (${total}/20 observações). Os dados devem ser interpretados como indicativos.` : null,
        sampleDisclaimer: total < 20
            ? `Amostra insuficiente para calibração estatística (${total}/20 observações). As taxas de conversão são meramente indicativas e não devem substituir a avaliação clínica/comercial humana.`
            : `Amostra calibrada estatisticamente (${total} observações observadas).`
    };
}

/**
 * Máquina de Estados: Transição Controlada no Funil do CRM
 */
export async function executeFunnelTransition({
    dealId,
    event,
    metadata = {}
}) {
    if (!dealId) {
        return { success: false, error: 'MISSING_DEAL_ID' };
    }

    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ''));

    let deal = null;
    if (supabase && isUUID(dealId)) {
        const { data: d } = await supabase
            .from('deals')
            .select('*')
            .eq('id', dealId)
            .single();
        deal = d;
    }

    if (!deal) {
        // Suporte para deals de teste/staging
        deal = { id: dealId, stage_id: metadata.currentStageId || 'stage_lead_identificado', status: 'lost', title: 'Deal de Simulação' };
    }

    let nextStatus = deal.status;
    let nextStageId = deal.stage_id;
    let transitionAllowed = false;
    let reason = '';

    switch (event) {
        case 'REPLY_WITH_INTEREST':
            nextStatus = 'open';
            nextStageId = 'stage_lead_engajamento';
            transitionAllowed = true;
            reason = 'Resposta inbound real com interesse comprovado recebida.';
            break;

        case 'MEETING_CONFIRMED':
            nextStatus = 'open';
            nextStageId = 'stage_reuniao';
            transitionAllowed = true;
            reason = 'Reunião de Diagnóstico de 20 minutos confirmada na agenda.';
            break;

        case 'SALE_WON':
            nextStatus = 'won';
            nextStageId = 'stage_fechamento';
            transitionAllowed = true;
            reason = 'Contrato assinado e primeira mensalidade liquidada.';
            break;

        case 'OPTOUT_OR_REFUSAL':
            nextStatus = 'lost';
            nextStageId = 'stage_lost';
            transitionAllowed = true;
            reason = 'Recusa expressa ou pedido de supressão ativado.';
            break;

        case 'SILENCE_OR_AMBIGUOUS':
        default:
            transitionAllowed = false;
            reason = 'Regra fundamental de segurança: silêncio ou ambiguidade não reabrem negócios nem alteram o funil.';
            break;
    }

    if (transitionAllowed && (nextStatus !== deal.status || nextStageId !== deal.stage_id)) {
        if (supabase && isUUID(dealId)) {
            const { error: updErr } = await supabase
                .from('deals')
                .update({
                    status: nextStatus,
                    stage_id: nextStageId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', dealId);

            if (updErr) {
                return { success: false, error: 'UPDATE_FAILED', details: updErr.message };
            }

            if (deal.user_id) {
                await supabase.from('activities').insert({
                    user_id: deal.user_id,
                    deal_id: dealId,
                    type: 'system',
                    title: `Transição Comercial do Funil: ${event}`,
                    notes: reason,
                    date: new Date().toISOString(),
                    completed: true
                });
            }
        }

        return {
            success: true,
            dealId,
            previousStatus: deal.status,
            previousStage: deal.stage_id,
            targetStatus: nextStatus,
            targetStageId: nextStageId,
            newStatus: nextStatus,
            newStageId: nextStageId,
            transitionAllowed: true,
            reason,
            simulated: !isUUID(dealId)
        };
    }

    return {
        success: true,
        transitionPerformed: false,
        dealId,
        currentStatus: deal.status,
        currentStageId: deal.stage_id,
        reason
    };
}

/**
 * Registar rotas no Express
 */
/**
 * B.13.3: Constrói a fila de trabalho operacional do SDR/Closer com dados reais do CRM,
 * cálculo estrito de estados comerciais, tarefas contextualizadas e contagens dos 9 filtros.
 */
export async function getSDRWorkQueue({ limit = 150 } = {}) {
    if (!supabase) return { candidates: [], counts: getEmptyCounts() };

    try {
        const { readRecoveryPipelineStore, determineInitialRecoveryStage, normalizeStage } = await import('./sdr_recovery_pipeline.js');
        const recoveryStore = readRecoveryPipelineStore();

        // 1. Carregar deals lost ou em engajamento/reunião
        const { data: deals, error: dealsErr } = await supabase
            .from('deals')
            .select('*')
            .or('status.eq.lost,stage_id.eq.stage_lead_engajamento,stage_id.eq.stage_reuniao')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (dealsErr || !deals) {
            console.error('Erro ao carregar deals do CRM:', dealsErr);
            return { candidates: [], counts: getEmptyCounts() };
        }

        // 2. Carregar contactos associados
        const contactIds = [...new Set(deals.map(d => d.contact_id).filter(Boolean))];
        const { data: contacts } = await supabase
            .from('contacts')
            .select('id, name, email, phone, role, notes')
            .in('id', contactIds.slice(0, 200));

        const contactMap = new Map((contacts || []).map(c => [c.id, c]));

        // 3. Carregar lista de supressão ativa
        const { data: suppressionRows } = await supabase
            .from('sdr_suppression_list')
            .select('*')
            .eq('estado', 'ativo');

        const suppressedDeals = new Set((suppressionRows || []).map(s => s.deal_id).filter(Boolean));
        const suppressedContacts = new Set((suppressionRows || []).map(s => s.contact_id).filter(Boolean));
        const suppressedPhones = new Set((suppressionRows || []).map(s => s.telefone_normalizado).filter(Boolean));

        // 4. Carregar atividades mais recentes por deal
        const dealIds = deals.map(d => d.id);
        const { data: activities } = await supabase
            .from('activities')
            .select('id, deal_id, date, title, type, notes, completed')
            .in('deal_id', dealIds)
            .order('date', { ascending: false });

        const actsByDeal = new Map();
        (activities || []).forEach(a => {
            if (!actsByDeal.has(a.deal_id)) actsByDeal.set(a.deal_id, []);
            actsByDeal.get(a.deal_id).push(a);
        });

        // 5. Carregar deal_logs relevantes
        const { data: dealLogs } = await supabase
            .from('deal_logs')
            .select('*')
            .in('deal_id', dealIds.slice(0, 100))
            .order('created_at', { ascending: false });

        const logsByDeal = new Map();
        (dealLogs || []).forEach(l => {
            if (!logsByDeal.has(l.deal_id)) logsByDeal.set(l.deal_id, []);
            logsByDeal.get(l.deal_id).push(l);
        });

        // 6. Carregar outcomes anteriores (Supabase + local)
        const localOutcomes = readLocalOutcomes();
        const outcomesByDeal = new Map();
        localOutcomes.forEach(o => {
            if (!outcomesByDeal.has(o.deal_id)) outcomesByDeal.set(o.deal_id, []);
            outcomesByDeal.get(o.deal_id).push(o);
        });

        const now = new Date();
        const candidates = [];

        for (const deal of deals) {
            const contact = contactMap.get(deal.contact_id);
            const dealActs = actsByDeal.get(deal.id) || [];
            const dealLgs = logsByDeal.get(deal.id) || [];
            const previousAttempts = outcomesByDeal.get(deal.id) || [];
            const lastOutcome = previousAttempts[0]?.outcome || null;

            const reason = (deal.lost_reason || '').trim().toLowerCase();
            const contactPhone = contact?.phone || '';
            const contactEmail = contact?.email || '';
            const phoneDigits = cleanPhone(contactPhone);
            const isMobile = isMobilePhone(contactPhone);

            // Dias desde encerramento
            const lastAct = dealActs[0] || null;
            const lastDate = lastAct ? new Date(lastAct.date) : (deal.lost_at ? new Date(deal.lost_at) : new Date(deal.created_at));
            const lostDate = deal.lost_at ? new Date(deal.lost_at) : lastDate;
            const daysSinceLost = Math.max(0, Math.floor((now.getTime() - lostDate.getTime()) / (1000 * 60 * 60 * 24)));
            const respiroCumprido = daysSinceLost >= 30;

            // Verificar supressão
            const isSuppressed = suppressedDeals.has(deal.id) ||
                                 (contact && suppressedContacts.has(contact.id)) ||
                                 (phoneDigits && suppressedPhones.has(phoneDigits)) ||
                                 reason.includes('optout') || reason.includes('recusa') || reason.includes('oposição');

            // Validação de identidade do interlocutor
            const contactValidation = validateContactIdentity(contact, deal, dealLgs);
            const factualHistory = reconstructFactualHistory(dealActs, dealLgs);
            const lossClassification = classifyLossReason(deal.lost_reason, dealActs, dealLgs);

            // Estado Comercial Real (Secção 10)
            let commercialState = 'Em recuperação — próxima ação pendente';
            let executionState = 'PENDENTE';

            if (isSuppressed) {
                commercialState = 'Suspenso — pedido de não contacto';
                executionState = 'BLOQUEADA';
            } else if (deal.stage_id === 'stage_reuniao' || lastOutcome === 'REUNIAO_CONFIRMADA') {
                commercialState = 'Reunião confirmada — evento real no calendário';
                executionState = 'EXECUTADA';
            } else if (deal.stage_id === 'stage_lead_engajamento' || lastOutcome === 'INTERESSE_QUALIFICADO' || lastOutcome === 'RESPOSTA_POSITIVA') {
                commercialState = 'Interesse confirmado — qualificação pelo Closer';
                executionState = 'EXECUTADA';
            } else if (lastOutcome === 'ENVIADA' || lastOutcome === 'EXECUTADA') {
                commercialState = 'A aguardar resposta — abordagem efetivamente enviada';
                executionState = 'EM_OBSERVACAO';
            } else if (contactValidation.status === 'REVISAO_HUMANA_OBRIGATORIA') {
                commercialState = 'Revisão humana — dados insuficientes';
                executionState = 'BLOQUEADA';
            } else if (!respiroCumprido) {
                commercialState = 'Perdido — aguarda nova avaliação';
                executionState = 'BLOQUEADA';
            }

            // Determinar Tipo de Tarefa (Task Driven UI)
            let taskType = 'MESSAGE';
            let recommendedChannel = 'WHATSAPP';
            let recommendedChannelReason = 'Canal de baixo atrito para abordagem consultiva.';
            let recommendedAction = '';

            if (isSuppressed) {
                taskType = 'PAUSE';
                recommendedChannel = 'NENHUM';
                recommendedAction = 'Não contactar — Contacto suprimido (oposição registada)';
                recommendedChannelReason = 'Bloqueio legal obrigatório.';
            } else if (!respiroCumprido) {
                taskType = 'PAUSE';
                recommendedChannel = 'NENHUM';
                recommendedAction = `Aguardar respiro comercial de 30 dias (faltam ${30 - daysSinceLost} dias)`;
                recommendedChannelReason = 'Proteção de marca e intervalo legal de recontacto.';
            } else if (deal.stage_id === 'stage_reuniao' || lastOutcome === 'REUNIAO_CONFIRMADA') {
                taskType = 'CLOSER_SPIN';
                recommendedChannel = 'CALL';
                recommendedAction = 'Preparar e conduzir Reunião de Diagnóstico de 20 min';
                recommendedChannelReason = 'Avanço formal após reunião confirmada.';
            } else if (deal.stage_id === 'stage_lead_engajamento' || lastOutcome === 'INTERESSE_QUALIFICADO' || lastOutcome === 'RESPOSTA_POSITIVA') {
                taskType = 'CLOSER_SPIN';
                recommendedChannel = contactPhone ? 'WHATSAPP' : 'EMAIL';
                recommendedAction = 'Qualificação consultiva SPIN Selling com o Closer';
                recommendedChannelReason = 'Lead respondeu com interesse — qualificar situação e problemas clínicos.';
            } else if (contactValidation.status === 'REVISAO_HUMANA_OBRIGATORIA') {
                if (contactPhone && !isMobile) {
                    taskType = 'CALL';
                    recommendedChannel = 'CALL';
                    recommendedAction = 'Telefonar à receção para identificar o médico dentista titular';
                    recommendedChannelReason = 'Telefone fixo da clínica — chamada à secretária para identificar o decisor.';
                } else {
                    taskType = 'HUMAN_VALIDATION';
                    recommendedChannel = 'NENHUM';
                    recommendedAction = 'Validar identidade e decisor clínico antes de contactar';
                    recommendedChannelReason = 'Nome ou cargo não confirmados no histórico do CRM.';
                }
            } else if (contactPhone && !isMobile) {
                taskType = 'CALL';
                recommendedChannel = 'CALL';
                recommendedAction = 'Telefonar à receção para identificar o decisor clínico';
                recommendedChannelReason = 'Telefone fixo da clínica — chamada à receção.';
            } else if (contactPhone && isMobile) {
                taskType = 'MESSAGE';
                recommendedChannel = 'WHATSAPP';
                recommendedAction = 'Enviar mensagem consultiva via WhatsApp';
                recommendedChannelReason = 'Telemóvel móvel validado para abordagem consultiva.';
            } else if (contactEmail) {
                taskType = 'MESSAGE';
                recommendedChannel = 'EMAIL';
                recommendedAction = 'Enviar e-mail consultivo ao decisor';
                recommendedChannelReason = 'E-mail indicado no registo do CRM.';
            } else {
                taskType = 'HUMAN_VALIDATION';
                recommendedChannel = 'NENHUM';
                recommendedAction = 'Recolher dados de contacto no CRM';
                recommendedChannelReason = 'Sem telefone nem email elegíveis.';
            }

            // Salvaguarda Legal e Prontidão
            const legalGateBlocked = isSuppressed || !respiroCumprido || (!contactPhone && !contactEmail);
            const legalGateBlockReason = isSuppressed
                ? 'Contacto suprimido'
                : !respiroCumprido
                ? `Respiro de 30 dias não decorrido (${daysSinceLost}/30 dias)`
                : (!contactPhone && !contactEmail)
                ? 'Ausência de dados de contacto'
                : null;

            // Regra de aceitação estrita: Negócio pronto NÃO pode estar bloqueado
            const isReadyForApproach = respiroCumprido && !isSuppressed && !legalGateBlocked && 
                contactValidation.status !== 'REVISAO_HUMANA_OBRIGATORIA' && 
                (taskType === 'MESSAGE' || taskType === 'CALL') &&
                !commercialState.includes('Suspenso');

            const contactPerson = contactValidation.identifiedInLogs || (contact?.name ? contact.name : 'Não identificado (Apenas receção)');
            const isDecisionMakerConfirmed = contactValidation.isDecisionMaker === 'PROVAVEL';

            const recoverability = calculateRecoverabilityScore({
                deal,
                contact,
                activities: dealActs,
                lossClassification,
                daysSinceLost,
                isSuppressed,
                contactValidation,
                factualHistory,
                previousAttempts
            });

            const savedRecoveryItem = recoveryStore?.deals ? recoveryStore.deals[deal.id] : null;
            const isDisq = (deal.lost_reason || '').toLowerCase().includes('desqualificad') || 
                           (deal.disqualified_reason || '').toLowerCase().includes('desqualificad') || 
                           deal.stage_id === 'disqualified';
            const recoveryStage = isDisq 
                ? 'nao_reativado' 
                : (normalizeStage(savedRecoveryItem?.stage) || determineInitialRecoveryStage(deal, contact, outcomesByDeal.get(deal.id) || []));

            candidates.push({
                dealId: deal.id,
                title: deal.title,
                value: deal.value,
                status: deal.status,
                stageId: deal.stage_id,
                recoveryStage,
                clinicName: contactValidation.normalizedClinic || deal.title || 'Clínica Dentária',
                contactId: deal.contact_id,
                contactName: contact?.name || deal.title || 'Contacto',
                contactPerson,
                isDecisionMakerConfirmed,
                phone: contactPhone || null,
                email: contactEmail || null,
                isMobile,
                cleanPhone: phoneDigits,
                lostReason: deal.lost_reason,
                lostCategory: lossClassification.category,
                lostAt: deal.lost_at,
                daysSinceLost,
                respiroCumprido,
                lastInteractionDate: lastAct ? (lastAct.date?.slice(0, 10) || null) : null,
                lastInteractionType: lastAct ? lastAct.type : null,
                lastInteractionChannel: lastAct ? (lastAct.type === 'email' ? 'EMAIL' : lastAct.type === 'message' ? 'WHATSAPP' : lastAct.type?.toUpperCase()) : null,
                activitiesCount: dealActs.length,
                commercialState,
                executionState,
                taskType,
                recommendedAction,
                recommendedChannel,
                recommendedChannelReason,
                isSuppressed,
                suppressionReason: isSuppressed ? 'Pedido de não contacto / oposição' : undefined,
                humanValidationStatus: contactValidation.status,
                humanValidationReason: contactValidation.reason,
                legalGateBlocked,
                legalGateBlockReason,
                isReadyForApproach,
                priorityTier: recoverability.priorityTier,
                recoverabilityScore: recoverability.score,
                previousAttemptsCount: previousAttempts.length,
                lastOutcome
            });
        }

        const counts = {
            proximaAcao: candidates.filter(c => c.taskType !== 'PAUSE' && !c.commercialState.includes('Suspenso') && !c.commercialState.includes('Aguardar') && !c.commercialState.includes('aguardar') && !c.isSuppressed).length,
            revisaoHumana: candidates.filter(c => c.humanValidationStatus === 'REVISAO_HUMANA_OBRIGATORIA' || c.taskType === 'HUMAN_VALIDATION').length,
            prontos: candidates.filter(c => c.isReadyForApproach).length,
            aguardamResposta: candidates.filter(c => c.commercialState.includes('A aguardar resposta') || c.lastOutcome === 'ENVIADA' || c.lastOutcome === 'EXECUTADA').length,
            closerQualificacao: candidates.filter(c => c.stageId === 'stage_lead_engajamento' || c.commercialState.includes('Interesse confirmado') || c.lastOutcome === 'INTERESSE_QUALIFICADO' || c.lastOutcome === 'RESPOSTA_POSITIVA').length,
            reuniaoConfirmada: candidates.filter(c => c.stageId === 'stage_reuniao' || c.commercialState.includes('Reunião confirmada') || c.lastOutcome === 'REUNIAO_CONFIRMADA').length,
            pausaComercial: candidates.filter(c => !c.respiroCumprido || c.taskType === 'PAUSE' || c.commercialState.includes('aguarda nova avaliação')).length,
            bloqueados: candidates.filter(c => c.isSuppressed || c.commercialState.includes('Suspenso') || c.commercialState.includes('Bloqueado')).length,
            // 5 estágios canónicos simplificados de reaquecimento
            perdidos_qualificados: candidates.filter(c => c.recoveryStage === 'perdidos_qualificados').length,
            mensagem_enviada: candidates.filter(c => c.recoveryStage === 'mensagem_enviada').length,
            em_conversa: candidates.filter(c => c.recoveryStage === 'em_conversa').length,
            pronto_reabrir: candidates.filter(c => c.recoveryStage === 'pronto_reabrir').length,
            nao_reativado: candidates.filter(c => c.recoveryStage === 'nao_reativado').length,
            todos: candidates.length
        };

        return {
            candidates,
            counts,
            legalGate: process.env.SDR_LEGAL_GATE || 'FAIL_CLOSED'
        };
    } catch (err) {
        console.error('❌ [SDR Engine] Erro ao construir fila SDR:', err);
        return { candidates: [], counts: getEmptyCounts() };
    }
}

function getEmptyCounts() {
    return {
        proximaAcao: 0,
        revisaoHumana: 0,
        prontos: 0,
        aguardamResposta: 0,
        closerQualificacao: 0,
        reuniaoConfirmada: 0,
        pausaComercial: 0,
        bloqueados: 0,
        perdidos_qualificados: 0,
        mensagem_enviada: 0,
        em_conversa: 0,
        pronto_reabrir: 0,
        nao_reativado: 0,
        todos: 0
    };
}

/**
 * B.13.3 & B.13.4: Manipulador de registo de desfecho comercial (10 estados canónicos)
 * Validação estrita no backend de pré-requisitos factuais, idempotência e integridade do pipeline
 */
export async function handleRecordOutcome({
    dealId,
    contactId,
    phone = null,
    outcome,
    channel = 'WHATSAPP',
    strategy = 'REGISTO_OPERACIONAL',
    strategyVersion = 'v2',
    notes = '',
    evidence = '',
    responseText = '',
    messageApproved = '',
    executedBy = 'Operador SDR',
    idempotencyKey = null,
    ignoreWindow = false,
    metadata = {}
}) {
    // 1. Verificação de parâmetros obrigatórios
    if (!dealId || !outcome) {
        return {
            success: false,
            statusCode: 400,
            error: 'MISSING_PARAMETERS',
            message: 'dealId e outcome são obrigatórios.'
        };
    }

    // 2. Validação do estado no ciclo de vida canónico
    if (!SDR_LIFECYCLE_STATES[outcome]) {
        return {
            success: false,
            statusCode: 400,
            error: 'INVALID_OUTCOME',
            message: `O desfecho "${outcome}" não é um estado válido do ciclo de vida comercial.`
        };
    }

    // 3. Verificação de idempotência (mesmo deal, outcome e canal na mesma data)
    const today = new Date().toISOString().slice(0, 10);
    const resolvedIdempotencyKey = idempotencyKey || `${dealId}_${outcome}_${channel}_${today}`;
    const local = readLocalOutcomes();
    const existingAttempt = local.find(o => 
        o.idempotency_key === resolvedIdempotencyKey ||
        (o.deal_id === dealId && o.outcome === outcome && o.channel === channel && (o.created_at || '').startsWith(today))
    );
    if (existingAttempt) {
        return {
            success: true,
            idempotent: true,
            duplicated: true,
            dealId,
            outcome,
            outcomeId: existingAttempt.id,
            idempotencyKey: resolvedIdempotencyKey,
            message: 'Resultado já registado anteriormente nesta data (idempotência preservada sem duplicação).'
        };
    }

    // 4. Histórico prévio e validações contextuais de transição (B.13.4)
    const previousAttempts = await getPreviousAttempts(dealId);

    // Regra A: EXECUTADA só regista a execução da ação; não significa resposta positiva nem avança o deal
    if (outcome === 'EXECUTADA') {
        // Permitido: execução registada sem presunção de resposta nem transição no funil
    }

    // Regra B: SEM_RESPOSTA exige que tenha havido uma abordagem prévia e que a janela tenha decorrido
    if (outcome === 'SEM_RESPOSTA') {
        if (!previousAttempts || previousAttempts.length === 0) {
            return {
                success: false,
                statusCode: 422,
                error: 'NO_PRIOR_ATTEMPT',
                message: 'Impossível registar SEM_RESPOSTA sem qualquer tentativa de abordagem prévia registada para este negócio.'
            };
        }

        const lastAttempt = previousAttempts[0];
        const attemptDate = new Date(lastAttempt.attempt_date || lastAttempt.created_at || Date.now());
        const hoursElapsed = (Date.now() - attemptDate.getTime()) / (1000 * 60 * 60);
        if (hoursElapsed < 48 && !ignoreWindow) {
            return {
                success: false,
                statusCode: 422,
                error: 'OBSERVATION_WINDOW_NOT_ELAPSED',
                message: `A janela de observação ainda está em curso (${Math.max(0, Math.round(hoursElapsed))}h decorridas das 48h mínimas necessárias antes de classificar como sem resposta).`
            };
        }
    }

    // Regra C: RESPOSTA_POSITIVA exige transcrição ou evidência da resposta real
    if (outcome === 'RESPOSTA_POSITIVA') {
        const textProof = (evidence || notes || responseText || '').trim();
        if (!textProof || textProof.length < 5) {
            return {
                success: false,
                statusCode: 422,
                error: 'EVIDENCE_REQUIRED',
                message: 'RESPOSTA_POSITIVA exige registo ou transcrição da resposta real recebida do contacto.'
            };
        }
    }

    // Regra D: INTERESSE_QUALIFICADO exige evidência explícita de interesse comercial/dor
    if (outcome === 'INTERESSE_QUALIFICADO') {
        const qualProof = (evidence || notes || responseText || '').trim();
        if (!qualProof || qualProof.length < 10) {
            return {
                success: false,
                statusCode: 422,
                error: 'QUALIFICATION_EVIDENCE_REQUIRED',
                message: 'INTERESSE_QUALIFICADO exige registo explícito da dor clínica, necessidade de captação ou interesse manifestado.'
            };
        }
    }

    // Regra E: REUNIAO_CONFIRMADA exige comprovação do agendamento real
    if (outcome === 'REUNIAO_CONFIRMADA') {
        const meetProof = (evidence || notes || '').trim();
        if (!meetProof || meetProof.length < 10) {
            return {
                success: false,
                statusCode: 422,
                error: 'MEETING_EVIDENCE_REQUIRED',
                message: 'REUNIAO_CONFIRMADA exige comprovação do agendamento real (data, hora, link ou confirmação da agenda da clínica).'
            };
        }
    }

    // Regra F: PROPOSTA_APRESENTADA exige registo dos termos da proposta
    if (outcome === 'PROPOSTA_APRESENTADA') {
        const propProof = (evidence || notes || '').trim();
        if (!propProof || propProof.length < 10) {
            return {
                success: false,
                statusCode: 422,
                error: 'PROPOSAL_EVIDENCE_REQUIRED',
                message: 'PROPOSTA_APRESENTADA exige registo dos termos, valores ou documento da proposta comercial apresentada.'
            };
        }
    }

    // Regra G: VENDA_GANHA exige comprovação formal de fecho comercial
    if (outcome === 'VENDA_GANHA') {
        const saleProof = (evidence || notes || '').trim();
        if (!saleProof || saleProof.length < 10) {
            return {
                success: false,
                statusCode: 422,
                error: 'SALE_WON_EVIDENCE_REQUIRED',
                message: 'VENDA_GANHA exige comprovação formal de fecho comercial (contrato assinado ou liquidação da mensalidade).'
            };
        }
    }

    // Regra H: VENDA_PERDIDA exige registo explícito do motivo formal de encerramento
    if (outcome === 'VENDA_PERDIDA') {
        const lostReason = (notes || evidence || '').trim();
        if (!lostReason || lostReason.length < 10) {
            return {
                success: false,
                statusCode: 422,
                error: 'LOST_REASON_REQUIRED',
                message: 'VENDA_PERDIDA exige registo explícito do motivo formal de encerramento comercial definitivo.'
            };
        }
    }

    // 5. Gravar tentativa / outcome no repositório de aprendizagem (com chave de idempotência)
    const attemptRes = await recordReactivationAttempt({
        dealId,
        contactId,
        strategy,
        strategyVersion,
        channel,
        messageText: messageApproved || notes || evidence,
        lossClassification: 'OPERACIONAL',
        recoverabilityScore: 50,
        diagnosticConfidence: 'MEDIA',
        outcome,
        notes: notes || evidence,
        executedBy,
        idempotencyKey: resolvedIdempotencyKey,
        metadata: metadata || {}
    });

    // 6. Transições de Funil e Salvaguardas Conforme o Resultado
    let funnelTransition = null;

    if (outcome === 'OPTOUT') {
        let phoneDigits = phone ? cleanPhone(phone) : null;
        if (!phoneDigits && contactId && supabase) {
            try {
                const { data: ct } = await supabase.from('contacts').select('phone').eq('id', contactId).single();
                phoneDigits = cleanPhone(ct?.phone);
            } catch {}
        }
        // Ativar supressão local imediata fail-closed
        addLocalSuppression({
            deal_id: dealId,
            contact_id: contactId || null,
            telefone_normalizado: phoneDigits || 'none',
            motivo: `Oposição expressa / opt-out: ${notes || 'Registado pelo operador'}`,
            motivo_bloqueio: 'OPTOUT_EXPLICITO'
        });
        if (supabase) {
            try {
                await supabase.from('sdr_suppression_list').insert({
                    deal_id: dealId,
                    contact_id: contactId || null,
                    telefone_normalizado: phoneDigits || 'none',
                    motivo: `Oposição expressa / opt-out registado pelo operador SDR: ${notes || 'Sem notas adicionais'}`,
                    estado: 'ativo',
                    data_registo: new Date().toISOString()
                });
            } catch (e) {
                console.warn('⚠️ Erro ao inserir na lista de supressão:', e.message);
            }
        }
        funnelTransition = await executeFunnelTransition({ dealId, event: 'OPTOUT_OR_REFUSAL', metadata: { notes } });
    } else if (outcome === 'RESPOSTA_POSITIVA') {
        funnelTransition = await executeFunnelTransition({ dealId, event: 'REPLY_WITH_INTEREST', metadata: { notes, evidence } });
    } else if (outcome === 'INTERESSE_QUALIFICADO') {
        funnelTransition = await executeFunnelTransition({ dealId, event: 'REPLY_WITH_INTEREST', metadata: { notes, evidence } });
    } else if (outcome === 'REUNIAO_CONFIRMADA') {
        funnelTransition = await executeFunnelTransition({ dealId, event: 'MEETING_CONFIRMED', metadata: { notes, evidence } });
    } else if (outcome === 'VENDA_GANHA') {
        funnelTransition = await executeFunnelTransition({ dealId, event: 'SALE_WON', metadata: { notes, evidence } });
    } else if (outcome === 'VENDA_PERDIDA' || outcome === 'RESPOSTA_NEGATIVA') {
        funnelTransition = await executeFunnelTransition({ dealId, event: 'OPTOUT_OR_REFUSAL', metadata: { notes, evidence } });
    } else if (outcome === 'EXECUTADA' || outcome === 'SEM_RESPOSTA') {
        // Preserva o estado do pipeline sem alteração indevida
        funnelTransition = { success: true, changed: false, reason: `Registo de [${outcome}] efetuado; funil preservado sem alteração indevida de estado.` };
    }

    // 7. Registar atividade no CRM
    if (supabase) {
        try {
            const { data: deal } = await supabase.from('deals').select('user_id').eq('id', dealId).single();
            await supabase.from('activities').insert({
                user_id: deal?.user_id || '9469fb08-7de5-405e-a4e7-d83cf818ea1e',
                deal_id: dealId,
                type: channel?.toLowerCase() === 'call' ? 'call' : channel?.toLowerCase() === 'whatsapp' ? 'message' : 'system',
                title: `Registo SDR: Resultado [${outcome}] via ${channel || 'Posto Comercial'}`,
                notes: notes || evidence || `Ação executada com desfecho ${outcome}.`,
                date: new Date().toISOString(),
                completed: true
            });
        } catch (e) {
            console.warn('⚠️ Erro ao criar atividade no CRM:', e.message);
        }
    }

    const learningMetrics = await calculateLearningMetrics();

    return {
        success: true,
        dealId,
        outcome,
        outcomeId: attemptRes.outcomeId,
        idempotencyKey: resolvedIdempotencyKey,
        funnelTransition,
        learning: learningMetrics
    };
}

/**
 * Registar rotas no Express
 */
export function setupSDREngine(app) {
    console.log('🧠 [SDR + Closer Engine] Inicializando motor B.13.3 com Workspace Reestruturado...');
    setupLearningRoutes(app);

    /**
     * GET /api/sdr/queue
     * B.13.3: Fila de trabalho operacional com contagens dinâmicas para os 9 filtros
     */
    app.get('/api/sdr/queue', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10) || 150;
            const data = await getSDRWorkQueue({ limit });
            return res.json({ success: true, ...data });
        } catch (err) {
            console.error('❌ [SDR Engine] Erro ao carregar fila:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/record-outcome
     * B.13.4: Registo de desfecho comercial com validação estrita no backend
     */
    app.post('/api/sdr/record-outcome', async (req, res) => {
        try {
            const result = await handleRecordOutcome(req.body);
            if (!result.success) {
                const status = result.statusCode || (result.error === 'MISSING_PARAMETERS' || result.error === 'INVALID_OUTCOME' ? 400 : 422);
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (err) {
            console.error('❌ [SDR Engine] Erro ao registar resultado comercial:', err);
            return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
        }
    });

    /**
     * POST /api/sdr/diagnose
     * B.13.3: Motor completo enriquecido com linha temporal, tipo de tarefa,
     * guião de chamada, contexto do closer e cópia dupla.
     */
    app.post('/api/sdr/diagnose', async (req, res) => {
        const { dealId } = req.body;
        if (!dealId) {
            return res.status(400).json({ success: false, error: 'dealId é obrigatório' });
        }

        try {
            if (!supabase) {
                return res.status(500).json({ success: false, error: 'Supabase não inicializado' });
            }

            // 1. Obter dados do negócio
            const { data: deal, error: dealErr } = await supabase
                .from('deals')
                .select('*')
                .eq('id', dealId)
                .single();

            if (dealErr || !deal) {
                return res.status(404).json({ success: false, error: 'Negócio não encontrado', details: dealErr?.message });
            }

            // 2. Contacto associado
            let contact = null;
            if (deal.contact_id) {
                const { data: c } = await supabase.from('contacts').select('*').eq('id', deal.contact_id).single();
                contact = c;
            }

            // 3. Atividades cronológicas
            const { data: activities } = await supabase
                .from('activities')
                .select('*')
                .eq('deal_id', dealId)
                .order('date', { ascending: false });

            // 4. Deal logs (para análise semântica aprofundada)
            const { data: dealLogs } = await supabase
                .from('deal_logs')
                .select('*')
                .eq('deal_id', dealId)
                .order('created_at', { ascending: false })
                .limit(20);

            // 5. Supressão
            const phoneDigits = cleanPhone(contact?.phone);
            const { data: supp } = await supabase
                .from('sdr_suppression_list')
                .select('*')
                .or(`deal_id.eq.${dealId},contact_id.eq.${deal.contact_id || '00000000-0000-0000-0000-000000000000'},telefone_normalizado.eq.${phoneDigits || 'none'}`)
                .eq('estado', 'ativo');

            const isSuppressed = (supp && supp.length > 0);

            // 6. Dias desde a perda
            const now = new Date();
            const lostDate = deal.lost_at ? new Date(deal.lost_at) : (activities?.[0]?.date ? new Date(activities[0].date) : new Date(deal.created_at));
            const daysSinceLost = Math.max(0, Math.floor((now.getTime() - lostDate.getTime()) / (1000 * 60 * 60 * 24)));
            const respiroCumprido = daysSinceLost >= 30;

            // 7. B.13.1: Reconstrução factual profunda
            const factualHistory = reconstructFactualHistory(activities || [], dealLogs || []);

            // 8. B.13.2: Validação de identidade cruzando deal_logs
            const contactValidation = validateContactIdentity(contact, deal, dealLogs || []);

            // 9. B.13.2: Consultar tentativas anteriores (ciclo de aprendizagem)
            const previousAttempts = await getPreviousAttempts(dealId);

            // 10. Classificação Comercial da Perda
            const lossClassification = classifyLossReason(deal.lost_reason, activities || [], dealLogs || []);

            // 11. B.13.2: Score de Recuperabilidade com 5 dimensões estritas
            const recoverability = calculateRecoverabilityScore({
                deal,
                contact,
                activities: activities || [],
                lossClassification,
                daysSinceLost,
                isSuppressed,
                contactValidation,
                factualHistory,
                previousAttempts
            });

            // 12. B.13.2: Seleção deliberada de estratégia considerando aprendizagem
            const selectedStrategy = selectStrategy(factualHistory, lossClassification, contactValidation, previousAttempts);

            // 13. Execução do GPT / Fallback determinístico com 10 perguntas prévias e dual copy
            const gptResult = await runGPTDiagnosisAndStrategy({
                deal,
                contact,
                activities: activities || [],
                lossClassification,
                recoverability,
                daysSinceLost,
                factualHistory,
                contactValidation,
                selectedStrategy,
                previousAttempts
            });

            // 14. B.13.3: Determinação do Tipo de Tarefa para UI Orientada a Tarefa
            const contactPhone = contact?.phone || '';
            const isMobile = isMobilePhone(contactPhone);
            let taskType = 'MESSAGE';

            if (isSuppressed || !respiroCumprido || selectedStrategy?.strategy === 'PAUSA_EVITAR_SATURACAO') {
                taskType = 'PAUSE';
            } else if (deal.stage_id === 'stage_reuniao' || deal.stage_id === 'stage_lead_engajamento') {
                taskType = 'CLOSER_SPIN';
            } else if (contactValidation.status === 'REVISAO_HUMANA_OBRIGATORIA') {
                if (contactPhone && !isMobile) {
                    taskType = 'CALL';
                } else {
                    taskType = 'HUMAN_VALIDATION';
                }
            } else if (contactPhone && !isMobile) {
                taskType = 'CALL';
            } else if (selectedStrategy?.strategy === 'PEDIR_ORIENTACAO_DECISOR') {
                taskType = 'CALL';
            } else {
                taskType = 'MESSAGE';
            }

            // 15. Formatar Linha Temporal de Atividades Reais
            const activitiesTimeline = (activities || []).map(a => ({
                id: a.id,
                date: a.date ? a.date.slice(0, 10) : (a.created_at ? a.created_at.slice(0, 10) : 'N/A'),
                fullDate: a.date || a.created_at,
                type: a.type || 'activity',
                title: a.title || 'Atividade',
                notes: a.notes || '',
                completed: a.completed,
                channel: a.type === 'email' ? 'EMAIL' : a.type === 'message' ? 'WHATSAPP' : a.type === 'call' ? 'CALL' : a.type?.toUpperCase(),
                isInbound: a.type === 'inbound' || a.houve_resposta === true || a.title?.toLowerCase().includes('resposta') || a.title?.toLowerCase().includes('inbound')
            }));

            // 16. Estruturar Guião de Chamada (CALL)
            const callScript = {
                objetivo: selectedStrategy?.strategy === 'PEDIR_ORIENTACAO_DECISOR' || contactValidation.status === 'REVISAO_HUMANA_OBRIGATORIA'
                    ? 'Identificar o médico dentista titular / diretor clínico e recolher o canal direto preferencial'
                    : 'Contacto consultivo direto para entender prioridades clínicas em tratamentos particulares',
                o_que_sabemos: [
                    `Clínica: ${contactValidation.normalizedClinic || deal.title}`,
                    `Interlocutor no CRM: ${contactValidation.identifiedInLogs || contact?.name || 'Apenas receção identificada'}`,
                    `Motivo de perda: ${deal.lost_reason || 'Silêncio comercial'} (${daysSinceLost} dias decorridos)`,
                    `Tentativas anteriores: ${factualHistory.totalOutbound} ações realizadas (${factualHistory.uniqueChannels?.join(', ') || 'N/A'})`
                ],
                o_que_falta_descobrir: [
                    'Nome e disponibilidade do diretor clínico ou sócio-gerente',
                    'Se realizam ativamente reabilitação oral e implantes com capacidade de agenda',
                    'Canal institucional direto (e-mail ou telemóvel do doutor)'
                ],
                guiao_contextual: contactValidation.status === 'REVISAO_HUMANA_OBRIGATORIA' || selectedStrategy?.strategy === 'PEDIR_ORIENTACAO_DECISOR'
                    ? `«Boa tarde, daqui fala Philipe Coelho da Vamuss. Gostaria de saber, por favor, quem é o médico dentista responsável pela direção clínica da ${contactValidation.normalizedClinic || 'clínica'}, para podermos endereçar uma comunicação específica sobre captação de pacientes particulares para tratamentos de reabilitação. Seria possível passar a chamada ou facultar o e-mail direto do doutor?»`
                    : `«Boa tarde ${contactValidation.identifiedInLogs || 'Dr(a)'}, daqui fala Philipe Coelho da Vamuss. Sei que está com a sua agenda em gabinete, pelo que serei muito direto: apoiamos clínicas a captar novos pacientes particulares para tratamentos de implantes e estética através de pesquisa no Google. Faria sentido falarmos 2 minutos sobre como estruturamos isto?»`
            };

            // 17. Detalhes de Pausa (PAUSE)
            const pauseDetails = {
                em_pausa: !respiroCumprido || isSuppressed || selectedStrategy?.strategy === 'PAUSA_EVITAR_SATURACAO',
                motivo: isSuppressed
                    ? 'Contacto em lista de supressão ativa (oposição/opt-out).'
                    : !respiroCumprido
                    ? `Respiro comercial de 30 dias em curso. Apenas ${daysSinceLost} dias decorridos.`
                    : 'Pausa comercial deliberada para evitar saturação após tentativas sem resposta.',
                dias_decorridos: daysSinceLost,
                dias_restantes: Math.max(0, 30 - daysSinceLost),
                data_reavaliacao: new Date(Date.now() + Math.max(0, 30 - daysSinceLost) * 86400000).toISOString().slice(0, 10),
                bloqueia_envio: true
            };

            // 18. Memória Partilhada e Qualificação SPIN (CLOSER_SPIN)
            const closerContext = {
                resumo_partilhado: `Negócio "${deal.title}" com perda anterior por "${deal.lost_reason || 'silêncio'}". Histórico com ${factualHistory.totalOutbound} contactos. Decisor: ${contactValidation.identifiedInLogs || 'Não confirmado'}. Propostas anteriores: ${factualHistory.hasProposal ? 'Sim' : 'Não'}.`,
                criterio_transferencia: 'Aprovada apenas com resposta explícita demonstrando interesse em consultas particulares.',
                roteiro_spin: gptResult.qualificacao_closer?.roteiro_spin || {
                    situacao: 'Como está estruturada hoje a captação de primeiras consultas na clínica?',
                    problema: 'A dependência de seguros ou recomendações causa oscilação na agenda?',
                    implicacao: 'Quanto custa um gabinete ocioso ou a baixa margem de convenções?',
                    necessidade: 'Faria sentido ter um sistema que garanta novas consultas particulares todos os meses?'
                },
                criterio_proxima_etapa: 'Confirmar data na agenda da clínica antes de declarar reunião agendada.',
                limitacao_calendario: 'Nota de Salvaguarda: Não existe sincronização com calendário externo. Confirmações de reunião devem ser validadas com o agendamento real na agenda da clínica.'
            };

            // 19. Cópia Dupla Estratégica (MESSAGE)
            const dualCopy = {
                canal_recomendado: gptResult.mensagem_sdr_pt_pt?.canal_sugerido || (contact?.email ? 'EMAIL' : 'WHATSAPP'),
                texto_recomendado: gptResult.mensagem_sdr_pt_pt?.texto_recomendado || gptResult.mensagem_sdr_pt_pt?.texto || '',
                alternativa_comercial_relevante: gptResult.mensagem_sdr_pt_pt?.alternativa_comercial_relevante || '',
                explicacao_diferenca_estrategica: gptResult.mensagem_sdr_pt_pt?.explicacao_diferenca_estrategica || '',
                destinatario_nome: contactValidation.identifiedInLogs || contact?.name || 'Direção Clínica',
                destinatario_origem: contactValidation.sourceNote || 'CRM Contatos / Histórico de atividades'
            };

            return res.json({
                success: true,
                dealId,
                title: deal.title,
                status: deal.status,
                stageId: deal.stage_id,
                lostReason: deal.lost_reason,
                daysSinceLost,
                respiroCumprido,
                isSuppressed,
                contactValidation,
                factualHistory,
                lossClassification,
                selectedStrategy,
                recoverability,
                previousAttempts,
                taskType,
                callScript,
                pauseDetails,
                closerContext,
                dualCopy,
                activities: activitiesTimeline,
                analiseDecisaoPrevia: gptResult.analise_decisao_previa,
                gptDiagnosis: gptResult
            });

        } catch (err) {
            console.error('❌ [SDR Engine] Erro ao diagnosticar negócio:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/record-attempt
     * B.13.1: Registar tentativa de reativação no sistema de aprendizagem
     */
    app.post('/api/sdr/record-attempt', async (req, res) => {
        try {
            const result = await recordReactivationAttempt(req.body);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/update-outcome
     * B.13.1: Atualizar resultado de uma tentativa
     */
    app.post('/api/sdr/update-outcome', async (req, res) => {
        try {
            const result = await updateOutcomeResult(req.body);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/transition
     * Executa transição controlada no funil do CRM
     */
    app.post('/api/sdr/transition', async (req, res) => {
        const { dealId, event, metadata } = req.body;
        if (!dealId || !event) {
            return res.status(400).json({ success: false, error: 'dealId e event são obrigatórios' });
        }

        try {
            const result = await executeFunnelTransition({ dealId, event, metadata });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/metrics
     * B.13.1: Métricas expandidas com sistema de aprendizagem
     */
    app.get('/api/sdr/metrics', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(500).json({ success: false, error: 'Supabase indisponível' });
            }

            const { count: totalLost } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'lost');
            const { count: totalSuppressed } = await supabase.from('sdr_suppression_list').select('*', { count: 'exact', head: true }).eq('estado', 'ativo');
            const { count: totalActivities } = await supabase.from('activities').select('*', { count: 'exact', head: true });

            // B.13.1: Métricas de aprendizagem
            const learningMetrics = await calculateLearningMetrics();

            return res.json({
                success: true,
                metrics: {
                    totalNegociosPerdidos: totalLost || 0,
                    totalContactosSuprimidos: totalSuppressed || 0,
                    totalAtividadesRegistadas: totalActivities || 0,
                    regraRespiroDias: 30,
                    limiteTentativasCadencia: 2,
                    intervaloCadenciaDiasUteis: '5 a 7 dias',
                    horarioPermitidoEnvio: 'Segunda a sexta-feira, 09h00 às 17h00 (Europe/Lisbon)'
                },
                learning: learningMetrics
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/learning
     * B.13.1 & B.14.1.5: Endpoint de métricas de aprendizagem com KPIs avançados, custos e memória
     */
    app.get('/api/sdr/learning', async (req, res) => {
        try {
            const metrics = await calculateLearningMetrics();
            const advanced = calculateAdvancedKPIs({ periodDays: parseInt(req.query?.period || '30', 10) });
            const memory = readLearningMemory();
            const recentInsights = readLearningInsights().slice(0, 5);
            return res.json({
                success: true,
                learning: metrics,
                advanced,
                memory,
                recentInsights
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * ============================================================================
     * ENDPOINTS DO EXECUTOR AUTÓNOMO (B.14)
     * ============================================================================
     */

    /**
     * GET /api/sdr/worker/status
     * Estado consolidado do worker, circuit breaker, kill switch e fila
     */
    app.get('/api/sdr/worker/status', async (req, res) => {
        try {
            const { defaultSDRWorker } = await import('./sdr_worker.js');
            return res.json({
                success: true,
                status: defaultSDRWorker.getStatus()
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/worker/health
     * Health check operacional para monitorização contínua e probes de deployment (Fase B.14.3.5)
     */
    app.get('/api/sdr/worker/health', async (req, res) => {
        try {
            const { defaultSDRWorker } = await import('./sdr_worker.js');
            const status = defaultSDRWorker.getStatus();
            const httpStatus = status.killSwitchActive ? 503 : (status.circuitBreaker.tripped ? 503 : 200);
            return res.status(httpStatus).json({
                health: status.operationalMode,
                uptimeSeconds: Math.floor(process.uptime()),
                pid: process.pid,
                status
            });
        } catch (err) {
            return res.status(500).json({ health: 'UNHEALTHY', error: err.message });
        }
    });

    /**
     * POST /api/sdr/reconciliation/run
     * Dispara a reconciliação automática de elegibilidade de todos os negócios perdidos
     */
    app.post('/api/sdr/reconciliation/run', async (req, res) => {
        try {
            const { reconcileAllLostDeals } = await import('./sdr_eligibility_reconciler.js');
            const limit = parseInt(req.body?.limit || req.query?.limit || 500, 10);
            const result = await reconcileAllLostDeals({ limit });
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/reconciliation/status
     * Consulta o relatório da última reconciliação automática
     */
    app.get('/api/sdr/reconciliation/status', async (req, res) => {
        try {
            const { readReconciliationStore } = await import('./sdr_eligibility_reconciler.js');
            return res.json({ success: true, ...readReconciliationStore() });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET & POST /api/sdr/worker/tick
     * Dispara um ciclo (tick) do worker com opções. Suporta invocação por Vercel Cron (GET) ou manual/API (POST).
     */
    const handleWorkerTick = async (req, res) => {
        try {
            const { defaultSDRWorker } = await import('./sdr_worker.js');
            const options = { ...(req.query || {}), ...(req.body || {}) };
            const result = await defaultSDRWorker.tick(options);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    app.get('/api/sdr/worker/tick', handleWorkerTick);
    app.post('/api/sdr/worker/tick', handleWorkerTick);

    /**
     * GET /api/sdr/worker/queue
     * Consulta as tarefas da fila com filtro opcional por estado
     */
    app.get('/api/sdr/worker/queue', async (req, res) => {
        try {
            const { readTaskQueue, getTaskQueueStats } = await import('./sdr_task_queue.js');
            const { status } = req.query;
            let tasks = readTaskQueue();
            if (status) {
                tasks = tasks.filter(t => t.state === status.toUpperCase());
            }
            return res.json({
                success: true,
                total: tasks.length,
                stats: getTaskQueueStats(),
                tasks
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/worker/kill-switch
     * Ativa ou desativa o Kill Switch de emergência
     */
    app.post('/api/sdr/worker/kill-switch', async (req, res) => {
        try {
            const { active } = req.body;
            if (typeof active !== 'boolean') {
                return res.status(400).json({ success: false, error: 'Campo "active" (booleano) é obrigatório.' });
            }
            process.env.SDR_KILL_SWITCH = active ? 'true' : 'false';
            const { defaultSDRWorker } = await import('./sdr_worker.js');
            return res.json({
                success: true,
                message: active ? '⛔ Kill Switch ATIVADO. Execuções em background interrompidas.' : '🟢 Kill Switch DESATIVADO. Execuções retomadas.',
                killSwitchActive: defaultSDRWorker.isKillSwitchActive()
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/costs/status
     * B.14.2: Estado consolidado do controlador de custos e orçamentos
     */
    app.get('/api/sdr/costs/status', (req, res) => {
        try {
            return res.json({ success: true, costs: getCostControllerStatus() });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/conversational/evaluate
     * B.14.2: Avaliação semântica de resposta com cérebro comercial GPT
     */
    app.post('/api/sdr/conversational/evaluate', async (req, res) => {
        try {
            const { inboundText, dealId, contactId, phone } = req.body;
            if (!inboundText) return res.status(400).json({ success: false, error: 'inboundText é obrigatório' });

            let deal = null;
            if (supabase && dealId) {
                const { data: d } = await supabase.from('deals').select('*').eq('id', dealId).single();
                deal = d;
            }
            if (!deal) deal = { id: dealId || 'test_deal', title: 'Negócio Simulado' };

            let contact = null;
            if (supabase && contactId) {
                const { data: c } = await supabase.from('contacts').select('*').eq('id', contactId).single();
                contact = c;
            }
            if (!contact) contact = { id: contactId || 'test_contact', phone: phone || '' };

            const decision = await runConversationalDecisionGPT({
                inboundText,
                deal,
                contact
            });

            return res.json({ success: true, decision });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * ========================================================================
     * B.14.3: ENDPOINTS DO PIPELINE DE RECUPERAÇÃO COMERCIAL
     * ========================================================================
     */

    /**
     * GET /api/sdr/recovery-pipeline
     * Retorna o funil de 9 etapas, contadores e métricas operacionais
     */
    app.get('/api/sdr/recovery-pipeline', async (req, res) => {
        try {
            const { getRecoveryPipelineData } = await import('./sdr_recovery_pipeline.js');
            const limit = parseInt(req.query.limit, 10) || 150;
            const data = await getRecoveryPipelineData({ limit });
            return res.json({ success: true, ...data });
        } catch (err) {
            console.error('❌ [Recovery Pipeline] Erro ao obter dados do funil:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/recovery-pipeline/action
     * Executa ações operacionais do Closer Humano (assumir, contacto, agendar, adiar, fechar)
     */
    app.post('/api/sdr/recovery-pipeline/action', async (req, res) => {
        try {
            const { executeRecoveryAction } = await import('./sdr_recovery_pipeline.js');
            const result = await executeRecoveryAction(req.body);
            if (!result.success) {
                const status = result.error === 'MISSING_PARAMETERS' || result.error === 'PRECONDITION_FAILED' ? 400 : 422;
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (err) {
            console.error('❌ [Recovery Pipeline] Erro ao executar ação operacional:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/sdr/recovery-pipeline/handoff
     * Aciona suspensão da IA e transferência para o operador
     */
    app.post('/api/sdr/recovery-pipeline/handoff', async (req, res) => {
        try {
            const { triggerCloserHandoff } = await import('./sdr_recovery_pipeline.js');
            const result = await triggerCloserHandoff(req.body);
            if (!result.success) {
                return res.status(400).json(result);
            }
            return res.json(result);
        } catch (err) {
            console.error('❌ [Recovery Pipeline] Erro ao acionar handoff:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/sdr/recovery-pipeline/deal/:dealId
     * Retorna o histórico completo e diagnóstico factual para o modal de detalhe
     */
    app.get('/api/sdr/recovery-pipeline/deal/:dealId', async (req, res) => {
        try {
            const { getRecoveryDealDetail } = await import('./sdr_recovery_pipeline.js');
            const result = await getRecoveryDealDetail(req.params.dealId);
            if (!result.success) {
                return res.status(result.error === 'DEAL_NOT_FOUND' ? 404 : 400).json(result);
            }
            return res.json(result);
        } catch (err) {
            console.error('❌ [Recovery Pipeline] Erro ao buscar detalhe do negócio:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/webhooks/calcom & /api/calcom/webhook
     * Webhook de agendamento do Cal.com (integração 100% autónoma)
     */
    const handleCalcomWebhook = async (req, res) => {
        try {
            const body = req.body || {};
            const triggerEvent = body.triggerEvent || body.type;
            const payload = body.payload || body;

            console.log(`📅 [Cal.com Webhook] Evento recebido: ${triggerEvent || 'desconhecido'}`);

            if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'booking.created' || body.event === 'BOOKING_CREATED') {
                const attendees = payload.attendees || [];
                const firstAttendee = attendees[0] || {};
                const attendeeEmail = (firstAttendee.email || payload.email || '').toLowerCase().trim();
                const attendeeName = firstAttendee.name || payload.name || 'Doutor(a)';
                const attendeePhone = payload.responses?.phone || payload.phone || '';
                const startTime = payload.startTime || payload.date;

                console.log(`🎉 [Cal.com Webhook] Reunião agendada por: ${attendeeName} (${attendeeEmail} / ${attendeePhone}) em ${startTime}`);

                let matchedDeal = null;
                if (supabase) {
                    if (attendeePhone) {
                        const cleanP = attendeePhone.replace(/\D/g, '').slice(-9);
                        const { data: contacts } = await supabase.from('contacts').select('id, name, phone, email').ilike('phone', `%${cleanP}%`);
                        if (contacts && contacts.length > 0) {
                            const { data: deals } = await supabase.from('deals').select('*').eq('contact_id', contacts[0].id).order('created_at', { ascending: false }).limit(1);
                            if (deals && deals.length > 0) matchedDeal = deals[0];
                        }
                    }
                    if (!matchedDeal && attendeeEmail) {
                        const { data: contacts } = await supabase.from('contacts').select('id, name, phone, email').eq('email', attendeeEmail);
                        if (contacts && contacts.length > 0) {
                            const { data: deals } = await supabase.from('deals').select('*').eq('contact_id', contacts[0].id).order('created_at', { ascending: false }).limit(1);
                            if (deals && deals.length > 0) matchedDeal = deals[0];
                        }
                    }
                }

                const dealId = matchedDeal?.id;

                // 2. Mover o deal para stage_reuniao no Supabase
                if (supabase && dealId) {
                    await supabase.from('deals').update({
                        stage_id: 'stage_reuniao',
                        status: 'open',
                        updated_at: new Date().toISOString()
                    }).eq('id', dealId);

                    await supabase.from('activities').insert({
                        deal_id: dealId,
                        type: 'meeting',
                        title: `Reunião Confirmada (Cal.com): ${startTime}`,
                        notes: `Reunião de Diagnóstico de 20 min agendada pelo lead no link do Cal.com.\nData: ${startTime}\nParticipante: ${attendeeName} (${attendeeEmail})`,
                        date: startTime || new Date().toISOString(),
                        completed: false,
                        is_automatic: true
                    });
                }

                // 3. Atualizar pipeline de recuperação para reuniao_confirmada
                if (dealId) {
                    const { executeRecoveryAction } = await import('./sdr_recovery_pipeline.js');
                    await executeRecoveryAction({
                        dealId,
                        action: 'CONFIRMAR_REUNIAO',
                        payload: { meetingDate: startTime }
                    });
                }

                // 4. Enviar mensagem de confirmação para o WhatsApp do Philipe
                const operatorPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
                const { getWhatsAppWebStatus, sendWhatsAppWebMessage } = await import('./whatsapp_web.js');
                const wa = getWhatsAppWebStatus();
                if (wa.isConnected) {
                    const confirmMsg = `🎉 *REUNIÃO CONFIRMADA NO CAL.COM!*\n\n` +
                        `• *Clínica / Contacto:* ${attendeeName}\n` +
                        `• *Contacto:* ${attendeePhone || attendeeEmail}\n` +
                        `• *Data & Hora:* ${new Date(startTime).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}\n` +
                        `• *Negócio:* ${matchedDeal?.title || 'Lead Cal.com'} (${dealId || 'N/A'})\n\n` +
                        `👉 O negócio foi atualizado automaticamente para a etapa de Reunião no pipeline comercial!`;
                    await sendWhatsAppWebMessage(operatorPhone, confirmMsg);
                }

                return res.json({ success: true, processed: true, dealId });
            }

            return res.json({ success: true, ignored: true, triggerEvent });
        } catch (err) {
            console.error('❌ [Cal.com Webhook] Erro ao processar webhook:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    app.post('/api/webhooks/calcom', handleCalcomWebhook);
    app.post('/api/calcom/webhook', handleCalcomWebhook);

    // B.15: Endpoints de Observabilidade e Aprendizagem (Relatório Semanal, Objeções e Dossiê Web)
    app.get('/api/sdr/reports/weekly', (req, res) => {
        try {
            const report = generateWeeklyLearningReport();
            return res.json({ success: true, report });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get('/api/sdr/objections', (req, res) => {
        try {
            const repo = readObjectionsRepository();
            return res.json({ success: true, objections: repo.objections });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get('/api/sdr/dossier/:dealId', (req, res) => {
        try {
            const dossier = getValidDossier(req.params.dealId);
            return res.json({ success: true, dossier: dossier || null });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });
}


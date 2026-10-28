import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    checkSuppression,
    createSuppressionRecord,
    deduplicateSuppressionList
} from './sdr_suppression_engine.mjs';

import {
    SDRCadenceSimulator
} from './sdr_cadence_simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_B3_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b3_validation.json');
const INPUT_B2_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');
const OUTPUT_B4_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b4_readiness.json');

/**
 * ============================================================================
 * VAMUSS SDR — FASE B.4: RECONCILIAÇÃO FINAL, ELEGIBILIDADE E READINESS
 * ============================================================================
 */
export function runPhaseB4Readiness() {
    console.log('🚀 Iniciando VAMUSS SDR — FASE B.4: Reconciliação Final e Readiness do Piloto...');

    if (!fs.existsSync(INPUT_B3_FILE) || !fs.existsSync(INPUT_B2_FILE)) {
        throw new Error('Ficheiros de entrada B.2 e B.3 devem existir antes de executar B.4.');
    }

    const b3Data = JSON.parse(fs.readFileSync(INPUT_B3_FILE, 'utf8'));
    const b2Data = JSON.parse(fs.readFileSync(INPUT_B2_FILE, 'utf8'));

    const allDealsB2 = b2Data.auditoria_completa_405_negocios || [];
    console.log(`📦 Carregados ${allDealsB2.length} negócios auditados.`);

    // 1. RECONCILIAÇÃO E DISTRIBUIÇÃO DAS 11 CATEGORIAS CANÓNICAS
    const distributionCounts = {
        DESQUALIFICADO_INCOMPATIVEL: 0,
        SILENCIO_CONFIRMADO: 0,
        JA_TEM_AGENCIA_OU_ANUNCIA: 0,
        RECUSA_COMERCIAL_DIRETA: 0,
        AMBIGUO_OU_GATEKEEPER: 0,
        HISTORICO_INCOMPLETO_SEM_EVIDENCIA: 0,
        RESTRICAO_CANAL: 0,
        INATINGIVEL_TECNICO: 0,
        RESPOSTA_AUTOMATICA: 0,
        CONTINGENCIA_OU_ADIAMENTO: 0,
        SILENCIO_APOS_PROPOSTA: 0
    };

    allDealsB2.forEach(d => {
        const cat = d.auditoria_classificacao.fase_b2_revisada;
        if (distributionCounts[cat] !== undefined) {
            distributionCounts[cat]++;
        } else {
            throw new Error(`Categoria inesperada: ${cat}`);
        }
    });

    const sumDistribution = Object.values(distributionCounts).reduce((a, b) => a + b, 0);
    console.log(`✅ Soma das 11 categorias canónicas: ${sumDistribution} (Esperado: exatamente 405).`);

    // 2. TRATAMENTO ESPECÍFICO DOS CASOS ESPECIAIS (4 AUTO-REPLY, 3 CONTINGÊNCIA, 1 PROPOSTA)
    const specialCases = {
        respostas_automaticas: allDealsB2
            .filter(d => d.auditoria_classificacao.fase_b2_revisada === 'RESPOSTA_AUTOMATICA')
            .map(d => ({
                deal_id: d.deal_id,
                nome: d.nome_clinica,
                motivo_original: d.motivo_perda_original,
                tratamento_operacional: 'Interlocutor humano não atingido no passado. Bloqueado para cadência automática; requer ligação telefónica direta em horário comercial ou revisão de recepção.'
            })),
        adiamento_ou_contingencia: allDealsB2
            .filter(d => d.auditoria_classificacao.fase_b2_revisada === 'CONTINGENCIA_OU_ADIAMENTO')
            .map(d => ({
                deal_id: d.deal_id,
                nome: d.nome_clinica,
                motivo_original: d.motivo_perda_original,
                tratamento_operacional: 'Contingência temporária de equipa, obras ou migração. Quarentena de espera de 90 a 180 dias; não incluir em supressão definitiva.'
            })),
        silencio_apos_proposta: allDealsB2
            .filter(d => d.auditoria_classificacao.fase_b2_revisada === 'SILENCIO_APOS_PROPOSTA')
            .map(d => ({
                deal_id: d.deal_id,
                nome: d.nome_clinica,
                motivo_original: d.motivo_perda_original,
                tratamento_operacional: 'Lead quente que silenciou após proposta comercial formal. Proibido envio de template genérico; encaminhar exclusivamente para follow-up consultivo de Closer Humano.'
            }))
    };

    // 3. TABELA DE RECONCILIAÇÃO COMPLETA (405 NEGÓCIOS)
    const reconciliationTable = allDealsB2.map(d => {
        let acaoOperacional = 'NENHUMA';
        const cat = d.auditoria_classificacao.fase_b2_revisada;

        switch (cat) {
            case 'DESQUALIFICADO_INCOMPATIVEL':
                acaoOperacional = 'Arquivamento definitivo no CRM sem abordagem (ICP incompatível / clínica fechada / grande grupo / sem presença digital).';
                break;
            case 'SILENCIO_CONFIRMADO':
                acaoOperacional = 'Candidato comercial a reativação com abordagem respeitosa (sujeito a validação prévia de base legal e LIA B2B).';
                break;
            case 'JA_TEM_AGENCIA_OU_ANUNCIA':
                acaoOperacional = 'Quarentena comercial de 90 a 180 dias para pesquisa de satisfação / benchmark com agência atual (não é opt-out).';
                break;
            case 'RECUSA_COMERCIAL_DIRETA':
                acaoOperacional = 'Supressão total no servidor (TODOS) em respeito à recusa expressa do cliente.';
                break;
            case 'AMBIGUO_OU_GATEKEEPER':
                acaoOperacional = 'Revisão humana obrigatória antes de qualquer contacto (atrito de receção / notas dúbias).';
                break;
            case 'HISTORICO_INCOMPLETO_SEM_EVIDENCIA':
                acaoOperacional = 'Revisão manual de cadastro (sem notas e sem histórico no CRM).';
                break;
            case 'RESTRICAO_CANAL':
                acaoOperacional = 'Supressão de WhatsApp no servidor (WHATSAPP); avaliar e-mail mediante solicitação explícita.';
                break;
            case 'INATINGIVEL_TECNICO':
                acaoOperacional = 'Revisão cadastral de telefone (discador não chama / só caixa postal / sem WhatsApp).';
                break;
            case 'RESPOSTA_AUTOMATICA':
                acaoOperacional = 'Tentativa única em horário comercial nobre ou contacto telefónico de receção.';
                break;
            case 'CONTINGENCIA_OU_ADIAMENTO':
                acaoOperacional = 'Agendamento de reavaliação pós-migração / quarentena de equipa completa.';
                break;
            case 'SILENCIO_APOS_PROPOSTA':
                acaoOperacional = 'Follow-up consultivo personalizado de proposta com Closer Humano.';
                break;
        }

        return {
            deal_id: d.deal_id,
            nome_clinica: d.nome_clinica,
            categoria_b1_anterior: d.auditoria_classificacao.fase_b1_anterior,
            categoria_final_canonica: cat,
            evidencia_crm: d.motivo_perda_original,
            acao_operacional_proposta: acaoOperacional
        };
    });

    // 4. VALIDAÇÃO DOS 116 NEGÓCIOS DE SILÊNCIO CONFIRMADO (8 EIXOS)
    const suppressionList = b2Data.lista_supressao_estrita_proposta.registos || [];
    const suppressedPhones = new Map();
    const suppressedEmails = new Map();
    suppressionList.forEach(s => {
        if (s.telefone_normalizado) suppressedPhones.set(s.telefone_normalizado, s);
        if (s.email_normalizado) suppressedEmails.set(s.email_normalizado, s);
    });

    const silence116Deals = allDealsB2.filter(d => d.auditoria_classificacao.fase_b2_revisada === 'SILENCIO_CONFIRMADO');
    const validated116Detail = [];

    const legalStats = {
        total_avaliados: 116,
        tipo_destinatario: {
            pessoa_singular_medico: 0,
            entidade_colectiva_clinica: 0
        },
        canal_candidato: {
            whatsapp: 0,
            email_apenas: 0
        },
        restricoes_ativas: {
            livre: 0,
            bloqueado_herdado_telefone: 0,
            bloqueado_herdado_email: 0
        },
        base_legal_e_consentimento: {
            optin_comprovado_crm: 0,
            sem_optin_documentado_crm: 116, // Nenhum tem opt-in formal comprovado no CRM
            elegivel_para_analise_lia_b2b: 0
        },
        estado_validacao_envio_real: {
            BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN: 0,
            BLOQUEADO_HERANCA_ENDPOINT: 0,
            PENDENTE_DESAMBIGUACAO_PARTILHA: 0,
            PENDENTE_AVALIACAO_LIA_B2B: 0
        },
        autorizados_a_disparar_agora_sem_validacao: 0 // ZERO ABSOLUTO
    };

    silence116Deals.forEach(deal => {
        const titleLower = (deal.nome_clinica || '').toLowerCase();
        const contactNameLower = (deal.contacto?.nome || '').toLowerCase();
        const isIndividualDoctor = titleLower.includes('dr.') || titleLower.includes('dra.') || 
                                   titleLower.includes('doutor') || titleLower.includes('doutora') ||
                                   contactNameLower.includes('dr.') || contactNameLower.includes('dra.');

        const tipoDestinatario = isIndividualDoctor ? 'PESSOA_SINGULAR_MEDICO' : 'ENTIDADE_COLECTIVA_CLINICA';
        if (isIndividualDoctor) legalStats.tipo_destinatario.pessoa_singular_medico++;
        else legalStats.tipo_destinatario.entidade_colectiva_clinica++;

        const phone = deal.contacto.telefone_normalizado;
        const email = deal.contacto.email_normalizado;

        // Restrições aplicáveis
        let restricaoAtiva = 'NENHUMA';
        if (phone && suppressedPhones.has(phone)) {
            const sup = suppressedPhones.get(phone);
            restricaoAtiva = `HERDADA_TELEFONE_${sup.canal_bloqueado}`;
            legalStats.restricoes_ativas.bloqueado_herdado_telefone++;
        } else if (email && suppressedEmails.has(email)) {
            const sup = suppressedEmails.get(email);
            restricaoAtiva = `HERDADA_EMAIL_${sup.canal_bloqueado}`;
            legalStats.restricoes_ativas.bloqueado_herdado_email++;
        } else {
            legalStats.restricoes_ativas.livre++;
        }

        // Canal candidato
        let canalCandidato = 'EMAIL';
        if (phone && phone.startsWith('3519') && !restricaoAtiva.includes('TELEFONE')) {
            canalCandidato = 'WHATSAPP';
            legalStats.canal_candidato.whatsapp++;
        } else {
            legalStats.canal_candidato.email_apenas++;
        }

        // Base Legal & Consentimento
        const consentimentoDocumentadoCRM = false; // Fato: o CRM não contém prova documental de opt-in prévio

        // Estado de Validação para Envio Real
        let estadoValidacao = 'PENDENTE_AVALIACAO_LIA_B2B';
        let revisaoHumana = false;
        let motivoPendencia = '';

        if (restricaoAtiva !== 'NENHUMA') {
            estadoValidacao = 'BLOQUEADO_HERANCA_ENDPOINT';
            revisaoHumana = true;
            motivoPendencia = 'Endpoint partilhado sob restrição ativa de outro negócio.';
            legalStats.estado_validacao_envio_real.BLOQUEADO_HERANCA_ENDPOINT++;
        } else if (deal.contacto.partilhas_e_duplicados.mesmo_telefone) {
            estadoValidacao = 'PENDENTE_DESAMBIGUACAO_PARTILHA';
            revisaoHumana = true;
            motivoPendencia = 'Telefone partilhado entre clínicas distintas no CRM. Requer desambiguação prévia de titularidade.';
            legalStats.estado_validacao_envio_real.PENDENTE_DESAMBIGUACAO_PARTILHA++;
        } else if (isIndividualDoctor) {
            estadoValidacao = 'BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN';
            revisaoHumana = true;
            motivoPendencia = 'Pessoa singular (médico individual). Art. 13º DL 7/2004 exige consentimento prévio (opt-in) para comunicações diretas não solicitadas.';
            legalStats.estado_validacao_envio_real.BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN++;
        } else {
            estadoValidacao = 'PENDENTE_AVALIACAO_LIA_B2B';
            revisaoHumana = false;
            motivoPendencia = 'Pessoa colectiva (clínica). Requer aprovação do teste de legítimo interesse comercial (LIA B2B) antes de qualquer envio real.';
            legalStats.estado_validacao_envio_real.PENDENTE_AVALIACAO_LIA_B2B++;
            legalStats.base_legal_e_consentimento.elegivel_para_analise_lia_b2b++;
        }

        validated116Detail.push({
            deal_id: deal.deal_id,
            nome_clinica: deal.nome_clinica,
            elegibilidade_comercial: true,
            tipo_destinatario: tipoDestinatario,
            canal_candidato: canalCandidato,
            restricao_ativa: restricaoAtiva,
            base_legal_aplicavel: isIndividualDoctor ? 'CONSENTIMENTO_EXPLICITO_OPTIN' : 'LEGITIMO_INTERESSE_B2B_CORPORATIVO',
            consentimento_verificado_crm: consentimentoDocumentadoCRM,
            estado_validacao_envio_real: estadoValidacao,
            revisao_humana_obrigatoria: revisaoHumana,
            motivo_pendencia: motivoPendencia,
            identificadores: {
                telefone: phone,
                email: email
            }
        });
    });

    // 5. SIMULAÇÃO DA CADÊNCIA CONTROLADA COM O MOTOR CANÓNICO
    console.log('🔄 Executando simulação de cadência controlada em memória...');
    const simulator = new SDRCadenceSimulator({
        suppressionList,
        maxAttemptsPerCycle: 2,
        intervalDays: 6,
        maxGlobalAttempts: 100
    });

    const simulationResults = [];

    // Rodar simulação nos 97 casos de entidades coletivas aptos para avaliação de cadência simulada
    const cohortForSimulation = validated116Detail.filter(d => d.estado_validacao_envio_real === 'PENDENTE_AVALIACAO_LIA_B2B');

    cohortForSimulation.forEach((prospect, idx) => {
        // Tentativa 1 simulada no Dia 1
        const att1 = simulator.simulateAttempt({
            deal_id: prospect.deal_id,
            nome_clinica: prospect.nome_clinica,
            canal_pretendido: prospect.canal_candidato,
            telefone_normalizado: prospect.identificadores.telefone,
            email_normalizado: prospect.identificadores.email,
            elegibilidade_comercial: true,
            autorizacao_contacto: 'PENDENTE_VALIDACAO_PREVIA',
            revisao_humana_necessaria: false,
            simulatedCurrentDay: 1
        });

        // Simular comportamento de intervalo: tentativa 2 no Dia 7 (6 dias depois)
        const att2 = simulator.simulateAttempt({
            deal_id: prospect.deal_id,
            nome_clinica: prospect.nome_clinica,
            canal_pretendido: prospect.canal_candidato,
            telefone_normalizado: prospect.identificadores.telefone,
            email_normalizado: prospect.identificadores.email,
            elegibilidade_comercial: true,
            autorizacao_contacto: 'PENDENTE_VALIDACAO_PREVIA',
            revisao_humana_necessaria: false,
            simulatedCurrentDay: 7
        });

        simulationResults.push({
            deal_id: prospect.deal_id,
            nome_clinica: prospect.nome_clinica,
            tentativa_1: att1,
            tentativa_2: att2
        });
    });

    const simulatorStats = simulator.getStats();
    console.log(`✅ Simulação concluída com sucesso: ${simulatorStats.total_envios_simulados} disparos simulados em memória.`);

    // 6. ESTRUTURAÇÃO DO FICHEIRO FINAL DA FASE B.4
    const readinessReport = {
        meta: {
            projeto: 'Vamuss SDR Automático — Fase B.4 (Reconciliação Final e Readiness do Piloto)',
            data_execucao: new Date().toISOString(),
            modo: 'simulacao_read_only_estrita',
            read_only_confirmado: true,
            mensagens_reais_enviadas: 0,
            escritas_producao_efetuadas: 0
        },
        reconciliacao_carteira_405: {
            total_negocios: 405,
            distribuicao_canonica: distributionCounts,
            grupos_estrategicos: b3Data.reconciliacao_geral.grupos_estrategicos,
            tratamento_casos_especiais: specialCases
        },
        auditoria_legal_e_elegibilidade_116_silencio: {
            resumo_estatistico: legalStats,
            negocios_detalhe: validated116Detail
        },
        conflitos_identidade_e_endpoints: b3Data.auditoria_identidade_e_conflitos,
        simulacao_cadencia: {
            resumo_execucao: simulatorStats,
            amostra_simulada: simulationResults.slice(0, 10),
            total_prospects_simulados: cohortForSimulation.length
        },
        tabela_reconciliacao_completa_405: reconciliationTable
    };

    fs.writeFileSync(OUTPUT_B4_FILE, JSON.stringify(readinessReport, null, 2), 'utf8');
    console.log(`🎉 Fase B.4 concluída com sucesso! Ficheiro gravado em:\n   ${OUTPUT_B4_FILE}`);

    return readinessReport;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPhaseB4Readiness();
}

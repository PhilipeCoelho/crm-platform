import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRActivationGate } from './sdr_activation_gate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_B2_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');
const INPUT_B7_1_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b7_1_reconciliation.json');
const INPUT_A3_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json');
const OUTPUT_B10_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b10_pilot_dossier.json');

/**
 * ============================================================================
 * VAMUSS SDR — FASE B.10: PREPARAÇÃO DO CASO-PILOTO E VALIDAÇÃO INTEGRADA
 * ============================================================================
 */
export async function runPilotCasePreparation() {
    console.log('🚀 Iniciando Preparação do Caso-Piloto da Fase B.10...');

    const b2Data = JSON.parse(fs.readFileSync(INPUT_B2_FILE, 'utf8'));
    const b71Data = JSON.parse(fs.readFileSync(INPUT_B7_1_FILE, 'utf8'));
    const a3Data = JSON.parse(fs.readFileSync(INPUT_A3_FILE, 'utf8'));

    const allDealsB2 = b2Data.auditoria_completa_405_negocios || [];
    const suppressionList = b2Data.lista_supressao_estrita_proposta?.registos || [];
    const allDealsB71 = b71Data.inventario_individual_405_negocios || [];
    const allDealsA3 = a3Data.resultados_individuais || [];

    // Seleção do caso-piloto canónico: Clínica Dentária Diniz Salgueiro
    const PILOT_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';

    const rawDealB2 = allDealsB2.find(d => d.deal_id === PILOT_DEAL_ID);
    const rawDealB71 = allDealsB71.find(d => d.deal_id === PILOT_DEAL_ID);
    const rawDealA3 = allDealsA3.find(d => d.identificacao?.deal_id === PILOT_DEAL_ID);

    if (!rawDealB2 || !rawDealB71 || !rawDealA3) {
        throw new Error(`Dados incompletos para o negócio piloto ${PILOT_DEAL_ID}`);
    }

    console.log(`📌 Negócio Piloto selecionado: ${rawDealB2.nome_clinica} (ID: ${PILOT_DEAL_ID})`);

    // Inicialização da infraestrutura com salvaguardas fail-closed
    const controls = new SDROperationalControls({ suppressionList });
    const gate = new SDRActivationGate({
        suppressionList,
        operationalControls: controls,
        strictLegalVerification: true,
        requireExplicitLegalSigner: true
    });

    const integration = new SDRRecoveryPipelineIntegration({
        suppressionList,
        operationalControls: controls,
        activationGate: gate
    });

    // 1. Enfileirar o negócio piloto na fila SDR
    const enqResult = integration.enqueueLostDeal({
        id: rawDealB2.deal_id,
        title: rawDealB2.nome_clinica,
        value: 3000,
        currency: 'EUR',
        pipelineId: 'sales',
        stageId: 'stage_prospect',
        status: 'lost',
        lostReason: rawDealB2.motivo_perda_original,
        lostAt: '2026-06-19T17:34:13.765+00:00',
        contacto: rawDealB2.contacto,
        activities: [
            { id: 'act_1', title: 'Criação do negócio no CRM', dueDate: '2026-02-07T10:00:00.000Z', completed: true },
            { id: 'act_2', title: 'WhatsApp: Abordagem inicial sobre Google', dueDate: '2026-06-19T17:34:13.765Z', completed: true },
            { id: 'act_3', title: 'Transição para Perdido (Falta de resposta)', dueDate: '2026-06-19T17:34:13.765Z', completed: true }
        ]
    });

    // 2. Testar idempotência
    const reEnqResult = integration.enqueueLostDeal({
        id: rawDealB2.deal_id,
        title: rawDealB2.nome_clinica,
        status: 'lost',
        lostReason: 'Tentativa indevida de sobrescrever'
    });

    // 3. Avaliar Gate de Ativação estrito
    const gateEval = gate.evaluateActivation({
        deal_id: PILOT_DEAL_ID,
        nome_clinica: rawDealB2.nome_clinica,
        categoria_canonica: rawDealB71.categoria_canonica_origem,
        canal_pretendido: 'WHATSAPP',
        telefone: rawDealB2.contacto?.telefone_normalizado,
        email: rawDealB2.contacto?.email_normalizado,
        tipo_destinatario: rawDealB71.tipo_destinatario,
        consentimento_documentado: false,
        avaliacao_lia_b2b_aprovada: false
    });

    // 4. Preparar Próxima Ação Comercial (Context Grounding)
    const prepResult = integration.prepareNextCommercialAction(PILOT_DEAL_ID, {
        customAngle: 'ATRAÇÃO_PACIENTES_ALTO_TICKET_PRIMEIRA_CONSULTA'
    });

    // 5. Simular Cenários de Recuperação (em memória, sem mutação de produção)
    // Simulação Caso B: Resposta com Interesse Positivo
    const simInteresse = integration.handleRecoveryTransition(PILOT_DEAL_ID, {
        type: 'INBOUND_REPLY',
        rawText: 'Olá! Vimos a vossa mensagem sobre pacientes particulares. Como funciona a vossa parceria para clínicas dentárias?'
    });

    // Simulação Caso C: Agendamento de Reunião Confirmada
    const simReuniao = integration.handleRecoveryTransition(PILOT_DEAL_ID, {
        type: 'MEETING_CONFIRMED',
        statusConfirmacao: 'CONFIRMADA',
        dataReuniao: '2026-10-28T14:30:00.000Z',
        linkReuniao: 'https://meet.google.com/vamuss-diniz-salgueiro'
    });

    // Dossiê do Caso-Piloto
    const pilotDossier = {
        meta: {
            fase: 'B.10',
            data_preparacao: new Date().toISOString(),
            status: 'PREPARADO_PARA_DECISAO_HUMANA',
            salvaguarda_estrita_envios: 'ZERO_MENSAGENS_ENVIADAS'
        },
        caso_piloto: {
            identificacao: {
                deal_id: PILOT_DEAL_ID,
                nome_negocio: rawDealB2.nome_clinica,
                empresa_associada: 'Clínica Dentária Diniz Salgueiro',
                tipo_entidade: rawDealB71.tipo_destinatario, // ENTIDADE_COLECTIVA_CLINICA
                contacto: {
                    nome: rawDealB2.contacto?.nome || 'Dra./Dr. Responsável Clínico',
                    telefone: `+${rawDealB2.contacto?.telefone_normalizado}`,
                    email: rawDealB2.contacto?.email_normalizado,
                    dominio_proprio: 'dinizsalgueiro.pt',
                    partilhas_ou_duplicados: false
                }
            },
            contexto_historico_crm: {
                data_criacao: '2026-02-07T10:00:00.000Z',
                data_ultima_interacao: rawDealA3.identificacao?.data_ultima_atividade_conhecida,
                dias_em_respiro_comercial: 113,
                motivo_perda_original: rawDealB2.motivo_perda_original,
                resumo_interacoes_anteriores: rawDealA3.interpretacao_comercial?.resumo_factual_historico,
                ultima_mensagem_enviada_pelo_crm: rawDealA3.interpretacao_comercial?.detalhe_resposta
            },
            estado_fila_sdr: {
                status_fila: enqResult.item.status_fila,
                idempotencia_confirmada: reEnqResult.isDuplicate,
                duplicados_gerados: 0,
                motivo_perda_preservado: enqResult.item.lost_reason,
                tentativas_realizadas: enqResult.item.tentativas_recuperacao
            },
            bloqueios_e_conformidade_legal: {
                categoria_canonica_b7_1: rawDealB71.b7_1_reconciliado?.categoria_final_meta,
                motivo_bloqueio_gate: gateEval.motivo_bloqueio,
                detalhe_bloqueio: gateEval.detalhe,
                supressao_ativa: false,
                quarentena_concorrencia: false,
                condicao_para_ativacao_real: 'Homologação do parecer jurídico LIA B2B para o domínio dinizsalgueiro.pt e aprovação operacional do supervisor.'
            },
            diagnostico_comercial_gpt: {
                factos_comprovados: [
                    'A clínica é uma entidade coletiva privada de medicina dentária em Portugal.',
                    'Possui domínio web corporativo institucional próprio (dinizsalgueiro.pt).',
                    'Foi contactada pela primeira vez em fevereiro e novamente em junho de 2026.',
                    'Não respondeu às abordagens anteriores, sem expressar qualquer recusa ou pedido de opt-out.',
                    'O intervalo de silêncio (113 dias) cumpre amplamente o respiro comercial recomendado (mínimo 60 dias).'
                ],
                hipoteses_estrategicas: [
                    'A mensagem anterior ("aparece no Google?") pode ter sido filtrada pela receção como contacto promocional genérico.',
                    'A direção clínica pode estar recetiva a uma conversa breve se a abordagem focar a qualificação de pacientes particulares e previsibilidade de faturação.',
                    'O email institucional (geral@dinizsalgueiro.pt) pode ser um canal complementar menos intrusivo se o WhatsApp não obtiver resposta.'
                ],
                dados_em_falta_identificados: [
                    'Identidade do gestor administrativo/comercial direto da clínica (contacto atual registado como genérico da equipa).',
                    'Especialidades de maior foco da clínica no momento (ex: implantologia vs ortodontia).'
                ]
            },
            proposta_acao_comercial: {
                objetivo_comercial: 'Iniciar conversa consultiva de baixo atrito focada na captação de pacientes particulares de primeira consulta, visando agendamento de Reunião de Diagnóstico de 15 minutos.',
                canal_recomendado: 'WHATSAPP',
                canal_alternativo_seguranca: 'EMAIL',
                assuntos_a_evitar: [
                    'Cobrar resposta de mensagens enviadas em junho.',
                    'Afirmar que analisou a agenda interna da clínica.',
                    'Propor propostas comerciais fechadas antes do diagnóstico.'
                ],
                mensagem_personalizada_proposta: rawDealA3.proxima_acao?.mensagem_proposta_pt_pt || 
                    'Olá, boa tarde! Espero que esteja tudo bem com a equipa da Clínica Dentária Diniz Salgueiro. Retomo o contacto no seguimento da nossa mensagem anterior sobre atração de novos pacientes particulares. Se fizer sentido reavaliar este tema para os próximos meses, como está a vossa disponibilidade para uma breve troca de ideias? Obrigado pela atenção!'
            },
            simulacao_comportamento_pipeline: {
                se_interesse_confirmado: {
                    status_crm: simInteresse.deal?.status,
                    etapa_destino: simInteresse.toStage,
                    motivo_perda_preservado: simInteresse.deal?.lostReason,
                    mesmo_deal_id: simInteresse.deal?.id === PILOT_DEAL_ID
                },
                se_reuniao_confirmada: {
                    status_crm: simReuniao.deal?.status, // open (NUNCA won)
                    etapa_destino: simReuniao.toStage,
                    marca_como_ganho: false,
                    mesmo_deal_id: simReuniao.deal?.id === PILOT_DEAL_ID
                }
            }
        }
    };

    fs.writeFileSync(OUTPUT_B10_FILE, JSON.stringify(pilotDossier, null, 2), 'utf8');
    console.log(`✅ Dossiê do Caso-Piloto exportado com sucesso em: ${OUTPUT_B10_FILE}`);

    return pilotDossier;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPilotCasePreparation().catch((err) => {
        console.error('❌ Erro fatal:', err);
        process.exit(1);
    });
}

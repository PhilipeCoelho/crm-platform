import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRIntelligentSalesAgent } from './sdr_intelligent_sales_agent.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO } from './sdr_activation_gate.mjs';
import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import {
    validateDispatchTiming,
    getNextBusinessWindow,
    createLisbonDateTime,
    getLisbonTimeParts,
    isPortugueseHoliday,
    MUNICIPAL_HOLIDAYS_MAP
} from './sdr_business_hours.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_B2_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');
const INPUT_B7_1_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b7_1_reconciliation.json');
const INPUT_A3_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json');
const OUTPUT_B11_3_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b11_3_validation.json');

/**
 * ============================================================================
 * VAMUSS SDR — FASE B.11.3: VALIDAÇÃO COMERCIAL PONTA A PONTA COM CASO REAL
 * ============================================================================
 * Valida o comportamento comercial do agente inteligente GPT com o negócio real:
 * Clínica Dentária Diniz Salgueiro (ID: 5b0f44c1-57d3-4a30-8de5-7df432207b34).
 * ============================================================================
 */
export async function runCommercialEndToEndValidation() {
    console.log('🚀 Iniciando Validação Comercial Ponta a Ponta da Fase B.11.3...\n');

    // 1. CARREGAMENTO DOS DADOS FACTUAIS REAIS DO CRM
    const b2Data = JSON.parse(fs.readFileSync(INPUT_B2_FILE, 'utf8'));
    const b71Data = JSON.parse(fs.readFileSync(INPUT_B7_1_FILE, 'utf8'));
    const a3Data = JSON.parse(fs.readFileSync(INPUT_A3_FILE, 'utf8'));

    const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';

    const rawDealB2 = (b2Data.auditoria_completa_405_negocios || []).find(d => d.deal_id === CANONICAL_DEAL_ID);
    const rawDealB71 = (b71Data.inventario_individual_405_negocios || []).find(d => d.deal_id === CANONICAL_DEAL_ID);
    const rawDealA3 = (a3Data.resultados_individuais || []).find(d => d.identificacao?.deal_id === CANONICAL_DEAL_ID);
    const suppressionList = b2Data.lista_supressao_estrita_proposta?.registos || [];

    if (!rawDealB2 || !rawDealB71 || !rawDealA3) {
        throw new Error(`Dados do negócio canónico ${CANONICAL_DEAL_ID} não encontrados nos ficheiros de auditoria.`);
    }

    // 2. INICIALIZAÇÃO DO AGENTE INTELIGENTE E DOS COMPONENTES OPERACIONAIS
    const agent = new SDRIntelligentSalesAgent();
    const controls = new SDROperationalControls({ suppressionList });
    const gate = new SDRActivationGate({
        suppressionList,
        operationalControls: controls,
        strictLegalVerification: true,
        requireExplicitLegalSigner: true,
        checkBusinessHours: true
    });
    const recovery = new SDRRecoveryPipelineIntegration({
        suppressionList,
        operationalControls: controls,
        activationGate: gate
    });

    // 3. CONSULTA DO ESTADO ATUAL E DO HISTÓRICO COMPLETO
    const dealFacts = {
        deal_id: CANONICAL_DEAL_ID,
        title: rawDealB2.nome_clinica,
        nome_clinica: rawDealB2.nome_clinica,
        valor_estimado: 3000,
        moeda: 'EUR',
        pipeline_id: 'sales',
        etapa_atual: 'stage_prospect',
        status_atual: 'lost',
        motivo_perda_original: rawDealB2.motivo_perda_original,
        data_criacao: '2026-02-07T10:00:00.000Z',
        data_perda: '2026-06-19T17:34:13.765+00:00',
        dias_em_respiro: 113,
        interacoes_anteriores: [
            { tipo: 'CRIACAO', data: '2026-02-07T10:00:00Z', detalhe: 'Negócio criado no CRM.' },
            { tipo: 'WHATSAPP_ENVIADO', data: '2026-06-19T17:34:13Z', detalhe: 'Abordagem fria anterior sobre aparecer no Google.' },
            { tipo: 'PERDIDO_REGISTADO', data: '2026-06-19T17:34:13Z', detalhe: 'Marcado como lost por falta de resposta.' }
        ],
        total_tentativas_anteriores: 1,
        respostas_recebidas: 0,
        recusas_ou_optouts: 0,
        restricoes_canal: 'NENHUMA',
        contacto: {
            nome: rawDealB2.contacto?.nome || 'Diniz Salgueiro',
            telefone: `+${rawDealB2.contacto?.telefone_normalizado}`,
            email: rawDealB2.contacto?.email_normalizado,
            dominio: 'clinicadinizsalgueiro.pt',
            concelho: 'LISBOA'
        }
    };

    console.log(`📌 1. Estado Atual do Negócio no CRM:`);
    console.log(`   - Negócio: ${dealFacts.nome_clinica} (ID: ${dealFacts.deal_id})`);
    console.log(`   - Status / Etapa: ${dealFacts.status_atual} / ${dealFacts.etapa_atual}`);
    console.log(`   - Motivo da Perda: "${dealFacts.motivo_perda_original}"`);
    console.log(`   - Última interação: ${dealFacts.data_perda} (${dealFacts.dias_em_respiro} dias de respiro comercial)`);
    console.log(`   - Tentativas registadas: ${dealFacts.total_tentativas_anteriores} (Respostas: ${dealFacts.respostas_recebidas}, Recusas: ${dealFacts.recusas_ou_optouts})\n`);

    // 4. AVALIAÇÃO DO GATE DE ATIVAÇÃO E CONTROLOS OPERACIONAIS
    const gateDecision = gate.evaluateActivation({
        deal_id: CANONICAL_DEAL_ID,
        nome_clinica: dealFacts.nome_clinica,
        categoria_canonica: rawDealB71.categoria_canonica_origem,
        canal_pretendido: 'WHATSAPP',
        telefone: rawDealB2.contacto?.telefone_normalizado,
        email: rawDealB2.contacto?.email_normalizado,
        tipo_destinatario: rawDealB71.tipo_destinatario,
        consentimento_documentado: false,
        avaliacao_lia_b2b_aprovada: false
    });

    console.log(`🔒 Avaliação do Gate Operacional e Segurança:`);
    console.log(`   - Autorizado para envio imediato: ${gateDecision.autorizado_para_ativacao}`);
    console.log(`   - Motivo do bloqueio: ${gateDecision.motivo_decisao}`);
    console.log(`   - Detalhe: ${gateDecision.detalhe}`);
    console.log(`   - Estado Documental: ${gateDecision.estado_documental}\n`);

    // 5. EXECUÇÃO DO RACIOCÍNIO COMERCIAL DO AGENTE INTELIGENTE
    const publicWebData = {
        dados: {
            nome_oficial: 'Clínica Dentária Diniz Salgueiro',
            localizacao: 'Avenida das Forças Armadas, 2A – 1º C, 1600-082 Lisboa (Entrecampos)',
            concelho: 'LISBOA',
            website: 'https://clinicadinizsalgueiro.pt',
            especialidades: ['Cirurgia oral', 'Endodontia', 'Ortodontia', 'Odontopediatria', 'Prostodontia', 'Reabilitação oral'],
            equipamentos: ['Microscópio endodôntico', 'Radiologia digital']
        }
    };

    const agentSession = await agent.executeAgentCycle({
        dealId: CANONICAL_DEAL_ID,
        dealData: {
            id: CANONICAL_DEAL_ID,
            title: dealFacts.nome_clinica,
            status: dealFacts.status_atual,
            lostReason: dealFacts.motivo_perda_original,
            lostAt: dealFacts.data_perda,
            contacto: rawDealB2.contacto
        },
        publicWebPresence: publicWebData
    });

    console.log(`🧠 2. Raciocínio Comercial do GPT:`);
    const raciocinio = agentSession.etapas_raciocinio['04_raciocinio_comercial_gpt'];
    console.log(`   - Factos Comprovados (${raciocinio.factos_comprovados.length}):`);
    raciocinio.factos_comprovados.forEach(f => console.log(`     • ${f}`));
    console.log(`   - Hipóteses Comerciais (${raciocinio.hipoteses_estrategicas.length}):`);
    raciocinio.hipoteses_estrategicas.forEach(h => console.log(`     • ${h}`));
    console.log(`   - Incertezas / Dados em Falta (${raciocinio.dados_em_falta.length}):`);
    raciocinio.dados_em_falta.forEach(d => console.log(`     • ${d}`));
    console.log(`   - Por que a abordagem anterior falhou: ${raciocinio.causa_provavel_perda_anterior}`);
    console.log(`   - Estratégia Escolhida: ${raciocinio.estrategia_escolhida}`);
    console.log(`   - Objetivo Comercial: ${agentSession.proposta_mensagem.objetivo_comercial}\n`);

    // 6. AS TRÊS ALTERNATIVAS DE PRIMEIRA ABORDAGEM
    const alternativas = agentSession.alternativas_primeira_abordagem.alternativas;
    console.log(`📝 3. Três Alternativas Estruturadas de Primeira Abordagem:`);
    alternativas.forEach((alt, idx) => {
        console.log(`\n   --- Alternativa ${idx + 1}: ${alt.angulo} ---`);
        console.log(`   Descrição: ${alt.descricao}`);
        console.log(`   Texto (pt-PT):`);
        console.log(`   "${alt.texto.replace(/\n/g, '\n    ')}"`);
        console.log(`   Pede reunião/chamada: ${alt.pede_chamada_ou_reuniao ? 'SIM' : 'NÃO'}`);
        console.log(`   Presume carências de agenda: ${alt.assume_problema_agenda ? 'SIM' : 'NÃO'}`);
    });

    console.log(`\n   ⭐ Mensagem Selecionada: Alternativa ${agentSession.alternativas_primeira_abordagem.alternativa_selecionada}`);
    console.log(`   Justificação: ${agentSession.alternativas_primeira_abordagem.justificacao_escolha}\n`);

    // 7. SIMULAÇÃO DAS 8 SITUAÇÕES CONVERSACIONAIS DE CONTINUAÇÃO
    console.log(`🔄 4 & 5. Simulação da Continuação da Conversa e Transições de Pipeline:\n`);

    const cenariosDeTeste = [
        {
            id: 1,
            cenario: 'CURIOSIDADE_ABORDAGEM',
            descricao: 'Curiosidade sobre a abordagem',
            input: 'Como é que repararam no nosso trabalho e como funciona a vossa parceria?'
        },
        {
            id: 2,
            cenario: 'PEDIDO_EXPLICACAO_SERVICOS',
            descricao: 'Pedido de explicação sobre os serviços',
            input: 'Podem explicar melhor o que fazem exatamente na Vamuss?'
        },
        {
            id: 3,
            cenario: 'OBJECAO_PRECO',
            descricao: 'Pergunta sobre preços',
            input: 'Quanto é que custa o vosso serviço para uma clínica como a nossa?'
        },
        {
            id: 4,
            cenario: 'JA_TEM_AGENCIA',
            descricao: 'Indicação de que já existe uma agência',
            input: 'Já temos uma agência de marketing a tratar da nossa comunicação há 2 anos.'
        },
        {
            id: 5,
            cenario: 'NECESSIDADE_IDENTIFICADA',
            descricao: 'Identificação de uma necessidade comercial',
            input: 'Temos dois gabinetes vazios às terças e quintas e precisamos de atrair mais pacientes particulares para endodontia e cirurgia.'
        },
        {
            id: 6,
            cenario: 'PERGUNTA_INESPERADA',
            descricao: 'Resposta vaga ou inesperada',
            input: 'Qual é a vossa experiência prática com tratamentos de harmonização orofacial?'
        },
        {
            id: 7,
            cenario: 'RECUSA_COMERCIAL',
            descricao: 'Recusa explícita',
            input: 'Não temos qualquer interesse, por favor não voltem a contactar esta clínica.'
        },
        {
            id: 8,
            cenario: 'SILENCIO_SEM_RESPOSTA',
            descricao: 'Ausência de resposta (silêncio contínuo)',
            input: null
        }
    ];

    const resultadosSimulacao = [];

    for (const c of cenariosDeTeste) {
        const sim = agent.evaluateConversationScenario({
            tipoCenario: c.cenario,
            textoInterlocutor: c.input
        });

        // Mapeamento explícito da transição apropriada no CRM
        let transicaoCRM = '';
        let novoStatusCRM = '';
        let novaEtapaCRM = '';

        if (c.cenario === 'NECESSIDADE_IDENTIFICADA' || c.cenario === 'CURIOSIDADE_ABORDAGEM' || c.cenario === 'PEDIDO_EXPLICACAO_SERVICOS') {
            transicaoCRM = 'Regressa ao funil ativo na etapa Lead de Engajamento';
            novoStatusCRM = 'open';
            novaEtapaCRM = 'stage_lead_engajamento';
        } else if (c.cenario === 'OBJECAO_PRECO' || c.cenario === 'JA_TEM_AGENCIA' || c.cenario === 'PERGUNTA_INESPERADA') {
            transicaoCRM = 'Mantido em diálogo consultivo / Lead de Engajamento';
            novoStatusCRM = 'open';
            novaEtapaCRM = 'stage_lead_engajamento';
        } else if (c.cenario === 'RECUSA_COMERCIAL') {
            transicaoCRM = 'Retirado definitivamente do funil ativo; registado em Supressão Estrita';
            novoStatusCRM = 'lost';
            novaEtapaCRM = 'stage_lost (supressão estrita)';
        } else if (c.cenario === 'SILENCIO_SEM_RESPOSTA' || c.cenario === 'LEAD_FRIO_SEM_RESPOSTA') {
            transicaoCRM = 'Preserva status perdido na Fila SDR; aguarda intervalo de respiro';
            novoStatusCRM = 'lost';
            novaEtapaCRM = 'stage_perdido (inalterado na fila de recuperação)';
        }

        resultadosSimulacao.push({
            cenario_id: c.id,
            nome_cenario: c.descricao,
            tipo_cenario_chave: c.cenario,
            input_recebido: c.input,
            interpretacao_agente: sim.interpretacao_agente,
            estrategia_adotada: sim.estrategia_adotada,
            proxima_acao_recomendada: sim.proxima_acao_recomendada,
            propor_reuniao_imediata: sim.propor_reuniao_imediata,
            mensagem_proposta_pt_pt: sim.mensagem_proposta_pt_pt,
            transicao_crm_prevista: {
                acao: transicaoCRM,
                novo_status: novoStatusCRM,
                nova_etapa: novaEtapaCRM,
                preserva_historico: true,
                preserva_motivo_perda: true
            }
        });

        console.log(`   [Cenário ${c.id}: ${c.descricao}]`);
        console.log(`   • Input: ${c.input ? `"${c.input}"` : '(sem resposta)'}`);
        console.log(`   • Interpretação do Agente: ${sim.interpretacao_agente}`);
        console.log(`   • Ação Escolhida: ${sim.proxima_acao_recomendada}`);
        console.log(`   • Propor Reunião de 20 min agora? ${sim.propor_reuniao_imediata ? 'SIM (dor comercial comprovada)' : 'NÃO (muito cedo)'}`);
        console.log(`   • Mensagem Proposta (pt-PT): "${sim.mensagem_proposta_pt_pt ? sim.mensagem_proposta_pt_pt.replace(/\n/g, ' ') : '(nenhuma)'}"`);
        console.log(`   • Transição no CRM: ${transicaoCRM} (Status: ${novoStatusCRM})\n`);
    }

    // 8. VALIDAÇÃO DETERMINÍSTICA DO HORÁRIO COMERCIAL
    console.log(`⏰ 6. Validação Determinística de Horário Comercial (scripts/sdr_business_hours.mjs):`);

    // Teste A: Planeamento às 20h45 de sábado (fora de horas)
    const sabadoNoite = createLisbonDateTime(2026, 10, 10, 20, 45, 0);
    const timingCheckSabado = validateDispatchTiming(sabadoNoite, { municipality: 'LISBOA' });
    console.log(`   • Teste Sábado 20h45: Permitido? ${timingCheckSabado.permitido} (Motivo: ${timingCheckSabado.motivo})`);
    console.log(`     -> Próxima Janela Calculada: ${timingCheckSabado.proxima_janela_util} (Segunda-feira 09h00 Lisbon)`);

    // Teste B: Feriado Municipal de Lisboa (Santo António - 13 de Junho)
    const santoAntonioLisboa = createLisbonDateTime(2026, 6, 13, 11, 0, 0);
    const timingCheckMun = validateDispatchTiming(santoAntonioLisboa, { municipality: 'LISBOA' });
    console.log(`   • Teste Feriado Municipal de Lisboa (13 Jun): Permitido? ${timingCheckMun.permitido} (Motivo: ${timingCheckMun.motivo})`);

    // Teste C: Horário comercial válido (Segunda-feira 10h30)
    const segundaValida = createLisbonDateTime(2026, 10, 12, 10, 30, 0);
    const timingCheckValido = validateDispatchTiming(segundaValida, { municipality: 'LISBOA' });
    console.log(`   • Teste Segunda-feira 10h30: Permitido? ${timingCheckValido.permitido} (Motivo: ${timingCheckValido.motivo})`);

    // Demonstração com a fila de recuperação e proteção contra disparo fora de horas
    recovery.enqueueLostDeal({
        id: CANONICAL_DEAL_ID,
        title: dealFacts.nome_clinica,
        status: 'lost',
        lostReason: dealFacts.motivo_perda_original,
        telefone: dealFacts.contacto.telefone
    });

    const prepForaDeHora = recovery.prepareNextCommercialAction(CANONICAL_DEAL_ID, {
        checkBusinessHours: true,
        dispatchTimestamp: sabadoNoite.toISOString()
    });

    console.log(`   • Preparação na Fila SDR fora de horas:`);
    console.log(`     -> Bloqueado para disparo: ${prepForaDeHora.blocked}`);
    console.log(`     -> Motivo do bloqueio: ${prepForaDeHora.motivo_bloqueio}`);
    console.log(`     -> Reagendamento sugerido: ${prepForaDeHora.reagendamento_sugerido}`);
    console.log(`     -> Reagendado para: ${prepForaDeHora.reagendado_para}\n`);

    // 9. CONSOLIDAÇÃO DO DOSSIÊ DE VALIDAÇÃO B.11.3
    const validationDossier = {
        meta: {
            fase: 'B.11.3',
            data_execucao: new Date().toISOString(),
            negocio_auditado: CANONICAL_DEAL_ID,
            clinica: dealFacts.nome_clinica,
            concelho: 'LISBOA',
            modo: 'VALIDACAO_COMERCIAL_ASSISTIDA_SEM_DISPARO_REAL',
            mensagens_reais_enviadas: 0,
            mutacoes_producao_efetuadas: 0
        },
        estado_crm: dealFacts,
        seguranca_e_gates: gateDecision,
        raciocinio_gpt: raciocinio,
        primeira_abordagem: {
            alternativas: alternativas,
            alternativa_selecionada: agentSession.alternativas_primeira_abordagem.alternativa_selecionada,
            justificacao: agentSession.alternativas_primeira_abordagem.justificacao_escolha,
            mensagem_final: agentSession.proposta_mensagem.texto_pt_pt
        },
        simulacoes_conversacionais: resultadosSimulacao,
        validacao_horario_comercial: {
            teste_fora_de_horas: timingCheckSabado,
            teste_feriado_municipal: timingCheckMun,
            teste_janela_valida: timingCheckValido,
            comportamento_fila_sdr: {
                bloqueado: prepForaDeHora.blocked,
                reagendado_para: prepForaDeHora.reagendado_para,
                reavaliacao_contextual_obrigatoria_antes_de_disparar: true
            }
        },
        limitacoes_operacionais_ativas: [
            'Avaliação de Impacto sobre a Proteção de Dados (LIA B2B) para clinicadinizsalgueiro.pt ainda pendente de homologação jurídica formal.',
            'Aprovação operacional formal do supervisor responsável ainda não registada em sistema.',
            'Circuit Breaker mantido estritamente ativado para prevenção de disparos acidentais.'
        ]
    };

    fs.writeFileSync(OUTPUT_B11_3_FILE, JSON.stringify(validationDossier, null, 2), 'utf8');
    console.log(`💾 Dossiê completo da Fase B.11.3 gravado em: ${OUTPUT_B11_3_FILE}\n`);

    return validationDossier;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runCommercialEndToEndValidation().catch((err) => {
        console.error('❌ Erro na validação B.11.3:', err);
        process.exit(1);
    });
}

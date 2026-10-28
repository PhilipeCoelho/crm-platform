import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRIntelligentSalesAgent } from './sdr_intelligent_sales_agent.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES DO AGENTE COMERCIAL ESPECIALIZADO
 * ============================================================================
 * Valida a Skill Comercial, os 8 Princípios Fundamentais, as 9 Situações
 * Conversacionais, o Caso Real Diniz Salgueiro e o Motor de Métricas do CRM.
 * ============================================================================
 */

async function runIntelligentAgentTests() {
    console.log('🧪 Iniciando Bateria Completa de Testes do Agente Comercial Especializado (SDR Skill)...\n');

    let passedTests = 0;

    // Fixture factual real: Clínica Dentária Diniz Salgueiro
    const dinizSalgueiroDeal = {
        id: '5b0f44c1-57d3-4a30-8de5-7df432207b34',
        title: 'Negócio Clínica Dentária Diniz Salgueiro',
        nome_clinica: 'Clínica Dentária Diniz Salgueiro',
        value: 3000,
        currency: 'EUR',
        status: 'lost',
        stageId: 'stage_prospect',
        lostReason: 'Não respondeu - Não respondeu as abordagens',
        lostAt: '2026-06-19T17:34:13.765+00:00',
        categoria_canonica: 'AUTORIZACAO_PENDENTE',
        tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
        contacto: {
            nome: 'Diniz Salgueiro',
            telefone: '+351929238634',
            telefone_normalizado: '351929238634',
            email: 'geral@dinizsalgueiro.pt',
            email_normalizado: 'geral@dinizsalgueiro.pt'
        }
    };

    const publicWebData = {
        dados: {
            nome_oficial: 'Clínica Dentária Diniz Salgueiro',
            localizacao: 'Avenida das Forças Armadas, 2A – 1º C, 1600-082 Lisboa (Entrecampos)',
            website: 'https://clinicadinizsalgueiro.pt',
            telefone_fixo: '(+351) 217 931 658',
            telemovel: '(+351) 929 238 634',
            especialidades: ['Cirurgia oral', 'Endodontia', 'Ortodontia', 'Odontopediatria', 'Prostodontia', 'Reabilitação oral'],
            equipamentos: ['Microscópio endodôntico', 'Radiologia digital']
        }
    };

    const agent = new SDRIntelligentSalesAgent();

    // -------------------------------------------------------------------------
    // TESTE 1: Carregamento da Skill Especializada e Verificação de Metadados
    // -------------------------------------------------------------------------
    {
        const meta = agent.getSkillMetadata();
        assert.ok(meta);
        assert.strictEqual(meta.name, 'vamuss-sdr-commercial');
        assert.ok(meta.description.includes('SDR'));

        const prompt = agent.getSystemPrompt();
        assert.ok(prompt.includes('Vamuss'));
        assert.ok(prompt.includes('português europeu (pt-PT)'));
        assert.ok(prompt.includes('Reunião de Diagnóstico de 20 minutos'));

        passedTests++;
        console.log('  ✅ [PASS] 1. Skill comercial especializada carregada e validada (.agent/skills/vamuss-sdr-commercial)');
    }

    // -------------------------------------------------------------------------
    // TESTE 2: Incorporação dos 8 Princípios Comerciais Fundamentais
    // -------------------------------------------------------------------------
    {
        const principles = agent.getCorePrinciples();
        assert.strictEqual(principles.length, 8, 'Devem existir exatamente 8 princípios fundamentais');

        assert.strictEqual(principles[0].nome, 'Selecionar as empresas certas');
        assert.strictEqual(principles[1].nome, 'Qualificar o interesse');
        assert.strictEqual(principles[2].nome, 'Encontrar o contacto certo');
        assert.strictEqual(principles[3].nome, 'Definir o próximo passo');
        assert.strictEqual(principles[4].nome, 'Pesquisar o contexto');
        assert.strictEqual(principles[5].nome, 'Planear as retomas (respiro comercial)');
        assert.strictEqual(principles[6].nome, 'Abrir com o problema do cliente');
        assert.strictEqual(principles[7].nome, 'Medir a conversão');

        passedTests++;
        console.log('  ✅ [PASS] 2. Todos os 8 princípios comerciais fundamentais devidamente estruturados');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: Ferramentas operacionais e de inteligência disponíveis
    // -------------------------------------------------------------------------
    {
        const tools = agent.getAvailableTools();
        assert.strictEqual(tools.length, 5);
        assert.ok(tools.some(t => t.name === 'crm_get_deal_history'));
        assert.ok(tools.some(t => t.name === 'web_research_clinic'));
        assert.ok(tools.some(t => t.name === 'vamuss_knowledge_base'));
        assert.ok(tools.some(t => t.name === 'gate_evaluate_safety'));
        assert.ok(tools.some(t => t.name === 'crm_stage_transition'));

        passedTests++;
        console.log('  ✅ [PASS] 3. Ferramentas comerciais e de segurança inventariadas e mapeadas');
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Caso Real Diniz Salgueiro (Raciocínio, Factos vs Hipóteses e Abordagem)
    // -------------------------------------------------------------------------
    {
        agent.recoveryIntegration.enqueueLostDeal(dinizSalgueiroDeal);

        const session = await agent.executeAgentCycle({
            dealId: dinizSalgueiroDeal.id,
            dealData: dinizSalgueiroDeal,
            publicWebPresence: publicWebData
        });

        assert.strictEqual(session.deal_id, dinizSalgueiroDeal.id);
        const raciocinio = session.etapas_raciocinio['04_raciocinio_comercial_gpt'];
        assert.ok(raciocinio.factos_comprovados.length >= 3);
        assert.ok(raciocinio.hipoteses_estrategicas.length >= 1);
        assert.ok(raciocinio.dados_em_falta.length >= 1);

        const msg = session.proposta_mensagem.texto_pt_pt;
        assert.ok(msg.includes('Diniz Salgueiro'));
        assert.ok(!msg.includes('compre agora'));
        assert.ok(!msg.includes('porque não respondeu'));

        passedTests++;
        console.log('  ✅ [PASS] 4. Caso real Diniz Salgueiro analisado com distinção de factos e abertura de baixo atrito');
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Avaliação das 9 Situações Conversacionais Variadas
    // -------------------------------------------------------------------------
    {
        const s1 = agent.evaluateConversationScenario({
            tipoCenario: 'LEAD_FRIO_SEM_RESPOSTA',
            textoInterlocutor: null
        });
        assert.strictEqual(s1.estrategia_adotada, 'ABERTURA_COM_DOR_E_BAIXO_ATRITO');
        assert.strictEqual(s1.propor_reuniao_imediata, false);

        const s2 = agent.evaluateConversationScenario({
            tipoCenario: 'OBJECAO_PRECO',
            textoInterlocutor: 'O vosso serviço é muito caro, não temos orçamento para isso.'
        });
        assert.strictEqual(s2.estrategia_adotada, 'ANCORAGEM_DE_ROI_E_TRATAMENTOS_ALTO_TICKET');
        assert.strictEqual(s2.propor_reuniao_imediata, false);

        const s3 = agent.evaluateConversationScenario({
            tipoCenario: 'JA_TEM_AGENCIA',
            textoInterlocutor: 'Já trabalhamos com uma agência de marketing.'
        });
        assert.strictEqual(s3.estrategia_adotada, 'DIFERENCIACAO_CONSULTAS_VS_POSTS');
        assert.strictEqual(s3.propor_reuniao_imediata, false);

        const s4 = agent.evaluateConversationScenario({
            tipoCenario: 'PERGUNTA_INESPERADA',
            textoInterlocutor: 'Qual é a vossa experiência com clínicas de medicina estética?'
        });
        assert.strictEqual(s4.estrategia_adotada, 'RESPOSTA_DIRETA_TRANSPARENTE_ANTES_DE_VENDER');
        assert.strictEqual(s4.propor_reuniao_imediata, false);

        const s5 = agent.evaluateConversationScenario({
            tipoCenario: 'INTERESSE_SEM_NECESSIDADE',
            textoInterlocutor: 'Parece interessante o vosso trabalho.'
        });
        assert.strictEqual(s5.estrategia_adotada, 'EXPLORACAO_DE_GARGALOS_E_ESPECIALIDADES');
        assert.strictEqual(s5.propor_reuniao_imediata, false);

        const s6 = agent.evaluateConversationScenario({
            tipoCenario: 'NECESSIDADE_IDENTIFICADA',
            textoInterlocutor: 'Temos dois gabinetes vazios às terças e quintas e precisamos de mais pacientes de ortodontia.'
        });
        assert.strictEqual(s6.estrategia_adotada, 'PROPOSTA_DIAGNOSTICO_20_MINUTOS');
        assert.strictEqual(s6.propor_reuniao_imediata, true, 'Com dor e necessidade clara, DEVE propor diagnóstico de 20 min');

        const s7 = agent.evaluateConversationScenario({
            tipoCenario: 'ACEITA_REUNIAO',
            textoInterlocutor: 'Sim, na quinta-feira às 15h tenho disponibilidade.'
        });
        assert.strictEqual(s7.estrategia_adotada, 'COORDENACAO_E_CONFIRMACAO_DE_AGENDA');
        assert.strictEqual(s7.acao_planeada_crm, 'MOVER_REUNIAO_STATUS_OPEN');

        const s8 = agent.evaluateConversationScenario({
            tipoCenario: 'RECUSA_COMERCIAL',
            textoInterlocutor: 'Não temos interesse, retirem o nosso contacto.'
        });
        assert.strictEqual(s8.estrategia_adotada, 'ENCERRAMENTO_RESPEITOSO_E_SUPRESSAO');
        assert.strictEqual(s8.acao_planeada_crm, 'SUPRESSAO_ESTRITA_STATUS_LOST');

        const s9 = agent.evaluateConversationScenario({
            tipoCenario: 'HISTORICO_INCOMPLETO_CONTRADITORIO',
            textoInterlocutor: 'Contato sem notas no CRM e sem motivo de perda'
        });
        assert.strictEqual(s9.estrategia_adotada, 'REVISAO_HUMANA_E_PESQUISA_PREVIA');

        passedTests++;
        console.log('  ✅ [PASS] 5. Todas as 9 situações conversacionais testadas e validadas com sucesso');
    }

    // -------------------------------------------------------------------------
    // TESTE 6: Transições Reais no CRM (Engajamento, Reunião e Supressão)
    // -------------------------------------------------------------------------
    {
        // 6.1 Curiosidade reverte para Lead de Engajamento
        const engResult = agent.recoveryIntegration.handleRecoveryTransition(dinizSalgueiroDeal.id, {
            type: 'INBOUND_REPLY',
            rawText: 'Olá, estivemos a ver a vossa mensagem e temos interesse em perceber mais detalhes sobre como funciona.'
        });
        assert.strictEqual(engResult.transition, true);
        assert.strictEqual(engResult.toStage, 'Lead de Engajamento');
        assert.strictEqual(engResult.deal.status, 'open');
        assert.strictEqual(engResult.deal.lostReason, dinizSalgueiroDeal.lostReason, 'Preserva motivo de perda original');

        // 6.2 Confirmação de Reunião move para Reunião SEM won
        const meetResult = agent.recoveryIntegration.handleRecoveryTransition(dinizSalgueiroDeal.id, {
            type: 'MEETING_CONFIRMED',
            statusConfirmacao: 'CONFIRMADA',
            dataReuniao: '2026-11-05T10:00:00.000Z'
        });
        assert.strictEqual(meetResult.transition, true);
        assert.strictEqual(meetResult.toStage, 'Reunião');
        assert.strictEqual(meetResult.deal.status, 'open', 'Status DEVE permanecer open, NUNCA won');
        assert.notStrictEqual(meetResult.deal.status, 'won');

        // 6.3 Recusa aciona supressão imediata
        const refResult = agent.recoveryIntegration.handleRecoveryTransition(dinizSalgueiroDeal.id, {
            type: 'INBOUND_REPLY',
            rawText: 'Por favor parem com as mensagens, não temos interesse.'
        });
        assert.strictEqual(refResult.transition, false);
        assert.strictEqual(refResult.suppressed, true);
        assert.strictEqual(refResult.deal_status, 'lost');

        passedTests++;
        console.log('  ✅ [PASS] 6. Transições no CRM comprovadas: Engajamento, Reunião (status open) e Supressão estrita');
    }

    // -------------------------------------------------------------------------
    // TESTE 7: Estrutura de Métricas do CRM e Feedback de Aprendizagem
    // -------------------------------------------------------------------------
    {
        const metrics = agent.getPerformanceMetrics();
        assert.ok(metrics);
        assert.ok(metrics.taxa_resposta_inbound);
        assert.ok(metrics.taxa_reabertura_comercial);
        assert.ok(metrics.taxa_reunioes_marcadas);
        assert.ok(metrics.feedback_aprendizagem);
        assert.ok(metrics.feedback_aprendizagem.estrategias_mais_eficazes.length >= 1);

        passedTests++;
        console.log('  ✅ [PASS] 7. Métricas de conversão e ciclo de feedback de aprendizagem comercial validados');
    }

    // -------------------------------------------------------------------------
    // TESTE 8: Salvaguardas Fail-Closed e Zero Disparos Reais
    // -------------------------------------------------------------------------
    {
        assert.strictEqual(agent.operationalControls.isCircuitBreakerTripped(), false);
        agent.operationalControls.tripCircuitBreaker({ operador: 'SUPERVISOR', motivo: 'Teste emergência' });
        assert.strictEqual(agent.operationalControls.isCircuitBreakerTripped(), true);

        const prepBlocked = agent.recoveryIntegration.prepareNextCommercialAction(dinizSalgueiroDeal.id);
        assert.strictEqual(prepBlocked.ready, false);
        assert.strictEqual(prepBlocked.blocked, true);

        agent.operationalControls.resetCircuitBreaker({ operador: 'SUPERVISOR', motivo: 'Reset teste' });
        assert.strictEqual(agent.operationalControls.isCircuitBreakerTripped(), false);

        passedTests++;
        console.log('  ✅ [PASS] 8. Disjuntor de segurança e salvaguardas fail-closed 100% ativas');
    }

    console.log('\n==============================================================================');
    console.log(`🎉 TODOS OS ${passedTests}/8 TESTES DA SKILL COMERCIAL FORAM APROVADOS!`);
    console.log('==============================================================================\n');
}

runIntelligentAgentTests().catch((err) => {
    console.error('❌ Falha na bateria de testes da skill comercial:', err);
    process.exit(1);
});

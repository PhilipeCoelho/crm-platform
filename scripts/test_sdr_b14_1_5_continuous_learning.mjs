/**
 * ============================================================================
 * TESTE DE ACEITAÇÃO: VAMUSS B.14.1.5 — CICLO DE APRENDIZAGEM COMERCIAL CONTÍNUA
 * ============================================================================
 * Validação rigorosa dos 14 critérios de aceitação da fase B.14.1.5:
 * 1. Registo detalhado de interação comercial com custos, tokens e metadados.
 * 2. Distinção explícita entre factos, classificações e hipóteses.
 * 3. Consulta de aprendizagens contextuais prévias pelo motor de decisão.
 * 4. Deteção de ineficiências: abordagens duplicadas e ciclos excessivos.
 * 5. Identificação de estratégias dispendiosas sem retorno comercial.
 * 6. Proteção contra conclusões precipitadas com amostra insuficiente (N < 20).
 * 7. Cálculo determinístico de métricas a partir do sdr_outcomes.json.
 * 8. Framework de testes A/B respeita limites de volume, custos e cancelamento por rejeição.
 * 9. Opt-out e recusas respeitadas rigorosamente sem novas tentativas.
 * 10. Salvaguarda de autonomia: bloqueio de auto-aprovação de alterações de alto impacto.
 * 11. Persistência da memória e insights após paragem/reinício do worker.
 * 12. Exposição dos dados, memória e recomendações via API para o painel CRM.
 * 13. Capacidade de reversão auditada de regras comerciais ativas.
 * 14. Integridade estrita do histórico original de interações.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

import {
    readLocalOutcomes,
    writeLocalOutcomes,
    handleRecordOutcome
} from '../api/sdr_engine.js';

import {
    calculateInteractionCost,
    calculateAdvancedKPIs,
    runPeriodicLearningAnalysis,
    readLearningMemory,
    writeLearningMemory,
    readLearningInsights,
    writeLearningInsights,
    readABTestsConfig,
    writeABTestsConfig,
    selectABVariant,
    getLearningContextForDeal,
    approveRecommendation,
    rejectRecommendation,
    revertRule,
    WHATSAPP_COST_PER_MESSAGE,
    MIN_SAMPLE_SIZE
} from '../api/sdr_learning.js';

import {
    isPhoneSuppressedLocally,
    readLocalSuppression,
    writeLocalSuppression
} from '../api/suppression_store.js';

import {
    SDROperationalWorker
} from '../api/sdr_worker.js';

import {
    readTaskQueue,
    writeTaskQueue
} from '../api/sdr_task_queue.js';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        totalPassed++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        totalFailed++;
    }
}

async function runAcceptanceTests() {
    console.log('================================================================');
    console.log('🧪 SUÍTE DE TESTES: B.14.1.5 — APRENDIZAGEM COMERCIAL CONTÍNUA');
    console.log('================================================================\n');

    // Backup dos ficheiros de estado
    const backupOutcomes = readLocalOutcomes();
    const backupMemory = readLearningMemory();
    const backupInsights = readLearningInsights();
    const backupABConfig = readABTestsConfig();
    const backupSuppression = readLocalSuppression();
    const backupQueue = readTaskQueue();

    try {
        // --------------------------------------------------------------------
        // CRITÉRIO 1: Uma nova interação gera um registo de resultados enriquecido
        // --------------------------------------------------------------------
        console.log('▶️ [Critério 1] Registo de Interação Comercial com Metadados & Custos');
        const testDealId1 = `test_deal_learn_01_${Date.now()}`;
        const outcomePayload1 = {
            dealId: testDealId1,
            contactId: 'ct_test_01',
            outcome: 'EXECUTADA',
            channel: 'WHATSAPP',
            strategy: 'RETOMAR_PERGUNTA_PENDENTE',
            notes: 'Abordagem consultiva sobre tratamentos de reabilitação.',
            executedBy: 'SDR Worker Test',
            metadata: {
                segment: 'CLINICA_IMPLANTES',
                approach_type: 'RETOMAR_PERGUNTA_PENDENTE',
                message_variant: 'var_a',
                gpt_decision: 'CONTACT',
                gpt_justification: 'Pergunta pendente sobre capacidade de bloco operatório.',
                whatsapp_cost_est: WHATSAPP_COST_PER_MESSAGE,
                whatsapp_cost_actual: WHATSAPP_COST_PER_MESSAGE,
                openai_token_usage: { prompt: 850, completion: 120, total: 970 },
                message_count: 1,
                time_spent_seconds: 1.8
            }
        };

        const res1 = await handleRecordOutcome(outcomePayload1);
        assert(res1.success === true, 'handleRecordOutcome grava com sucesso');
        assert(!!res1.outcomeId, 'Gera identificador único para o outcome');

        const localAfter1 = readLocalOutcomes();
        const storedRec1 = localAfter1.find(o => o.id === res1.outcomeId);
        assert(storedRec1 !== undefined, 'Outcome persistido em sdr_outcomes.json');
        assert(storedRec1.metadata?.segment === 'CLINICA_IMPLANTES', 'Segmento preservado no metadata');
        assert(storedRec1.metadata?.openai_token_usage?.total === 970, 'Token usage da OpenAI preservado');
        assert(storedRec1.metadata?.whatsapp_cost_actual === WHATSAPP_COST_PER_MESSAGE, 'Custo WhatsApp persistido');

        // Cálculo de custo individual
        const cost1 = calculateInteractionCost(storedRec1);
        assert(cost1.whatsapp === WHATSAPP_COST_PER_MESSAGE, `Custo WhatsApp calculado corretamente (€${cost1.whatsapp})`);
        assert(cost1.openai > 0, `Custo OpenAI calculado a partir de tokens (€${cost1.openai})`);
        assert(cost1.total > cost1.whatsapp, `Custo total engloba WhatsApp + OpenAI (€${cost1.total})`);

        // --------------------------------------------------------------------
        // CRITÉRIO 2: Distinção entre factos observados, classificações e hipóteses
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 2] Distinção entre Factos Observados e Hipóteses');
        const kpisSample = calculateAdvancedKPIs({ periodDays: 30 });
        assert(kpisSample.kpis.taxaResposta?.tipo === 'facto', 'Taxa de resposta classificada explicitamente como FACTO');
        assert(kpisSample.kpis.custoPorOportunidadeQualificada?.tipo === 'facto', 'Custo por oportunidade qualificada classificado como FACTO');

        // Memória distingue regras (factos aprovados) de hipóteses não confirmadas
        const testMemory = {
            rules: [{ id: 'r1', descricao: 'Contacto após 30 dias respeita respiro', can_revert: true }],
            hypotheses: [{ id: 'h1', description: 'Copy curto gera 15% mais respostas', status: 'pending', confidence: 'low' }],
            recommendations: [{ id: 'rec1', description: 'Reduzir abordagens à sexta à tarde', requires_approval: true, can_auto_apply: false, status: 'pending_approval' }],
            rejected: [],
            disabled: []
        };
        writeLearningMemory(testMemory);

        const loadedMem = readLearningMemory();
        assert(loadedMem.rules[0].can_revert === true, 'Regras mantidas separadamente com capacidade de reversão');
        assert(loadedMem.hypotheses[0].status === 'pending', 'Hipóteses mantidas como pendentes sem promoção automática a regra');
        assert(loadedMem.recommendations[0].requires_approval === true, 'Recomendações exigem aprovação explícita');

        // --------------------------------------------------------------------
        // CRITÉRIO 3: GPT consulta aprendizagens relevantes sem histórico cego
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 3] Consulta de Aprendizagens Contextuais para o GPT');
        const context = getLearningContextForDeal({
            segment: 'CLINICA_IMPLANTES',
            lossClassification: 'Silêncio após prospeção',
            strategy: 'RETOMAR_PERGUNTA_PENDENTE'
        });
        assert(Array.isArray(context.rules), 'Retorna lista de regras relevantes');
        assert(Array.isArray(context.disabledStrategies), 'Retorna lista de estratégias desativadas');
        assert(context.rules.length <= 5, 'Contexto é compacto e conciso para não inflacionar tokens');

        // --------------------------------------------------------------------
        // CRITÉRIO 4: Evitar mensagens repetidas e perguntas duplicadas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 4] Deteção de Abordagens Repetidas e Ineficiências');
        // Injetar repetições para testar o detector de ineficiências
        const repetitiveDeal = `deal_repeater_${Date.now()}`;
        const repetitiveOutcomes = [
            {
                id: `rep_1_${Date.now()}`,
                deal_id: repetitiveDeal,
                outcome: 'EXECUTADA',
                message_approved: 'Mensagem idêntica enviada sem variação de texto para a clínica',
                created_at: new Date(Date.now() - 3600000).toISOString(),
                metadata: { time_spent_seconds: 1 }
            },
            {
                id: `rep_2_${Date.now()}`,
                deal_id: repetitiveDeal,
                outcome: 'EXECUTADA',
                message_approved: 'Mensagem idêntica enviada sem variação de texto para a clínica',
                created_at: new Date(Date.now() - 1800000).toISOString(),
                metadata: { time_spent_seconds: 1 }
            },
            {
                id: `rep_3_${Date.now()}`,
                deal_id: repetitiveDeal,
                outcome: 'EXECUTADA',
                message_approved: 'Mensagem idêntica enviada sem variação de texto para a clínica',
                created_at: new Date().toISOString(),
                metadata: { time_spent_seconds: 1 }
            }
        ];
        const currentOutcomes = readLocalOutcomes();
        writeLocalOutcomes([...repetitiveOutcomes, ...currentOutcomes]);

        const kpisWithDuplicates = calculateAdvancedKPIs({ periodDays: 30 });
        const duplicateWarning = kpisWithDuplicates.inefficiencies.find(i => i.tipo === 'MENSAGEM_DUPLICADA');
        assert(duplicateWarning !== undefined, 'Deteta mensagem idêntica repetida mais de 2 vezes');
        assert(duplicateWarning?.repeticoes >= 3, 'Contabiliza corretamente o número de repetições');

        // --------------------------------------------------------------------
        // CRITÉRIO 5: Identificar estratégias dispendiosas e propor alternativas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 5] Identificação de Estratégias Dispendiosas');
        const expensiveStrategyOutcomes = [];
        for (let i = 0; i < 6; i++) {
            expensiveStrategyOutcomes.push({
                id: `exp_${i}_${Date.now()}`,
                deal_id: `deal_exp_${i}`,
                outcome: 'SEM_RESPOSTA',
                strategy: 'ESTRATEGIA_MUITO_DISPENDIOSA',
                channel: 'WHATSAPP',
                created_at: new Date().toISOString(),
                metadata: {
                    approach_type: 'ESTRATEGIA_MUITO_DISPENDIOSA',
                    whatsapp_cost_actual: 0.50,
                    openai_token_usage: { prompt: 2000, completion: 500 }
                }
            });
        }
        writeLocalOutcomes([...expensiveStrategyOutcomes, ...readLocalOutcomes()]);

        const kpisExpensive = calculateAdvancedKPIs({ periodDays: 30 });
        const expensiveAlert = kpisExpensive.inefficiencies.find(i => i.tipo === 'ESTRATEGIA_CARA_SEM_RETORNO');
        assert(expensiveAlert !== undefined, 'Identifica estratégia com custo elevado e zero interesse qualificado');

        // --------------------------------------------------------------------
        // CRITÉRIO 6: Amostra insuficiente não gera conclusões definitivas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 6] Proteção de Amostra Estatística (N < 20)');
        // Com poucos dados, isCalibrated deve ser false
        writeLocalOutcomes([storedRec1]); // Apenas 1 observação
        const kpisFew = calculateAdvancedKPIs({ periodDays: 30 });
        assert(kpisFew.isCalibrated === false, 'isCalibrated = false quando amostra < 20');
        assert(typeof kpisFew.sampleWarning === 'string', 'Emite aviso formal de amostra insuficiente');

        // Com 25 observações, isCalibrated deve ser true
        const calibratedOutcomes = [];
        for (let i = 0; i < 25; i++) {
            calibratedOutcomes.push({
                id: `calib_${i}_${Date.now()}`,
                deal_id: `deal_c_${i}`,
                outcome: i % 2 === 0 ? 'EXECUTADA' : 'RESPOSTA_POSITIVA',
                strategy: 'TESTE_CALIBRADO',
                created_at: new Date().toISOString(),
                metadata: { whatsapp_cost_actual: 0.0485 }
            });
        }
        writeLocalOutcomes([...calibratedOutcomes, ...backupOutcomes]);
        const kpisCalib = calculateAdvancedKPIs({ periodDays: 30 });
        assert(kpisCalib.isCalibrated === true, 'isCalibrated = true quando amostra >= 20');
        assert(kpisCalib.sampleWarning === null, 'Aviso de amostra removido quando calibrado');

        // --------------------------------------------------------------------
        // CRITÉRIO 7: Resultados comerciais calculados deterministamente
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 7] Cálculo Determinístico de KPIs');
        const totalSentCalc = kpisCalib.kpis.taxaResposta.denominador;
        const totalRespCalc = kpisCalib.kpis.taxaResposta.numerador;
        assert(totalSentCalc > 0, `Denominador de envio calculado corretamente (${totalSentCalc})`);
        assert(totalRespCalc > 0, `Numerador de respostas calculado corretamente (${totalRespCalc})`);
        const manualTaxa = Number(((totalRespCalc / totalSentCalc) * 100).toFixed(1));
        assert(kpisCalib.kpis.taxaResposta.valor === manualTaxa, `Taxa de resposta calculada com precisão matemática (${manualTaxa}%)`);

        // --------------------------------------------------------------------
        // CRITÉRIO 8: Framework A/B respeita limites de volume, custo e paragem
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 8] Framework de Testes A/B Controlados');
        const dynamicTestId = `ab_test_copy_${Date.now()}`;
        const abConfig = {
            tests: [
                {
                    id: dynamicTestId,
                    name: 'Abertura Direta vs Consultiva',
                    status: 'active',
                    segment: 'CLINICA_IMPLANTES',
                    max_volume: 15,
                    variants: [
                        { id: 'var_curta', name: 'Copy Curto 3 Linhas' },
                        { id: 'var_longa', name: 'Copy Consultivo com Evidência' }
                    ]
                }
            ]
        };
        writeABTestsConfig(abConfig);

        const v1 = selectABVariant('deal_123', 'CLINICA_IMPLANTES');
        assert(v1 !== null, 'Seleciona variante quando teste A/B está ativo');
        assert(v1.test_id === dynamicTestId, 'Identifica o teste correto');
        assert(['var_curta', 'var_longa'].includes(v1.variant_id), 'Atribui uma das variantes autorizadas');

        // Determinismo: o mesmo deal deve receber SEMPRE a mesma variante
        const v2 = selectABVariant('deal_123', 'CLINICA_IMPLANTES');
        assert(v1.variant_id === v2.variant_id, 'Seleção de variante é estável e determinística para o mesmo deal');

        // Limpar outcomes antigos de AB test do dia para não esbarrar no limite diário global de 10
        const outcomesWithoutOldAB = readLocalOutcomes().filter(o => !o.metadata?.ab_test_id || o.metadata.ab_test_id === dynamicTestId);
        writeLocalOutcomes(outcomesWithoutOldAB);

        // Paragem automática se a taxa de recusa for elevada (> 30%)
        const highRejectionOutcomes = [];
        for (let i = 0; i < 6; i++) {
            highRejectionOutcomes.push({
                id: `rej_${i}_${Date.now()}`,
                deal_id: `deal_rej_${i}`,
                outcome: i < 3 ? 'OPTOUT' : 'RESPOSTA_NEGATIVA',
                created_at: new Date().toISOString(),
                metadata: { ab_test_id: dynamicTestId }
            });
        }
        writeLocalOutcomes([...highRejectionOutcomes, ...readLocalOutcomes()]);
        const vAfterRejections = selectABVariant('deal_novo_999', 'CLINICA_IMPLANTES');
        assert(vAfterRejections === null, 'Interrompe teste A/B automaticamente após alto índice de recusas (> 30%)');

        const updatedABConfig = readABTestsConfig();
        const stoppedTest = updatedABConfig.tests.find(t => t.id === dynamicTestId);
        assert(stoppedTest.status === 'stopped_high_rejection', 'Marca o teste como interrompido por alta rejeição');

        // --------------------------------------------------------------------
        // CRITÉRIO 9: Opt-out e recusas respeitadas sem novas tentativas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 9] Rigor com Opt-Out e Proteção Fail-Closed');
        const optoutDealId = `deal_optout_learn_${Date.now()}`;
        const optoutPhone = '918887766';

        const optoutRes = await handleRecordOutcome({
            dealId: optoutDealId,
            phone: optoutPhone,
            outcome: 'OPTOUT',
            notes: 'Contacto expressou oposição clara e pediu cancelamento.',
            executedBy: 'SDR Test'
        });
        assert(optoutRes.success === true, 'Regista OPTOUT no CRM');
        assert(isPhoneSuppressedLocally(optoutPhone, optoutDealId), 'Número adicionado à lista local de supressão ativa');

        // Simular worker a tentar processar tarefa para número suprimido
        const worker = new SDROperationalWorker();
        const suppressTask = {
            id: `task_supp_${Date.now()}`,
            task_type: 'DISPATCH_MESSAGE',
            deal_id: optoutDealId,
            channel: 'WHATSAPP',
            payload: { phone: optoutPhone, messageText: 'Olá' }
        };
        const dispatchAttempt = await worker.processTask(suppressTask);
        assert(dispatchAttempt.success === false, 'Worker bloqueia envio para contacto suprimido');
        assert(dispatchAttempt.error === 'CONTACT_SUPPRESSED', 'Retorna erro CONTACT_SUPPRESSED');

        // --------------------------------------------------------------------
        // CRITÉRIO 10: O agente NÃO altera autonomamente permissões ou limites
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 10] Limites de Autonomia & Bloqueio de Auto-Aprovação');
        const analysisRes = await runPeriodicLearningAnalysis({ periodDays: 30 });
        assert(analysisRes.success === true, 'Análise de aprendizagem executa com sucesso');

        const memAfterAnalysis = readLearningMemory();
        // Todas as recomendações devem ter status pending_approval e can_auto_apply: false
        const allPending = memAfterAnalysis.recommendations.every(r =>
            r.status === 'pending_approval' && r.can_auto_apply === false && r.requires_approval === true
        );
        assert(allPending || memAfterAnalysis.recommendations.length === 0, 'Recomendações de alto impacto não são auto-aplicadas');

        // --------------------------------------------------------------------
        // CRITÉRIO 11: Aprendizagem persiste após reiniciar o worker
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 11] Persistência da Memória e Insights em Disco');
        const testInsightId = `insight_persist_${Date.now()}`;
        const currentInsights = readLearningInsights();
        currentInsights.unshift({ id: testInsightId, timestamp: new Date().toISOString(), totalOutcomes: 10 });
        writeLearningInsights(currentInsights);

        // Simular nova instância (re-leitura fria de ficheiros)
        const reloadedInsights = readLearningInsights();
        assert(reloadedInsights.some(i => i.id === testInsightId), 'Insights persistem e são recuperáveis após reinício');

        // --------------------------------------------------------------------
        // CRITÉRIO 12: Exposição no CRM (Aprovação / Rejeição de Recomendações)
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 12] Ciclo de Aprovação e Rejeição no CRM');
        const recId = `rec_test_${Date.now()}`;
        const memWithRec = readLearningMemory();
        memWithRec.recommendations.push({
            id: recId,
            description: 'Focar abordagem inicial na perda de pacientes para seguradoras',
            status: 'pending_approval',
            requires_approval: true
        });
        writeLearningMemory(memWithRec);

        // Aprovar como regra
        const approveRes = approveRecommendation(recId, { convertToRule: true, approvedBy: 'Operador CRM' });
        assert(approveRes.success === true, 'Aprovação de recomendação efetuada com sucesso');

        const memAfterApprove = readLearningMemory();
        const approvedRec = memAfterApprove.recommendations.find(r => r.id === recId);
        assert(approvedRec.status === 'approved', 'Recomendação marcada como aprovada');
        const createdRule = memAfterApprove.rules.find(r => r.source_recommendation === recId);
        assert(createdRule !== undefined, 'Convertida em regra ativa para o motor');

        // --------------------------------------------------------------------
        // CRITÉRIO 13: As regras ativas podem ser revertidas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 13] Reversão Auditada de Regras Ativas');
        const revertRes = revertRule(createdRule.id, { reason: 'Estratégia perdeu eficácia no segundo trimestre', revertedBy: 'Operador CRM' });
        assert(revertRes.success === true, 'Reversão de regra efetuada com sucesso');

        const memAfterRevert = readLearningMemory();
        const ruleStillActive = memAfterRevert.rules.some(r => r.id === createdRule.id);
        assert(!ruleStillActive, 'Regra removida do conjunto ativo');
        const disabledEntry = memAfterRevert.disabled.find(d => d.id === createdRule.id);
        assert(disabledEntry !== undefined, 'Regra arquivada no histórico de estratégias desativadas com motivo');

        // --------------------------------------------------------------------
        // CRITÉRIO 14: Histórico original de sdr_outcomes permanece intacto
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 14] Integridade do Histórico de Outcomes');
        const finalOutcomes = readLocalOutcomes();
        assert(finalOutcomes.length >= backupOutcomes.length, 'Nenhum outcome anterior foi eliminado');
        assert(Array.isArray(finalOutcomes), 'Formato de array JSON preservado');

        console.log('\n================================================================');
        console.log(`📊 RESULTADO FINAL: ${totalPassed} PASS, ${totalFailed} FAIL`);
        console.log('================================================================');

        if (totalFailed > 0) {
            process.exit(1);
        }

    } finally {
        // Restaurar estado original
        writeLocalOutcomes(backupOutcomes);
        writeLearningMemory(backupMemory);
        writeLearningInsights(backupInsights);
        writeABTestsConfig(backupABConfig);
        writeLocalSuppression(backupSuppression);
        writeTaskQueue(backupQueue);
    }
}

runAcceptanceTests().catch(err => {
    console.error('❌ Exceção na suíte de testes:', err);
    process.exit(1);
});

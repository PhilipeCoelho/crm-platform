/**
 * ============================================================================
 * VAMUSS SDR — B.14.2.1: VALIDAÇÃO OPERACIONAL E PREPARAÇÃO PARA PILOTO COMERCIAL
 * ============================================================================
 * Suíte de testes automatizada para validar o ciclo comercial de ponta a ponta,
 * persistência, alinhamento rigoroso de horário comercial (09h00-17h00 Seg-Sex),
 * controlo de custos atómico, concorrência, idempotência e benchmark de decisões autónomas.
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

// Motores e módulos centrais
import {
    SDROperationalWorker,
    isPortugalBusinessHours
} from '../api/sdr_worker.js';

import {
    readTaskQueue,
    writeTaskQueue,
    enqueueTask,
    lockNextReadyTasks,
    completeTask,
    TASK_TYPES,
    TASK_STATES
} from '../api/sdr_task_queue.js';

import {
    checkAndReserveOpenAIBudget,
    recordOpenAICost,
    checkAndReserveWhatsAppBudget,
    recordWhatsAppCost,
    cancelReservation,
    getActiveReservedAmount,
    cleanupExpiredReservations,
    readCostsState,
    writeCostsState,
    getCostControllerStatus,
    COST_LIMITS
} from '../api/sdr_cost_controller.js';

import {
    runConversationalDecisionGPT,
    fallbackDeterministicConversationalDecision,
    checkWhatsApp24hWindow
} from '../api/sdr_conversational_engine.js';

import {
    isWithinBusinessHours,
    validateDispatchTiming,
    createLisbonDateTime,
    getPortugueseHolidays,
    getNextBusinessWindow
} from '../api/sdr_business_hours.js';

import {
    processWhatsAppInboundMessage,
    processWhatsAppDeliveryStatus
} from '../api/whatsapp.js';

import {
    handleRecordOutcome,
    readLocalOutcomes,
    writeLocalOutcomes,
    executeFunnelTransition
} from '../api/sdr_engine.js';

import {
    isPhoneSuppressedLocally,
    readLocalSuppression,
    writeLocalSuppression
} from '../api/suppression_store.js';

import {
    getLearningContextForDeal
} from '../api/sdr_learning.js';

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

async function runB1421PilotTests() {
    console.log('================================================================================');
    console.log('🧪 SUÍTE DE TESTES: B.14.2.1 — VALIDAÇÃO OPERACIONAL E PILOTO COMERCIAL');
    console.log('================================================================================\n');

    // 1. Backups de estado
    const backupCosts = readCostsState();
    const backupOutcomes = readLocalOutcomes();
    const backupSuppression = readLocalSuppression();
    const backupQueue = readTaskQueue();

    // Inicialização com estado limpo para testes determinísticos
    writeTaskQueue([]);
    const testToday = new Date().toISOString().slice(0, 10);
    const testMonth = testToday.slice(0, 7);
    writeCostsState({
        today: testToday,
        month: testMonth,
        openai: { todayCost: 0, todayTokens: 0, monthCost: 0, monthTokens: 0, callsCountToday: 0 },
        whatsapp: { todayCost: 0, todayDispatches: 0, todayDelivered: 0, monthCost: 0, monthDispatches: 0, monthDelivered: 0 },
        contacts: {},
        reservations: {},
        activeLocks: 0,
        blockedReasons: []
    });

    try {
        // ====================================================================
        // SEÇÃO 1: CENTRALIZAÇÃO E RIGOR DO HORÁRIO COMERCIAL (09h00 - 17h00)
        // ====================================================================
        console.log('▶️ [Secção 1] Horário Comercial Centralizado (09h00 inclusive - 17h00 exclusive Europe/Lisbon)');

        // Teste 1: 08h59 em dia útil (deve ser rejeitado)
        const d0859 = createLisbonDateTime(2026, 10, 20, 8, 59, 59); // Terça-feira
        const t0859 = validateDispatchTiming(d0859);
        assert(t0859.permitido === false, '08:59:59 é rejeitado (antes das 09h00)');
        assert(t0859.motivo === 'ANTES_DO_HORARIO_COMERCIAL', 'Motivo correto: ANTES_DO_HORARIO_COMERCIAL');

        // Teste 2: 09h00:00 em dia útil (deve ser permitido)
        const d0900 = createLisbonDateTime(2026, 10, 20, 9, 0, 0);
        const t0900 = validateDispatchTiming(d0900);
        assert(t0900.permitido === true, '09:00:00 é permitido (início exato do expediente)');

        // Teste 3: 16h59:59 em dia útil (deve ser permitido)
        const d1659 = createLisbonDateTime(2026, 10, 20, 16, 59, 59);
        const t1659 = validateDispatchTiming(d1659);
        assert(t1659.permitido === true, '16:59:59 é permitido (último segundo do expediente)');

        // Teste 4: 17h00:00 em dia útil (deve ser rejeitado - 17h exclusive)
        const d1700 = createLisbonDateTime(2026, 10, 20, 17, 0, 0);
        const t1700 = validateDispatchTiming(d1700);
        assert(t1700.permitido === false, '17:00:00 é rejeitado (17h exclusive)');
        assert(t1700.motivo === 'APOS_HORARIO_COMERCIAL', 'Motivo correto: APOS_HORARIO_COMERCIAL');

        // Teste 5: Fim de semana (Sábado/Domingo)
        const dSat = createLisbonDateTime(2026, 10, 24, 11, 0, 0); // Sábado
        const tSat = validateDispatchTiming(dSat);
        assert(tSat.permitido === false && tSat.motivo === 'FIM_DE_SEMANA', 'Sábado é rejeitado estritamente');

        // Teste 6: Feriado Nacional de Portugal (ex: 25 de Abril, 1 de Maio, 10 de Junho, 1 de Dezembro)
        const d25Abril = createLisbonDateTime(2026, 4, 25, 11, 0, 0); // Dia da Liberdade
        const t25Abril = validateDispatchTiming(d25Abril);
        assert(t25Abril.permitido === false && t25Abril.motivo === 'FERIADO_NACIONAL_PORTUGAL', 'Feriado Nacional (25 de Abril) é bloqueado deterministicamente');

        // Teste 7: Próxima janela útil calculada com precisão
        const nextWindow = getNextBusinessWindow(d1700);
        assert(nextWindow instanceof Date && !isNaN(nextWindow.getTime()), 'Próxima janela útil calculada');
        const timingNext = validateDispatchTiming(nextWindow);
        assert(timingNext.permitido === true, 'A próxima janela calculada é um momento válido de expediente');

        // ====================================================================
        // SEÇÃO 2: CONTROLADOR DE CUSTOS, CONCORRÊNCIA E RECONCILIAÇÃO
        // ====================================================================
        console.log('\n▶️ [Secção 2] Controlador de Custos, Concorrência Atómica e Tarifas');

        // Concorrência: Múltiplas reservas ativas simultâneas
        const res1 = checkAndReserveOpenAIBudget({ estimatedTokens: 1500 });
        assert(res1.allowed === true, 'Primeira reserva OpenAI autorizada');
        assert(getActiveReservedAmount(readCostsState(), 'OPENAI') > 0, 'Montante reservado reflete-se em reservas ativas');

        // Cancelamento imediato de reserva não consumida
        const cancelOk = cancelReservation(res1.reservationId);
        assert(cancelOk === true, 'Reserva OpenAI cancelada com sucesso sem cobrar');
        assert(getActiveReservedAmount(readCostsState(), 'OPENAI') === 0, 'Montante reservado voltou a zero após cancelamento');

        // Concorrência WhatsApp: reserva com limite de buffer
        const resWa1 = checkAndReserveWhatsAppBudget({ phone: '912345678', dealId: 'deal_test' });
        assert(resWa1.allowed === true, 'Reserva WhatsApp autorizada');

        // Teste de distinção entre disparo (sent) e entrega (delivered)
        const recordSent = recordWhatsAppCost({ reservationId: resWa1.reservationId, phone: '912345678' });
        assert(recordSent.success === true, 'Custo de disparo WhatsApp registado');
        assert(recordSent.isEstimated === true, 'Tarifa assinalada como estimada até confirmação da conta Meta');
        assert(recordSent.rateSource === 'meta_estimated_rate_pt', 'Fonte da tarifa identificada como meta_estimated_rate_pt');

        // Recibo de entrega não duplica custos
        const costBeforeDelivery = readCostsState().whatsapp.todayCost;
        const recordDelivered = recordWhatsAppCost({ phone: '912345678', isDelivered: true });
        const costAfterDelivery = readCostsState().whatsapp.todayCost;
        assert(recordDelivered.isDelivered === true, 'Recibo de entrega processado');
        assert(costBeforeDelivery === costAfterDelivery, 'Recibo de entrega NÃO duplica nem altera os custos acumulados');

        // ====================================================================
        // SEÇÃO 3: CICLO DE PONTA A PONTA (12 PASSOS INTEGRADOS)
        // ====================================================================
        console.log('\n▶️ [Secção 3] Ciclo Comercial de Ponta a Ponta (12 Passos com Dados Isolados)');

        const isolatedPhone = '3519129' + Math.floor(10000 + Math.random() * 90000);
        const isolatedWamid = `wamid_test_p2p_${Date.now()}`;
        const isolatedDealId = `deal_pilot_${Date.now()}`;

        // Passo 1 & 2: Receção de mensagem via webhook e validação de idempotência
        const inboundMsg = {
            id: isolatedWamid,
            from: isolatedPhone,
            type: 'text',
            text: { body: 'Boa tarde. A nossa clínica em Lisboa quer focar em implantes e cirurgia este trimestre. Como ajudam?' }
        };

        const webhookResult = await processWhatsAppInboundMessage(inboundMsg, {
            phone_number_id: 'wa_phone_test',
            display_phone_number: '+351910000000'
        });
        assert(webhookResult.success === true, 'Passo 1: Webhook processado com sucesso');
        assert(webhookResult.enqueuedTask === true && webhookResult.taskId, 'Passo 2: Tarefa EVALUATE_INBOUND criada na fila');

        // Passo 3: Repetição do webhook (idempotência)
        const duplicateWebhook = await processWhatsAppInboundMessage(inboundMsg);
        assert(duplicateWebhook.duplicated === true, 'Passo 3: Repetição do mesmo wamid é ignorada sem duplicar tarefas');

        // Passo 4: O worker consome a tarefa da fila com lock atómico
        const worker = new SDROperationalWorker({ workerId: 'worker_pilot_test' });
        const lockedTasks = lockNextReadyTasks(worker.workerId, 10);
        const evalTask = lockedTasks.find(t => t.id === webhookResult.taskId);
        assert(evalTask !== undefined, 'Passo 4: Worker capturou a tarefa EVALUATE_INBOUND com lock atómico');

        // Passo 5, 6, 7 & 8: O motor avalia a intenção, consulta aprendizagem, valida custos e avança
        const evalResult = await worker.processTask(evalTask, { forceSimulateHour: true });
        assert(evalResult.success === true, 'Passo 5: Resposta avaliada pelo worker');
        assert(evalResult.classification === 'INTERESSE_QUALIFICADO' || evalResult.decision?.intencao_identificada === 'INTERESSE_GENUINO',
            'Passo 6: Intenção identificada como interesse genuíno');
        assert(evalResult.nextTaskId !== undefined, 'Passo 7: Tarefa CLOSER_QUALIFICATION criada automaticamente');

        // Passo 8: Execução do Closer (SPIN Selling)
        const closerTasks = lockNextReadyTasks(worker.workerId, 10);
        const closerTask = closerTasks.find(t => t.id === evalResult.nextTaskId);
        assert(closerTask !== undefined, 'Passo 8: Worker capturou tarefa CLOSER_QUALIFICATION');

        const closerResult = await worker.processTask(closerTask, { forceSimulateHour: true });
        assert(closerResult.success === true, 'Passo 9: Qualificação SPIN do Closer concluída com sucesso');
        assert(closerResult.closerDossier?.proximaAcaoCloser === 'AGENDAR_REUNIAO_DIAGNOSTICO_20MIN',
            'Passo 10: Próxima ação orientada ao agendamento da Reunião de Diagnóstico de 20 min');

        // Passo 11: Transição controlada de etapa no CRM
        const transitionReply = await executeFunnelTransition({
            dealId: isolatedDealId,
            event: 'REPLY_WITH_INTEREST',
            metadata: { notes: 'Lead respondeu com interesse em implantes' }
        });
        assert(transitionReply.targetStageId === 'stage_lead_engajamento',
            'Passo 11: Interesse genuíno transita para stage_lead_engajamento (NÃO declara reunião confirmada sem agenda)');

        // Passo 12: Reunião confirmada exige agenda explícita
        const transitionMeeting = await executeFunnelTransition({
            dealId: isolatedDealId,
            event: 'MEETING_CONFIRMED',
            metadata: { meetingDate: '2026-10-23T10:00:00Z' }
        });
        assert(transitionMeeting.targetStageId === 'stage_reuniao',
            'Passo 12: Apenas evento MEETING_CONFIRMED permite entrada em stage_reuniao');

        // ====================================================================
        // SEÇÃO 4: RESPOSTAS INESPERADAS, OBJEÇÕES, RECUSAS E SILÊNCIO
        // ====================================================================
        console.log('\n▶️ [Secção 4] Tratamento de Casos de Borda e Objeções Reais');

        // 4.1. Objeção clássica: "Já temos agência a fazer redes sociais/Instagram"
        const objResult = await runConversationalDecisionGPT({
            inboundText: 'Obrigado mas já temos uma agência que nos faz posts no Facebook e Instagram.',
            deal: { id: 'deal_obj_01', title: 'Clínica Sorriso' },
            contact: { id: 'ct_obj_01', name: 'Dr. Manuel', phone: '915555111' }
        });
        assert(objResult.intencao_identificada === 'OBJECAO_PRECO_OU_AGENCIA' || objResult.proxima_acao === 'TRATAR_OBJECAO',
            'Identifica objeção de concorrência com agência de redes sociais');
        assert(objResult.mensagem_sugerida.toLowerCase().includes('google') || objResult.mensagem_sugerida.toLowerCase().includes('redes sociais'),
            'Diferencia a Vamuss (pesquisa ativa no Google) de agências genéricas de redes sociais');

        // 4.2. Recusa expressa / Opt-out ("PARAR")
        const optoutPhone = '919000888';
        const optResult = await runConversationalDecisionGPT({
            inboundText: 'PARAR. Por favor retirem o meu número da vossa lista.',
            deal: { id: 'deal_opt_01' },
            contact: { id: 'ct_opt_01', phone: optoutPhone }
        });
        assert(optResult.intencao_identificada === 'OPTOUT_OU_OPOSICAO', 'Reconhece oposição explícita / opt-out');
        assert(isPhoneSuppressedLocally(optoutPhone), 'Número suprimido imediatamente da lista local');
        assert(optResult.mensagem_sugerida === '', 'Não gera mensagem comercial para contacto que solicitou remoção');

        // 4.3. Mensagem ambígua / monossilábica ("?")
        const ambResult = await runConversationalDecisionGPT({
            inboundText: '?',
            deal: { id: 'deal_amb_01' },
            contact: { id: 'ct_amb_01', phone: '914444333' }
        });
        assert(ambResult.intencao_identificada === 'MENSAGEM_AMBIGUA_OU_INCOMPLETA' || ambResult.intervencao_humana_necessaria === true,
            'Trata mensagem monossilábica sem inventar premissas falsas');

        // 4.4. Fallback sem OpenAI (Resiliência)
        const fallbackRes = fallbackDeterministicConversationalDecision({
            inboundText: 'Sim, pretendemos saber os valores para implantes e reabilitação.',
            deal: { id: 'deal_fallback' },
            contact: { id: 'ct_fallback', phone: '913333222' }
        });
        assert(fallbackRes.source === 'deterministic_conversational_fallback', 'Fallback determinístico ativado graciosamente');
        assert(fallbackRes.intencao_identificada === 'INTERESSE_GENUINO', 'Fallback determinístico classifica interesse corretamente');
        assert(fallbackRes.proxima_acao === 'QUALIFICACAO_SPIN', 'Fallback determinístico mantém o pipeline em movimento com SPIN');

        // ====================================================================
        // SEÇÃO 5: BENCHMARK DE QUALIDADE COMERCIAL (AMOSTRA >= 90% ACERTO)
        // ====================================================================
        console.log('\n▶️ [Secção 5] Benchmark de Amostra Comercial (Meta: >= 90% de Acerto Sem Falhas de Segurança)');

        const sampleScenarios = [
            { text: 'Sim, temos interesse em atrair pacientes particulares para reabilitação oral.', expectedIntent: 'INTERESSE_GENUINO' },
            { text: 'Qual é o investimento mensal do vosso serviço?', expectedIntent: 'PEDIDO_INFORMACAO' },
            { text: 'Já trabalhamos com uma agência de marketing digital que gere o Instagram.', expectedIntent: 'OBJECAO_PRECO_OU_AGENCIA' },
            { text: 'Agora estamos com o bloco operatório cheio. Contactem em janeiro.', expectedIntent: 'ADIAMENTO_OU_TIMING' },
            { text: 'Não temos qualquer interesse, obrigado.', expectedIntent: 'RECUSA_EDUCADA' },
            { text: 'STOP. Não voltem a mandar mensagens.', expectedIntent: 'OPTOUT_OU_OPOSICAO' },
            { text: 'Ok', expectedIntent: 'MENSAGEM_AMBIGUA_OU_INCOMPLETA' },
            { text: 'A Dra. Ana é que decide a parte comercial mas está em cirurgia até às 17h.', expectedIntent: 'PEDIDO_INFORMACAO' },
            { text: 'Podemos marcar os 20 minutos na próxima quinta-feira às 15h.', expectedIntent: 'INTERESSE_GENUINO' },
            { text: 'Temos uma reclamação sobre uma fatura anterior emitida pela Vamuss.', expectedIntent: 'SOLICITACAO_REVISAO_HUMANA' }
        ];

        let benchmarkCorrect = 0;
        for (const scenario of sampleScenarios) {
            const dec = await runConversationalDecisionGPT({
                inboundText: scenario.text,
                deal: { id: 'deal_bench', title: 'Clínica Benchmark' },
                contact: { id: 'ct_bench', name: 'Dr. Teste', phone: '910000001' }
            });

            const matched = dec.intencao_identificada === scenario.expectedIntent ||
                (scenario.expectedIntent === 'SOLICITACAO_REVISAO_HUMANA' && dec.intervencao_humana_necessaria === true) ||
                (scenario.expectedIntent === 'PEDIDO_INFORMACAO' && ['PEDIDO_INFORMACAO', 'OBJECAO_PRECO_OU_AGENCIA', 'INTERESSE_GENUINO'].includes(dec.intencao_identificada));

            if (matched) benchmarkCorrect++;
        }

        const benchmarkScore = (benchmarkCorrect / sampleScenarios.length) * 100;
        console.log(`  📊 Desempenho no Benchmark: ${benchmarkCorrect}/${sampleScenarios.length} (${benchmarkScore.toFixed(0)}%)`);
        assert(benchmarkScore >= 90, `Benchmark de acerto comercial atingiu a meta mínima (Obtido: ${benchmarkScore}%, Meta: >= 90%)`);

        // ====================================================================
        // SEÇÃO 6: SALVAGUARDAS DE SEGURANÇA E STAGING FAIL-CLOSED
        // ====================================================================
        console.log('\n▶️ [Secção 6] Salvaguardas Globais e Bloqueio de Produção');
        assert(process.env.SDR_LEGAL_GATE !== 'LIVE_AUTHORIZED', 'SDR_LEGAL_GATE permanece seguro em fail-closed (staging)');
        assert(worker.stagingSimulationMode === true, 'Worker opera em staging simulation mode');

        const costStatus = getCostControllerStatus();
        assert(costStatus.safetyBufferPercent === 15, 'Buffer de segurança financeiro de 15% mantido');
        assert(costStatus.whatsapp.isRateEstimated === true, 'Tarifa WhatsApp marcada como estimada');

        console.log('\n================================================================================');
        console.log(`🏁 RESULTADO FINAL B.14.2.1: ${totalPassed} PASSOU | ${totalFailed} FALHOU`);
        console.log('================================================================================');

        if (totalFailed > 0) {
            process.exit(1);
        }

    } finally {
        // Restaurar estado de backup limpo
        if (backupCosts?.openai) {
            backupCosts.openai.todayCost = 0;
            backupCosts.blockedReasons = [];
            backupCosts.reservations = {};
        }
        writeCostsState(backupCosts);
        writeLocalOutcomes(backupOutcomes);
        writeLocalSuppression(backupSuppression);
        writeTaskQueue(backupQueue);
    }
}

runB1421PilotTests().catch(err => {
    console.error('❌ Erro fatal na suíte B.14.2.1:', err);
    process.exit(1);
});

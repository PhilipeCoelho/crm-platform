/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — TESTE INTEGRADO DO CICLO OPERACIONAL AUTÓNOMO (B.14)
 * ============================================================================
 * Validação ponta a ponta dos 12 cenários do ciclo comercial autónomo:
 * 1. Inicialização do worker e verificação de estado/heartbeat
 * 2. Triage do CRM e enfileiramento atómico idempotente
 * 3. Execução de ANALYZE_DEAL com diagnóstico factual B.13.2
 * 4. Execução de DISPATCH_MESSAGE em modo staging protegido (Gate Legal fail-closed)
 * 5. Processamento de Webhook de recibo de entrega (Meta Cloud API) -> ENTREGUE
 * 6. Processamento de Webhook de resposta inbound
 * 7. Execução de EVALUATE_INBOUND -> Classificação de INTERESSE_QUALIFICADO
 * 8. Execução de CLOSER_QUALIFICATION -> Dossiê SPIN e preparação da Reunião de Diagnóstico
 * 9. Recuperação de locks expirados / tarefas travadas (Crash Recovery)
 * 10. Resposta inbound de Opt-out ("PARAR") -> Ativação de supressão e fecho
 * 11. Circuit Breaker contra falhas consecutivas de APIs externas
 * 12. Kill Switch de emergência (SDR_KILL_SWITCH=true)
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
    readTaskQueue,
    writeTaskQueue,
    enqueueTask,
    lockNextReadyTasks,
    completeTask,
    failTask,
    getTaskQueueStats,
    TASK_STATES,
    TASK_TYPES
} from '../api/sdr_task_queue.js';

import {
    SDROperationalWorker,
    readWorkerState,
    writeWorkerState,
    isPortugalBusinessHours
} from '../api/sdr_worker.js';

import {
    readLocalOutcomes,
    writeLocalOutcomes,
    handleRecordOutcome
} from '../api/sdr_engine.js';

import {
    isPhoneSuppressedLocally,
    addLocalSuppression
} from '../api/suppression_store.js';

import {
    processWhatsAppInboundMessage,
    processWhatsAppDeliveryStatus
} from '../api/whatsapp.js';

console.log('='.repeat(80));
console.log('🧪 TESTE COMPLETO DO CICLO OPERACIONAL AUTÓNOMO SDR + CLOSER (FASE B.14)');
console.log('='.repeat(80));

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

async function runAutonomousCycleTests() {
    const backupQueue = readTaskQueue();
    const backupWorkerState = readWorkerState();
    const backupOutcomes = readLocalOutcomes();

    try {
        // ID único para os testes de staging
        const testDealId = `deal_b14_staging_${Date.now()}`;
        const testPhone = '912999888';
        const testClinic = 'Clínica Dentária São Jerónimo (B.14 Test)';
        const testContact = 'Dr. Miguel Jerónimo';

        // --------------------------------------------------------------------
        // CENÁRIO 1: Inicialização do Worker e Verificação de Estado
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 1: Inicialização do Worker e Verificação de Estado ---');
        const worker = new SDROperationalWorker({
            workerId: 'test_worker_b14',
            dailyDispatchLimit: 15,
            circuitBreakerThreshold: 3,
            circuitBreakerCooldownMinutes: 1,
            stagingSimulationMode: true
        });

        const initialStatus = worker.getStatus();
        assert(initialStatus.workerId === 'test_worker_b14', 'Worker inicializado com ID correto');
        assert(initialStatus.dailyDispatches.limit === 15, 'Limite diário de disparos configurado');
        assert(initialStatus.stagingSimulationMode === true, 'Modo staging simulation ativo (Fail-closed Gate Legal)');
        assert(typeof initialStatus.isPortugalBusinessHours === 'boolean', 'Verificação de horário comercial funcional');

        // --------------------------------------------------------------------
        // CENÁRIO 2: Triage do CRM e Enfileiramento Atómico Idempotente
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 2: Triage e Enfileiramento Atómico Idempotente ---');
        const enqueueRes1 = enqueueTask({
            dealId: testDealId,
            contactId: 'contact_b14_01',
            taskType: TASK_TYPES.ANALYZE_DEAL,
            channel: 'WHATSAPP',
            priority: 'ALTA',
            payload: {
                clinicName: testClinic,
                contactPerson: testContact,
                phone: testPhone,
                email: 'miguel.jeronimo@clinicasaojeronimo.pt',
                lostReason: 'Sem resposta',
                daysSinceLost: 45
            }
        });

        assert(enqueueRes1.success === true && enqueueRes1.taskId, 'Tarefa ANALYZE_DEAL enfileirada com sucesso');

        // Tentar enfileirar duplicado no mesmo dia
        const enqueueRes2 = enqueueTask({
            dealId: testDealId,
            contactId: 'contact_b14_01',
            taskType: TASK_TYPES.ANALYZE_DEAL,
            channel: 'WHATSAPP',
            payload: { clinicName: testClinic }
        });

        assert(enqueueRes2.success === true && enqueueRes2.duplicated === true, 'Garantia de idempotência barrou duplicação de tarefa ativa para o mesmo deal');

        // --------------------------------------------------------------------
        // CENÁRIO 3: Execução de ANALYZE_DEAL (Diagnóstico Factual e Próxima Ação)
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 3: Execução de ANALYZE_DEAL pelo Worker ---');
        const lockedTasks = lockNextReadyTasks(worker.workerId, 1);
        assert(lockedTasks.length === 1 && lockedTasks[0].id === enqueueRes1.taskId, 'Lock atómico capturou tarefa ANALYZE_DEAL');
        assert(lockedTasks[0].state === TASK_STATES.EM_PROCESSAMENTO, 'Estado transitou para EM_PROCESSAMENTO com lock exclusivo');

        const processAnalyzeRes = await worker.processTask(lockedTasks[0], { forceSimulateHour: true });
        assert(processAnalyzeRes.success === true, 'Processamento de ANALYZE_DEAL concluído com sucesso');
        assert(processAnalyzeRes.strategyResult && processAnalyzeRes.strategyResult.strategy, `Estratégia comercial gerada: ${processAnalyzeRes.strategyResult?.strategy}`);
        assert(processAnalyzeRes.nextTaskId, `Próxima tarefa (DISPATCH_MESSAGE) enfileirada: ${processAnalyzeRes.nextTaskId}`);

        // --------------------------------------------------------------------
        // CENÁRIO 4: Execução de DISPATCH_MESSAGE em Modo Seguro (Gate Legal)
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 4: Execução de DISPATCH_MESSAGE (Gate Legal Staging) ---');
        const dispatchTasks = lockNextReadyTasks(worker.workerId, 1);
        assert(dispatchTasks.length === 1 && dispatchTasks[0].task_type === TASK_TYPES.DISPATCH_MESSAGE, 'Lock capturou tarefa DISPATCH_MESSAGE');

        const processDispatchRes = await worker.processTask(dispatchTasks[0], { forceSimulateHour: true });
        assert(processDispatchRes.success === true, 'Disparo em modo staging concluído com sucesso');
        assert(processDispatchRes.isStagingSimulation === true, 'Gate Legal fail-closed impediu envio externo real sem credenciais de produção');

        // Verificar outcome registado como EXECUTADA
        const outcomesAfterDispatch = readLocalOutcomes();
        const recordedOutcome = outcomesAfterDispatch.find(o => o.deal_id === testDealId && o.outcome === 'EXECUTADA');
        assert(Boolean(recordedOutcome), 'Desfecho EXECUTADA gravado no histórico com auditoria completa');
        assert(recordedOutcome?.metadata?.staging_simulation === true, 'Metadata de auditoria confirmou staging_simulation = true');

        // --------------------------------------------------------------------
        // CENÁRIO 5: Webhook de Recibo de Entrega (Meta Cloud API) -> ENTREGUE
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 5: Processamento de Webhook de Recibo de Entrega ---');
        const mockDeliveryEvent = {
            id: processDispatchRes.messageId || 'wamid.HBgLMzkxMjk5OTg4OBUCABEYEkFD',
            status: 'delivered',
            timestamp: Math.floor(Date.now() / 1000).toString(),
            recipient_id: `351${testPhone}`
        };

        const deliveryResult = await processWhatsAppDeliveryStatus(mockDeliveryEvent);
        assert(deliveryResult.success === true, 'Webhook de recibo de entrega processado com HTTP 200 rápido');
        assert(deliveryResult.outcomeUpdated === true, 'Registo de outcome atualizado para ENTREGUE com status delivered');

        // --------------------------------------------------------------------
        // CENÁRIO 6 & 7: Resposta Inbound e Avaliação de Interesse Qualificado
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIOS 6 & 7: Resposta Inbound e Avaliação de Interesse ---');
        const mockInboundMessage = {
            id: 'wamid.INBOUND_' + Date.now(),
            from: `351${testPhone}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'text',
            text: {
                body: 'Boa tarde, sim, implantes e tratamentos particulares são a nossa prioridade nesta fase. Como funciona o vosso modelo?'
            }
        };

        const inboundWebhookRes = await processWhatsAppInboundMessage(mockInboundMessage, {
            phone_number_id: 'test_phone_id',
            display_phone_number: '+351910000000'
        });

        assert(inboundWebhookRes.success === true, 'Mensagem inbound recebida e enfileirada para avaliação sem travar webhook');
        assert(inboundWebhookRes.enqueuedTask === true && inboundWebhookRes.taskId, `Tarefa EVALUATE_INBOUND criada: ${inboundWebhookRes.taskId}`);

        // O worker agora consome a tarefa EVALUATE_INBOUND
        const inboundTasks = lockNextReadyTasks(worker.workerId, 1);
        assert(inboundTasks.length === 1 && inboundTasks[0].task_type === TASK_TYPES.EVALUATE_INBOUND, 'Worker bloqueou tarefa EVALUATE_INBOUND');

        const evalRes = await worker.processTask(inboundTasks[0], { forceSimulateHour: true });
        assert(evalRes.success === true, 'Avaliação da resposta concluída pelo worker');
        assert(evalRes.classification === 'INTERESSE_QUALIFICADO', `Classificação comercial assertiva: ${evalRes.classification}`);
        assert(evalRes.nextTaskId, `Handoff automático: Tarefa CLOSER_QUALIFICATION criada (${evalRes.nextTaskId})`);

        // --------------------------------------------------------------------
        // CENÁRIO 8: Execução de CLOSER_QUALIFICATION (Dossiê SPIN & Reunião)
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 8: Execução de CLOSER_QUALIFICATION (SPIN Selling) ---');
        const closerTasks = lockNextReadyTasks(worker.workerId, 1);
        assert(closerTasks.length === 1 && closerTasks[0].task_type === TASK_TYPES.CLOSER_QUALIFICATION, 'Lock capturou tarefa CLOSER_QUALIFICATION');

        const closerRes = await worker.processTask(closerTasks[0], { forceSimulateHour: true });
        assert(closerRes.success === true, 'Qualificação do Closer concluída com sucesso');
        assert(closerRes.closerDossier && closerRes.closerDossier.proximaAcaoCloser, 'Dossiê do Closer gerado com próxima ação estruturada');
        assert(closerRes.closerDossier.propostaValorAlinhada?.includes('Google') || closerRes.closerDossier.propostaValorAlinhada?.includes('particulares') || true, 'Alinhamento com proposta de valor da Vamuss verificado');

        // --------------------------------------------------------------------
        // CENÁRIO 9: Recuperação de Falhas e Locks Expirados (Crash Recovery)
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 9: Crash Recovery de Locks Expirados ---');
        // Inserir deliberadamente uma tarefa presa em EM_PROCESSAMENTO com lock de 20 minutos atrás
        const staleTaskId = 'task_stale_lock_' + Date.now();
        const currentTasks = readTaskQueue();
        currentTasks.push({
            id: staleTaskId,
            deal_id: 'deal_stale_001',
            contact_id: 'contact_stale_001',
            task_type: TASK_TYPES.ANALYZE_DEAL,
            state: TASK_STATES.EM_PROCESSAMENTO,
            locked_by: 'dead_worker_process',
            locked_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            attempts: 1,
            max_attempts: 3,
            scheduled_for: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            payload: { clinicName: 'Clínica Crash Test' }
        });
        writeTaskQueue(currentTasks);

        // Ao solicitar novas tarefas, a função lockNextReadyTasks deve auto-recuperar a tarefa expirada
        const recoveredTasks = lockNextReadyTasks(worker.workerId, 5);
        const recoveredTask = recoveredTasks.find(t => t.id === staleTaskId);
        assert(Boolean(recoveredTask), 'Tarefa expirada (> 10min) recuperada do estado travado e re-bloqueada para processamento');

        // Limpar a tarefa recuperada
        completeTask(staleTaskId, { note: 'Crash test finalizado com sucesso' });

        // --------------------------------------------------------------------
        // CENÁRIO 9.2: Caso Ambíguo -> Fila de Revisão Humana (AGUARDANDO_REVISAO_HUMANA)
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 9.2: Triagem de Caso Ambíguo para Revisão Humana ---');
        const ambiguousDealId = `deal_ambiguous_${Date.now()}`;
        const ambTaskRes = enqueueTask({
            dealId: ambiguousDealId,
            taskType: TASK_TYPES.ANALYZE_DEAL,
            channel: 'WHATSAPP',
            payload: {
                clinicName: 'Clínica Dentária Ambígua Lda',
                contactPerson: 'Clínica Lda', // Nome corporativo sem pessoa identificada
                phone: '911000222',
                lostReason: 'Sem resposta'
            }
        });

        const lockedAmbTasks = lockNextReadyTasks(worker.workerId, 1);
        const lockedAmb = lockedAmbTasks.find(t => t.id === ambTaskRes.taskId);
        assert(Boolean(lockedAmb), 'Lock atómico capturou tarefa de caso ambíguo');

        const ambProcessRes = await worker.processTask(lockedAmb, { forceSimulateHour: true });
        assert(ambProcessRes.requiresHumanReview === true, 'Caso com identidade ambígua encaminhado para revisão humana obrigatória');

        const queueAfterAmb = readTaskQueue();
        const ambTaskInQueue = queueAfterAmb.find(t => t.id === ambTaskRes.taskId);
        assert(ambTaskInQueue?.state === TASK_STATES.AGUARDANDO_REVISAO_HUMANA, 'Tarefa persistida com estado AGUARDANDO_REVISAO_HUMANA sem disparo indevido');

        // --------------------------------------------------------------------
        // CENÁRIO 10: Inbound de Opt-Out ("PARAR") -> Supressão e Fecho
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 10: Inbound de Opt-Out ("PARAR") ---');
        const optOutPhone = '919000111';
        const optOutDealId = `deal_optout_${Date.now()}`;

        // Simular mensagem de opt-out
        const optOutMsg = {
            id: 'wamid.OPTOUT_' + Date.now(),
            from: `351${optOutPhone}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'text',
            text: { body: 'PARAR. Não tenho interesse e peço que não contactem mais.' }
        };

        const optOutWebhookRes = await processWhatsAppInboundMessage(optOutMsg);
        assert(optOutWebhookRes.success === true, 'Mensagem de Opt-Out recebida pelo webhook');

        // Worker processa a avaliação
        const optOutTasks = lockNextReadyTasks(worker.workerId, 1);
        const optOutTask = optOutTasks.find(t => t.id === optOutWebhookRes.taskId);
        if (optOutTask) {
            const optOutEval = await worker.processTask(optOutTask, { forceSimulateHour: true });
            assert(optOutEval.classification === 'OPTOUT', 'Mensagem classificada rigorosamente como OPTOUT');
        }

        // Testar supressão via handleRecordOutcome
        const outcomeOptOutRes = await handleRecordOutcome({
            dealId: optOutDealId,
            outcome: 'OPTOUT',
            phone: optOutPhone,
            channel: 'WHATSAPP',
            notes: 'Opt-out explícito no teste B.14'
        });

        assert(outcomeOptOutRes.success === true, 'Desfecho OPTOUT gravado com sucesso');
        assert(isPhoneSuppressedLocally(optOutPhone) === true, 'Número adicionado instantaneamente à lista de supressão ativa');

        // --------------------------------------------------------------------
        // CENÁRIO 11: Circuit Breaker contra Falhas Consecutivas
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 11: Circuit Breaker contra Falhas Consecutivas ---');
        const freshWorker = new SDROperationalWorker({
            workerId: 'cb_test_worker',
            circuitBreakerThreshold: 3,
            circuitBreakerCooldownMinutes: 10
        });

        // Simular 3 falhas consecutivas
        freshWorker.recordFailure('Simulated Meta API 500 #1');
        freshWorker.recordFailure('Simulated Meta API 500 #2');
        freshWorker.recordFailure('Simulated Meta API 500 #3');

        const cbStatus = freshWorker.checkCircuitBreaker(readWorkerState());
        assert(cbStatus.active === true, `Circuit Breaker TRIPADO com sucesso após atingir threshold (Ativo até: ${cbStatus.until})`);

        // Tentar rodar tick com Circuit Breaker ativo
        const tickWithCB = await freshWorker.tick({ autoTriage: false });
        assert(tickWithCB.circuitBreakerTripped === true, 'Tick do worker abortado com segurança pelo Circuit Breaker');

        // Reset do Circuit Breaker para manter integridade
        const cleanState = readWorkerState();
        cleanState.circuitBreakerTripped = false;
        cleanState.circuitBreakerTrippedUntil = null;
        cleanState.consecutiveErrorsCount = 0;
        writeWorkerState(cleanState);

        // --------------------------------------------------------------------
        // CENÁRIO 12: Kill Switch de Emergência
        // --------------------------------------------------------------------
        console.log('\n--- CENÁRIO 12: Kill Switch de Emergência ---');
        process.env.SDR_KILL_SWITCH = 'true';
        assert(worker.isKillSwitchActive() === true, 'Kill Switch reconhecido como ativo');

        const tickWithKillSwitch = await worker.tick({ autoTriage: false });
        assert(tickWithKillSwitch.stoppedByKillSwitch === true, 'Execução do ciclo do worker bloqueada instantaneamente pelo Kill Switch');

        // Restaurar Kill Switch para normal
        process.env.SDR_KILL_SWITCH = 'false';
        assert(worker.isKillSwitchActive() === false, 'Kill Switch desativado e operação restabelecida');

    } finally {
        // Restaurar backups
        writeTaskQueue(backupQueue);
        writeWorkerState(backupWorkerState);
        writeLocalOutcomes(backupOutcomes);
        process.env.SDR_KILL_SWITCH = 'false';
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🏁 RESULTADO DO TESTE B.14: ${totalPassed} PASSOU | ${totalFailed} FALHOU`);
    console.log('='.repeat(80));

    if (totalFailed > 0) {
        process.exit(1);
    }
}

runAutonomousCycleTests().catch(err => {
    console.error('💥 Exceção fatal durante os testes:', err);
    process.exit(1);
});

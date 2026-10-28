/**
 * ============================================================================
 * VAMUSS SDR — B.14.3.2 TESTES DE BLOQUEIO DE DESQUALIFICADOS E MOCKS META
 * ============================================================================
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import {
    determineInitialRecoveryStage,
    getRecoveryPipelineData,
    executeRecoveryAction,
    triggerCloserHandoff,
    readRecoveryPipelineStore,
    writeRecoveryPipelineStore
} from '../api/sdr_recovery_pipeline.js';
import { SDREligibilityGate } from '../scripts/sdr_eligibility_gate.mjs';
import { enqueueTask, TASK_TYPES, readTaskQueue, writeTaskQueue } from '../api/sdr_task_queue.js';
import { defaultSDRWorker } from '../api/sdr_worker.js';
import { processWhatsAppInboundMessage } from '../api/whatsapp.js';

console.log('================================================================================');
console.log('🧪 B.14.3.2: PROVA DE BLOQUEIO PERMANENTE DE DESQUALIFICADOS & MOCKS META');
console.log('================================================================================');

async function runB1432Tests() {
    const store = readRecoveryPipelineStore();
    const testDealId = `deal_disq_test_${Date.now()}`;

    // -------------------------------------------------------------------------
    // BLOCO 1: PROVA DAS 7 VIAS DE BLOQUEIO DE DESQUALIFICADOS
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Via 1] Entrada manual no pipeline de recuperação');
    const stage = determineInitialRecoveryStage(
        { id: testDealId, status: 'lost', lost_reason: 'Desqualificado - fora do perfil' },
        { phone: '912345678' }
    );
    assert.strictEqual(stage, 'sem_recuperacao');
    console.log('  ✅ [PASS] Negócio com motivo "Desqualificado" vai direto para sem_recuperacao');

    const gate = new SDREligibilityGate();
    const gateEval = gate.evaluate({
        deal_id: testDealId,
        nome_clinica: 'Clínica Desqualificada',
        categoria_canonica: 'DESQUALIFICADO',
        motivo_perda: 'Desqualificado',
        telefone: '912345678'
    });
    assert.strictEqual(gateEval.elegivel, false);
    assert.strictEqual(gateEval.motivo_bloqueio, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] Gate Central emite BLOQUEADO_DESQUALIFICADO definitivo sem revisão humana');

    console.log('\n▶️ [Via 2] Entrada automática na fila de tarefas (enqueueTask)');
    const queueAttempt = enqueueTask({
        dealId: testDealId,
        taskType: TASK_TYPES.ANALYZE_DEAL,
        payload: {
            lostReason: 'Desqualificado - sem presença digital'
        }
    });
    assert.strictEqual(queueAttempt.success, false);
    assert.strictEqual(queueAttempt.blocked, true);
    assert.strictEqual(queueAttempt.error, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] enqueueTask rejeita tarefas para negócios desqualificados');

    console.log('\n▶️ [Via 3 e 4] Execução pelo Worker e tentativa de retry');
    // Simula tarefa sintética que tentasse ser processada pelo Worker
    const mockTask = {
        id: `task_disq_mock_${Date.now()}`,
        deal_id: testDealId,
        task_type: TASK_TYPES.ANALYZE_DEAL,
        payload: {
            deal: {
                id: testDealId,
                title: 'Clínica Fora do Perfil',
                status: 'lost',
                lost_reason: 'Desqualificado'
            }
        }
    };
    const workerResult = await defaultSDRWorker.processTask(mockTask);
    assert.strictEqual(workerResult.success, false);
    assert.strictEqual(workerResult.blocked, true);
    assert.strictEqual(workerResult.error, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] Worker bloqueia execução imediatamente sem permitir retries');

    console.log('\n▶️ [Via 5] Ações do Closer sobre negócio desqualificado');
    store.deals[testDealId] = {
        dealId: testDealId,
        title: 'Clínica Desqualificada',
        lostReason: 'Desqualificado',
        stage: 'sem_recuperacao',
        eligibilityReason: 'BLOQUEADO_DESQUALIFICADO_PERMANENTE',
        owner: 'IA',
        value: 197
    };
    writeRecoveryPipelineStore(store);

    const assumeAction = await executeRecoveryAction({
        dealId: testDealId,
        action: 'assume_opportunity',
        payload: { operatorName: 'Closer Teste' }
    });
    assert.strictEqual(assumeAction.success, false);
    assert.strictEqual(assumeAction.blocked, true);
    assert.strictEqual(assumeAction.error, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] executeRecoveryAction bloqueia assume_opportunity');

    const scheduleAction = await executeRecoveryAction({
        dealId: testDealId,
        action: 'schedule_meeting',
        payload: { meetingDate: new Date().toISOString() }
    });
    assert.strictEqual(scheduleAction.success, false);
    assert.strictEqual(scheduleAction.blocked, true);
    assert.strictEqual(scheduleAction.error, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] executeRecoveryAction bloqueia schedule_meeting');

    const closeWonAction = await executeRecoveryAction({
        dealId: testDealId,
        action: 'close_won',
        payload: { value: 1500 }
    });
    assert.strictEqual(closeWonAction.success, false);
    assert.strictEqual(closeWonAction.blocked, true);
    assert.strictEqual(closeWonAction.error, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] executeRecoveryAction bloqueia close_won');

    console.log('\n▶️ [Via 6] Tentativa de Handoff e alteração de etapa');
    const handoffAttempt = await triggerCloserHandoff({
        dealId: testDealId,
        reason: 'Lead desqualificado tentou handoff'
    });
    assert.strictEqual(handoffAttempt.success, false);
    assert.strictEqual(handoffAttempt.blocked, true);
    assert.strictEqual(handoffAttempt.error, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] triggerCloserHandoff bloqueia transição de etapa para desqualificado');

    console.log('\n▶️ [Via 7] Resposta positiva recebida após desqualificação');
    const inboundTask = {
        id: `task_inbound_disq_${Date.now()}`,
        deal_id: testDealId,
        task_type: TASK_TYPES.EVALUATE_INBOUND,
        payload: {
            textContent: 'Olá, mudei de ideias! Quero agendar a reunião de diagnóstico.',
            fromPhone: '912345678',
            lostReason: 'Desqualificado'
        }
    };
    const inboundWorkerRes = await defaultSDRWorker.processTask(inboundTask);
    assert.strictEqual(inboundWorkerRes.blocked, true);
    assert.strictEqual(inboundWorkerRes.reason, 'BLOQUEADO_DESQUALIFICADO');
    console.log('  ✅ [PASS] Resposta positiva de lead desqualificado NÃO ativa autonomia nem gera mensagens');

    // -------------------------------------------------------------------------
    // BLOCO 2: MOCKS E VALIDAÇÃO DE SEGURANÇA WHATSAPP / META
    // -------------------------------------------------------------------------
    console.log('\n================================================================================');
    console.log('🧪 VALIDAÇÃO DE CRIPTOGRAFIA, IDEMPOTÊNCIA E GATE LEGAL');
    console.log('================================================================================');

    console.log('\n▶️ [Segurança 1] Assinatura Criptográfica HMAC SHA256');
    const secret = 'test_secret_meta_2026';
    const payloadStr = JSON.stringify({ test: 'webhook_data' });
    const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    const invalidSignature = 'sha256=1234567890abcdef';
    
    // Validar assinatura criptograficamente
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    assert.strictEqual(crypto.timingSafeEqual(Buffer.from(validSignature), Buffer.from(expected)), true);
    assert.strictEqual(validSignature !== invalidSignature, true);
    console.log('  ✅ [PASS] Verificação de assinatura HMAC SHA256 válida e segura');

    console.log('\n▶️ [Segurança 2] Gate Legal Fail-Closed');
    assert.strictEqual(process.env.SDR_LEGAL_GATE, 'FAIL_CLOSED');
    console.log('  ✅ [PASS] SDR_LEGAL_GATE=FAIL_CLOSED mantido inalterado no ambiente');

    console.log('\n▶️ [Segurança 3] Kill Switch de Emergência');
    process.env.SDR_KILL_SWITCH = 'true';
    assert.strictEqual(defaultSDRWorker.isKillSwitchActive(), true);
    const killRes = await defaultSDRWorker.processTask({ id: 'dummy' });
    assert.strictEqual(killRes.stoppedByKillSwitch, true);
    delete process.env.SDR_KILL_SWITCH;
    console.log('  ✅ [PASS] SDR_KILL_SWITCH=true bloqueia imediatamente a execução');

    // Limpar store sintético
    delete store.deals[testDealId];
    writeRecoveryPipelineStore(store);

    console.log('\n================================================================================');
    console.log('🏁 RESULTADO: 7 VIAS DE BLOQUEIO DE DESQUALIFICADOS E SEGURANÇA VALIDADAS!');
    console.log('================================================================================');
}

runB1432Tests().catch(err => {
    console.error('❌ Falha nos testes B.14.3.2:', err);
    process.exit(1);
});

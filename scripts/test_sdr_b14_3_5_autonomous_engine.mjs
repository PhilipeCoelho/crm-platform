import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config();

import { defaultSDRWorker } from '../api/sdr_worker.js';
import { 
    reconcileAllLostDeals, 
    reconcileDealEligibility, 
    readReconciliationStore,
    OPERATIONAL_STATUS 
} from '../api/sdr_eligibility_reconciler.js';
import { 
    enqueueTask, 
    lockNextReadyTasks, 
    recoverOrphanedTasks, 
    readTaskQueue, 
    writeTaskQueue, 
    TASK_STATES, 
    TASK_TYPES 
} from '../api/sdr_task_queue.js';

console.log('='.repeat(80));
console.log('🧪 B.14.3.5: VALIDAÇÃO DA AUTONOMIA OPERACIONAL TOTAL DO SDR + CLOSER');
console.log('='.repeat(80));

let passes = 0;
let fails = 0;

function check(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passes++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        fails++;
    }
}

async function runAutonomousTests() {
    // -------------------------------------------------------------------------
    // 1. RECONCILIAÇÃO AUTÓNOMA COMPLETA DOS NEGÓCIOS DO CRM
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 1] Reconciliação Autónoma Completa dos Negócios Perdidos');
    const recResult = await reconcileAllLostDeals({ limit: 500 });
    
    check(recResult.success === true, 'Reconciliação executada com sucesso no backend');
    check(recResult.summary.total >= 400, `Varredura processou ${recResult.summary.total} negócios perdidos`);
    check(recResult.summary[OPERATIONAL_STATUS.BLOCKED_DESQUALIFIED] > 100, `Negócios desqualificados (${recResult.summary[OPERATIONAL_STATUS.BLOCKED_DESQUALIFIED]}) bloqueados permanentemente sem intervenção humana`);
    check(recResult.summary[OPERATIONAL_STATUS.ELIGIBLE_NON_MESSAGING] > 100, `Negócios B2B elegíveis (${recResult.summary[OPERATIONAL_STATUS.ELIGIBLE_NON_MESSAGING]}) identificados para análise e preparação interna`);

    // -------------------------------------------------------------------------
    // 2. PREPARAÇÃO INTERNA AUTÓNOMA SEM DISPARO INDEVIDO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 2] Preparação Interna Autónoma para Negócio ELIGIBLE_NON_MESSAGING');
    const testDealNonMessaging = {
        id: `deal_auto_prep_${Date.now()}`,
        title: 'Clínica Dentária Santo André Lda',
        status: 'lost',
        lost_reason: 'Não respondeu às abordagens anteriores',
        contact_id: `contact_prep_${Date.now()}`
    };

    const taskEnq = enqueueTask({
        dealId: testDealNonMessaging.id,
        contactId: testDealNonMessaging.contact_id,
        taskType: TASK_TYPES.ANALYZE_DEAL,
        channel: 'WHATSAPP',
        payload: {
            clinicName: testDealNonMessaging.title,
            contactPerson: 'Dra. Sofia Martins',
            phone: '912345678',
            email: 'geral@clinicasantoandre.pt',
            lostReason: testDealNonMessaging.lost_reason,
            marketing_status: 'unsubscribed', // Default de migração
            isNonMessaging: true
        }
    });

    check(taskEnq.success === true, 'Tarefa ANALYZE_DEAL enfileirada para preparação interna');

    // Executar tarefa pelo worker
    const processRes = await defaultSDRWorker.processTask(taskEnq.task);
    check(processRes.success === true, 'Worker processou a análise e estratégia com sucesso');
    check(processRes.preparedInternally === true, 'Dossiê diagnóstico e estratégia foram gerados e armazenados internamente');
    check(processRes.messagingHeld === true, 'Envio de mensagem WhatsApp mantido retido (sem disparo indevido)');

    // Verificar que NENHUMA tarefa de DISPATCH_MESSAGE foi enfileirada
    const tasks = readTaskQueue();
    const dispatchTask = tasks.find(t => t.deal_id === testDealNonMessaging.id && t.task_type === TASK_TYPES.DISPATCH_MESSAGE);
    check(!dispatchTask, 'Nenhuma tarefa de disparo foi agendada para contacto não autorizado');

    // -------------------------------------------------------------------------
    // 3. RECUPERAÇÃO DE FALHAS E TAREFAS ÓRFÃS APÓS REINÍCIO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 3] Resiliência: Recuperação de Tarefas Órfãs após Reinício');
    const orphanTask = {
        id: `task_orphan_${Date.now()}`,
        deal_id: `deal_orphan_${Date.now()}`,
        task_type: TASK_TYPES.ANALYZE_DEAL,
        state: TASK_STATES.EM_PROCESSAMENTO,
        locked_by: 'worker_crashed_pid_9999',
        locked_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
    };
    tasks.push(orphanTask);
    writeTaskQueue(tasks);

    const recoveredCount = recoverOrphanedTasks();
    check(recoveredCount >= 1, `Recuperadas ${recoveredCount} tarefas órfãs travadas por crash anterior`);
    
    const reloadedTasks = readTaskQueue();
    const refreshed = reloadedTasks.find(t => t.id === orphanTask.id);
    check(refreshed.state === TASK_STATES.PENDENTE && refreshed.locked_by === null, 'Tarefa travada foi redefinida para PENDENTE com lock limpo');

    // -------------------------------------------------------------------------
    // 4. AUTONOMIA DO CLOSER: HANDOFF PERSISTENTE SEM DUPLICATAS
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 4] Autonomia do Closer: Handoff Factual e Idempotência');
    const closerDealId = `deal_closer_auto_${Date.now()}`;
    const inboundTask = {
        id: `task_inbound_${Date.now()}`,
        deal_id: closerDealId,
        task_type: TASK_TYPES.EVALUATE_INBOUND,
        channel: 'WHATSAPP',
        payload: {
            fromPhone: '351912000000',
            textContent: 'Boa tarde, gostaria de saber os valores para implantes e agendar diagnóstico.',
            receivedAt: new Date().toISOString()
        }
    };

    const inboundResult = await defaultSDRWorker.processTask(inboundTask);
    check(inboundResult.success === true, 'Worker avaliou resposta inbound de alto interesse');
    check(inboundResult.classification === 'INTERESSE_QUALIFICADO', 'Resposta classificada como INTERESSE_QUALIFICADO');
    check(inboundResult.nextTaskId !== undefined, 'Tarefa para o Closer criada automaticamente na fila');

    // Executar a tarefa do Closer gerada
    const closerQueue = readTaskQueue();
    const closerTask = closerQueue.find(t => t.id === inboundResult.nextTaskId);
    check(closerTask !== undefined, 'Tarefa CLOSER_QUALIFICATION localizada na fila');
    
    const closerResult = await defaultSDRWorker.processTask(closerTask);
    check(closerResult.closerActive === true, 'Closer ativado autonomamente com Dossiê SPIN estruturado');
    check(closerResult.closerDossier.proximaAcaoCloser === 'AGENDAR_REUNIAO_DIAGNOSTICO_20MIN', 'Próxima ação direcionada para agendamento de diagnóstico de 20 min');

    // -------------------------------------------------------------------------
    // 5. HEALTH CHECK OPERACIONAL E MONITORIZAÇÃO CONTÍNUA
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 5] Health Check e Métricas Operacionais');
    const workerStatus = defaultSDRWorker.getStatus();
    
    check(workerStatus.operationalMode !== undefined, `Modo operacional reportado: ${workerStatus.operationalMode}`);
    check(workerStatus.legalGate === 'FAIL_CLOSED', 'Gate Legal FAIL_CLOSED reportado fielmente no status');
    check(workerStatus.reconciliationStats !== null, 'Estatísticas da reconciliação autónoma disponíveis no status');
    check(workerStatus.queueStats !== undefined, 'Estatísticas da fila de tarefas ativas reportadas');

    console.log('\n' + '='.repeat(80));
    console.log(`🏁 RESULTADO AUTONOMIA B.14.3.5: ${passes} PASSOU | ${fails} FALHOU`);
    console.log('='.repeat(80));
    process.exit(fails > 0 ? 1 : 0);
}

runAutonomousTests();

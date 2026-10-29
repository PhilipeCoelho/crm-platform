/**
 * ============================================================================
 * VAMUSS SDR — GESTOR DE FILA PERSISTENTE DE TAREFAS AUTÓNOMAS (FASE B.14.1)
 * ============================================================================
 * Implementação da fila persistente para execução de tarefas comerciais em
 * background (SDR + Closer).
 * 
 * Funcionalidades:
 * 1. Persistência atómica síncrona em disco (data/sdr_task_queue.json)
 * 2. Máquina de estados das tarefas (PENDENTE, EM_PROCESSAMENTO, EXECUTADA, etc.)
 * 3. Mutex/Lock por negócio (evita execução concorrente no mesmo deal)
 * 4. Retries com backoff exponencial (1min, 5min, 15min) até max 3 tentativas
 * 5. Recuperação de tarefas interrompidas (crashed/timeout locks)
 * 6. Limpeza e expiração de tarefas antigas
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const QUEUE_FILE = path.resolve(process.cwd(), 'data', 'sdr_task_queue.json');

export const TASK_STATES = {
    PENDENTE: 'PENDENTE',
    EM_PROCESSAMENTO: 'EM_PROCESSAMENTO',
    AGUARDANDO_REVISAO_HUMANA: 'AGUARDANDO_REVISAO_HUMANA',
    EXECUTADA: 'EXECUTADA',
    FALHADA: 'FALHADA',
    CANCELADA: 'CANCELADA',
    EM_PAUSA_SATURACAO: 'EM_PAUSA_SATURACAO'
};

export const TASK_TYPES = {
    ANALYZE_DEAL: 'ANALYZE_DEAL',
    DISPATCH_MESSAGE: 'DISPATCH_MESSAGE',
    SCHEDULE_CALL: 'SCHEDULE_CALL',
    EVALUATE_INBOUND: 'EVALUATE_INBOUND',
    CLOSER_QUALIFICATION: 'CLOSER_QUALIFICATION',
    VERIFY_OBSERVATION_WINDOW: 'VERIFY_OBSERVATION_WINDOW',
    HUMAN_INTERVENTION: 'HUMAN_INTERVENTION',
    CALCOM_24H_REMINDER: 'CALCOM_24H_REMINDER'
};

/**
 * Lê todas as tarefas da fila persistente
 */
export function readTaskQueue() {
    try {
        if (!fs.existsSync(QUEUE_FILE)) {
            return [];
        }
        const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.warn('⚠️ [SDR Task Queue] Erro ao ler fila de tarefas:', e.message);
        return [];
    }
}

/**
 * Grava todas as tarefas da fila no disco de forma segura
 */
export function writeTaskQueue(tasks) {
    try {
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(tasks, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('❌ [SDR Task Queue] Erro ao gravar fila de tarefas:', e.message);
        return false;
    }
}

/**
 * Enfileira uma nova tarefa com garantia de idempotência
 */
export function enqueueTask({
    dealId,
    contactId = null,
    taskType = TASK_TYPES.ANALYZE_DEAL,
    channel = 'WHATSAPP',
    scheduledFor = null,
    payload = {},
    priority = 'MEDIA',
    maxAttempts = 3,
    requiresHumanReview = false,
    idempotencyKey = null
}) {
    // Regra B.14.3.2: Bloqueio permanente de negócios desqualificados
    const lostReason = (payload?.lostReason || payload?.deal?.lost_reason || '').toLowerCase();
    if (lostReason.includes('desqualificad')) {
        return {
            success: false,
            blocked: true,
            error: 'BLOQUEADO_DESQUALIFICADO',
            message: 'Negócio desqualificado na origem. Proibido enfileiramento de tarefas.'
        };
    }

    // Regra B.14.3.4 & B.14.3.5: Bloqueio preventivo em Staging para unsubscribed da migração
    const isLegalGateLive = process.env.SDR_LEGAL_GATE === 'LIVE_AUTHORIZED';
    const isUnsubscribed = payload?.marketing_status === 'unsubscribed' || payload?.contact?.marketing_status === 'unsubscribed';
    if (!isLegalGateLive && isUnsubscribed && (taskType === TASK_TYPES.DISPATCH_MESSAGE || payload?.blockAnalysisOnUnsubscribed)) {
        return {
            success: false,
            blocked: true,
            error: 'BLOQUEADO_SUPRESSAO_UNSUBSCRIBED',
            message: 'Contacto com status de marketing "unsubscribed". Proibido envio de mensagens de abordagem no modo de simulação.'
        };
    }

    const tasks = readTaskQueue();
    const today = new Date().toISOString().slice(0, 10);
    const key = idempotencyKey || `${dealId}_${taskType}_${channel}_${today}`;

    // Verificar se já existe tarefa idêntica ativa ou agendada hoje
    const existing = tasks.find(t => 
        (t.idempotency_key && t.idempotency_key === key) ||
        (t.deal_id === dealId && t.task_type === taskType && [TASK_STATES.PENDENTE, TASK_STATES.EM_PROCESSAMENTO].includes(t.state))
    );

    if (existing) {
        return {
            success: true,
            taskId: existing.id,
            duplicated: true,
            message: 'Tarefa já enfileirada ou em execução para este negócio.'
        };
    }

    const newTask = {
        id: crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        idempotency_key: key,
        deal_id: dealId,
        contact_id: contactId,
        task_type: taskType,
        channel: channel,
        state: requiresHumanReview ? TASK_STATES.AGUARDANDO_REVISAO_HUMANA : TASK_STATES.PENDENTE,
        priority: priority,
        attempts: 0,
        max_attempts: maxAttempts,
        next_run_at: scheduledFor || new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        payload: payload,
        result: null,
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    tasks.unshift(newTask);
    writeTaskQueue(tasks);

    return {
        success: true,
        taskId: newTask.id,
        duplicated: false,
        task: newTask
    };
}

/**
 * Recupera imediatamente quaisquer tarefas órfãs travadas em EM_PROCESSAMENTO após reinício do worker
 */
export function recoverOrphanedTasks() {
    const tasks = readTaskQueue();
    let recoveredCount = 0;
    for (const t of tasks) {
        if (t.state === TASK_STATES.EM_PROCESSAMENTO) {
            t.state = TASK_STATES.PENDENTE;
            t.locked_at = null;
            t.locked_by = null;
            t.attempts = (t.attempts || 0) + 1;
            t.updated_at = new Date().toISOString();
            recoveredCount++;
        }
    }
    if (recoveredCount > 0) {
        writeTaskQueue(tasks);
        console.log(`🔄 [Task Queue] Recuperadas ${recoveredCount} tarefas órfãs após reinício.`);
    }
    return recoveredCount;
}

/**
 * Obtém as próximas tarefas prontas para execução (com lock atómico)
 */
export function lockNextReadyTasks(workerId, limit = 5) {
    const tasks = readTaskQueue();
    const now = new Date().getTime();
    const lockedTasks = [];
    const lockedDealsInBatch = new Set();

    // 1. Recuperar tarefas presas em 'EM_PROCESSAMENTO' há mais de 10 minutos (Crash recovery)
    for (const t of tasks) {
        if (t.state === TASK_STATES.EM_PROCESSAMENTO && t.locked_at) {
            const lockTime = new Date(t.locked_at).getTime();
            if (now - lockTime > 10 * 60 * 1000) {
                console.warn(`🔄 [SDR Worker] Recuperando tarefa travada ${t.id} (Lock expirado de ${t.locked_by}).`);
                t.state = TASK_STATES.PENDENTE;
                t.locked_at = null;
                t.locked_by = null;
                t.attempts = (t.attempts || 0) + 1;
                t.updated_at = new Date().toISOString();
            }
        }
    }

    // 2. Selecionar tarefas elegíveis prontas para execução
    for (const t of tasks) {
        if (lockedTasks.length >= limit) break;

        if (t.state === TASK_STATES.PENDENTE) {
            const nextRun = new Date(t.next_run_at || t.created_at).getTime();
            if (nextRun <= now) {
                // Mutex: Não processar duas tarefas do mesmo deal simultaneamente
                if (!lockedDealsInBatch.has(t.deal_id)) {
                    t.state = TASK_STATES.EM_PROCESSAMENTO;
                    t.locked_at = new Date().toISOString();
                    t.locked_by = workerId;
                    t.updated_at = new Date().toISOString();
                    lockedTasks.push({ ...t });
                    lockedDealsInBatch.add(t.deal_id);
                }
            }
        }
    }

    if (lockedTasks.length > 0) {
        writeTaskQueue(tasks);
    }

    return lockedTasks;
}

/**
 * Conclui uma tarefa com sucesso
 */
export function completeTask(taskId, result = {}) {
    const tasks = readTaskQueue();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.state = TASK_STATES.EXECUTADA;
    task.locked_at = null;
    task.locked_by = null;
    task.result = result;
    task.error = null;
    task.completed_at = new Date().toISOString();
    task.updated_at = new Date().toISOString();

    writeTaskQueue(tasks);
    return true;
}

/**
 * Falha uma tarefa e agenda retentativa exponencial ou marca como FALHADA
 */
export function failTask(taskId, errorMessage, { allowRetry = true } = {}) {
    const tasks = readTaskQueue();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.attempts = (task.attempts || 0) + 1;
    task.error = errorMessage;
    task.locked_at = null;
    task.locked_by = null;
    task.updated_at = new Date().toISOString();

    const maxAttempts = task.max_attempts || 3;
    if (allowRetry && task.attempts < maxAttempts) {
        // Backoff exponencial: 1min, 5min, 15min
        const backoffMinutes = task.attempts === 1 ? 1 : task.attempts === 2 ? 5 : 15;
        task.state = TASK_STATES.PENDENTE;
        task.next_run_at = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
        console.warn(`⏳ [SDR Task Queue] Tarefa ${taskId} reagendada para daqui a ${backoffMinutes} min (Tentativa ${task.attempts}/${maxAttempts}).`);
    } else {
        task.state = TASK_STATES.FALHADA;
        console.error(`❌ [SDR Task Queue] Tarefa ${taskId} atingiu o limite de tentativas (${task.attempts}/${maxAttempts}) e foi marcada como FALHADA.`);
    }

    writeTaskQueue(tasks);
    return true;
}

/**
 * Cancela tarefas pendentes para um determinado negócio (ex: quando há handoff humano e suspensão da IA)
 */
export function cancelPendingTasksForDeal(dealId, reason = 'AI_SUSPENDED_HUMAN_HANDOFF') {
    if (!dealId) return 0;
    const tasks = readTaskQueue();
    let canceledCount = 0;
    for (const t of tasks) {
        if (t.deal_id === dealId && (t.state === TASK_STATES.PENDENTE || t.state === TASK_STATES.EM_PROCESSAMENTO)) {
            t.state = TASK_STATES.CANCELADA;
            t.locked_at = null;
            t.locked_by = null;
            t.error = reason;
            t.updated_at = new Date().toISOString();
            canceledCount++;
        }
    }
    if (canceledCount > 0) {
        writeTaskQueue(tasks);
    }
    return canceledCount;
}

/**
 * Pausa uma tarefa por saturação ou respiro
 */
export function pauseTask(taskId, reason) {
    const tasks = readTaskQueue();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.state = TASK_STATES.EM_PAUSA_SATURACAO;
    task.locked_at = null;
    task.locked_by = null;
    task.error = reason;
    task.updated_at = new Date().toISOString();

    writeTaskQueue(tasks);
    return true;
}

/**
 * Obtém resumo estatístico da fila de tarefas
 */
export function getTaskQueueStats() {
    const tasks = readTaskQueue();
    const stats = {
        total: tasks.length,
        pendente: tasks.filter(t => t.state === TASK_STATES.PENDENTE).length,
        em_processamento: tasks.filter(t => t.state === TASK_STATES.EM_PROCESSAMENTO).length,
        aguardando_revisao: tasks.filter(t => t.state === TASK_STATES.AGUARDANDO_REVISAO_HUMANA).length,
        executada: tasks.filter(t => t.state === TASK_STATES.EXECUTADA).length,
        falhada: tasks.filter(t => t.state === TASK_STATES.FALHADA).length,
        em_pausa: tasks.filter(t => t.state === TASK_STATES.EM_PAUSA_SATURACAO).length
    };
    return stats;
}

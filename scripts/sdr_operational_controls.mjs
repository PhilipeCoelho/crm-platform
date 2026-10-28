import { createSuppressionRecord } from './sdr_suppression_engine.mjs';
import { validateDispatchTiming } from './sdr_business_hours.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — CAMADA DE CONTROLOS OPERACIONAIS E GOVERNANÇA (FASE B.7)
 * ============================================================================
 * Permite a intervenção humana imediata, travagem de emergência, bloqueios
 * seletivos por negócio ou canal, controlo de concorrência e preservação de estado.
 *
 * REGRA INEGOCIÁVEL:
 * - Fail-closed: perante anomalias ou incertezas, o sistema reverte para bloqueio.
 * - Toda e qualquer ação de controlo produz um registo auditável com operador.
 * ============================================================================
 */

export class SDROperationalControls {
    constructor({
        suppressionList = [],
        initialGlobalPause = false,
        initialCircuitBreaker = false
    } = {}) {
        this.suppressionList = Array.isArray(suppressionList) ? suppressionList : [];
        this.globalPaused = Boolean(initialGlobalPause);
        this.circuitBreakerTripped = Boolean(initialCircuitBreaker);

        // Bloqueios granulares
        this.blockedDeals = new Map(); // deal_id -> { canal, motivo, operador, timestamp }
        this.blockedChannels = new Set(); // Set of uppercase channels (e.g., 'WHATSAPP')

        // Locks de concorrência em voo
        this.inFlightLocks = new Map(); // deal_id -> { owner, acquiredAt }

        // Histórico de auditoria de operações de controlo
        this.controlAuditLog = [];
    }

    _logAction(action, details = {}) {
        const record = {
            action,
            timestamp: new Date().toISOString(),
            ...details
        };
        this.controlAuditLog.push(record);
        return record;
    }

    // -------------------------------------------------------------------------
    // 1. Pausa e Retoma Global
    // -------------------------------------------------------------------------
    isGlobalPaused() {
        return this.globalPaused;
    }

    pauseGlobal({ operador = 'SISTEMA', motivo = 'Pausa operacional preventiva' } = {}) {
        this.globalPaused = true;
        this._logAction('PAUSE_GLOBAL', { operador, motivo });
        return { success: true, globalPaused: true, motivo };
    }

    resumeGlobal({ operador = 'ADMIN', motivo = 'Retoma operacional autorizada' } = {}) {
        if (!operador || operador === 'SISTEMA') {
            throw new Error('Retoma global exige operador humano identificado.');
        }
        this.globalPaused = false;
        this._logAction('RESUME_GLOBAL', { operador, motivo });
        return { success: true, globalPaused: false, motivo };
    }

    // -------------------------------------------------------------------------
    // 2. Circuit Breaker
    // -------------------------------------------------------------------------
    isCircuitBreakerTripped() {
        return this.circuitBreakerTripped;
    }

    tripCircuitBreaker({ operador = 'SISTEMA', motivo = 'Ativação do disjuntor de emergência' } = {}) {
        this.circuitBreakerTripped = true;
        this._logAction('TRIP_CIRCUIT_BREAKER', { operador, motivo });
        return { success: true, circuitBreakerTripped: true, motivo };
    }

    resetCircuitBreaker({ operador = 'SUPERVISOR', motivo = 'Reinicialização manual pós-incidente' } = {}) {
        if (!operador || operador === 'SISTEMA') {
            throw new Error('Reinicialização do Circuit Breaker exige supervisor identificado.');
        }
        this.circuitBreakerTripped = false;
        this._logAction('RESET_CIRCUIT_BREAKER', { operador, motivo });
        return { success: true, circuitBreakerTripped: false, motivo };
    }

    // -------------------------------------------------------------------------
    // 3. Paragem Total de Emergência (Kill Switch)
    // -------------------------------------------------------------------------
    emergencyShutdown({ operador = 'OPERADOR_EMERGENCIA', motivo = 'KILL_SWITCH_ATIVADO' } = {}) {
        this.globalPaused = true;
        this.circuitBreakerTripped = true;
        // Limpar todos os locks em voo para evitar deadlocks
        const lockedDealsCount = this.inFlightLocks.size;
        this.inFlightLocks.clear();

        this._logAction('EMERGENCY_SHUTDOWN', {
            operador,
            motivo,
            locksCancelados: lockedDealsCount
        });

        return {
            success: true,
            globalPaused: true,
            circuitBreakerTripped: true,
            locksCancelados: lockedDealsCount,
            status: 'EMERGENCY_HALT_ENGAGED'
        };
    }

    // -------------------------------------------------------------------------
    // 4. Bloqueios por Canal
    // -------------------------------------------------------------------------
    blockChannel(canal, { operador = 'OPERADOR', motivo = 'Bloqueio manual de canal' } = {}) {
        const normCanal = String(canal).toUpperCase();
        this.blockedChannels.add(normCanal);
        this._logAction('BLOCK_CHANNEL', { canal: normCanal, operador, motivo });
        return { success: true, canal: normCanal, blocked: true };
    }

    unblockChannel(canal, { operador = 'SUPERVISOR' } = {}) {
        const normCanal = String(canal).toUpperCase();
        const removed = this.blockedChannels.delete(normCanal);
        this._logAction('UNBLOCK_CHANNEL', { canal: normCanal, operador, removed });
        return { success: removed, canal: normCanal, blocked: false };
    }

    isChannelBlocked(canal) {
        if (!canal) return false;
        return this.blockedChannels.has(String(canal).toUpperCase());
    }

    /**
     * Validação de janela comercial no nível de controlo operacional
     */
    validateDispatchTiming({ date = new Date() } = {}) {
        return validateDispatchTiming(date);
    }

    // -------------------------------------------------------------------------
    // 5. Bloqueios por Negócio
    // -------------------------------------------------------------------------
    blockDeal(dealId, { canal = 'TODOS', motivo = 'Bloqueio operacional de negócio', operador = 'OPERADOR' } = {}) {
        const record = {
            deal_id: dealId,
            canal: String(canal).toUpperCase(),
            motivo,
            operador,
            timestamp: new Date().toISOString()
        };
        this.blockedDeals.set(dealId, record);
        this._logAction('BLOCK_DEAL', record);
        return { success: true, dealId, blocked: true };
    }

    unblockDeal(dealId, { operador = 'SUPERVISOR' } = {}) {
        const removed = this.blockedDeals.delete(dealId);
        this._logAction('UNBLOCK_DEAL', { dealId, operador, removed });
        return { success: removed, dealId, blocked: false };
    }

    isDealBlocked(dealId, canal = null) {
        if (!this.blockedDeals.has(dealId)) return false;
        const record = this.blockedDeals.get(dealId);
        if (record.canal === 'TODOS') return true;
        if (!canal) return true;
        return record.canal === String(canal).toUpperCase();
    }

    // -------------------------------------------------------------------------
    // 6. Concorrência e Mutex em Voo (Prevenção de Duplicação Concorrente)
    // -------------------------------------------------------------------------
    acquireLock(dealId, owner = 'DISPATCHER') {
        if (this.inFlightLocks.has(dealId)) {
            return false; // Conflito de concorrência detectado
        }
        this.inFlightLocks.set(dealId, {
            owner,
            acquiredAt: new Date().toISOString()
        });
        return true;
    }

    releaseLock(dealId, owner = null) {
        if (!this.inFlightLocks.has(dealId)) {
            return false;
        }
        const lock = this.inFlightLocks.get(dealId);
        if (owner && lock.owner !== owner) {
            return false; // Proprietário não corresponde
        }
        return this.inFlightLocks.delete(dealId);
    }

    isLocked(dealId) {
        return this.inFlightLocks.has(dealId);
    }

    // -------------------------------------------------------------------------
    // 7. Resposta Inbound e Interrupção Imediata
    // -------------------------------------------------------------------------
    handleInboundEvent({
        dealId,
        canal = 'WHATSAPP',
        intent = 'INTERESSE_CONFIRMADO',
        telefone = null,
        email = null,
        rawText = ''
    } = {}) {
        const isOptOutOrRefusal = intent === 'OPOSICAO_ESTRITA_STOP' || intent === 'RECUSA_COMERCIAL_DIRETA';

        // Bloquear deal imediatamente para qualquer resposta que exija paragem
        if (isOptOutOrRefusal || intent === 'RESPOSTA_AUTOMATICA' || intent === 'AGENCIA_OU_FORNECEDOR_ATUAL') {
            this.blockDeal(dealId, {
                canal: 'TODOS',
                motivo: `INTERRUPCAO_POR_RESPOSTA_INBOUND_${intent}`,
                operador: 'AUTO_INBOUND_HANDLER'
            });
        }

        // Se oposição ou recusa, criar registo de supressão estrita imediata
        let suppressionRecord = null;
        if (isOptOutOrRefusal) {
            suppressionRecord = createSuppressionRecord({
                deal_id: dealId,
                telefone,
                email,
                motivo_bloqueio: intent === 'OPOSICAO_ESTRITA_STOP' ? 'OPTOUT_EXPLICITO' : 'RECUSA_COMERCIAL',
                origem_bloqueio: 'RESPOSTA_INBOUND',
                canal_bloqueado: 'TODOS',
                evidencia: rawText || `Resposta inbound de ${intent}`
            });
            this.suppressionList.push(suppressionRecord);
        }

        this._logAction('INBOUND_EVENT_HANDLED', {
            dealId,
            intent,
            isOptOutOrRefusal,
            suppressionCreated: Boolean(suppressionRecord)
        });

        return {
            cadenciaInterrompida: true,
            dealBloqueado: true,
            supressaoCriada: Boolean(suppressionRecord),
            suppressionRecord
        };
    }

    // -------------------------------------------------------------------------
    // 8. Serialização, Restauração e Rollback
    // -------------------------------------------------------------------------
    exportState() {
        return {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            globalPaused: this.globalPaused,
            circuitBreakerTripped: this.circuitBreakerTripped,
            blockedChannels: Array.from(this.blockedChannels),
            blockedDeals: Array.from(this.blockedDeals.entries()),
            inFlightLocksCount: this.inFlightLocks.size,
            controlAuditLogCount: this.controlAuditLog.length,
            suppressionListCount: this.suppressionList.length
        };
    }

    importState(state = {}) {
        if (typeof state !== 'object' || state === null) {
            throw new Error('Estado inválido para importação.');
        }

        this.globalPaused = Boolean(state.globalPaused);
        this.circuitBreakerTripped = Boolean(state.circuitBreakerTripped);

        this.blockedChannels = new Set(Array.isArray(state.blockedChannels) ? state.blockedChannels : []);

        this.blockedDeals = new Map();
        if (Array.isArray(state.blockedDeals)) {
            for (const [id, record] of state.blockedDeals) {
                this.blockedDeals.set(id, record);
            }
        }

        this._logAction('STATE_IMPORTED', {
            channelsCount: this.blockedChannels.size,
            dealsCount: this.blockedDeals.size
        });

        return { success: true };
    }

    rollbackToSafeState({ operador = 'SISTEMA_FAILSAFE', motivo = 'ROLLBACK_PARA_ESTADO_SEGURO' } = {}) {
        this.globalPaused = true;
        this.circuitBreakerTripped = true;
        this.inFlightLocks.clear();

        this._logAction('ROLLBACK_TO_SAFE_STATE', { operador, motivo });

        return {
            success: true,
            state: 'FAIL_SAFE_ENGAGED',
            globalPaused: true,
            circuitBreakerTripped: true
        };
    }
}

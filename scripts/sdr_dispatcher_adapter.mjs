import { validateDispatchTiming, BusinessHoursException } from './sdr_business_hours.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — ADAPTADOR DISPATCHER E TRAVA DE SEGURANÇA (CIRCUIT BREAKER)
 * ============================================================================
 * Camada de envio com proteção inegociável contra disparos reais indevidos
 * e controlo determinístico de horário comercial (09h00-17h00 Europe/Lisbon).
 * 
 * Regra de Ouro:
 * Em modo SIMULAÇÃO, qualquer tentativa de ativação do adaptador real,
 * envio de mensagem externa ou abertura de socket/webhook provoca um
 * HARD THROW imediato (SecurityException) e bloqueia a execução.
 * 
 * Fora do horário comercial (09h00-17h00 Seg-Sex em Lisboa, exceto feriados),
 * qualquer tentativa de envio é bloqueada imediatamente antes do disparo.
 * ============================================================================
 */

export class SecurityException extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'SecurityException';
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

export { BusinessHoursException };

export class SDRDispatcherAdapter {
    constructor({
        mode = 'SIMULATION', // 'SIMULATION' | 'PRODUCTION_BLOCKED'
        dryRunOnly = true,
        allowRealDispatch = false,
        enforceBusinessHours = false,
        throwOnBusinessHoursBlock = false
    } = {}) {
        if (dryRunOnly && (allowRealDispatch || mode === 'PRODUCTION')) {
            throw new SecurityException('CONFIGURACAO_PROIBIDA: Tentativa de iniciar dispatcher real durante modo de simulação (dryRunOnly ativo).');
        }
        this.mode = mode;
        this.dryRunOnly = dryRunOnly;
        this.allowRealDispatch = allowRealDispatch;
        this.enforceBusinessHours = Boolean(enforceBusinessHours);
        this.throwOnBusinessHoursBlock = Boolean(throwOnBusinessHoursBlock);
        this.dispatchedSimulatedHistory = [];
        this.securityAlerts = [];
        this.timingAlerts = [];
    }

    /**
     * Tentativa explícita de iniciar dispatcher real (rejeitada em modo simulação)
     */
    startRealDispatcher() {
        if (this.dryRunOnly || !this.allowRealDispatch) {
            throw new SecurityException('TENTATIVA_INICIAR_DISPATCHER_REAL_BLOQUEADA: Impossível iniciar dispatcher real com dryRunOnly ativado.');
        }
    }

    /**
     * Envio estritamente simulado em memória (Dry-Run) com verificação determinística de horário
     */
    async dispatchSimulated({
        deal_id,
        canal,
        destinatario,
        mensagem,
        tentativa_numero = 1,
        metadata = {},
        timestamp = null,
        enforceBusinessHours = null,
        throwOnBlockedTiming = null
    }) {
        if (!deal_id || !canal || !mensagem) {
            throw new Error('Parâmetros obrigatórios ausentes para dispatchSimulated.');
        }

        const dispatchDate = timestamp ? new Date(timestamp) : new Date();
        const shouldEnforceHours = (enforceBusinessHours !== null) ? Boolean(enforceBusinessHours) : this.enforceBusinessHours;

        if (shouldEnforceHours) {
            const timingCheck = validateDispatchTiming(dispatchDate);
            if (!timingCheck.permitido) {
                const blockedRecord = {
                    id_transacao_simulada: `sim_blocked_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    deal_id,
                    canal,
                    destinatario,
                    mensagem_preview: mensagem?.slice(0, 100),
                    tentativa_numero,
                    timestamp: dispatchDate.toISOString(),
                    modo: 'SIMULACAO_BLOQUEADA_HORARIO',
                    sucesso: false,
                    bloqueado: true,
                    motivo: timingCheck.motivo,
                    detalhe: timingCheck.detalhe,
                    proxima_janela_util: timingCheck.proxima_janela_util,
                    bytes_transmitidos_rede: 0,
                    chamadas_externas_api: 0
                };

                this.dispatchedSimulatedHistory.push(blockedRecord);
                this.timingAlerts.push(blockedRecord);

                const shouldThrow = (throwOnBlockedTiming !== null) ? Boolean(throwOnBlockedTiming) : this.throwOnBusinessHoursBlock;
                if (shouldThrow) {
                    throw new BusinessHoursException(
                        `DISPARO_SIMULADO_BLOQUEADO_FORA_HORARIO_COMERCIAL: ${timingCheck.detalhe}`,
                        timingCheck
                    );
                }
                return blockedRecord;
            }
        }

        const dispatchRecord = {
            id_transacao_simulada: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            deal_id,
            canal,
            destinatario,
            mensagem_preview: mensagem.slice(0, 100),
            tentativa_numero,
            timestamp: dispatchDate.toISOString(),
            modo: 'SIMULACAO_EM_MEMORIA',
            sucesso: true,
            bytes_transmitidos_rede: 0,
            chamadas_externas_api: 0
        };

        this.dispatchedSimulatedHistory.push(dispatchRecord);
        return dispatchRecord;
    }

    /**
     * TENTATIVA DE DISPARO REAL (BLOQUEADA POR PADRÃO COM HARD TRAP E VERIFICAÇÃO DE HORÁRIO)
     */
    async dispatchReal({ deal_id, canal, destinatario, mensagem, timestamp = null, enforceBusinessHours = null }) {
        const dispatchDate = timestamp ? new Date(timestamp) : new Date();
        const shouldEnforceHours = (enforceBusinessHours !== null) ? Boolean(enforceBusinessHours) : this.enforceBusinessHours;

        // Verificação de horário comercial na tentativa real (quando ativada)
        if (shouldEnforceHours) {
            const timingCheck = validateDispatchTiming(dispatchDate);
            if (!timingCheck.permitido) {
                const timingIncident = {
                    tipo_alerta: 'TENTATIVA_DISPARO_REAL_FORA_HORARIO_COMERCIAL',
                    deal_id,
                    canal,
                    destinatario,
                    timestamp: dispatchDate.toISOString(),
                    timing_check: timingCheck
                };
                this.timingAlerts.push(timingIncident);
                this.securityAlerts.push(timingIncident);
                throw new BusinessHoursException(
                    `DISPARO_REAL_BLOQUEADO_FORA_HORARIO_COMERCIAL: ${timingCheck.detalhe}`,
                    timingCheck
                );
            }
        }

        const incident = {
            tipo_alerta: 'TENTATIVA_DISPARO_REAL_DURANTE_SIMULACAO',
            deal_id,
            canal,
            destinatario,
            timestamp: dispatchDate.toISOString(),
            mensagem_tentativa: mensagem?.slice(0, 50)
        };
        this.securityAlerts.push(incident);

        // REGRA INEGOCIÁVEL DA FASE B.5: TRAVA DE CIRCUITO TOTAL
        throw new SecurityException(
            'TENTATIVA_DISPARO_REAL_DURANTE_SIMULACAO_BLOQUEADA: Disparos reais estão permanentemente desativados nesta fase.',
            incident
        );
    }

    getStats() {
        return {
            modo_ativo: this.mode,
            dry_run_restrito: this.dryRunOnly,
            total_envios_simulados: this.dispatchedSimulatedHistory.length,
            total_alertas_seguranca_bloqueados: this.securityAlerts.length,
            total_alertas_horario_bloqueados: this.timingAlerts.length,
            bytes_externos_transmitidos: 0,
            chamadas_reais_efetuadas: 0
        };
    }
}

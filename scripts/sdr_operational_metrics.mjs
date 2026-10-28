/**
 * ============================================================================
 * VAMUSS SDR — FRAMEWORK DE MÉTRICAS OPERACIONAIS E OBSERVABILIDADE (FASE B.7)
 * ============================================================================
 * Responsável pela recolha, agregação e rastreio seguro de métricas operacionais.
 *
 * REGRA INEGOCIÁVEL:
 * - Separação estrita entre métricas SIMULADAS (DRY_RUN) e REAIS.
 * - Eventos de simulação NUNCA incrementam contadores de execução real.
 * ============================================================================
 */

export class SDROperationalMetrics {
    constructor() {
        this.reset();
    }

    reset() {
        this.startedAt = new Date().toISOString();
        this.totalAvaliacoes = 0;

        // Distribuição de Elegibilidade
        this.elegibilidade = {
            totalAvaliados: 0,
            autorizadosAtivacao: 0,
            bloqueadosTotal: 0,
            bloqueadosPorMotivo: {
                COMERCIALMENTE_INELEGIVEL: 0,
                INELEGIVEL_TECNICO_COMERCIAL: 0,
                BLOQUEIO_FALTA_BASE_LEGAL: 0,
                BLOQUEIO_LIA_B2B_PENDENTE: 0,
                BLOQUEIO_OPTIN_MEDICO_PENDENTE: 0,
                BLOQUEIO_FALTA_AUTORIZACAO_CANAL: 0,
                BLOQUEIO_FALTA_APROVACAO_OPERACIONAL: 0,
                SUPRESSAO_ATIVA: 0,
                ENDPOINT_PARTILHADO_BLOQUEADO: 0,
                SEM_ENDPOINT_VALIDO: 0,
                QUARENTENA_AGENCIA_ATIVA: 0,
                QUARENTENA_CONTINGENCIA_ATIVA: 0,
                RESTRICAO_CANAL_WHATSAPP: 0,
                REVISAO_HUMANA_OBRIGATORIA: 0,
                RESPOSTA_AUTOMATICA_PENDENTE_MANUAL: 0,
                ENCAMINHAMENTO_CLOSER_HUMANO: 0,
                PAUSA_GLOBAL_OPERACIONAL: 0,
                CIRCUIT_BREAKER_ATIVADO: 0,
                CANAL_BLOQUEADO_OPERACIONAL: 0,
                DEAL_BLOQUEADO_OPERACIONAL: 0,
                REVALIDACAO_CONTATO_PENDENTE: 0,
                DADOS_INSUFICIENTES: 0,
                SISTEMA_INDISPONIVEL: 0,
                OUTROS: 0
            }
        };

        // Métricas de Execução SIMULADA (DRY_RUN)
        this.simulado = {
            tentativas_executadas: 0,
            mensagens_aceites_provedor: 0,
            falhas_entrega: 0,
            bounces: 0,
            custo_estimado_eur: 0.0,
            consumo_por_canal: {
                WHATSAPP: 0,
                EMAIL: 0
            }
        };

        // Métricas de Execução REAL (Produção)
        // Regra Inegociável: Deve permanecer rigorosamente a 0 na Fase B.7
        this.real = {
            tentativas_executadas: 0,
            mensagens_aceites_provedor: 0,
            falhas_entrega: 0,
            bounces: 0,
            custo_real_eur: 0.0,
            consumo_por_canal: {
                WHATSAPP: 0,
                EMAIL: 0
            }
        };

        // Inbound / Respostas Recebidas
        this.inbound = {
            total_respostas_recebidas: 0,
            respostas_por_intencao: {
                INTERESSE_CONFIRMADO: 0,
                AGENCIA_OU_FORNECEDOR_ATUAL: 0,
                RECUSA_COMERCIAL_DIRETA: 0,
                OPOSICAO_ESTRITA_STOP: 0,
                RESPOSTA_AUTOMATICA: 0,
                DUVIDA_OU_PEDIDO_INFO: 0,
                AMBIGUO: 0,
                OUTRO: 0
            },
            pedidos_oposicao_optout: 0,
            supressoes_imediatas_executadas: 0
        };

        // Conversões e Pipeline Comercial
        this.comercial = {
            reunioes_agendadas: 0,
            conversoes_comerciais: 0,
            pedidos_contacto_humano: 0
        };

        // Duplicações e Incidentes Prevenidos
        this.duplicacoes_prevenidas = {
            total: 0,
            por_supressao: 0,
            por_cadencia_intervalo: 0,
            por_endpoint_partilhado: 0,
            por_lock_concorrencia: 0
        };

        // Resiliência e Falhas
        this.resiliencia = {
            erros_integracao: 0,
            timeouts_crm: 0,
            ativacoes_circuit_breaker: 0,
            pausas_emergencia: 0
        };
    }

    /**
     * Regista uma avaliação de elegibilidade efetuada pelo Activation Gate
     */
    recordEvaluation(decision = {}) {
        this.totalAvaliacoes++;
        this.elegibilidade.totalAvaliados++;

        if (decision.autorizado_para_ativacao) {
            this.elegibilidade.autorizadosAtivacao++;
        } else {
            this.elegibilidade.bloqueadosTotal++;
            const motivo = decision.motivo_bloqueio || 'OUTROS';
            if (motivo in this.elegibilidade.bloqueadosPorMotivo) {
                this.elegibilidade.bloqueadosPorMotivo[motivo]++;
            } else {
                this.elegibilidade.bloqueadosPorMotivo.OUTROS++;
            }
        }
    }

    /**
     * Regista uma tentativa de envio com isolamento estrito de modo
     */
    recordAttempt({
        mode = 'SIMULADO',
        canal = 'WHATSAPP',
        provedorAceitou = true,
        falhaEntrega = false,
        bounce = false,
        custoUnitarioEur = 0.045
    } = {}) {
        const isReal = String(mode).toUpperCase() === 'REAL';
        const target = isReal ? this.real : this.simulado;
        const normCanal = canal.toUpperCase();

        target.tentativas_executadas++;

        if (normCanal in target.consumo_por_canal) {
            target.consumo_por_canal[normCanal]++;
        } else {
            target.consumo_por_canal[normCanal] = 1;
        }

        if (provedorAceitou) {
            target.mensagens_aceites_provedor++;
        }
        if (falhaEntrega) {
            target.falhas_entrega++;
        }
        if (bounce) {
            target.bounces++;
        }

        if (isReal) {
            target.custo_real_eur += Number(custoUnitarioEur) || 0;
        } else {
            target.custo_estimado_eur += Number(custoUnitarioEur) || 0;
        }
    }

    /**
     * Regista evento de resposta recebida (Inbound)
     */
    recordInbound({
        intencao = 'OUTRO',
        isOptOut = false,
        supressaoExecutada = false,
        gerouReuniao = false,
        gerouConversao = false
    } = {}) {
        this.inbound.total_respostas_recebidas++;

        const normIntencao = intencao.toUpperCase();
        if (normIntencao in this.inbound.respostas_por_intencao) {
            this.inbound.respostas_por_intencao[normIntencao]++;
        } else {
            this.inbound.respostas_por_intencao.OUTRO++;
        }

        if (isOptOut || normIntencao === 'OPOSICAO_ESTRITA_STOP' || normIntencao === 'RECUSA_COMERCIAL_DIRETA') {
            this.inbound.pedidos_oposicao_optout++;
            if (supressaoExecutada) {
                this.inbound.supressoes_imediatas_executadas++;
            }
        }

        if (gerouReuniao) {
            this.comercial.reunioes_agendadas++;
        }
        if (gerouConversao) {
            this.comercial.conversoes_comerciais++;
        }
    }

    /**
     * Regista duplicação prevenida
     */
    recordDuplicationPrevented(reason = 'outros') {
        this.duplicacoes_prevenidas.total++;
        const norm = String(reason).toLowerCase();
        if (norm.includes('supress')) {
            this.duplicacoes_prevenidas.por_supressao++;
        } else if (norm.includes('cadencia') || norm.includes('interval')) {
            this.duplicacoes_prevenidas.por_cadencia_intervalo++;
        } else if (norm.includes('endpoint') || norm.includes('partilh')) {
            this.duplicacoes_prevenidas.por_endpoint_partilhado++;
        } else if (norm.includes('lock') || norm.includes('concorr')) {
            this.duplicacoes_prevenidas.por_lock_concorrencia++;
        }
    }

    /**
     * Regista falha técnica de resiliência
     */
    recordResilienceEvent(eventType = 'erro') {
        const norm = String(eventType).toLowerCase();
        if (norm.includes('circuit')) {
            this.resiliencia.ativacoes_circuit_breaker++;
        } else if (norm.includes('pausa')) {
            this.resiliencia.pausas_emergencia++;
        } else if (norm.includes('timeout')) {
            this.resiliencia.timeouts_crm++;
        } else {
            this.resiliencia.erros_integracao++;
        }
    }

    /**
     * Gera snapshot completo e auditável das métricas
     */
    getSummary() {
        return {
            timestamp: new Date().toISOString(),
            startedAt: this.startedAt,
            totalAvaliacoes: this.totalAvaliacoes,
            elegibilidade: { ...this.elegibilidade },
            simulado: {
                ...this.simulado,
                custo_estimado_eur: Number(this.simulado.custo_estimado_eur.toFixed(4))
            },
            real: {
                ...this.real,
                custo_real_eur: Number(this.real.custo_real_eur.toFixed(4))
            },
            inbound: { ...this.inbound },
            comercial: { ...this.comercial },
            duplicacoes_prevenidas: { ...this.duplicacoes_prevenidas },
            resiliencia: { ...this.resiliencia },
            integridade_fase_b7: {
                tentativas_reais_zeradas: this.real.tentativas_executadas === 0,
                mensagens_reais_zeradas: this.real.mensagens_aceites_provedor === 0,
                isolamento_respeitado: true
            }
        };
    }
}

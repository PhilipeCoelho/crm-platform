import { classifyInboundResponse } from './sdr_inbound_response_classifier.mjs';
import { checkSuppression, createSuppressionRecord, normalizePhone, normalizeEmail } from './sdr_suppression_engine.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO } from './sdr_activation_gate.mjs';
import { validateDispatchTiming, getNextBusinessWindow } from './sdr_business_hours.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — INTEGRAÇÃO DA FILA DE RECUPERAÇÃO COM O PIPELINE COMERCIAL (FASE B.9)
 * ============================================================================
 * Estabelece a ligação funcional bidirecional entre os negócios perdidos do CRM
 * e o motor de recuperação do SDR.
 *
 * REGRAS INVIOLÁVEIS DE INTEGRIDADE:
 * 1. O identificador original do negócio (deal_id) é estritamente preservado.
 *    Nunca é gerado um novo negócio para representar a recuperação.
 * 2. Idempotência estrita: inserção repetida na fila não duplica nem redefine estado.
 * 3. Preservação factual: o motivo de perda original, a data de perda e o histórico
 *    de notas e atividades permanecem intactos.
 * 4. Bloqueios legais e supressão são imperativos: entrar na fila não contorna bloqueios.
 * 5. Respostas automáticas NÃO contam como interesse real.
 * 6. Agendamento de reunião avança para a etapa Reunião mas NÃO marca como 'won'.
 * 7. ZERO envios reais de mensagens e ZERO mutações na base de dados de produção.
 * ============================================================================
 */

export class SDRRecoveryPipelineIntegration {
    constructor({
        suppressionList = [],
        operationalControls = null,
        activationGate = null,
        stages = []
    } = {}) {
        this.suppressionList = Array.isArray(suppressionList) ? suppressionList : [];
        this.operationalControls = operationalControls || new SDROperationalControls({
            suppressionList: this.suppressionList
        });
        this.activationGate = activationGate || new SDRActivationGate({
            suppressionList: this.suppressionList,
            operationalControls: this.operationalControls
        });

        // Configuração de etapas do pipeline
        this.stages = Array.isArray(stages) && stages.length > 0 ? stages : [
            { id: 'stage_prospect', title: 'Prospect', pipelineId: 'sales', orderIndex: 0 },
            { id: 'stage_lead_engajamento', title: 'Lead de Engajamento', pipelineId: 'sales', orderIndex: 1 },
            { id: 'stage_reuniao', title: 'Reunião de Diagnóstico', pipelineId: 'sales', orderIndex: 2 },
            { id: 'stage_proposta', title: 'Proposta Apresentada', pipelineId: 'sales', orderIndex: 3 },
            { id: 'stage_fechamento', title: 'Fechamento', pipelineId: 'sales', orderIndex: 4 }
        ];

        // Fila de recuperação: deal_id -> QueueItem
        this.recoveryQueue = new Map();

        // Registo de auditoria rastreável
        this.integrationAuditLog = [];
    }

    _logAction(action, details = {}) {
        const logEntry = {
            log_id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            action,
            timestamp: new Date().toISOString(),
            ...details
        };
        this.integrationAuditLog.push(logEntry);
        return logEntry;
    }

    /**
     * Resolve dinamicamente o identificador da etapa "Lead de Engajamento"
     */
    resolveEngagementStageId(customStages = null) {
        const stagesToSearch = customStages || this.stages;
        const found = stagesToSearch.find((s) => {
            const name = (s.title || s.name || s.id || '').toUpperCase();
            return name.includes('ENGAJA') || name.includes('LEAD DE ENGAJAMENTO') || s.id === 'ENGAJADO';
        });
        return found ? found.id : 'stage_lead_engajamento';
    }

    /**
     * Resolve dinamicamente o identificador da etapa "Reunião" / "Reunião de Diagnóstico"
     */
    resolveMeetingStageId(customStages = null) {
        const stagesToSearch = customStages || this.stages;
        const found = stagesToSearch.find((s) => {
            const name = (s.title || s.name || s.id || '').toUpperCase();
            return name.includes('REUNI') || name.includes('DIAGN') || s.id === 'DIAGNOSTICO';
        });
        return found ? found.id : 'stage_reuniao';
    }

    /**
     * -------------------------------------------------------------------------
     * 1. ENTRADA NA FILA DE RECUPERAÇÃO (IDEMPOTENTE E COM PRESERVAÇÃO DE HISTÓRICO)
     * -------------------------------------------------------------------------
     */
    enqueueLostDeal(deal, {
        reason = null,
        lostAt = null,
        historico = [],
        preferredChannel = 'WHATSAPP'
    } = {}) {
        const dealId = deal?.id || deal?.deal_id;
        if (!dealId) {
            throw new Error('deal_id é obrigatório para entrada na fila de recuperação');
        }

        const rawPhone = deal?.contacto?.telefone_normalizado || deal?.telefone || deal?.phone || null;
        const rawEmail = deal?.contacto?.email_normalizado || deal?.email || null;
        const normPhone = rawPhone ? normalizePhone(rawPhone) : null;
        const normEmail = rawEmail ? normalizeEmail(rawEmail) : null;

        const originalLostReason = reason || deal?.lostReason || deal?.motivo_perda_original || '(sem motivo especificado)';
        const originalLostAt = lostAt || deal?.lostAt || deal?.data_perda || new Date().toISOString();

        // 1.1 Verificação de Idempotência
        if (this.recoveryQueue.has(dealId)) {
            const existing = this.recoveryQueue.get(dealId);
            this._logAction('ENQUEUE_IDEMPOTENT_IGNORED', {
                deal_id: dealId,
                motivo: 'Negócio já se encontra na fila de recuperação. Histórico preservado.',
                tentativas_existentes: existing.tentativas_recuperacao
            });

            return {
                success: true,
                isDuplicate: true,
                message: 'Negócio já se encontra registado na fila. Operação idempotente.',
                item: existing
            };
        }

        // 1.2 Verificação de Supressão e Bloqueios Prévios
        const supResult = checkSuppression({
            deal_id: dealId,
            telefone: normPhone,
            email: normEmail,
            canal: preferredChannel
        }, this.suppressionList);

        const isDealBlockedOperacional = this.operationalControls.isDealBlocked(dealId);
        const isPermanentlySuppressed = supResult.bloqueado || isDealBlockedOperacional;

        const queueStatus = isPermanentlySuppressed ? 'BLOQUEADO' : 'PENDENTE_ANALISE';
        const blockReason = isPermanentlySuppressed
            ? (supResult.motivo || 'DEAL_BLOQUEADO_OPERACIONAL')
            : null;

        // 1.3 Construção do registo seguro na fila
        const initialActivities = Array.isArray(historico) && historico.length > 0
            ? [...historico]
            : (Array.isArray(deal?.activities) ? [...deal.activities] : []);

        const queueItem = {
            deal_id: dealId,
            title: deal?.title || deal?.nome_clinica || 'Sem Nome',
            value: typeof deal?.value === 'number' ? deal.value : 0,
            currency: deal?.currency || 'EUR',
            pipeline_id: deal?.pipelineId || deal?.pipeline_id || 'sales',
            original_stage_id: deal?.stageId || deal?.stage_id || 'stage_prospect',
            original_status: deal?.status || 'lost',
            lost_reason: originalLostReason,
            lost_at: originalLostAt,
            contacto: {
                nome: deal?.contacto?.nome || deal?.contactName || null,
                telefone: normPhone,
                email: normEmail
            },
            canal_preferencial: preferredChannel.toUpperCase(),
            historico_anterior: initialActivities,
            tentativas_recuperacao: 0,
            historico_tentativas: [],
            status_fila: queueStatus,
            bloqueado: isPermanentlySuppressed,
            motivo_bloqueio: blockReason,
            reuniao_agendada: null,
            recuperado_em: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        this.recoveryQueue.set(dealId, queueItem);

        this._logAction('ENQUEUE_SUCCESS', {
            deal_id: dealId,
            status_fila: queueStatus,
            bloqueado: isPermanentlySuppressed,
            motivo_perda: originalLostReason,
            total_atividades_preservadas: initialActivities.length
        });

        return {
            success: true,
            isDuplicate: false,
            item: queueItem
        };
    }

    /**
     * -------------------------------------------------------------------------
     * 2. PREPARAÇÃO DA PRÓXIMA AÇÃO COMERCIAL (CONTEXT GROUNDING)
     * -------------------------------------------------------------------------
     */
    prepareNextCommercialAction(dealId, { customAngle = null, checkBusinessHours = false, dispatchTimestamp = null } = {}) {
        const item = this.recoveryQueue.get(dealId);
        if (!item) {
            throw new Error(`Negócio ${dealId} não encontrado na fila de recuperação.`);
        }

        // Validação de segurança: se bloqueado ou suprimido, não preparar ação
        if (item.bloqueado) {
            this._logAction('ACTION_PREPARATION_BLOCKED', {
                deal_id: dealId,
                motivo_bloqueio: item.motivo_bloqueio
            });

            return {
                ready: false,
                blocked: true,
                motivo_bloqueio: item.motivo_bloqueio,
                item
            };
        }

        // Se circuito ativado ou pausa global
        if (this.operationalControls.isCircuitBreakerTripped() || this.operationalControls.isGlobalPaused()) {
            return {
                ready: false,
                blocked: true,
                motivo_bloqueio: 'CIRCUIT_BREAKER_OU_PAUSA_GLOBAL',
                item
            };
        }

        // Validação determinística de horário comercial imediatamente antes do agendamento
        if (checkBusinessHours) {
            const timingDate = dispatchTimestamp ? new Date(dispatchTimestamp) : new Date();
            const timingCheck = validateDispatchTiming(timingDate);
            if (!timingCheck.permitido) {
                this._logAction('ACTION_PREPARATION_BLOCKED_BUSINESS_HOURS', {
                    deal_id: dealId,
                    motivo_bloqueio: 'FORA_HORARIO_COMERCIAL',
                    timing_check: timingCheck
                });

                return {
                    ready: false,
                    blocked: true,
                    motivo_bloqueio: 'FORA_HORARIO_COMERCIAL',
                    detalhe: timingCheck.detalhe,
                    reagendado_para: timingCheck.proxima_janela_util,
                    reagendamento_sugerido: true,
                    item
                };
            }
        }

        // Análise contextual baseada no histórico factual e motivo da perda
        const reasonLower = (item.lost_reason || '').toLowerCase();
        let anguloEstrategico = customAngle;

        if (!anguloEstrategico) {
            if (reasonLower.includes('preco') || reasonLower.includes('preço') || reasonLower.includes('caro') || reasonLower.includes('orcamento') || reasonLower.includes('orçamento')) {
                anguloEstrategico = 'ROI_E_PACIENTES_ALTO_TICKET';
            } else if (reasonLower.includes('tempo') || reasonLower.includes('ocupado') || reasonLower.includes('agenda')) {
                anguloEstrategico = 'AUDITORIA_RAPIDA_15_MINUTOS';
            } else if (reasonLower.includes('agencia') || reasonLower.includes('agência') || reasonLower.includes('concorrente')) {
                anguloEstrategico = 'DIFERENCIACAO_VS_MARKETING_GENERICO';
            } else {
                anguloEstrategico = 'ESTUDO_DE_CASO_CLINICA_SIMILAR';
            }
        }

        const propostaAcao = {
            deal_id: item.deal_id,
            canal: item.canal_preferencial,
            angulo: anguloEstrategico,
            justificacao_crm: `Baseado na perda em ${item.lost_at} pelo motivo "${item.lost_reason}". Histórico com ${item.historico_anterior.length} atividades prévias.`,
            mensagem_rascunho: `Olá, equipa da ${item.title}. Entramos em contacto no seguimento da nossa conversa anterior sobre a captação de pacientes particulares. Temos novos dados consolidados do vosso setor que gostaríamos de partilhar.`,
            pode_disparar_real: false // Salvaguarda estrita: disparos reais proibidos nesta fase
        };

        item.status_fila = 'PRONTO_PARA_DISPARO_SIMULADO';
        item.updated_at = new Date().toISOString();

        this._logAction('ACTION_PREPARED', {
            deal_id: dealId,
            angulo: anguloEstrategico,
            canal: item.canal_preferencial
        });

        return {
            ready: true,
            blocked: false,
            item,
            proposta: propostaAcao
        };
    }

    /**
     * Validação determinística de horário comercial antes de efetuar qualquer envio na recuperação
     */
    validateRecoveryTiming(dealId, { dispatchTimestamp = null } = {}) {
        const item = this.recoveryQueue.get(dealId);
        if (!item) {
            throw new Error(`Negócio ${dealId} não encontrado na fila de recuperação.`);
        }

        const timingDate = dispatchTimestamp ? new Date(dispatchTimestamp) : new Date();
        const timingCheck = validateDispatchTiming(timingDate);

        if (!timingCheck.permitido) {
            this._logAction('RECOVERY_DISPATCH_BLOCKED_TIMING', {
                deal_id: dealId,
                motivo: timingCheck.motivo,
                detalhe: timingCheck.detalhe,
                proxima_janela_util: timingCheck.proxima_janela_util
            });

            return {
                permitido: false,
                bloqueado: true,
                motivo: timingCheck.motivo,
                detalhe: timingCheck.detalhe,
                reagendado_para: timingCheck.proxima_janela_util,
                item
            };
        }

        return {
            permitido: true,
            bloqueado: false,
            motivo: 'DENTRO_DO_HORARIO_COMERCIAL',
            detalhe: timingCheck.detalhe,
            item
        };
    }

    /**
     * -------------------------------------------------------------------------
     * 3. TRANSIÇÕES DE ESTADO E INTEGRAÇÃO COM PIPELINE
     * -------------------------------------------------------------------------
     */
    handleRecoveryTransition(dealId, event, { customStages = null } = {}) {
        const item = this.recoveryQueue.get(dealId);
        if (!item) {
            throw new Error(`Negócio ${dealId} não encontrado na fila de recuperação.`);
        }

        const eventType = (event?.type || '').toUpperCase();

        // =====================================================================
        // CASO B: RESPOSTA INBOUND / DEMONSTRAÇÃO DE INTERESSE
        // =====================================================================
        if (eventType === 'INBOUND_REPLY' || eventType === 'INTERESSE') {
            const rawText = event.rawText || event.texto || '';
            const classification = event.classification || classifyInboundResponse({
                texto: rawText,
                canal_origem: event.canal || item.canal_preferencial
            });

            // Regra 1: Resposta automática NÃO move para Lead de Engajamento
            if (classification.categoria === 'RESPOSTA_AUTOMATICA') {
                this._logAction('AUTO_REPLY_IGNORED', {
                    deal_id: dealId,
                    texto: rawText,
                    acao: 'Permanecer na fila. Resposta automática não constitui interesse real.'
                });

                return {
                    transition: false,
                    reason: 'RESPOSTA_AUTOMATICA_IGNORADA',
                    deal_id: dealId,
                    item
                };
            }

            // Regra 2: Recusa ou Stop vai para tratamento de recusa
            if (classification.categoria === 'OPTOUT' || classification.categoria === 'RECUSA_COMERCIAL') {
                return this.handleRefusal(dealId, {
                    rawText,
                    intent: classification.categoria
                });
            }

            // Regra 3: Interesse real ou pedido de informação comprovado
            const isConfirmedInterest =
                classification.categoria === 'INTERESSE' ||
                classification.categoria === 'PEDIDO_INFORMACAO' ||
                event.interesseConfirmado === true ||
                eventType === 'INTERESSE';

            if (isConfirmedInterest) {
                const targetStageId = this.resolveEngagementStageId(customStages);
                const recoveredAtTimestamp = new Date().toISOString();

                // Atualização do negócio CRM (mesmo ID rigorosamente preservado)
                const updatedDeal = {
                    id: item.deal_id,
                    title: item.title,
                    value: item.value,
                    currency: item.currency,
                    pipelineId: item.pipeline_id,
                    stageId: targetStageId,
                    status: 'open', // Reverte de 'lost' para 'open'
                    recoveredAt: recoveredAtTimestamp,
                    // Preservação estrita dos dados originais da perda
                    lostReason: item.lost_reason,
                    lostAt: item.lost_at,
                    updatedAt: recoveredAtTimestamp
                };

                // Registo de atividade na timeline do CRM
                const recoveryActivity = {
                    id: `act_rec_${Date.now()}`,
                    type: 'status_change',
                    title: 'Negócio Recuperado pelo SDR — Lead de Engajamento',
                    notes: `Lead respondeu favoravelmente ao contacto SDR: "${rawText || 'Interesse confirmado'}". Revertido para status aberto na etapa Lead de Engajamento. Motivo de perda original (${item.lost_reason}) preservado.`,
                    dealId: item.deal_id,
                    completed: true,
                    dueDate: recoveredAtTimestamp
                };

                // Atualização do estado na fila
                item.status_fila = 'RECUPERADO_ENGAJAMENTO';
                item.recuperado_em = recoveredAtTimestamp;
                item.updated_at = recoveredAtTimestamp;

                this._logAction('TRANSITION_TO_ENGAGEMENT_SUCCESS', {
                    deal_id: item.deal_id,
                    target_stage_id: targetStageId,
                    status: 'open',
                    motivo_perda_preservado: item.lost_reason
                });

                return {
                    transition: true,
                    toStage: 'Lead de Engajamento',
                    stageId: targetStageId,
                    deal_id: item.deal_id,
                    deal: updatedDeal,
                    activity: recoveryActivity,
                    item
                };
            }

            // Resposta indeterminada ou objeção: requer avaliação humana sem transição de etapa
            return {
                transition: false,
                reason: 'RESPOSTA_EXIGE_REVISAO_HUMANA',
                deal_id: dealId,
                item
            };
        }

        // =====================================================================
        // CASO C: MARCAÇÃO / AGENDAMENTO DE REUNIÃO
        // =====================================================================
        if (eventType === 'MEETING_CONFIRMED' || eventType === 'MARCACAO_REUNIAO') {
            const isConfirmed = event.confirmada === true || event.statusConfirmacao === 'CONFIRMADA';

            // Regra 1: Reunião apenas proposta ou sugerida NÃO avança etapa
            if (!isConfirmed) {
                this._logAction('PROPOSED_MEETING_NOT_ADVANCED', {
                    deal_id: dealId,
                    status_confirmacao: event.statusConfirmacao || 'SUGERIDA',
                    motivo: 'Apenas reuniões expressamente confirmadas avançam para a etapa de Reunião.'
                });

                return {
                    transition: false,
                    reason: 'REUNIAO_NAO_CONFIRMADA',
                    deal_id: dealId,
                    item
                };
            }

            // Regra 2: Reunião confirmada avança para Reunião SEM marcar como 'won'
            const targetMeetingStageId = this.resolveMeetingStageId(customStages);
            const meetingTimestamp = new Date().toISOString();

            const updatedDeal = {
                id: item.deal_id,
                title: item.title,
                value: item.value,
                currency: item.currency,
                pipelineId: item.pipeline_id,
                stageId: targetMeetingStageId,
                status: 'open', // RIGOROSAMENTE 'open', NUNCA 'won'!
                // Preservação dos dados de perda
                lostReason: item.lost_reason,
                lostAt: item.lost_at,
                updatedAt: meetingTimestamp
            };

            const meetingActivity = {
                id: `act_meet_${Date.now()}`,
                type: 'meeting',
                title: 'Reunião de Diagnóstico Agendada pelo SDR',
                notes: `Reunião confirmada para: ${event.dataReuniao || 'Data a alinhar'}. Canal: ${event.canal || item.canal_preferencial}. Link: ${event.linkReuniao || 'N/A'}.`,
                dealId: item.deal_id,
                completed: false,
                dueDate: event.dataReuniao || meetingTimestamp
            };

            item.status_fila = 'RECUPERADO_REUNIAO_AGENDADA';
            item.reuniao_agendada = {
                data: event.dataReuniao || null,
                link: event.linkReuniao || null,
                confirmada: true,
                agendada_em: meetingTimestamp
            };
            item.updated_at = meetingTimestamp;

            this._logAction('TRANSITION_TO_MEETING_SUCCESS', {
                deal_id: item.deal_id,
                target_stage_id: targetMeetingStageId,
                status: 'open',
                reuniao_data: event.dataReuniao
            });

            return {
                transition: true,
                toStage: 'Reunião',
                stageId: targetMeetingStageId,
                deal_id: item.deal_id,
                deal: updatedDeal,
                activity: meetingActivity,
                item
            };
        }

        // =====================================================================
        // CASO D: RECUSA EXPLICITA OU OPTOUT
        // =====================================================================
        if (eventType === 'RECUSA' || eventType === 'OPTOUT') {
            return this.handleRefusal(dealId, event);
        }

        // =====================================================================
        // CASO E: SILÊNCIO / TENTATIVA SEM RESPOSTA
        // =====================================================================
        if (eventType === 'SILENCIO' || eventType === 'TENTATIVA_SEM_RESPOSTA') {
            return this.handleSilence(dealId, event);
        }

        throw new Error(`Tipo de evento desconhecido: ${eventType}`);
    }

    /**
     * -------------------------------------------------------------------------
     * 4. TRATAMENTO DE RECUSA OU OPTOUT (INTERRUPÇÃO E SUPRESSÃO)
     * -------------------------------------------------------------------------
     */
    handleRefusal(dealId, { rawText = '', intent = 'RECUSA_COMERCIAL' } = {}) {
        const item = this.recoveryQueue.get(dealId);
        if (!item) {
            throw new Error(`Negócio ${dealId} não encontrado na fila.`);
        }

        const motivoSupressao = intent === 'OPTOUT' ? 'OPTOUT_EXPLICITO' : 'RECUSA_COMERCIAL';

        // Criação e registo estrito na lista de supressão
        const suppressionRecord = createSuppressionRecord({
            deal_id: item.deal_id,
            telefone: item.contacto.telefone,
            email: item.contacto.email,
            motivo_bloqueio: motivoSupressao,
            origem_bloqueio: 'RESPOSTA_INBOUND',
            canal_bloqueado: 'TODOS',
            evidencia: rawText || `Recusa manifestada na recuperação SDR (${intent})`
        });

        this.suppressionList.push(suppressionRecord);

        // Bloqueio no controlador operacional
        this.operationalControls.blockDeal(item.deal_id, {
            canal: 'TODOS',
            motivo: `RECUSA_OU_OPTOUT_${motivoSupressao}`,
            operador: 'SDR_RECOVERY_INTEGRATION'
        });

        // Atualização da fila: negócio permanece 'lost' e bloqueado
        item.status_fila = 'ENCERRADO_RECUSADO';
        item.bloqueado = true;
        item.motivo_bloqueio = motivoSupressao;
        item.updated_at = new Date().toISOString();

        this._logAction('REFUSAL_HANDLED', {
            deal_id: item.deal_id,
            motivo_supressao: motivoSupressao,
            cadencia_interrompida: true,
            deal_permanece_perdido: true
        });

        return {
            transition: false,
            refusalRecorded: true,
            suppressed: true,
            suppressionRecord,
            deal_id: item.deal_id,
            deal_status: 'lost', // Permanece perdido
            item
        };
    }

    /**
     * -------------------------------------------------------------------------
     * 5. TRATAMENTO DE SILÊNCIO / TENTATIVA SEM RESPOSTA
     * -------------------------------------------------------------------------
     */
    handleSilence(dealId, { canal = 'WHATSAPP', diaSimulado = 1, maxTentativas = 4 } = {}) {
        const item = this.recoveryQueue.get(dealId);
        if (!item) {
            throw new Error(`Negócio ${dealId} não encontrado na fila.`);
        }

        item.tentativas_recuperacao += 1;
        const attemptEntry = {
            tentativa_numero: item.tentativas_recuperacao,
            canal,
            dia_simulado: diaSimulado,
            timestamp: new Date().toISOString(),
            resultado: 'SILENCIO_SEM_RESPOSTA'
        };
        item.historico_tentativas.push(attemptEntry);

        let cadenciaConcluida = false;
        if (item.tentativas_recuperacao >= maxTentativas) {
            item.status_fila = 'CADENCIA_CONCLUIDA_SEM_RESPOSTA';
            cadenciaConcluida = true;
        } else {
            item.status_fila = 'AGUARDANDO_PROXIMA_TENTATIVA';
        }

        item.updated_at = new Date().toISOString();

        this._logAction('SILENCE_RECORDED', {
            deal_id: item.deal_id,
            tentativa_numero: item.tentativas_recuperacao,
            cadencia_concluida: cadenciaConcluida
        });

        return {
            transition: false,
            attemptCount: item.tentativas_recuperacao,
            cadenciaConcluida,
            deal_id: item.deal_id,
            deal_status: 'lost', // Permanece perdido
            item
        };
    }

    /**
     * Retorna item da fila por ID
     */
    getQueueItem(dealId) {
        return this.recoveryQueue.get(dealId) || null;
    }

    /**
     * Métricas agregadas da fila de recuperação
     */
    getQueueMetrics() {
        const items = Array.from(this.recoveryQueue.values());
        return {
            total_negocios_fila: items.length,
            pendentes_analise: items.filter((i) => i.status_fila === 'PENDENTE_ANALISE').length,
            prontos_disparo_simulado: items.filter((i) => i.status_fila === 'PRONTO_PARA_DISPARO_SIMULADO').length,
            recuperados_engajamento: items.filter((i) => i.status_fila === 'RECUPERADO_ENGAJAMENTO').length,
            recuperados_reuniao: items.filter((i) => i.status_fila === 'RECUPERADO_REUNIAO_AGENDADA').length,
            bloqueados_ou_suprimidos: items.filter((i) => i.bloqueado).length,
            encerrados_recusa: items.filter((i) => i.status_fila === 'ENCERRADO_RECUSADO').length,
            cadencia_esgotada_silencio: items.filter((i) => i.status_fila === 'CADENCIA_CONCLUIDA_SEM_RESPOSTA').length
        };
    }
}

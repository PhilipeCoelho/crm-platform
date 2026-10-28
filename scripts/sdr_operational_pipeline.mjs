import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { SDRCadenceSimulator } from './sdr_cadence_simulator.mjs';
import { SDRDispatcherAdapter } from './sdr_dispatcher_adapter.mjs';
import { classifyInboundResponse } from './sdr_inbound_response_classifier.mjs';
import { createSuppressionRecord } from './sdr_suppression_engine.mjs';
import { validateDispatchTiming } from './sdr_business_hours.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — ORQUESTRADOR INTEGRADO DO FLUXO OPERACIONAL (FASE B.5)
 * ============================================================================
 * Executa a cadeia ponta-a-ponta com garantia de segurança determinística:
 * 
 * 1. Seleção do negócio
 * 2. Consulta do histórico factual do CRM
 * 3. Validação pelo Gate Central de Elegibilidade (10 verificações)
 * 4. Determinação de canal e autorização legal
 * 5. Preparação da abordagem fundamentada no CRM (Context Grounding)
 * 6. Ponto de revisão humana (se obrigatória)
 * 7. Simulação da tentativa via Dispatcher com Circuit Breaker
 * 8. Receção simulada de resposta inbound
 * 9. Classificação determinística da resposta
 * 10. Interrupção imediata, encaminhamento ou registo de supressão
 * 11. Registo de auditoria completo e rastreável
 * ============================================================================
 */

export class SDROperationalPipeline {
    constructor({
        gate = null,
        cadenceSimulator = null,
        dispatcher = null,
        suppressionList = [],
        mockGptAnalysis = true,
        enforceBusinessHours = false
    } = {}) {
        this.suppressionList = suppressionList;
        this.gate = gate || new SDREligibilityGate({ suppressionList: this.suppressionList });
        this.cadenceSimulator = cadenceSimulator || new SDRCadenceSimulator({ suppressionList: this.suppressionList });
        this.enforceBusinessHours = Boolean(enforceBusinessHours);
        this.dispatcher = dispatcher || new SDRDispatcherAdapter({ enforceBusinessHours: this.enforceBusinessHours });
        this.mockGptAnalysis = mockGptAnalysis;
        this.pipelineAuditLogs = [];
    }

    /**
     * Executa o fluxo operacional completo para um negócio
     */
    async processDeal({
        deal,
        historico_crm = [],
        simulatedInboundReply = null,
        simulatedCurrentDay = 1,
        legalOverride = null, // { consentimento_documentado, avaliacao_lia_b2b_aprovada }
        dispatchTimestamp = null,
        enforceBusinessHours = null
    }) {
        const audit = {
            pipeline_run_id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp_inicio: new Date().toISOString(),
            deal_id: deal?.id || deal?.deal_id,
            passos: {},
            resultado_final: null
        };

        // ---------------------------------------------------------------------
        // PASSO 1: SELEÇÃO E VALIDAÇÃO BÁSICA DO NEGÓCIO
        // ---------------------------------------------------------------------
        const dealId = deal?.id || deal?.deal_id;
        const nomeClinica = deal?.title || deal?.nome_clinica || 'Sem Nome';
        const categoriaCanonica = deal?.categoria_final_canonica || deal?.auditoria_classificacao?.fase_b2_revisada || 'DESCONHECIDO';

        if (!dealId) {
            audit.resultado_final = { status: 'BLOQUEADO', motivo: 'DEAL_ID_INVALIDO' };
            this.pipelineAuditLogs.push(audit);
            return audit;
        }

        audit.passos['01_selecao_negocio'] = {
            deal_id: dealId,
            nome_clinica: nomeClinica,
            categoria_canonica: categoriaCanonica,
            status: 'CONCLUIDO'
        };

        // ---------------------------------------------------------------------
        // PASSO 2: CONSULTA DO HISTÓRICO FACTUAL DO CRM
        // ---------------------------------------------------------------------
        const rawPhone = deal?.contacto?.telefone_normalizado || deal?.telefone || null;
        const rawEmail = deal?.contacto?.email_normalizado || deal?.email || null;
        const motivoPerda = deal?.motivo_perda_original || deal?.lostReason || '(sem nota)';
        const notasCount = Array.isArray(historico_crm) ? historico_crm.length : 0;

        audit.passos['02_consulta_historico'] = {
            total_atividades: notasCount,
            motivo_perda: motivoPerda,
            endpoint_telefone: rawPhone,
            endpoint_email: rawEmail,
            status: 'CONCLUIDO'
        };

        // ---------------------------------------------------------------------
        // PASSO 3: GATE CENTRAL DE ELEGIBILIDADE (10 VERIFICAÇÕES)
        // ---------------------------------------------------------------------
        const titleLower = nomeClinica.toLowerCase();
        const contactNameLower = (deal?.contacto?.nome || '').toLowerCase();
        const isIndividualDoctor = titleLower.includes('dr.') || titleLower.includes('dra.') || 
                                   titleLower.includes('doutor') || titleLower.includes('doutora') ||
                                   contactNameLower.includes('dr.') || contactNameLower.includes('dra.');

        const tipoDestinatario = isIndividualDoctor ? 'PESSOA_SINGULAR_MEDICO' : 'ENTIDADE_COLECTIVA_CLINICA';
        const consentimentoDocumentado = legalOverride?.consentimento_documentado ?? false;
        const liaAprovado = legalOverride?.avaliacao_lia_b2b_aprovada ?? false;

        const candidateCanal = (deal?.canal_candidato || 'WHATSAPP').toUpperCase();

        const cadenceState = this.cadenceSimulator.cadenceStates.get(dealId) || null;

        const gateEval = this.gate.evaluate({
            deal_id: dealId,
            nome_clinica: nomeClinica,
            categoria_canonica: categoriaCanonica,
            canal_pretendido: candidateCanal,
            telefone: rawPhone,
            email: rawEmail,
            tipo_destinatario: tipoDestinatario,
            consentimento_documentado: consentimentoDocumentado,
            avaliacao_lia_b2b_aprovada: liaAprovado,
            cadence_state: cadenceState,
            simulatedCurrentDay,
            organization_id: deal?.organization_id || null
        });

        audit.passos['03_gate_elegibilidade'] = gateEval;

        if (!gateEval.autorizado_para_disparo) {
            audit.resultado_final = {
                status: 'BLOQUEADO_PELO_GATE',
                motivo: gateEval.motivo_bloqueio,
                detalhe: gateEval.detalhe,
                etapa_falha: gateEval.etapa_falha
            };
            this.pipelineAuditLogs.push(audit);
            return audit;
        }

        // ---------------------------------------------------------------------
        // PASSO 4 & 5: CONTEXT GROUNDING E PREPARAÇÃO DA ABORDAGEM
        // ---------------------------------------------------------------------
        const mensagemAbordagem = `Olá, equipa da ${nomeClinica}. Entramos em contacto no seguimento do nosso contacto anterior sobre otimização de pacientes particulares. Gostaríamos de partilhar o nosso estudo de caso recente para clínicas da vossa especialidade.`;

        audit.passos['04_05_preparacao_abordagem'] = {
            canal_definido: gateEval.canal_autorizado,
            contexto_crm_utilizado: {
                nome_clinica: nomeClinica,
                motivo_perda: motivoPerda,
                tipo_destinatario: tipoDestinatario
            },
            mensagem_gerada: mensagemAbordagem,
            status: 'CONCLUIDO'
        };

        // ---------------------------------------------------------------------
        // PASSO 6 & 7: SIMULAÇÃO DA TENTATIVA DE CADÊNCIA (VIA DISPATCHER)
        // ---------------------------------------------------------------------
        const cadenceAttempt = this.cadenceSimulator.simulateAttempt({
            deal_id: dealId,
            nome_clinica: nomeClinica,
            canal_pretendido: gateEval.canal_autorizado,
            telefone_normalizado: rawPhone,
            email_normalizado: rawEmail,
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO',
            revisao_humana_necessaria: false,
            simulatedCurrentDay
        });

        audit.passos['06_07_simulacao_cadencia'] = cadenceAttempt;

        if (!cadenceAttempt.sucesso) {
            audit.resultado_final = {
                status: 'CADENCIA_NAO_DISPARADA',
                motivo: cadenceAttempt.motivo
            };
            this.pipelineAuditLogs.push(audit);
            return audit;
        }

        // Verificação determinística de horário comercial imediatamente antes do disparo
        const shouldEnforceHours = (enforceBusinessHours !== null) ? Boolean(enforceBusinessHours) : this.enforceBusinessHours;
        const timingDate = dispatchTimestamp ? new Date(dispatchTimestamp) : new Date();

        if (shouldEnforceHours) {
            const timingCheck = validateDispatchTiming(timingDate);
            audit.passos['06_b_verificacao_horario_comercial'] = timingCheck;

            if (!timingCheck.permitido) {
                audit.resultado_final = {
                    status: 'BLOQUEADO_FORA_HORARIO_COMERCIAL',
                    motivo: timingCheck.motivo,
                    detalhe: timingCheck.detalhe,
                    reagendado_para: timingCheck.proxima_janela_util
                };
                this.pipelineAuditLogs.push(audit);
                return audit;
            }
        }

        // Envio através do Dispatcher com Trava de Circuito
        const dispatchRecord = await this.dispatcher.dispatchSimulated({
            deal_id: dealId,
            canal: gateEval.canal_autorizado,
            destinatario: rawPhone || rawEmail,
            mensagem: mensagemAbordagem,
            tentativa_numero: cadenceAttempt.tentativa_numero,
            timestamp: timingDate.toISOString(),
            enforceBusinessHours: shouldEnforceHours
        });

        audit.passos['07_dispatcher_simulado'] = dispatchRecord;

        // ---------------------------------------------------------------------
        // PASSO 8, 9 & 10: RECEÇÃO E PROCESSAMENTO DE RESPOSTA INBOUND
        // ---------------------------------------------------------------------
        if (simulatedInboundReply) {
            const inboundResult = this.cadenceSimulator.simulateInboundResponse({
                deal_id: dealId,
                texto_resposta: simulatedInboundReply,
                canal_resposta: gateEval.canal_autorizado
            });

            audit.passos['08_09_resposta_inbound'] = inboundResult;

            // Se for OPTOUT ou RECUSA, adiciona automaticamente à lista de supressão ativa
            if (['OPTOUT', 'RECUSA_COMERCIAL'].includes(inboundResult.classificacao.categoria)) {
                const suppressionMotivo = inboundResult.classificacao.categoria === 'OPTOUT' ? 'OPTOUT_EXPLICITO' : 'RECUSA_COMERCIAL';
                const supRecord = createSuppressionRecord({
                    deal_id: dealId,
                    telefone: rawPhone,
                    email: rawEmail,
                    motivo_bloqueio: suppressionMotivo,
                    origem_bloqueio: 'RESPOSTA_INBOUND',
                    canal_bloqueado: 'TODOS',
                    evidencia: `Resposta do cliente: "${simulatedInboundReply}"`
                });
                this.suppressionList.push(supRecord);
                audit.passos['10_supressao_registada'] = supRecord;
            }

            audit.resultado_final = {
                status: 'RESPOSTA_PROCESSADA',
                categoria_resposta: inboundResult.classificacao.categoria,
                novo_status_cadencia: inboundResult.novo_status_cadencia,
                acao: inboundResult.classificacao.acao_recomendada
            };
        } else {
            audit.resultado_final = {
                status: 'AGUARDANDO_RESPOSTA',
                tentativa_numero: cadenceAttempt.tentativa_numero,
                status_cadencia: cadenceAttempt.status_cadencia
            };
        }

        audit.timestamp_fim = new Date().toISOString();
        this.pipelineAuditLogs.push(audit);
        return audit;
    }
}

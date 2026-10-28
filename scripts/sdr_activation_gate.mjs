import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { checkSuppression, normalizePhone, normalizeEmail } from './sdr_suppression_engine.mjs';
import { validateDispatchTiming } from './sdr_business_hours.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — GATE CENTRAL DE AUTORIZAÇÃO OPERACIONAL (FASE B.7 / B.7.1)
 * ============================================================================
 * Componente que atua como barreira estrita e multifatorial antes de qualquer
 * autorização de disparo. Opera segundo o princípio Fail-Closed (bloqueio por defeito).
 *
 * Exige a validação cumulativa de:
 * 1. Elegibilidade Técnica e Comercial (via SDREligibilityGate).
 * 2. Base Legal Documentada (LIA B2B homologado ou Opt-in documentado para médico/singular).
 * 3. Autorização Específica por Canal (LIA favorável não autoriza WhatsApp ou Email por defeito).
 * 4. Aprovação Operacional Registada (Operador, Timestamp e Justificação).
 * 5. Ausência de Supressão e Conflitos de Endpoints Partilhados.
 * 6. Estado Operacional Válido (Circuit Breaker desligado e Sistema não pausado).
 * 7. Horário Comercial Permitido (09h00-17h00 Europe/Lisbon, Seg-Sex, exceto feriados).
 *
 * REGRA INEGOCIÁVEL (FASE B.7.1):
 * - O Gate NUNCA converte inelegibilidade comercial ou quarentena em pendência jurídica (LIA).
 * - Aprovação operacional NÃO substitui base legal.
 * - Aprovação jurídica geral (LIA) NÃO autoriza canais sem autorização específica.
 * ============================================================================
 */

export const MOTIVOS_BLOQUEIO_ATIVACAO = Object.freeze({
    // Elegibilidade Comercial e Perfil
    INELEGIVEL_TECNICO_COMERCIAL: 'COMERCIALMENTE_INELEGIVEL',
    COMERCIALMENTE_INELEGIVEL: 'COMERCIALMENTE_INELEGIVEL',
    // Horário Comercial e Janela de Envio
    FORA_HORARIO_COMERCIAL: 'FORA_HORARIO_COMERCIAL',
    // Bloqueios de Contacto e Quarentena
    SEM_ENDPOINT_VALIDO: 'SEM_ENDPOINT_VALIDO',
    QUARENTENA_AGENCIA_ATIVA: 'QUARENTENA_AGENCIA_ATIVA',
    QUARENTENA_CONTINGENCIA_ATIVA: 'QUARENTENA_CONTINGENCIA_ATIVA',
    RESTRICAO_CANAL_WHATSAPP: 'RESTRICAO_CANAL_WHATSAPP',
    // Revisão Humana
    REVISAO_HUMANA_OBRIGATORIA: 'REVISAO_HUMANA_OBRIGATORIA',
    RESPOSTA_AUTOMATICA_PENDENTE_MANUAL: 'RESPOSTA_AUTOMATICA_PENDENTE_MANUAL',
    ENCAMINHAMENTO_CLOSER_HUMANO: 'ENCAMINHAMENTO_CLOSER_HUMANO',
    // Base Legal e Autorização
    FALTA_BASE_LEGAL: 'BLOQUEIO_FALTA_BASE_LEGAL',
    LIA_B2B_PENDENTE: 'BLOQUEIO_LIA_B2B_PENDENTE',
    OPTIN_MEDICO_PENDENTE: 'BLOQUEIO_OPTIN_MEDICO_PENDENTE',
    FALTA_AUTORIZACAO_CANAL: 'BLOQUEIO_FALTA_AUTORIZACAO_CANAL',
    FALTA_APROVACAO_OPERACIONAL: 'BLOQUEIO_FALTA_APROVACAO_OPERACIONAL',
    // Supressão e Segurança
    SUPRESSAO_ATIVA: 'SUPRESSAO_ATIVA',
    ENDPOINT_PARTILHADO_BLOQUEADO: 'ENDPOINT_PARTILHADO_BLOQUEADO',
    // Controlo Operacional
    PAUSA_GLOBAL_OPERACIONAL: 'PAUSA_GLOBAL_OPERACIONAL',
    CIRCUIT_BREAKER_ATIVADO: 'CIRCUIT_BREAKER_ATIVADO',
    CANAL_BLOQUEADO_OPERACIONAL: 'CANAL_BLOQUEADO_OPERACIONAL',
    DEAL_BLOQUEADO_OPERACIONAL: 'DEAL_BLOQUEADO_OPERACIONAL',
    // Integridade
    REVALIDACAO_CONTATO_PENDENTE: 'REVALIDACAO_CONTATO_PENDENTE',
    DADOS_INSUFICIENTES: 'DADOS_INSUFICIENTES',
    SISTEMA_INDISPONIVEL: 'SISTEMA_INDISPONIVEL'
});

export const ESTADOS_DOCUMENTAIS_ATIVACAO = Object.freeze({
    INELEGIVEL_TECNICO_OU_COMERCIAL: 'INELEGIVEL_TECNICO_OU_COMERCIAL',
    DOCUMENTACAO_EM_FALTA: 'DOCUMENTACAO_EM_FALTA',
    DOCUMENTACAO_SUBMETIDA_NAO_VALIDADA: 'DOCUMENTACAO_SUBMETIDA_NAO_VALIDADA',
    VALIDACAO_JURIDICA_CONCLUIDA: 'VALIDACAO_JURIDICA_CONCLUIDA',
    AUTORIZACAO_CANAL_CONFIRMADA: 'AUTORIZACAO_CANAL_CONFIRMADA',
    APROVACAO_OPERACIONAL_PENDENTE: 'APROVACAO_OPERACIONAL_PENDENTE',
    CANDIDATO_TECNICAMENTE_ELEGIVEL: 'CANDIDATO_TECNICAMENTE_ELEGIVEL',
    ATIVACAO_AUTORIZADA: 'ATIVACAO_AUTORIZADA'
});

export class SDRActivationGate {
    constructor({
        suppressionList = [],
        sharedEndpointsMap = new Map(),
        operationalControls = null,
        circuitBreakerActive = false,
        isGlobalPaused = false,
        strictLegalVerification = true,
        requireExplicitLegalSigner = false,
        checkBusinessHours = false
    } = {}) {
        this.suppressionList = Array.isArray(suppressionList) ? suppressionList : [];
        this.sharedEndpointsMap = sharedEndpointsMap instanceof Map ? sharedEndpointsMap : new Map();
        this.operationalControls = operationalControls;
        this.circuitBreakerActive = Boolean(circuitBreakerActive);
        this.isGlobalPaused = Boolean(isGlobalPaused);
        this.strictLegalVerification = Boolean(strictLegalVerification);
        this.requireExplicitLegalSigner = Boolean(requireExplicitLegalSigner);
        this.checkBusinessHours = Boolean(checkBusinessHours);

        this.technicalGate = new SDREligibilityGate({
            suppressionList: this.suppressionList,
            sharedEndpointsMap: this.sharedEndpointsMap
        });
    }

    /**
     * Avalia rigorosamente a ativação operacional de um negócio.
     * Retorna a decisão detalhada com todas as evidências analisadas.
     */
    evaluateActivation(dealParams = {}) {
        const {
            deal_id,
            nome_clinica,
            categoria_canonica,
            canal_pretendido = 'WHATSAPP',
            telefone = null,
            email = null,
            tipo_destinatario = 'ENTIDADE_COLECTIVA_CLINICA', // ou 'PESSOA_SINGULAR_MEDICO' / 'MEDICO_INDIVIDUAL'
            // Base Legal
            base_legal_validada = false,
            avaliacao_lia_b2b_aprovada = false,
            referencia_homologacao_lia = null,
            data_homologacao_lia = null,
            responsavel_homologacao_juridica = null,
            dossie_submetido = false,
            consentimento_documentado = false,
            referencia_opt_in = null,
            data_opt_in = null,
            validador_opt_in_juridico = null,
            // Autorização por Canal
            autorizacao_canal_documentada = false,
            canais_autorizados = [],
            // Aprovação Operacional
            aprovacao_operacional_registada = false,
            aprovado_por_operador = null,
            data_aprovacao_operacional = null,
            justificacao_operacional = null,
            // Revalidação / Integridade
            contacto_alterado_pos_validacao = false,
            revalidacao_obrigatoria = false,
            // Flags de sistema
            servico_indisponivel = false,
            // Verificação de Horário Comercial
            checkBusinessHours = null,
            dispatchTimestamp = null
        } = dealParams;

        const auditTrail = {
            deal_id,
            nome_clinica,
            canal_pretendido: canal_pretendido.toUpperCase(),
            timestamp_avaliacao: new Date().toISOString(),
            verificacoes: {}
        };

        // 1. Fail-closed se serviço ou dependência indisponível
        if (servico_indisponivel) {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.SISTEMA_INDISPONIVEL,
                detalhe: 'Serviço de validação ou dependência indisponível. Fail-closed por segurança.',
                auditTrail
            });
        }

        // 2. Verificação de Circuit Breaker ou Pausa Global
        const globalPaused = this.operationalControls ? this.operationalControls.isGlobalPaused() : this.isGlobalPaused;
        const cbTripped = this.operationalControls ? this.operationalControls.isCircuitBreakerTripped() : this.circuitBreakerActive;

        auditTrail.verificacoes.circuit_breaker_ok = !cbTripped;
        auditTrail.verificacoes.pausa_global_ok = !globalPaused;

        if (cbTripped) {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.CIRCUIT_BREAKER_ATIVADO,
                detalhe: 'Circuit Breaker ativado. Todos os disparos estão bloqueados.',
                auditTrail
            });
        }

        if (globalPaused) {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.PAUSA_GLOBAL_OPERACIONAL,
                detalhe: 'Operação global pausada preventivamente pelo controlo operacional.',
                auditTrail
            });
        }

        // 3. Verificação de Bloqueio Operacional específico por Deal ou Canal
        if (this.operationalControls) {
            if (this.operationalControls.isChannelBlocked(canal_pretendido)) {
                auditTrail.verificacoes.canal_bloqueado = true;
                return this._buildDecision({
                    autorizado: false,
                    motivo: MOTIVOS_BLOQUEIO_ATIVACAO.CANAL_BLOQUEADO_OPERACIONAL,
                    detalhe: `Canal ${canal_pretendido} bloqueado pelo controlo operacional.`,
                    auditTrail
                });
            }
            if (this.operationalControls.isDealBlocked(deal_id, canal_pretendido)) {
                auditTrail.verificacoes.deal_bloqueado = true;
                return this._buildDecision({
                    autorizado: false,
                    motivo: MOTIVOS_BLOQUEIO_ATIVACAO.DEAL_BLOQUEADO_OPERACIONAL,
                    detalhe: `Negócio ${deal_id} bloqueado individualmente no controlo operacional.`,
                    auditTrail
                });
            }
        }

        // 4. Integridade de contacto e revalidação
        if (contacto_alterado_pos_validacao || revalidacao_obrigatoria) {
            auditTrail.verificacoes.revalidacao_contacto = false;
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.REVALIDACAO_CONTATO_PENDENTE,
                detalhe: 'Contacto alterado após validação ou pendente de revalidação obrigatória.',
                auditTrail
            });
        }

        // 5. Verificação no SDREligibilityGate (técnica + comercial + supressão)
        const techEvaluation = this.technicalGate.evaluate({
            deal_id,
            nome_clinica,
            categoria_canonica,
            canal_pretendido,
            telefone,
            email,
            tipo_destinatario,
            consentimento_documentado,
            avaliacao_lia_b2b_aprovada,
            autorizacao_canal_documentada,
            canais_autorizados,
            contacto_alterado_pos_validacao,
            revalidacao_obrigatoria
        });

        auditTrail.verificacoes.elegibilidade_tecnica = techEvaluation;

        // Se o gate técnico/comercial bloqueou por supressão, integridade, endpoint ou perfil comercial,
        // PRESERVAR essa classificação primária e NUNCA mascarar com pendência jurídica de LIA!
        if (techEvaluation.motivo_bloqueio === 'SUPRESSAO_ATIVA') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.SUPRESSAO_ATIVA,
                detalhe: `Negócio ou contacto em lista de supressão estrita: ${techEvaluation.detalhe}`,
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'BLOQUEIO_PREVENTIVO_ENDPOINT_PARTILHADO') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.ENDPOINT_PARTILHADO_BLOQUEADO,
                detalhe: 'Contacto partilhado com entidade em supressão ativa.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'SEM_ENDPOINT_VALIDO') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.SEM_ENDPOINT_VALIDO,
                detalhe: 'Negócio não possui telefone normalizado nem email válido cadastrado.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'COMERCIALMENTE_INELEGIVEL') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.COMERCIALMENTE_INELEGIVEL,
                detalhe: `Negócio classificado comercialmente como inelegível: ${techEvaluation.detalhe}`,
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'QUARENTENA_AGENCIA_ATIVA') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.QUARENTENA_AGENCIA_ATIVA,
                detalhe: 'Clínica já tem agência ou anuncia ativamente; em quarentena comercial de 90-180 dias.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'QUARENTENA_CONTINGENCIA_ATIVA') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.QUARENTENA_CONTINGENCIA_ATIVA,
                detalhe: 'Clínica em contingência operacional ou obras; em período de quarentena.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'REVISAO_HUMANA_OBRIGATORIA') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.REVISAO_HUMANA_OBRIGATORIA,
                detalhe: 'Atrito de receção ou notas ambíguas exigem revisão humana prévia.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'RESPOSTA_AUTOMATICA_PENDENTE_MANUAL') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.RESPOSTA_AUTOMATICA_PENDENTE_MANUAL,
                detalhe: 'Histórico de resposta automática isolada; requer validação manual de receção.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'ENCAMINHAMENTO_CLOSER_HUMANO') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.ENCAMINHAMENTO_CLOSER_HUMANO,
                detalhe: 'Lead com proposta comercial anterior; proibida cadência automática, requer Closer Humano.',
                auditTrail
            });
        }

        if (techEvaluation.motivo_bloqueio === 'RESTRICAO_CANAL_WHATSAPP') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.RESTRICAO_CANAL_WHATSAPP,
                detalhe: 'Cliente solicitou expressamente não ser contactado via WhatsApp.',
                auditTrail
            });
        }

        // 6. Base Legal Documentada (Regra Inviolável para candidatos comercialmente elegíveis)
        const isCollective = tipo_destinatario === 'ENTIDADE_COLECTIVA_CLINICA' || tipo_destinatario === 'CLINICA';
        let legalBaseValid = false;
        let legalMotivo = null;

        if (isCollective) {
            const hasLiaApproval = Boolean(avaliacao_lia_b2b_aprovada);
            const hasFormalHomologation = Boolean(referencia_homologacao_lia);
            const hasIdentifiedSigner = Boolean(responsavel_homologacao_juridica);
            if (!hasLiaApproval) {
                legalMotivo = MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE;
            } else if (this.strictLegalVerification && !hasFormalHomologation) {
                legalMotivo = MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_BASE_LEGAL;
            } else if (this.requireExplicitLegalSigner && !hasIdentifiedSigner) {
                legalMotivo = MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_BASE_LEGAL;
            } else {
                legalBaseValid = true;
            }
        } else {
            // Médico singular ou pessoa física: Exige opt-in documentado
            const hasOptIn = Boolean(consentimento_documentado);
            const hasOptInRef = Boolean(referencia_opt_in);
            const hasIdentifiedSigner = Boolean(validador_opt_in_juridico);
            if (!hasOptIn) {
                legalMotivo = MOTIVOS_BLOQUEIO_ATIVACAO.OPTIN_MEDICO_PENDENTE;
            } else if (this.strictLegalVerification && !hasOptInRef) {
                legalMotivo = MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_BASE_LEGAL;
            } else if (this.requireExplicitLegalSigner && !hasIdentifiedSigner) {
                legalMotivo = MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_BASE_LEGAL;
            } else {
                legalBaseValid = true;
            }
        }

        auditTrail.verificacoes.base_legal_valida = legalBaseValid;

        if (!legalBaseValid) {
            const hasDocSubmitted = isCollective
                ? (Boolean(referencia_homologacao_lia) || Boolean(dossie_submetido))
                : (Boolean(referencia_opt_in) || Boolean(dossie_submetido));

            const estadoDoc = hasDocSubmitted
                ? ESTADOS_DOCUMENTAIS_ATIVACAO.DOCUMENTACAO_SUBMETIDA_NAO_VALIDADA
                : ESTADOS_DOCUMENTAIS_ATIVACAO.DOCUMENTACAO_EM_FALTA;

            // REGRA: Mesmo que exista aprovação operacional, SEM base legal DEVE bloquear!
            return this._buildDecision({
                autorizado: false,
                motivo: legalMotivo || MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_BASE_LEGAL,
                detalhe: isCollective
                    ? 'Avaliação LIA B2B favorável e homologada não comprovada para entidade coletiva.'
                    : 'Opt-in documentado não comprovado para médico singular / pessoa singular.',
                estado_documental: estadoDoc,
                auditTrail
            });
        }

        // 7. Autorização Específica por Canal
        // LIA favorável NÃO autoriza automaticamente WhatsApp ou Email
        const normalizedCanal = canal_pretendido.toUpperCase();
        const authorizedChannelsList = Array.isArray(canais_autorizados) 
            ? canais_autorizados.map(c => String(c).toUpperCase()) 
            : [];
        
        const channelExplicitlyAuthorized = autorizacao_canal_documentada && 
            (authorizedChannelsList.length === 0 || authorizedChannelsList.includes(normalizedCanal));

        auditTrail.verificacoes.canal_autorizado = channelExplicitlyAuthorized;

        if (!channelExplicitlyAuthorized) {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_AUTORIZACAO_CANAL,
                detalhe: `Canal pretendido (${normalizedCanal}) não possui autorização documental específica independente da base legal geral.`,
                estado_documental: ESTADOS_DOCUMENTAIS_ATIVACAO.VALIDACAO_JURIDICA_CONCLUIDA,
                auditTrail
            });
        }

        // 8. Aprovação Operacional Registada (Operador humano, data e justificação)
        const operationalSignOffValid = Boolean(aprovacao_operacional_registada) &&
            Boolean(aprovado_por_operador) &&
            Boolean(data_aprovacao_operacional);

        auditTrail.verificacoes.aprovacao_operacional = operationalSignOffValid;

        if (!operationalSignOffValid) {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_APROVACAO_OPERACIONAL,
                detalhe: 'Aprovação operacional formal não registada (requer operador, carimbo de data/hora e justificação).',
                estado_documental: ESTADOS_DOCUMENTAIS_ATIVACAO.APROVACAO_OPERACIONAL_PENDENTE,
                auditTrail
            });
        }

        // 9. Se passou todos os critérios anteriores, mas a classificação canónica é inelegível
        if (!techEvaluation.autorizado_para_disparo && techEvaluation.categoria_canonica !== 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO' && techEvaluation.categoria_canonica !== 'SILENCIO_CONFIRMADO') {
            return this._buildDecision({
                autorizado: false,
                motivo: MOTIVOS_BLOQUEIO_ATIVACAO.COMERCIALMENTE_INELEGIVEL,
                detalhe: `Negócio classificado comercialmente como inelegível: ${techEvaluation.motivo_bloqueio}`,
                estado_documental: ESTADOS_DOCUMENTAIS_ATIVACAO.INELEGIVEL_TECNICO_OU_COMERCIAL,
                auditTrail
            });
        }

        // 9.b Verificação determinística de horário comercial imediatamente antes da autorização de disparo
        const shouldCheckHours = (checkBusinessHours !== null) ? Boolean(checkBusinessHours) : this.checkBusinessHours;
        if (shouldCheckHours) {
            const timingDate = dispatchTimestamp ? new Date(dispatchTimestamp) : new Date();
            const timingEval = validateDispatchTiming(timingDate);
            auditTrail.verificacoes.horario_comercial = timingEval;

            if (!timingEval.permitido) {
                return this._buildDecision({
                    autorizado: false,
                    motivo: MOTIVOS_BLOQUEIO_ATIVACAO.FORA_HORARIO_COMERCIAL,
                    detalhe: `Disparo fora do horário comercial autorizado: ${timingEval.detalhe}`,
                    estado_documental: ESTADOS_DOCUMENTAIS_ATIVACAO.APROVACAO_OPERACIONAL_PENDENTE,
                    proxima_janela_util: timingEval.proxima_janela_util,
                    auditTrail
                });
            }
        }

        // 10. TODOS os requisitos cumulativos foram cumpridos!
        return this._buildDecision({
            autorizado: true,
            motivo: 'AUTORIZADO_PARA_ATIVACAO_PILOTO',
            detalhe: 'Todos os requisitos técnicos, comerciais, legais (LIA/Opt-in), canal e aprovação operacional validados com sucesso.',
            estado_documental: ESTADOS_DOCUMENTAIS_ATIVACAO.ATIVACAO_AUTORIZADA,
            auditTrail
        });
    }

    _buildDecision({ autorizado, motivo, detalhe, estado_documental, proxima_janela_util = null, auditTrail }) {
        return {
            autorizado_para_ativacao: Boolean(autorizado),
            motivo_decisao: motivo,
            motivo_bloqueio: autorizado ? null : motivo,
            detalhe,
            proxima_janela_util: proxima_janela_util || null,
            estado_documental: estado_documental || ESTADOS_DOCUMENTAIS_ATIVACAO.INELEGIVEL_TECNICO_OU_COMERCIAL,
            timestamp: new Date().toISOString(),
            auditTrail
        };
    }
}

import {
    checkSuppression,
    normalizePhone,
    normalizeEmail
} from './sdr_suppression_engine.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — GATE CENTRAL DE ELEGIBILIDADE DETERMINÍSTICO (FASE B.5)
 * ============================================================================
 * Único ponto de controlo central antes de qualquer tentativa de contacto.
 * 
 * Executa estritamente as 10 verificações obrigatórias:
 * 1. Identidade e negócio de origem
 * 2. Elegibilidade comercial
 * 3. Supressão por entidade e endpoint
 * 4. Restrições específicas do canal
 * 5. Autorizações e condições legais aplicáveis (RGPD/DL 7/2004)
 * 6. Contactos partilhados e ambiguidades
 * 7. Respostas anteriores e pedidos de paragem
 * 8. Estado e limites da cadência
 * 9. Killswitch global e individual
 * 10. Integridade e atualidade dos dados utilizados
 * 
 * Regra de Ouro:
 * Se qualquer verificação falhar, estiver indisponível ou for ambígua,
 * o Gate opera em modo FAIL-SAFE CLOSED (BLOQUEIO PREVENTIVO TOTAL).
 * ============================================================================
 */

export class SDREligibilityGate {
    constructor({
        suppressionList = [],
        killswitchGlobal = false,
        killswitchContacts = new Set(),
        sharedEndpointsMap = new Map(), // phone/email -> array of deal_ids
        maxAttemptsPerCycle = 2,
        minIntervalDays = 5,
        allowedOrganizationId = null
    } = {}) {
        this.suppressionList = Array.isArray(suppressionList) ? suppressionList : [];
        this.killswitchGlobal = killswitchGlobal;
        this.killswitchContacts = killswitchContacts instanceof Set ? killswitchContacts : new Set(killswitchContacts || []);
        this.sharedEndpointsMap = sharedEndpointsMap instanceof Map ? sharedEndpointsMap : new Map();
        this.maxAttemptsPerCycle = maxAttemptsPerCycle;
        this.minIntervalDays = minIntervalDays;
        this.allowedOrganizationId = allowedOrganizationId;
    }

    /**
     * Avaliação completa determinística pré-contacto
     */
    evaluate(params = {}) {
        const payload = (params && typeof params === 'object') ? params : {};
        const {
            deal_id,
            nome_clinica,
            categoria_canonica,
            canal_pretendido = 'WHATSAPP',
            telefone = null,
            email = null,
            tipo_destinatario = 'ENTIDADE_COLECTIVA_CLINICA', // ou 'PESSOA_SINGULAR_MEDICO'
            consentimento_documentado = false,
            avaliacao_lia_b2b_aprovada = false,
            historico_respostas = [],
            cadence_state = null,
            simulatedCurrentDay = 1,
            organization_id = null,
            payload_timestamp = null,
            revisao_humana_obrigatoria = false
        } = payload;

        const auditLog = {
            deal_id,
            timestamp: new Date().toISOString(),
            verificacoes: {}
        };

        try {
            // -----------------------------------------------------------------
            // VERIFICAÇÃO 10: INTEGRIDADE E ATUALIDADE DOS DADOS (FAIL-SAFE CLOSED)
            // -----------------------------------------------------------------
            if (!deal_id || typeof deal_id !== 'string' || !deal_id.trim()) {
                return this._blockResult('INTEGRIDADE_DADOS_INVALIDA', 'deal_id ausente ou inválido.', auditLog, 10);
            }
            if (!nome_clinica || typeof nome_clinica !== 'string' || !nome_clinica.trim()) {
                return this._blockResult('INTEGRIDADE_DADOS_INVALIDA', 'nome_clinica ausente ou inválido.', auditLog, 10);
            }
            if (!categoria_canonica || typeof categoria_canonica !== 'string') {
                return this._blockResult('INTEGRIDADE_DADOS_INVALIDA', 'categoria_canonica ausente ou inválida.', auditLog, 10);
            }

            // Falha / Timeout de consulta ao CRM (Cenário 13 / Fail-Closed)
            if (payload.erro_crm || payload.timeout_crm) {
                return this._blockResult('FALHA_CRM_FAIL_CLOSED', 'Timeout ou erro na consulta do histórico do CRM. Bloqueio preventivo ativado.', auditLog, 10);
            }

            // Contacto modificado após validação prévia (Cenário 19 / Revalidação obrigatória)
            if (payload.contacto_alterado_pos_validacao || payload.revalidacao_obrigatoria) {
                return this._blockResult('REVALIDACAO_CONTATO_OBRIGATORIA', 'Contacto foi alterado após validação prévia. Revalidação cadastral obrigatória.', auditLog, 10);
            }

            auditLog.verificacoes['10_integridade_dados'] = { status: 'APROVADO' };

            // Isolamento Multi-Tenant / Organização
            if (this.allowedOrganizationId && organization_id && organization_id !== this.allowedOrganizationId) {
                return this._blockResult('VIOLACAO_ISOLAMENTO_ORGANIZACAO', `Organização ${organization_id} incompatível com o tenant ativo ${this.allowedOrganizationId}.`, auditLog, 10);
            }

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 9: KILLSWITCH GLOBAL E INDIVIDUAL
            // -----------------------------------------------------------------
            if (this.killswitchGlobal) {
                return this._blockResult('KILLSWITCH_GLOBAL_ATIVO', 'Interrupção global de emergência ativada.', auditLog, 9);
            }
            if (this.killswitchContacts.has(deal_id)) {
                return this._blockResult('KILLSWITCH_INDIVIDUAL_ATIVO', `Killswitch de segurança ativado especificamente para o negócio ${deal_id}.`, auditLog, 9);
            }
            auditLog.verificacoes['09_killswitch'] = { status: 'APROVADO' };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 1: IDENTIDADE E NEGÓCIO DE ORIGEM
            // -----------------------------------------------------------------
            const normPhone = normalizePhone(telefone);
            const normEmail = normalizeEmail(email);

            if (!normPhone && !normEmail) {
                return this._blockResult('SEM_ENDPOINT_VALIDO', 'Negócio não possui nem telefone normalizado nem email válido cadastrado.', auditLog, 1);
            }
            auditLog.verificacoes['01_identidade_origem'] = { status: 'APROVADO', telefone: normPhone, email: normEmail };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 2: SUPRESSÃO CENTRAL NO SERVIDOR (PRE-SEND FIREWALL)
            // A supressão legal/comercial no servidor precede a avaliação comercial
            // -----------------------------------------------------------------
            const targetCanal = (canal_pretendido || 'TODOS').toUpperCase();
            const suppressionCheck = checkSuppression({
                deal_id,
                telefone: normPhone,
                email: normEmail,
                canal: targetCanal,
                organization_id
            }, this.suppressionList);

            if (suppressionCheck.bloqueado) {
                return this._blockResult('SUPRESSAO_ATIVA', `Bloqueio no motor de supressão: ${suppressionCheck.motivo} (critério: ${suppressionCheck.criterio_match}, evidência: "${suppressionCheck.evidencia}")`, auditLog, 2, {
                    motivo_supressao: suppressionCheck.motivo,
                    canal_bloqueado: suppressionCheck.canal_bloqueado,
                    origem_bloqueio: suppressionCheck.origem,
                    criterio_match: suppressionCheck.criterio_match,
                    categoria_canonica_origem: categoria_canonica
                });
            }

            // Regra B.14.3.4: Supressão preventiva por marketing_status 'unsubscribed' (Aplica-se apenas ao canal EMAIL de newsletter)
            const isMarketingUnsubscribed = (targetCanal === 'EMAIL') && (payload.marketing_status === 'unsubscribed' || payload.unsubscribed === true);
            if (isMarketingUnsubscribed) {
                return this._blockResult('SUPRESSAO_MARKETING_UNSUBSCRIBED', 'Contacto possui status de marketing "unsubscribed" no CRM para campanhas de email. Supressão preventiva ativa.', auditLog, 2, {
                    marketing_status: 'unsubscribed',
                    categoria_canonica_origem: categoria_canonica
                });
            }

            auditLog.verificacoes['02_supressao_endpoint'] = { status: 'APROVADO' };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 3: RESTRIÇÕES ESPECÍFICAS DO CANAL
            // -----------------------------------------------------------------
            if (categoria_canonica === 'RESTRICAO_CANAL' && targetCanal === 'WHATSAPP') {
                return this._blockResult('RESTRICAO_CANAL_WHATSAPP', 'Cliente solicitou expressamente não ser contactado via WhatsApp (restrição de canal ativa).', auditLog, 3, {
                    canal_bloqueado: 'WHATSAPP',
                    categoria_canonica_origem: categoria_canonica
                });
            }
            auditLog.verificacoes['03_restricao_canal'] = { status: 'APROVADO', canal: targetCanal };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 4: ELEGIBILIDADE COMERCIAL
            // -----------------------------------------------------------------
            // Regra B.14.3.1: Negócios desqualificados na origem NUNCA devem ser revistos
            const lostReasonParam = (payload.motivo_perda || payload.lost_reason || '').toLowerCase();
            if (lostReasonParam.includes('desqualificad')) {
                return this._blockResult('BLOQUEADO_DESQUALIFICADO', 'Negócio desqualificado na origem. Bloqueio definitivo sem revisão humana.', auditLog, 4, {
                    motivo_perda: payload.motivo_perda || payload.lost_reason
                });
            }

            const ineligibleCategories = [
                'DESQUALIFICADO_INCOMPATIVEL',
                'RECUSA_COMERCIAL_DIRETA',
                'INATINGIVEL_TECNICO',
                'HISTORICO_INCOMPLETO_SEM_EVIDENCIA'
            ];

            if (ineligibleCategories.includes(categoria_canonica)) {
                return this._blockResult('COMERCIALMENTE_INELEGIVEL', `Classificação comercial ${categoria_canonica} impede abordagem automática.`, auditLog, 4, {
                    categoria_canonica_origem: categoria_canonica
                });
            }

            // Casos especiais que exigem encaminhamento manual, não cadência automática
            if (categoria_canonica === 'SILENCIO_APOS_PROPOSTA') {
                return this._blockResult('ENCAMINHAMENTO_CLOSER_HUMANO', 'Lead com proposta anterior: proibida cadência de templates; requer Closer Humano.', auditLog, 4, {
                    categoria_canonica_origem: categoria_canonica
                });
            }
            if (categoria_canonica === 'AMBIGUO_OU_GATEKEEPER' || revisao_humana_obrigatoria) {
                return this._blockResult('REVISAO_HUMANA_OBRIGATORIA', 'Atrito de receção ou notas ambíguas exigem revisão humana prévia.', auditLog, 4, {
                    categoria_canonica_origem: categoria_canonica
                });
            }
            if (categoria_canonica === 'RESPOSTA_AUTOMATICA') {
                return this._blockResult('RESPOSTA_AUTOMATICA_PENDENTE_MANUAL', 'Histórico de resposta automática isolada; requer validação manual de receção.', auditLog, 4, {
                    categoria_canonica_origem: categoria_canonica
                });
            }
            if (categoria_canonica === 'CONTINGENCIA_OU_ADIAMENTO') {
                return this._blockResult('QUARENTENA_CONTINGENCIA_ATIVA', 'Clínica em contingência operacional ou obras; em período de quarentena.', auditLog, 4, {
                    categoria_canonica_origem: categoria_canonica
                });
            }
            if (categoria_canonica === 'JA_TEM_AGENCIA_OU_ANUNCIA') {
                return this._blockResult('QUARENTENA_AGENCIA_ATIVA', 'Clínica já atendida por agência/anúncios; em quarentena comercial de 90-180 dias.', auditLog, 4, {
                    categoria_canonica_origem: categoria_canonica
                });
            }

            auditLog.verificacoes['04_elegibilidade_comercial'] = { status: 'APROVADO', categoria: categoria_canonica };

            // Indisponibilidade do serviço de autorização (Cenário 14 / Fail-Closed)
            if (payload.servico_autorizacao_indisponivel) {
                return this._blockResult('SERVICO_AUTORIZACAO_INDISPONIVEL', 'Serviço central de autorização legal indisponível. Fail-safe closed ativado.', auditLog, 5);
            }

            // Ausência de evidência de autorização por canal (Cenário 20 / Regra 6)
            if (payload.autorizacao_canal_documentada === false) {
                return this._blockResult('AUSENCIA_AUTORIZACAO_CANAL', `Ausência de evidência de autorização específica para o canal ${targetCanal}.`, auditLog, 5, {
                    canal_requisitado: targetCanal
                });
            }
            if (Array.isArray(payload.canais_autorizados) && !payload.canais_autorizados.includes(targetCanal)) {
                return this._blockResult('AUSENCIA_AUTORIZACAO_CANAL', `Canal ${targetCanal} não consta da lista de canais com autorização documentada (${payload.canais_autorizados.join(', ')}).`, auditLog, 5, {
                    canal_requisitado: targetCanal,
                    canais_autorizados: payload.canais_autorizados
                });
            }

            // A classificação SILENCIO_CONFIRMADO NUNCA constitui autorização por si só
            if (tipo_destinatario === 'PESSOA_SINGULAR_MEDICO' || tipo_destinatario === 'MEDICO_INDIVIDUAL') {
                if (!consentimento_documentado) {
                    return this._blockResult('BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN', 'Médico/pessoa singular sem prova documental de opt-in prévio (art. 13º DL 7/2004 / RGPD).', auditLog, 5, {
                        tipo_destinatario,
                        categoria_canonica_origem: categoria_canonica
                    });
                }
            } else if (tipo_destinatario === 'CONTACTO_PROFISSIONAL_INDIVIDUAL') {
                // Contacto profissional individual em terminal móvel:
                // O número ser profissional ou público NÃO confere autorização automática para WhatsApp.
                // Exige consentimento prévio documentado (opt-in) OU LIA B2B formalmente aprovada + autorização documental de canal móvel institucional.
                if (!consentimento_documentado) {
                    if (!avaliacao_lia_b2b_aprovada || payload.autorizacao_canal_documentada !== true) {
                        return this._blockResult('BLOQUEADO_PROFISSIONAL_SEM_OPTIN_WHATSAPP', 'Contacto profissional individual em terminal móvel sem prova de opt-in nem autorização documental específica do canal (art. 13º DL 7/2004).', auditLog, 5, {
                            tipo_destinatario,
                            categoria_canonica_origem: categoria_canonica
                        });
                    }
                }
            } else if (tipo_destinatario === 'ENTIDADE_COLECTIVA_CLINICA' || tipo_destinatario === 'CLINICA') {
                if (!avaliacao_lia_b2b_aprovada) {
                    return this._blockResult('PENDENTE_AVALIACAO_LIA_B2B', 'Entidade coletiva pendente de avaliação de interesse legítimo B2B (LIA) formalmente aprovada.', auditLog, 5, {
                        tipo_destinatario,
                        categoria_canonica_origem: categoria_canonica
                    });
                }
            } else {
                return this._blockResult('TIPO_DESTINATARIO_DESCONHECIDO', `Tipo de destinatário desconhecido: ${tipo_destinatario}.`, auditLog, 5);
            }
            auditLog.verificacoes['05_base_legal_autorizacao'] = { status: 'APROVADO', tipo: tipo_destinatario, canal: targetCanal };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 6: CONTACTOS PARTILHADOS E AMBIGUIDADES
            // -----------------------------------------------------------------
            if (normPhone && this.sharedEndpointsMap.has(normPhone)) {
                const associatedDeals = this.sharedEndpointsMap.get(normPhone);
                if (associatedDeals.length > 1 && !associatedDeals.includes(deal_id)) {
                    return this._blockResult('CONFLITO_ENDPOINT_PARTILHADO', `Telefone ${normPhone} é partilhado com outras entidades distintas (${associatedDeals.join(', ')}). Titularidade ambígua.`, auditLog, 6, {
                        endpoint_partilhado: normPhone,
                        deals_associados: associatedDeals
                    });
                }
            }
            if (normEmail && this.sharedEndpointsMap.has(normEmail)) {
                const associatedDeals = this.sharedEndpointsMap.get(normEmail);
                if (associatedDeals.length > 1 && !associatedDeals.includes(deal_id)) {
                    return this._blockResult('CONFLITO_ENDPOINT_PARTILHADO', `Email ${normEmail} é partilhado com outras entidades distintas (${associatedDeals.join(', ')}). Titularidade ambígua.`, auditLog, 6, {
                        endpoint_partilhado: normEmail,
                        deals_associados: associatedDeals
                    });
                }
            }
            auditLog.verificacoes['06_contactos_partilhados'] = { status: 'APROVADO' };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 7: RESPOSTAS ANTERIORES E PEDIDOS DE PARAGEM (STOP)
            // -----------------------------------------------------------------
            if (Array.isArray(historico_respostas) && historico_respostas.length > 0) {
                for (const resp of historico_respostas) {
                    const cat = resp.classificacao?.categoria || resp.categoria;
                    if (['OPTOUT', 'RECUSA_COMERCIAL', 'STOP'].includes(cat)) {
                        return this._blockResult('HISTORICO_OPOSICAO_OU_PARAGEM', `Histórico contém resposta de ${cat}. Cadência terminantemente bloqueada.`, auditLog, 7);
                    }
                }
            }
            auditLog.verificacoes['07_respostas_anteriores'] = { status: 'APROVADO' };

            // -----------------------------------------------------------------
            // VERIFICAÇÃO 8: ESTADO E LIMITES DA CADÊNCIA
            // -----------------------------------------------------------------
            if (cadence_state) {
                if (['CONCLUIDA', 'INTERROMPIDA', 'CANCELADA_RESPOSTA', 'CONCLUIDA_COM_INTERESSE'].includes(cadence_state.status_cadencia)) {
                    return this._blockResult('CADENCIA_FINALIZADA', `Cadência com status ${cadence_state.status_cadencia}; proibido reiniciar.`, auditLog, 8);
                }
                if (cadence_state.tentativas_realizadas >= this.maxAttemptsPerCycle) {
                    return this._blockResult('LIMITE_CICLO_ATINGIDO', `Limite máximo de ${this.maxAttemptsPerCycle} tentativas por ciclo atingido.`, auditLog, 8);
                }
                if (cadence_state.tentativas_realizadas === 1 && cadence_state.data_primeira_tentativa !== null) {
                    const diasDecorridos = simulatedCurrentDay - cadence_state.data_primeira_tentativa;
                    if (diasDecorridos < this.minIntervalDays) {
                        return this._blockResult('INTERVALO_MINIMO_NAO_ATINGIDO', `Tentativa 2 prematura: decorreram ${diasDecorridos} dias (mínimo obrigatório: ${this.minIntervalDays} dias).`, auditLog, 8);
                    }
                }
            }
            auditLog.verificacoes['08_limites_cadencia'] = { status: 'APROVADO' };

            // -----------------------------------------------------------------
            // TODAS AS 10 VERIFICAÇÕES APROVADAS
            // -----------------------------------------------------------------
            return {
                elegivel: true,
                autorizado_para_disparo: true,
                motivo_bloqueio: null,
                detalhe: 'Todas as 10 verificações do Gate Central foram validadas com sucesso.',
                canal_autorizado: targetCanal,
                metadata: {},
                audit_log: auditLog
            };

        } catch (error) {
            // FAIL-SAFE CLOSED EM QUALQUER EXCEÇÃO INESPERADA
            return this._blockResult('FALHA_SISTEMA_FAIL_SAFE_CLOSED', `Exceção interna no Gate: ${error?.message || error}. Bloqueio preventivo ativado.`, auditLog, 0);
        }
    }

    _blockResult(codigoMotivo, mensagem, auditLog, etapa, metadata = {}) {
        auditLog.resultado_final = {
            elegivel: false,
            autorizado_para_disparo: false,
            etapa_falha: etapa,
            codigo_motivo: codigoMotivo,
            mensagem,
            metadata
        };

        return {
            elegivel: false,
            autorizado_para_disparo: false,
            motivo_bloqueio: codigoMotivo,
            detalhe: mensagem,
            canal_autorizado: null,
            etapa_falha: etapa,
            metadata,
            audit_log: auditLog
        };
    }
}

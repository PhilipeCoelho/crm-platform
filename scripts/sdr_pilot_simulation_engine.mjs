import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { SDRCadenceSimulator } from './sdr_cadence_simulator.mjs';
import { SDRDispatcherAdapter } from './sdr_dispatcher_adapter.mjs';
import { checkSuppression, normalizePhone, normalizeEmail } from './sdr_suppression_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ============================================================================
 * VAMUSS SDR — MOTOR DE SIMULAÇÃO DO PILOTO CONTROLADO (FASE B.6 — DRY-RUN)
 * ============================================================================
 * Opera EXCLUSIVAMENTE em modo DRY-RUN / SIMULAÇÃO EM MEMÓRIA.
 * 
 * Regra Inegociável da Fase B.6:
 * Zero mensagens enviadas, zero chamadas de API externa, zero escritas no DB.
 * Distingue rigorosamente:
 * - BLOQUEADO
 * - COMERCIALMENTE_INELEGIVEL
 * - AUTORIZACAO_PENDENTE
 * - REVISAO_HUMANA_OBRIGATORIA
 * - ELEGIVEL_PARA_SIMULACAO
 * - ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO
 * 
 * Nunca sugere autorização real quando existe apenas aprovação técnica.
 * ============================================================================
 */
export class SDRPilotSimulationEngine {
    constructor({
        suppressionList = [],
        sharedEndpointsMap = new Map(),
        maxAttemptsPerCycle = 2,
        minIntervalDays = 5,
        allowedOrganizationId = null
    } = {}) {
        this.mode = 'DRY_RUN';
        this.suppressionList = Array.isArray(suppressionList) ? suppressionList : [];
        this.sharedEndpointsMap = sharedEndpointsMap instanceof Map ? sharedEndpointsMap : new Map();

        this.gate = new SDREligibilityGate({
            suppressionList: this.suppressionList,
            sharedEndpointsMap: this.sharedEndpointsMap,
            maxAttemptsPerCycle,
            minIntervalDays,
            allowedOrganizationId
        });

        this.cadenceSimulator = new SDRCadenceSimulator({
            suppressionList: this.suppressionList,
            maxAttemptsPerCycle,
            intervalDays: minIntervalDays
        });

        this.dispatcher = new SDRDispatcherAdapter({
            mode: 'SIMULATION',
            dryRunOnly: true,
            allowRealDispatch: false
        });

        this.simulationAuditRecords = [];
    }

    /**
     * Simula a execução de um negócio individual no piloto
     */
    async simulateDeal(dealParams = {}) {
        const {
            deal_id,
            nome_clinica,
            categoria_canonica,
            canal_pretendido = 'WHATSAPP',
            telefone = null,
            email = null,
            tipo_destinatario = 'ENTIDADE_COLECTIVA_CLINICA',
            consentimento_documentado = false,
            avaliacao_lia_b2b_aprovada = false,
            autorizacao_canal_documentada = undefined,
            canais_autorizados = undefined,
            contacto_alterado_pos_validacao = false,
            revalidacao_obrigatoria = false,
            erro_crm = false,
            timeout_crm = false,
            servico_autorizacao_indisponivel = false,
            historico_respostas = [],
            simulatedCurrentDay = 1,
            organization_id = null
        } = dealParams;

        const normPhone = normalizePhone(telefone);
        const normEmail = normalizeEmail(email);

        // 1. Verificação prévia de supressão no servidor
        const suppressionCheck = checkSuppression({
            deal_id,
            telefone: normPhone,
            email: normEmail,
            canal: canal_pretendido,
            organization_id
        }, this.suppressionList);

        // 2. Verificação de contactos partilhados
        const sharedPhoneDeals = normPhone && this.sharedEndpointsMap.has(normPhone) ? this.sharedEndpointsMap.get(normPhone) : [];
        const sharedEmailDeals = normEmail && this.sharedEndpointsMap.has(normEmail) ? this.sharedEndpointsMap.get(normEmail) : [];
        const isSharedConflict = (sharedPhoneDeals.length > 1 && !sharedPhoneDeals.includes(deal_id)) ||
                                 (sharedEmailDeals.length > 1 && !sharedEmailDeals.includes(deal_id));

        // 3. Avaliação determinística do Gate
        const gateResult = this.gate.evaluate({
            deal_id,
            nome_clinica,
            categoria_canonica,
            canal_pretendido,
            telefone: normPhone,
            email: normEmail,
            tipo_destinatario,
            consentimento_documentado,
            avaliacao_lia_b2b_aprovada,
            autorizacao_canal_documentada,
            canais_autorizados,
            contacto_alterado_pos_validacao,
            revalidacao_obrigatoria,
            erro_crm,
            timeout_crm,
            servico_autorizacao_indisponivel,
            historico_respostas,
            simulatedCurrentDay,
            organization_id
        });

        // 4. Classificação categórica estrita do piloto
        let categoriaPiloto = 'BLOQUEADO';
        let decisaoFinal = 'NAO_DISPARAR';
        let motivoDeterministico = gateResult.motivo_bloqueio || 'APROVADO_TECNICAMENTE';
        let bloqueiosEncontrados = [];
        let acaoHipotetica = 'Nenhuma ação executada.';

        if (!gateResult.autorizado_para_disparo) {
            bloqueiosEncontrados.push({
                codigo: gateResult.motivo_bloqueio,
                detalhe: gateResult.detalhe,
                etapa_falha: gateResult.etapa_falha
            });

            if (gateResult.motivo_bloqueio === 'COMERCIALMENTE_INELEGIVEL') {
                categoriaPiloto = 'COMERCIALMENTE_INELEGIVEL';
                acaoHipotetica = 'Manter arquivado no CRM; fora de perfil ou histórico insuficiente.';
            } else if (gateResult.motivo_bloqueio === 'PENDENTE_AVALIACAO_LIA_B2B' || 
                       gateResult.motivo_bloqueio === 'BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN' ||
                       gateResult.motivo_bloqueio === 'AUSENCIA_AUTORIZACAO_CANAL' ||
                       gateResult.motivo_bloqueio === 'SERVICO_AUTORIZACAO_INDISPONIVEL') {
                categoriaPiloto = 'AUTORIZACAO_PENDENTE';
                acaoHipotetica = 'Aguardar validação jurídica externa de LIA B2B, opt-in formal ou autorização de canal.';
            } else if (gateResult.motivo_bloqueio === 'REVISAO_HUMANA_OBRIGATORIA' ||
                       gateResult.motivo_bloqueio === 'RESPOSTA_AUTOMATICA_PENDENTE_MANUAL' ||
                       gateResult.motivo_bloqueio === 'ENCAMINHAMENTO_CLOSER_HUMANO' ||
                       gateResult.motivo_bloqueio === 'REVALIDACAO_CONTATO_OBRIGATORIA') {
                categoriaPiloto = 'REVISAO_HUMANA_OBRIGATORIA';
                acaoHipotetica = 'Encaminhar ficha para análise prévia de SDR ou Closer humano.';
            } else {
                categoriaPiloto = 'BLOQUEADO';
                acaoHipotetica = 'Bloqueio estrito de segurança/firewall de servidor.';
            }
        } else {
            // Se o Gate aprovar tecnicamente (em simulação com overrides)
            decisaoFinal = 'ELEGIVEL_SIMULACAO_DRY_RUN';
            categoriaPiloto = 'ELEGIVEL_PARA_SIMULACAO';
            acaoHipotetica = `Seria enviada abordagem de estudo de caso para ${nome_clinica} via ${canal_pretendido} em modo piloto real (se houvesse autorização legal completa).`;
        }

        // 5. Simulação de Cadência e Dispatcher (Dry-Run estrito)
        let cadenciaResultado = null;
        let dispatchRecord = null;

        if (gateResult.autorizado_para_disparo) {
            cadenciaResultado = this.cadenceSimulator.simulateAttempt({
                deal_id,
                nome_clinica,
                canal_pretendido,
                telefone_normalizado: normPhone,
                email_normalizado: normEmail,
                elegibilidade_comercial: true,
                autorizacao_contacto: 'AUTORIZADO_SIMULADO',
                simulatedCurrentDay
            });

            if (cadenciaResultado.sucesso) {
                dispatchRecord = await this.dispatcher.dispatchSimulated({
                    deal_id,
                    canal: canal_pretendido,
                    destinatario: normPhone || normEmail,
                    mensagem: `[SIMULAÇÃO DRY-RUN] Abordagem para ${nome_clinica}`,
                    tentativa_numero: cadenciaResultado.tentativa_numero
                });
            }
        }

        const simRecord = {
            identificador_negocio: deal_id,
            nome_clinica,
            modo_execucao: 'DRY_RUN',
            estado_elegibilidade: gateResult.autorizado_para_disparo ? 'APROVADO_TECNICO' : 'BLOQUEADO',
            categoria_piloto: categoriaPiloto,
            autorizacao_por_canal: {
                canal_pretendido,
                status_autorizacao: gateResult.autorizado_para_disparo ? 'APROVADO_EM_SIMULACAO' : 'PENDENTE_OU_BLOQUEADO',
                evidencia_documentada: !!(consentimento_documentado || (avaliacao_lia_b2b_aprovada && autorizacao_canal_documentada !== false))
            },
            resultado_verificacao_supressao: {
                bloqueado: suppressionCheck.bloqueado,
                motivo: suppressionCheck.motivo,
                criterio_match: suppressionCheck.criterio_match
            },
            validacao_contacto_partilhado: {
                conflito_detectado: isSharedConflict,
                endpoints_partilhados: {
                    telefone_deals: sharedPhoneDeals,
                    email_deals: sharedEmailDeals
                }
            },
            resultado_controlo_cadencia: cadenciaResultado,
            decisao_final: decisaoFinal,
            motivo_deterministico_decisao: motivoDeterministico,
            bloqueios_encontrados: bloqueiosEncontrados,
            acao_hipotetica_simulada: acaoHipotetica,
            garantias_seguranca: {
                mensagem_real_enviada: false,
                bytes_rede_transmitidos: 0,
                chamadas_externas_api: 0,
                escritas_producao_crm: 0,
                escritas_supabase: 0
            },
            timestamp: new Date().toISOString()
        };

        this.simulationAuditRecords.push(simRecord);
        return simRecord;
    }

    /**
     * Executa a simulação completa da carteira ou de uma amostra
     */
    async simulateCohort(dealsList = []) {
        const results = [];
        for (const deal of dealsList) {
            const res = await this.simulateDeal(deal);
            results.push(res);
        }
        return results;
    }

    getStats() {
        const total = this.simulationAuditRecords.length;
        const dist = {
            BLOQUEADO: 0,
            COMERCIALMENTE_INELEGIVEL: 0,
            AUTORIZACAO_PENDENTE: 0,
            REVISAO_HUMANA_OBRIGATORIA: 0,
            ELEGIVEL_PARA_SIMULACAO: 0
        };

        this.simulationAuditRecords.forEach(r => {
            if (dist[r.categoria_piloto] !== undefined) dist[r.categoria_piloto]++;
        });

        return {
            modo: this.mode,
            total_simulados: total,
            distribuicao_categorias: dist,
            mensagens_reais_enviadas: 0,
            circuit_breaker_ativo: true
        };
    }
}

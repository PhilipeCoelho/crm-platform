import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    checkSuppression
} from './sdr_suppression_engine.mjs';

import {
    classifyInboundResponse
} from './sdr_inbound_response_classifier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ============================================================================
 * VAMUSS SDR — SIMULADOR DE CADÊNCIA CONTROLADA (FASE B.3)
 * ============================================================================
 * Opera estritamente em memória / modo simulação (Dry-Run).
 * Regras inegociáveis:
 * 1. No máximo 2 tentativas por ciclo (Dia 1 e Dia 6, intervalo 5-7 dias).
 * 2. Verificação de supressão no servidor antes de CADA tentativa.
 * 3. Cancelamento automático de seguimentos perante resposta inbound.
 * 4. Killswitch global e por contacto.
 * 5. Bloqueio automático se elegibilidade ou autorização for indeterminada.
 * ============================================================================
 */

export class SDRCadenceSimulator {
    constructor({
        suppressionList = [],
        maxAttemptsPerCycle = 2,
        intervalDays = 6,
        maxGlobalAttempts = 200,
        killswitchGlobal = false
    } = {}) {
        this.suppressionList = suppressionList;
        this.maxAttemptsPerCycle = maxAttemptsPerCycle;
        this.intervalDays = intervalDays;
        this.maxGlobalAttempts = maxGlobalAttempts;
        this.killswitchGlobal = killswitchGlobal;
        this.killswitchContacts = new Set();
        this.inFlightLocks = new Set();
        
        // Estado em memória das cadências simuladas
        this.cadenceStates = new Map(); // deal_id -> State
        this.executionLogs = [];
        this.totalSimulatedSends = 0;
    }

    /**
     * Exporta o estado completo da simulação para persistência e recuperação
     */
    exportState() {
        const statesObj = {};
        for (const [id, s] of this.cadenceStates.entries()) {
            statesObj[id] = s;
        }
        return {
            timestamp: new Date().toISOString(),
            totalSimulatedSends: this.totalSimulatedSends,
            killswitchGlobal: this.killswitchGlobal,
            killswitchContacts: Array.from(this.killswitchContacts),
            cadenceStates: statesObj,
            executionLogs: this.executionLogs
        };
    }

    /**
     * Importa o estado persistido garantindo recuperação de falhas sem disparos duplicados
     */
    importState(data = {}) {
        if (!data || typeof data !== 'object') return false;
        if (data.totalSimulatedSends !== undefined) this.totalSimulatedSends = data.totalSimulatedSends;
        if (data.killswitchGlobal !== undefined) this.killswitchGlobal = data.killswitchGlobal;
        if (Array.isArray(data.killswitchContacts)) {
            this.killswitchContacts = new Set(data.killswitchContacts);
        }
        if (data.cadenceStates && typeof data.cadenceStates === 'object') {
            for (const [id, s] of Object.entries(data.cadenceStates)) {
                this.cadenceStates.set(id, s);
            }
        }
        if (Array.isArray(data.executionLogs)) {
            this.executionLogs = [...data.executionLogs];
        }
        return true;
    }

    /**
     * Ativa o killswitch de emergência global
     */
    activateGlobalKillswitch() {
        this.killswitchGlobal = true;
        this.log('KILLSWITCH_GLOBAL_ACTIVATED', 'Interrupção de emergência global ativada.');
    }

    /**
     * Ativa o killswitch para um contacto específico
     */
    activateContactKillswitch(deal_id) {
        this.killswitchContacts.add(deal_id);
        this.log('KILLSWITCH_CONTACT_ACTIVATED', `Interrupção ativada para o deal ${deal_id}.`, { deal_id });
    }

    log(tipo, mensagem, detalhes = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            tipo,
            mensagem,
            detalhes
        };
        this.executionLogs.push(entry);
    }

    /**
     * Inicia ou avança a cadência simulada para um prospect
     */
    simulateAttempt({
        deal_id,
        nome_clinica,
        canal_pretendido = 'WHATSAPP',
        telefone_normalizado = null,
        email_normalizado = null,
        elegibilidade_comercial = true,
        autorizacao_contacto = 'PENDENTE_VALIDACAO_PREVIA',
        revisao_humana_necessaria = false,
        simulatedCurrentDay = 1
    }) {
        // 0. Proteção contra concorrência: Mutex atômico em voo por deal
        if (this.inFlightLocks.has(deal_id)) {
            this.log('ABORT_CONCURRENCY_LOCKED', `Tentativa concorrente bloqueada para ${deal_id}: Operação em voo ativa.`, { deal_id });
            return { sucesso: false, motivo: 'CONCORRENCIA_BLOQUEADA_MUTEX_ATIVO', acao: 'rejeitar_concorrencia' };
        }
        this.inFlightLocks.add(deal_id);

        try {
            // 1. Verificação do Killswitch Global
            if (this.killswitchGlobal) {
                this.log('ABORT_KILLSWITCH_GLOBAL', `Envio cancelado para ${deal_id}: Killswitch global ativo.`, { deal_id });
                return { sucesso: false, motivo: 'KILLSWITCH_GLOBAL_ATIVO', acao: 'abortar' };
            }

            // 2. Verificação do Killswitch por Contacto
            if (this.killswitchContacts.has(deal_id)) {
                this.log('ABORT_KILLSWITCH_CONTACT', `Envio cancelado para ${deal_id}: Killswitch de contacto ativo.`, { deal_id });
                return { sucesso: false, motivo: 'KILLSWITCH_CONTACT_ATIVO', acao: 'abortar' };
            }

            // 3. Limite Global de Tentativas
            if (this.totalSimulatedSends >= this.maxGlobalAttempts) {
                this.log('ABORT_GLOBAL_LIMIT', `Limite global de envios (${this.maxGlobalAttempts}) atingido.`, { deal_id });
                return { sucesso: false, motivo: 'LIMITE_GLOBAL_ATINGIDO', acao: 'abortar' };
            }

            // 4. Obter ou inicializar o estado da cadência
            let state = this.cadenceStates.get(deal_id);
            if (!state) {
                state = {
                    deal_id,
                    nome_clinica,
                    tentativas_realizadas: 0,
                    historico_tentativas: [],
                    status_cadencia: 'NAO_INICIADA', // NAO_INICIADA, EM_ANDAMENTO, CONCLUIDA, INTERROMPIDA, CANCELADA_RESPOSTA
                    canal_utilizado: canal_pretendido,
                    data_primeira_tentativa: null,
                    data_ultima_tentativa: null,
                    resposta_recebida: null
                };
                this.cadenceStates.set(deal_id, state);
            }

            // 5. Verificar se a cadência já foi concluída ou interrompida
            if (['CONCLUIDA', 'INTERROMPIDA', 'CANCELADA_RESPOSTA', 'CONCLUIDA_COM_INTERESSE'].includes(state.status_cadencia)) {
                this.log('ABORT_CADENCE_FINALIZED', `Negócio ${deal_id} já está com status ${state.status_cadencia}. Não reiniciar automaticamente.`, { deal_id, status: state.status_cadencia });
                return { sucesso: false, motivo: `CADENCIA_${state.status_cadencia}`, acao: 'ignorar' };
            }

            // 6. Verificar Elegibilidade e Autorização (com trap de invalidação)
            if (!elegibilidade_comercial) {
                state.status_cadencia = 'INTERROMPIDA';
                this.log('ABORT_INELIGIBLE', `Negócio ${deal_id} não é comercialmente elegível.`, { deal_id });
                return { sucesso: false, motivo: 'COMERCIALMENTE_INELEGIVEL', acao: 'interromper' };
            }

            const isAuthBlocked = 
                revisao_humana_necessaria || 
                autorizacao_contacto === 'INDETERMINADO' || 
                autorizacao_contacto === 'NAO_AUTORIZADO' ||
                autorizacao_contacto === 'REVOGADO' ||
                (typeof autorizacao_contacto === 'string' && autorizacao_contacto.startsWith('BLOQUEADO_'));

            if (isAuthBlocked) {
                state.status_cadencia = 'INTERROMPIDA';
                this.log('ABORT_AUTHORIZATION_PENDING', `Negócio ${deal_id} bloqueado por pendência, revogação ou ausência de autorização (${autorizacao_contacto}).`, { deal_id, autorizacao: autorizacao_contacto });
                return { sucesso: false, motivo: 'AUTORIZACAO_OU_REVISAO_PENDENTE', detalhe: autorizacao_contacto, acao: 'revisao_humana' };
            }

        // 7. Limite estrito de 2 tentativas por ciclo
        if (state.tentativas_realizadas >= this.maxAttemptsPerCycle) {
            state.status_cadencia = 'CONCLUIDA';
            this.log('CADENCE_CYCLE_COMPLETED', `Limite de ${this.maxAttemptsPerCycle} tentativas atingido para ${deal_id}. Cadência concluída sem resposta.`, { deal_id });
            return { sucesso: false, motivo: 'LIMITE_CICLO_ATINGIDO', acao: 'concluir' };
        }

        // 8. Intervalo obrigatório entre tentativas (5 a 7 dias)
        if (state.tentativas_realizadas === 1) {
            const diasDesdePrimeira = simulatedCurrentDay - state.data_primeira_tentativa;
            if (diasDesdePrimeira < 5) {
                this.log('WAIT_INTERVAL', `Tentativa 2 bloqueada para ${deal_id}: Intervalo de apenas ${diasDesdePrimeira} dias (mínimo 5 dias).`, { deal_id, diasDesdePrimeira });
                return { sucesso: false, motivo: 'INTERVALO_MINIMO_NAO_ATINGIDO', acao: 'aguardar' };
            }
        }

        // 9. Verificação de Supressão no Servidor (Pré-Envio)
        const suppressionCheck = checkSuppression({
            deal_id,
            telefone: telefone_normalizado,
            email: email_normalizado,
            canal: canal_pretendido
        }, this.suppressionList);

        if (suppressionCheck.bloqueado) {
            state.status_cadencia = 'INTERROMPIDA';
            this.log('SUPPRESSION_BLOCKED', `Envio bloqueado pelo motor de supressão para ${deal_id}: ${suppressionCheck.motivo} (${suppressionCheck.criterio_match})`, {
                deal_id,
                motivo: suppressionCheck.motivo,
                criterio: suppressionCheck.criterio_match
            });
            return { sucesso: false, motivo: 'BLOQUEIO_SUPRESSAO', detalhe: suppressionCheck, acao: 'interromper' };
        }

        // 10. Executar a Tentativa Simulada
        state.tentativas_realizadas++;
        this.totalSimulatedSends++;

        const attemptNumber = state.tentativas_realizadas;
        if (attemptNumber === 1) {
            state.data_primeira_tentativa = simulatedCurrentDay;
            state.status_cadencia = 'EM_ANDAMENTO';
        }
        state.data_ultima_tentativa = simulatedCurrentDay;

        const attemptRecord = {
            tentativa_numero: attemptNumber,
            dia_simulado: simulatedCurrentDay,
            canal: canal_pretendido,
            timestamp: new Date().toISOString(),
            status_envio: 'SIMULADO_COM_SUCESSO'
        };
        state.historico_tentativas.push(attemptRecord);

        // Se atingiu a 2ª tentativa, a cadência fica pendente de resposta ou encerramento
        if (state.tentativas_realizadas === this.maxAttemptsPerCycle) {
            state.status_cadencia = 'AGUARDANDO_RESPOSTA_OU_ENCERRAMENTO';
        }

        this.log('SIMULATED_SEND_SUCCESS', `Tentativa ${attemptNumber} simulada com sucesso para ${deal_id} via ${canal_pretendido}.`, {
            deal_id,
            tentativa: attemptNumber,
            dia: simulatedCurrentDay
        });

            return {
                sucesso: true,
                tentativa_numero: attemptNumber,
                dia_simulado: simulatedCurrentDay,
                status_cadencia: state.status_cadencia
            };
        } finally {
            this.inFlightLocks.delete(deal_id);
        }
    }

    /**
     * Processa uma resposta recebida simulada (Inbound) e cancela imediatamente seguimentos
     */
    simulateInboundResponse({ deal_id, texto_resposta, canal_resposta = 'WHATSAPP' }) {
        const state = this.cadenceStates.get(deal_id);
        if (!state) {
            throw new Error(`Cadência não encontrada para o deal ${deal_id}`);
        }

        const classification = classifyInboundResponse({ texto: texto_resposta, canal_origem: canal_resposta });
        state.resposta_recebida = {
            texto: texto_resposta,
            classificacao: classification,
            timestamp: new Date().toISOString()
        };

        // Regra Inegociável: Qualquer resposta recebida interrompe ou conclui a cadência ativa
        if (['OPTOUT', 'RECUSA_COMERCIAL', 'RESTRICAO_CANAL'].includes(classification.categoria)) {
            state.status_cadencia = 'INTERROMPIDA';
            this.log('INBOUND_REFUSAL_OR_OPTOUT', `Cadência interrompida para ${deal_id} após resposta: ${classification.categoria}`, { deal_id, categoria: classification.categoria });
        } else if (['INTERESSE', 'PEDIDO_INFORMACAO'].includes(classification.categoria)) {
            state.status_cadencia = 'CONCLUIDA_COM_INTERESSE';
            this.log('INBOUND_INTEREST', `Interesse recebido para ${deal_id}! Cadência concluída com sucesso para transição a closer.`, { deal_id });
        } else if (classification.categoria === 'ADIAMENTO') {
            state.status_cadencia = 'SUSPENSA_ADIAMENTO';
            this.log('INBOUND_POSTPONED', `Cadência suspensa para reavaliação futura (${classification.data_seguimento}) para ${deal_id}.`, { deal_id });
        } else {
            state.status_cadencia = 'PENDENTE_REVISAO_HUMANA';
            this.log('INBOUND_AMBIGUOUS', `Resposta ambígua recebida para ${deal_id}. Seguimento suspenso para revisão humana.`, { deal_id });
        }

        return {
            deal_id,
            classificacao: classification,
            novo_status_cadencia: state.status_cadencia,
            seguimento_cancelado: true
        };
    }

    getStats() {
        let emAndamento = 0;
        let concluidas = 0;
        let interrompidas = 0;
        let canceladasResposta = 0;

        for (const state of this.cadenceStates.values()) {
            if (state.status_cadencia === 'EM_ANDAMENTO' || state.status_cadencia === 'AGUARDANDO_RESPOSTA_OU_ENCERRAMENTO') emAndamento++;
            else if (state.status_cadencia === 'CONCLUIDA' || state.status_cadencia === 'CONCLUIDA_COM_INTERESSE') concluidas++;
            else if (state.status_cadencia === 'INTERROMPIDA') interrompidas++;
            else if (state.status_cadencia === 'SUSPENSA_ADIAMENTO' || state.status_cadencia === 'PENDENTE_REVISAO_HUMANA') canceladasResposta++;
        }

        return {
            total_prospects_cadencia: this.cadenceStates.size,
            total_envios_simulados: this.totalSimulatedSends,
            distribuicao_status: {
                em_andamento_ou_aguardando: emAndamento,
                concluidas: concluidas,
                interrompidas: interrompidas,
                respostas_inbound_processadas: canceladasResposta
            },
            killswitch_global_ativo: this.killswitchGlobal,
            total_killswitch_contactos: this.killswitchContacts.size
        };
    }
}

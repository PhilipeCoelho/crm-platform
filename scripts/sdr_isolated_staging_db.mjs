/**
 * ============================================================================
 * VAMUSS SDR — SIMULADOR ISOLADO TRANSAACIONAL POSTGRESQL (FASE B.12.4)
 * ============================================================================
 * Implementa um motor transacional em memória compatível com a semântica
 * PostgreSQL/Supabase para homologação isolada com dados sintéticos:
 * - Suporta transações ACID com COMMIT e ROLLBACK atómico
 * - Executa a lógica exata da função fn_sdr_transition_deal_stage
 * - Suporta verificação de RLS, triggers e supressão
 * ============================================================================
 */

export class IsolatedStagingDatabase {
    constructor() {
        this.reset();
    }

    reset() {
        this.tables = {
            deals: new Map(),
            activities: new Map(),
            sdr_suppression_list: new Map(),
            contacts: new Map()
        };
        this.transactionSnapshot = null;
        this.inTransaction = false;
        this.suppressionTableOnline = true;
    }

    beginTransaction() {
        if (this.inTransaction) throw new Error('Transação aninhada não suportada');
        this.inTransaction = true;
        // Snapshot profundo em memória
        this.transactionSnapshot = {
            deals: new Map(Array.from(this.tables.deals.entries()).map(([k, v]) => [k, { ...v }])),
            activities: new Map(Array.from(this.tables.activities.entries()).map(([k, v]) => [k, { ...v }])),
            sdr_suppression_list: new Map(Array.from(this.tables.sdr_suppression_list.entries()).map(([k, v]) => [k, { ...v }])),
            contacts: new Map(Array.from(this.tables.contacts.entries()).map(([k, v]) => [k, { ...v }]))
        };
    }

    commit() {
        if (!this.inTransaction) throw new Error('Nenhuma transação ativa para COMMIT');
        this.inTransaction = false;
        this.transactionSnapshot = null;
    }

    rollback() {
        if (!this.inTransaction) throw new Error('Nenhuma transação ativa para ROLLBACK');
        this.tables = this.transactionSnapshot;
        this.inTransaction = false;
        this.transactionSnapshot = null;
    }

    // Trigger de defesa de colunas
    _checkGuardTrigger(oldDeal, newDeal, callerClaims) {
        if (callerClaims && callerClaims.role === 'sdr_worker') {
            const protectedCols = ['value', 'contact_id', 'user_id', 'title', 'pipeline_id'];
            for (const col of protectedCols) {
                if (oldDeal[col] !== newDeal[col]) {
                    const err = new Error(`SDR_SECURITY_VIOLATION: Alteração da coluna "${col}" proibida para SDR Worker`);
                    err.code = '42501';
                    throw err;
                }
            }
        }
    }

    // Execução da RPC na transação
    executeSdrTransitionRpc({
        callerClaims = {},
        p_deal_id,
        p_new_stage,
        p_new_status,
        p_reason_code,
        p_notes = null,
        p_inbound_activity_id = null,
        p_meeting_activity_id = null,
        calendarIntegrationActive = false
    }) {
        this.beginTransaction();

        try {
            // 1. Autorização
            if (!callerClaims || callerClaims.role !== 'sdr_worker') {
                const err = new Error('Acesso não autorizado: Requer identidade e papel sdr_worker');
                err.code = '42501';
                throw err;
            }

            // 2. Status restrito
            if (!['open', 'lost'].includes(p_new_status)) {
                const err = new Error(`Status inválido para SDR: ${p_new_status}. Apenas "open" ou "lost" são permitidos`);
                err.code = '23514';
                throw err;
            }

            if (!['stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost'].includes(p_new_stage)) {
                const err = new Error(`Etapa inválida para transição SDR: ${p_new_stage}`);
                err.code = '23514';
                throw err;
            }

            // Consistência de pares
            if (p_new_stage === 'stage_lead_engajamento' && p_new_status !== 'open') {
                const err = new Error('Inconsistência de máquina de estados: stage_lead_engajamento exige status="open"');
                err.code = '23514';
                throw err;
            }
            if (p_new_stage === 'stage_reuniao' && p_new_status !== 'open') {
                const err = new Error('Inconsistência de máquina de estados: stage_reuniao exige status="open"');
                err.code = '23514';
                throw err;
            }
            if (['stage_perdido', 'stage_lost'].includes(p_new_stage) && p_new_status !== 'lost') {
                const err = new Error('Inconsistência de máquina de estados: etapa de perda exige status="lost"');
                err.code = '23514';
                throw err;
            }

            // 3. Consulta de negócio
            const deal = this.tables.deals.get(p_deal_id);
            if (!deal) {
                const err = new Error(`Negócio não encontrado: ${p_deal_id}`);
                err.code = 'PGRST116';
                throw err;
            }

            // 4.1 Bloqueio de silêncio, ambiguidade e mensagens preparadas
            const noInterestCodes = [
                'SILENCIO_SEM_RESPOSTA',
                'RESPOSTA_AMBIGUA',
                'MENSAGEM_APENAS_PREPARADA',
                'AGUARDANDO_RESPOSTA_CADENCIA',
                'RESPOSTA_AUTOMATICA'
            ];
            if (noInterestCodes.includes(p_reason_code)) {
                if (p_new_status === 'open' || ['stage_lead_engajamento', 'stage_reuniao'].includes(p_new_stage)) {
                    const err = new Error(`Transição comercial proibida: Motivo comercial "${p_reason_code}" não demonstra interesse comprovado.`);
                    err.code = '23514';
                    throw err;
                }
            }

            // 4.2 Reativação exige evidência factual verificável
            if (p_new_stage === 'stage_lead_engajamento') {
                if (deal.status !== 'lost' && deal.stage_id !== 'stage_lead_engajamento') {
                    const err = new Error('Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"');
                    err.code = '23514';
                    throw err;
                }

                if (p_reason_code !== 'RESPOSTA_COM_INTERESSE_COMPROVADO') {
                    const err = new Error('Reativação exige motivo formal "RESPOSTA_COM_INTERESSE_COMPROVADO"');
                    err.code = '23514';
                    throw err;
                }

                if (!p_inbound_activity_id) {
                    const err = new Error('Reativação proibida: Ausência de p_inbound_activity_id comprovando mensagem real recebida');
                    err.code = '23514';
                    throw err;
                }

                const inbound = this.tables.activities.get(p_inbound_activity_id);
                if (!inbound || inbound.deal_id !== p_deal_id) {
                    const err = new Error(`Atividade inbound ${p_inbound_activity_id} não encontrada para o negócio ${p_deal_id}`);
                    err.code = '23514';
                    throw err;
                }

                if (inbound.completed !== true) {
                    const err = new Error(`Atividade inbound ${p_inbound_activity_id} não concluída/confirmada`);
                    err.code = '23514';
                    throw err;
                }

                if (inbound.type === 'status_change') {
                    const err = new Error(`Atividade ${p_inbound_activity_id} é do tipo status_change; não constitui mensagem inbound`);
                    err.code = '23514';
                    throw err;
                }

                const titleLower = (inbound.title || '').toLowerCase();
                if (titleLower.includes('enviar') || titleLower.includes('apresentação') || titleLower.includes('mensagem inicial')) {
                    const err = new Error(`Atividade ${p_inbound_activity_id} representa disparo outbound, não mensagem recebida`);
                    err.code = '23514';
                    throw err;
                }

                if (!inbound.notes || inbound.notes.trim().length < 3) {
                    const err = new Error(`Atividade inbound ${p_inbound_activity_id} sem conteúdo/evidência de resposta registada em notes`);
                    err.code = '23514';
                    throw err;
                }
            }

            // 4.3 Transição para stage_reuniao
            if (p_new_stage === 'stage_reuniao') {
                if (!calendarIntegrationActive) {
                    const err = new Error('Transição para stage_reuniao bloqueada: Ausência de integração operacional ativa com calendário');
                    err.code = '23514';
                    throw err;
                }
                if (!p_meeting_activity_id) {
                    const err = new Error('Transição para stage_reuniao exige identificador p_meeting_activity_id');
                    err.code = '23514';
                    throw err;
                }
                const meeting = this.tables.activities.get(p_meeting_activity_id);
                if (!meeting || meeting.deal_id !== p_deal_id || meeting.type !== 'meeting') {
                    const err = new Error(`Nenhuma atividade de reunião ("meeting") encontrada para o negócio ${p_deal_id}`);
                    err.code = '23514';
                    throw err;
                }
                if (meeting.completed !== true) {
                    const err = new Error('A atividade de reunião ainda não se encontra confirmada no calendário');
                    err.code = '23514';
                    throw err;
                }
            }

            // 4.4 Tratamento de Recusa e Supressão FAIL-CLOSED
            if (['RECUSA_OU_PEDIDO_OPOSICAO', 'OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL'].includes(p_reason_code)) {
                if (p_new_status !== 'lost') {
                    const err = new Error('Transição de recusa exige status="lost"');
                    err.code = '23514';
                    throw err;
                }

                if (!this.suppressionTableOnline) {
                    const err = new Error('SUPPRESSION_FAIL_CLOSED: Tabela public.sdr_suppression_list indisponível. Transação abortada');
                    err.code = '42P01';
                    throw err;
                }

                const supId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                this.tables.sdr_suppression_list.set(supId, {
                    id: supId,
                    deal_id: p_deal_id,
                    contact_id: deal.contact_id,
                    motivo_bloqueio: p_reason_code === 'OPTOUT_EXPLICITO' ? 'OPTOUT_EXPLICITO' : 'RECUSA_COMERCIAL',
                    origem_bloqueio: 'RESPOSTA_INBOUND',
                    canal_bloqueado: 'TODOS',
                    evidencia: p_notes || 'Recusa comercial registada via RPC SDR',
                    estado: 'ativo',
                    created_at: new Date().toISOString()
                });
            }

            // 5. Atualização de Deals com Trigger Check
            const updatedDeal = {
                ...deal,
                stage_id: p_new_stage,
                status: p_new_status,
                updated_at: new Date().toISOString()
            };
            this._checkGuardTrigger(deal, updatedDeal, callerClaims);
            this.tables.deals.set(p_deal_id, updatedDeal);

            // 6. Registo de Auditoria em Activities
            const actId = `act_trans_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            this.tables.activities.set(actId, {
                id: actId,
                user_id: deal.user_id,
                deal_id: p_deal_id,
                type: 'status_change',
                title: `Transição SDR: ${p_new_stage} (${p_reason_code})`,
                notes: p_notes || 'Transição executada',
                completed: true,
                date: new Date().toISOString(),
                created_at: new Date().toISOString()
            });

            // Se tudo correu bem, COMMIT atómico
            this.commit();

            return {
                success: true,
                deal_id: updatedDeal.id,
                stage_id: updatedDeal.stage_id,
                status: updatedDeal.status,
                reason_code: p_reason_code,
                updated_at: updatedDeal.updated_at
            };
        } catch (error) {
            // Se ocorreu qualquer erro, ROLLBACK total!
            this.rollback();
            throw error;
        }
    }
}

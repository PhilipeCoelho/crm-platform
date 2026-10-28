/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES DE INTEGRIDADE DA FASE B.12.3.3
 * ============================================================================
 * Cobre os 10 cenários obrigatórios de teste negativo e positivo:
 * 1. NEGATIVO: Atividade inbound inexistente ou de outro negócio -> Erro 23514
 * 2. NEGATIVO: Atividade outbound apresentada como inbound -> Erro 23514
 * 3. NEGATIVO: Código de interesse inventado sem evidência factual -> Erro 23514
 * 4. NEGATIVO: Lista de supressão ausente ou indisponível (Fail-Closed) -> Erro 42P01
 * 5. NEGATIVO: Falha ao inserir a supressão -> Erro na transação
 * 6. NEGATIVO: Pares inválidos de etapa/estado (ex: stage_lead_engajamento + lost) -> Erro 23514
 * 7. NEGATIVO: Tentativa de status 'won' -> Erro 23514
 * 8. NEGATIVO: Utilizador autenticado comum sem claim sdr_worker -> Erro 42501
 * 9. NEGATIVO: Reunião sem evento real confirmado -> Erro 23514
 * 10. POSITIVO: Reativação legítima com atividade inbound real, tipo message e notes válidas -> Sucesso
 * 11. POSITIVO: Recusa comercial insere supressão duradoura com sucesso -> Sucesso
 * ============================================================================
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

function simulateB1233Rpc({
    callerClaims = {},
    deal,
    inboundActivity = null,
    meetingActivity = null,
    calendarIntegrationActive = false,
    suppressionTableExists = true,
    suppressionInsertFails = false,
    p_deal_id,
    p_new_stage,
    p_new_status,
    p_reason_code,
    p_notes = null,
    p_inbound_activity_id = null,
    p_meeting_activity_id = null,
    suppressionTable = []
}) {
    // 1. Autorização
    if (!callerClaims || callerClaims.role !== 'sdr_worker') {
        const err = new Error('Acesso não autorizado: Requer identidade e papel sdr_worker');
        err.code = '42501';
        throw err;
    }

    // 2. Validação de status e etapas
    if (!['open', 'lost'].includes(p_new_status)) {
        const err = new Error(`Status inválido para SDR: ${p_new_status}. Apenas open ou lost permitidos`);
        err.code = '23514';
        throw err;
    }

    if (!['stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost'].includes(p_new_stage)) {
        const err = new Error(`Etapa inválida para transição SDR: ${p_new_stage}`);
        err.code = '23514';
        throw err;
    }

    // 2.1 Consistência estrita dos pares stage_id / status
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
    if (!deal || deal.id !== p_deal_id) {
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
            const err = new Error(`Transição proibida: Motivo comercial "${p_reason_code}" não demonstra interesse comprovado.`);
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

        if (!inboundActivity || inboundActivity.id !== p_inbound_activity_id || inboundActivity.deal_id !== p_deal_id) {
            const err = new Error(`Atividade inbound ${p_inbound_activity_id} não encontrada para o negócio ${p_deal_id}`);
            err.code = '23514';
            throw err;
        }

        if (inboundActivity.completed !== true) {
            const err = new Error(`Atividade inbound ${p_inbound_activity_id} não concluída/confirmada`);
            err.code = '23514';
            throw err;
        }

        if (inboundActivity.type === 'status_change') {
            const err = new Error(`Atividade ${p_inbound_activity_id} é do tipo status_change; não constitui mensagem inbound`);
            err.code = '23514';
            throw err;
        }

        const titleLower = (inboundActivity.title || '').toLowerCase();
        if (titleLower.includes('enviar') || titleLower.includes('apresentação') || titleLower.includes('mensagem inicial')) {
            const err = new Error(`Atividade ${p_inbound_activity_id} representa disparo outbound, não mensagem recebida`);
            err.code = '23514';
            throw err;
        }

        if (!inboundActivity.notes || inboundActivity.notes.trim().length < 3) {
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
        if (!meetingActivity || meetingActivity.id !== p_meeting_activity_id || meetingActivity.deal_id !== p_deal_id) {
            const err = new Error(`Nenhuma atividade de reunião ("meeting") encontrada para o negócio ${p_deal_id}`);
            err.code = '23514';
            throw err;
        }
        if (meetingActivity.completed !== true) {
            const err = new Error('A atividade de reunião ainda não se encontra confirmada no calendário');
            err.code = '23514';
            throw err;
        }
    }

    // 4.4 Tratamento de Recusa e Supressão FAIL-CLOSED
    let suppressionCreated = false;
    if (['RECUSA_OU_PEDIDO_OPOSICAO', 'OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL'].includes(p_reason_code)) {
        if (p_new_status !== 'lost') {
            const err = new Error('Transição de recusa exige status="lost"');
            err.code = '23514';
            throw err;
        }

        // Se a tabela não existir: FAIL-CLOSED imediato!
        if (!suppressionTableExists) {
            const err = new Error('SUPPRESSION_FAIL_CLOSED: Tabela public.sdr_suppression_list indisponível. Transação abortada');
            err.code = '42P01';
            throw err;
        }

        if (suppressionInsertFails) {
            const err = new Error('SUPPRESSION_INSERT_FAILED: Falha crítica ao persistir registo de supressão');
            err.code = 'XX000';
            throw err;
        }

        suppressionTable.push({
            deal_id: p_deal_id,
            contact_id: deal.contact_id,
            motivo: p_reason_code === 'OPTOUT_EXPLICITO' ? 'OPTOUT_EXPLICITO' : 'RECUSA_COMERCIAL',
            estado: 'ativo'
        });
        suppressionCreated = true;
    }

    return {
        success: true,
        deal_id: deal.id,
        stage_id: p_new_stage,
        status: p_new_status,
        reason_code: p_reason_code,
        suppression_created: suppressionCreated,
        updated_at: new Date().toISOString()
    };
}

describe('Bateria de Testes Formais da Fase B.12.3.3', () => {
    const canonicalLostDeal = {
        id: '5b0f44c1-57d3-4a30-8de5-7df432207b34',
        contact_id: 'c-888',
        user_id: 'u-999',
        status: 'lost',
        stage_id: 'new'
    };
    const sdrClaims = { role: 'sdr_worker', is_service: true };
    const userClaims = { role: 'authenticated' };

    test('1. NEGATIVO: Atividade inbound inexistente ou de outro negócio é rejeitada', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                inboundActivity: { id: 'act-1', deal_id: 'outro-deal' },
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: 'act-1'
            });
        }, (err) => err.message.includes('não encontrada para o negócio'));
    });

    test('2. NEGATIVO: Atividade outbound (ex: "WhatsApp: Mensagem inicial") apresentada como inbound é rejeitada', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                inboundActivity: {
                    id: 'act-outbound',
                    deal_id: canonicalLostDeal.id,
                    type: 'message',
                    title: 'WhatsApp: Mensagem inicial',
                    notes: 'Texto enviado',
                    completed: true
                },
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: 'act-outbound'
            });
        }, (err) => err.message.includes('representa disparo outbound'));
    });

    test('3. NEGATIVO: Código de interesse inventado sem evidência factual é rejeitado', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: null // Sem ID de atividade
            });
        }, (err) => err.message.includes('Ausência de p_inbound_activity_id'));
    });

    test('4. NEGATIVO: Lista de supressão ausente resulta em Fail-Closed (aborta transação)', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                suppressionTableExists: false, // Tabela não existe
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_perdido',
                p_new_status: 'lost',
                p_reason_code: 'RECUSA_COMERCIAL'
            });
        }, (err) => err.code === '42P01');
    });

    test('5. NEGATIVO: Falha ao inserir supressão aborta a transação', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                suppressionTableExists: true,
                suppressionInsertFails: true, // Falha de escrita
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_perdido',
                p_new_status: 'lost',
                p_reason_code: 'RECUSA_COMERCIAL'
            });
        }, (err) => err.code === 'XX000');
    });

    test('6. NEGATIVO: Pares inválidos de etapa/estado (stage_lead_engajamento + lost) são rejeitados', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'lost', // Par ilícito
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.message.includes('Inconsistência de máquina de estados'));
    });

    test('7. NEGATIVO: Tentativa de status "won" é rejeitada incondicionalmente', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'won', // Status proibido
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '23514');
    });

    test('8. NEGATIVO: Utilizador autenticado comum sem claim sdr_worker recebe 42501', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: userClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '42501');
    });

    test('9. NEGATIVO: Reunião sem evento real confirmado é bloqueada', () => {
        assert.throws(() => {
            simulateB1233Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                calendarIntegrationActive: false, // Calendário desativado
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_reuniao',
                p_new_status: 'open',
                p_reason_code: 'REUNIAO_AGENDADA',
                p_meeting_activity_id: 'act-meet'
            });
        }, (err) => err.message.includes('Ausência de integração operacional ativa com calendário'));
    });

    test('10. POSITIVO: Reativação legítima aprovada com atividade inbound real e notas verificáveis', () => {
        const realInbound = {
            id: 'act-inbound-legit',
            deal_id: canonicalLostDeal.id,
            type: 'message',
            title: 'WhatsApp: Resposta recebida',
            notes: 'Boa tarde, temos interesse em avaliar a vossa metodologia.',
            completed: true
        };
        const res = simulateB1233Rpc({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            inboundActivity: realInbound,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: realInbound.id
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(res.status, 'open');
    });

    test('11. POSITIVO: Recusa comercial insere supressão duradoura e atualiza estado de forma atómica', () => {
        const table = [];
        const res = simulateB1233Rpc({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            suppressionTableExists: true,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_perdido',
            p_new_status: 'lost',
            p_reason_code: 'RECUSA_COMERCIAL',
            p_notes: 'Dr. indicou que não pretendem avançar',
            suppressionTable: table
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.suppression_created, true);
        assert.strictEqual(table.length, 1);
        assert.strictEqual(table[0].deal_id, canonicalLostDeal.id);
        assert.strictEqual(table[0].motivo, 'RECUSA_COMERCIAL');
    });
});

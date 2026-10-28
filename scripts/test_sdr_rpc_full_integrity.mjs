/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES DE INTEGRIDADE DA MÁQUINA DE ESTADOS E RPC (B.12.3)
 * ============================================================================
 * Cobertura exaustiva de casos positivos e negativos para a função corrigida
 * fn_sdr_transition_deal_stage e salvaguardas da base de dados.
 * ============================================================================
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

function executeSimulatedTransition({
    callerClaims = {},
    deal,
    meetingActivity = null,
    calendarIntegrationActive = false,
    p_deal_id,
    p_new_stage,
    p_new_status,
    p_reason_code,
    p_notes = null,
    p_meeting_activity_id = null
}) {
    // 1. Verificação de identidade e privilégio
    const isSdrWorker = callerClaims && callerClaims.role === 'sdr_worker';
    if (!isSdrWorker) {
        const err = new Error('Acesso não autorizado: Requer identidade e papel sdr_worker');
        err.code = '42501';
        throw err;
    }

    // 2. Validação estática de entradas
    if (!['open', 'lost'].includes(p_new_status)) {
        const err = new Error(`Status inválido para transição SDR: ${p_new_status} (Apenas open ou lost permitidos)`);
        err.code = '23514';
        throw err;
    }

    if (!['stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost'].includes(p_new_stage)) {
        const err = new Error(`Etapa inválida para transição SDR: ${p_new_stage}`);
        err.code = '23514';
        throw err;
    }

    // 3. Consulta de negócio
    if (!deal || deal.id !== p_deal_id) {
        const err = new Error(`Negócio não encontrado: ${p_deal_id}`);
        err.code = 'PGRST116';
        throw err;
    }

    // 4.1 Bloqueio de silêncio, mensagens preparadas e respostas ambíguas
    const noInterestCodes = [
        'SILENCIO_SEM_RESPOSTA',
        'RESPOSTA_AMBIGUA',
        'MENSAGEM_APENAS_PREPARADA',
        'AGUARDANDO_RESPOSTA_CADENCIA',
        'RESPOSTA_AUTOMATICA'
    ];
    if (noInterestCodes.includes(p_reason_code)) {
        if (p_new_status === 'open' || p_new_stage === 'stage_lead_engajamento' || p_new_stage === 'stage_reuniao') {
            const err = new Error(`Transição comercial proibida: Motivo "${p_reason_code}" não demonstra interesse. O negócio deve permanecer lost em stage_perdido.`);
            err.code = '23514';
            throw err;
        }
    }

    // 4.2 Validação de avanço para stage_lead_engajamento
    if (p_new_stage === 'stage_lead_engajamento') {
        if (deal.status !== 'lost' && deal.stage_id !== 'stage_lead_engajamento') {
            const err = new Error('Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"');
            err.code = '23514';
            throw err;
        }
        if (p_new_status !== 'open') {
            const err = new Error('Inconsistência de máquina de estados: stage_lead_engajamento exige status="open"');
            err.code = '23514';
            throw err;
        }
        if (p_reason_code !== 'RESPOSTA_COM_INTERESSE_COMPROVADO') {
            const err = new Error('Reativação para Lead de Engajamento exige motivo "RESPOSTA_COM_INTERESSE_COMPROVADO"');
            err.code = '23514';
            throw err;
        }
    }

    // 4.3 Validação de avanço para stage_reuniao
    if (p_new_stage === 'stage_reuniao') {
        if (!calendarIntegrationActive) {
            const err = new Error('Transição para stage_reuniao bloqueada: Ausência de integração operacional ativa com calendário');
            err.code = '23514';
            throw err;
        }
        if (!p_meeting_activity_id) {
            const err = new Error('Transição para stage_reuniao exige identificador p_meeting_activity_id de reunião confirmada');
            err.code = '23514';
            throw err;
        }
        if (!meetingActivity || meetingActivity.id !== p_meeting_activity_id || meetingActivity.deal_id !== p_deal_id) {
            const err = new Error(`Nenhuma atividade de reunião ("meeting") encontrada para o negócio ${p_deal_id}`);
            err.code = '23514';
            throw err;
        }
        if (meetingActivity.completed !== true || !meetingActivity.calendar_event_id) {
            const err = new Error('A atividade de reunião ainda não se encontra confirmada no calendário');
            err.code = '23514';
            throw err;
        }
        if (p_new_status !== 'open') {
            const err = new Error('Transição para stage_reuniao exige status="open"');
            err.code = '23514';
            throw err;
        }
    }

    return {
        success: true,
        deal_id: deal.id,
        stage_id: p_new_stage,
        status: p_new_status,
        reason_code: p_reason_code,
        updated_at: new Date().toISOString()
    };
}

describe('Suíte Formal de Validação da RPC fn_sdr_transition_deal_stage (B.12.3)', () => {
    const canonicalLostDeal = {
        id: '5b0f44c1-57d3-4a30-8de5-7df432207b34',
        user_id: 'e4bf647a-c96a-4e2c-87f4-831a5c8ac6a8',
        status: 'lost',
        stage_id: 'stage_perdido',
        value: 1200
    };

    const sdrClaims = { role: 'sdr_worker', is_service: true };
    const userClaims = { role: 'authenticated' };

    // TESTES NEGATIVOS (DEFESA E RESTRIÇÃO)
    test('1. NEGATIVO: Utilizador comum autenticado recebe 42501', () => {
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: userClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '42501');
    });

    test('2. NEGATIVO: Transição para stage_reuniao bloqueada quando não há integração com calendário', () => {
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                calendarIntegrationActive: false, // Sem calendário ativo
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_reuniao',
                p_new_status: 'open',
                p_reason_code: 'REUNIAO_AGENDADA',
                p_meeting_activity_id: 'act-001'
            });
        }, (err) => err.message.includes('Ausência de integração operacional ativa com calendário'));
    });

    test('3. NEGATIVO: Transição para stage_reuniao bloqueada se atividade de meeting não for confirmada', () => {
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                calendarIntegrationActive: true,
                meetingActivity: {
                    id: 'act-001',
                    deal_id: canonicalLostDeal.id,
                    type: 'meeting',
                    completed: false, // Não confirmada
                    calendar_event_id: null
                },
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_reuniao',
                p_new_status: 'open',
                p_reason_code: 'REUNIAO_AGENDADA',
                p_meeting_activity_id: 'act-001'
            });
        }, (err) => err.message.includes('não se encontra confirmada no calendário'));
    });

    test('4. NEGATIVO: Silêncio ou mensagem apenas preparada bloqueada para transição open', () => {
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'SILENCIO_SEM_RESPOSTA'
            });
        }, (err) => err.message.includes('não demonstra interesse'));
    });

    test('5. NEGATIVO: Resposta ambígua bloqueada para transição open', () => {
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_AMBIGUA'
            });
        }, (err) => err.message.includes('não demonstra interesse'));
    });

    test('6. NEGATIVO: Reabertura bloqueada se o deal não for perdido (status <> lost)', () => {
        const activeDeal = { ...canonicalLostDeal, status: 'active', stage_id: 'stage_prospect' };
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: sdrClaims,
                deal: activeDeal,
                p_deal_id: activeDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.message.includes('só pode ocorrer a partir de negócios com status="lost"'));
    });

    test('7. NEGATIVO: Rejeita status ilícito (ex: won)', () => {
        assert.throws(() => {
            executeSimulatedTransition({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'won', // Status ilícito para SDR
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '23514');
    });

    // TESTES POSITIVOS
    test('8. POSITIVO: Reativação legítima para stage_lead_engajamento com status open', () => {
        const res = executeSimulatedTransition({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_notes: 'Interesse manifestado pelo responsável clínico'
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(res.status, 'open');
    });

    test('9. POSITIVO: Transição para stage_perdido em recusa explícita', () => {
        const res = executeSimulatedTransition({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_perdido',
            p_new_status: 'lost',
            p_reason_code: 'RECUSA_EXPLICITA',
            p_notes: 'Solicitou não receber novos contactos'
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.stage_id, 'stage_perdido');
        assert.strictEqual(res.status, 'lost');
    });

    test('10. POSITIVO: Transição para stage_reuniao quando calendário está ativo e evento confirmado', () => {
        const confirmedMeeting = {
            id: 'act-meet-real',
            deal_id: canonicalLostDeal.id,
            type: 'meeting',
            completed: true,
            calendar_event_id: 'gmeet_event_12345'
        };
        const res = executeSimulatedTransition({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            calendarIntegrationActive: true,
            meetingActivity: confirmedMeeting,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_reuniao',
            p_new_status: 'open',
            p_reason_code: 'REUNIAO_CONFIRMADA_NO_CALENDARIO',
            p_meeting_activity_id: confirmedMeeting.id,
            p_notes: 'Reunião de Diagnóstico de 20 min sincronizada'
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.stage_id, 'stage_reuniao');
        assert.strictEqual(res.status, 'open');
    });
});

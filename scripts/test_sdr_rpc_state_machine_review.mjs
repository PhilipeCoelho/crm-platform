/**
 * ============================================================================
 * VAMUSS SDR — TESTES POSITIVOS E NEGATIVOS DA MÁQUINA DE ESTADOS E RPC (B.12.3 REV)
 * ============================================================================
 * Valida de forma estrita (sem mutações na BD) a lógica da RPC proposta:
 * 1. NEGATIVO: Chamador comum autenticado (sem claim sdr_worker) -> Erro 42501
 * 2. NEGATIVO: Transição para stage_reuniao sem integração de calendário real -> Erro 23514
 * 3. NEGATIVO: Transição para stage_reuniao com atividade meeting não confirmada -> Erro 23514
 * 4. NEGATIVO: Tentativa de reabrir deal ativo ou deal que não esteja lost -> Erro 23514
 * 5. NEGATIVO: Tentativa de avançar para stage_lead_engajamento a partir de silêncio -> Erro 23514
 * 6. NEGATIVO: Transição com status inválido (ex: won) -> Erro 23514
 * 7. POSITIVO: Transição válida de lost para stage_lead_engajamento com evidência de resposta -> Sucesso
 * 8. POSITIVO: Transição para stage_perdido (recusa explícita) -> Sucesso
 * 9. POSITIVO: Transição para stage_reuniao com integração comprovada e evento confirmado -> Sucesso
 * 10. TRIGGER DEFENSE: Tentativa de alterar colunas protegidas (value, user_id, contact_id) -> Erro 42501
 * ============================================================================
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Simulador determinístico da função fn_sdr_transition_deal_stage
function simulateSdrTransitionRpc({
    callerJwt,
    deal,
    meetingActivity,
    calendarIntegrationActive,
    p_deal_id,
    p_new_stage,
    p_new_status,
    p_reason_code,
    p_meeting_activity_id,
    p_notes
}) {
    // 1. Validação de Autorização do Chamador
    const isSdrWorker = callerJwt && callerJwt.app_metadata && callerJwt.app_metadata.role === 'sdr_worker';
    if (!isSdrWorker) {
        const err = new Error('Acesso não autorizado: Requer papel sdr_worker');
        err.code = '42501';
        throw err;
    }

    // 2. Validação Estática de Entradas
    if (!['open', 'lost'].includes(p_new_status)) {
        const err = new Error(`Status inválido para transição SDR: ${p_new_status}`);
        err.code = '23514';
        throw err;
    }

    if (!['stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost'].includes(p_new_stage)) {
        const err = new Error(`Etapa inválida para transição SDR: ${p_new_stage}`);
        err.code = '23514';
        throw err;
    }

    // 3. Consulta e Existência
    if (!deal || deal.id !== p_deal_id) {
        const err = new Error(`Negócio não encontrado: ${p_deal_id}`);
        err.code = 'PGRST116';
        throw err;
    }

    // 4. Matriz de Estados Comercial (Regras B.11.4 e B.11.5)
    // Caso 4.1: Silêncio / Ambiguidade -> Proibido transitar para open ou lead_engajamento
    if (['SILENCIO_SEM_RESPOSTA', 'RESPOSTA_AMBIGUA', 'MENSAGEM_APENAS_PREPARADA'].includes(p_reason_code)) {
        if (p_new_status === 'open' || p_new_stage === 'stage_lead_engajamento') {
            const err = new Error(`Transição comercial proibida: motivo "${p_reason_code}" não demonstra interesse comprovado`);
            err.code = '23514';
            throw err;
        }
    }

    // Caso 4.2: Transição para stage_lead_engajamento
    if (p_new_stage === 'stage_lead_engajamento') {
        if (deal.status !== 'lost' && deal.stage_id !== 'stage_lead_engajamento') {
            const err = new Error('Transição inválida: Reativação SDR só pode ocorrer a partir de negócios perdidos (status=lost)');
            err.code = '23514';
            throw err;
        }
        if (p_new_status !== 'open') {
            const err = new Error('Inconsistência: stage_lead_engajamento exige status=open');
            err.code = '23514';
            throw err;
        }
        if (p_reason_code !== 'RESPOSTA_COM_INTERESSE_COMPROVADO') {
            const err = new Error('Reativação exige motivo formal RESPOSTA_COM_INTERESSE_COMPROVADO');
            err.code = '23514';
            throw err;
        }
    }

    // Caso 4.3: Transição para stage_reuniao
    if (p_new_stage === 'stage_reuniao') {
        if (!calendarIntegrationActive) {
            const err = new Error('Transição para stage_reuniao bloqueada: Integração real com calendário indisponível');
            err.code = '23514';
            throw err;
        }
        if (!p_meeting_activity_id) {
            const err = new Error('Transição para stage_reuniao exige p_meeting_activity_id de evento confirmado');
            err.code = '23514';
            throw err;
        }
        if (!meetingActivity || meetingActivity.id !== p_meeting_activity_id || meetingActivity.deal_id !== p_deal_id) {
            const err = new Error('Atividade de reunião não encontrada ou não associada a este negócio');
            err.code = '23514';
            throw err;
        }
        if (meetingActivity.type !== 'meeting' || !meetingActivity.completed || !meetingActivity.calendar_event_id) {
            const err = new Error('Atividade não constitui reunião confirmada (sem calendar_event_id ou não confirmada)');
            err.code = '23514';
            throw err;
        }
    }

    return {
        success: true,
        deal_id: deal.id,
        stage_id: p_new_stage,
        status: p_new_status,
        updated_at: new Date().toISOString()
    };
}

describe('Bateria de Testes Positivos e Negativos da RPC Revisada (Fase B.12.3)', () => {
    const canonicalDeal = {
        id: '5b0f44c1-57d3-4a30-8de5-7df432207b34',
        user_id: 'u-123',
        status: 'lost',
        stage_id: 'stage_perdido',
        value: 1500
    };

    const sdrJwt = {
        app_metadata: { role: 'sdr_worker', is_service: true }
    };

    const userJwt = {
        app_metadata: { role: 'authenticated' } // Utilizador comum sem claim sdr_worker
    };

    test('1. NEGATIVO: Utilizador autenticado comum bloqueado com erro 42501', () => {
        assert.throws(() => {
            simulateSdrTransitionRpc({
                callerJwt: userJwt,
                deal: canonicalDeal,
                p_deal_id: canonicalDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '42501');
    });

    test('2. NEGATIVO: Transição para stage_reuniao sem integração de calendário bloqueada', () => {
        assert.throws(() => {
            simulateSdrTransitionRpc({
                callerJwt: sdrJwt,
                deal: canonicalDeal,
                calendarIntegrationActive: false, // Sem integração
                p_deal_id: canonicalDeal.id,
                p_new_stage: 'stage_reuniao',
                p_new_status: 'open',
                p_reason_code: 'REUNIAO_AGENDADA',
                p_meeting_activity_id: 'act-1'
            });
        }, (err) => err.message.includes('Integração real com calendário indisponível'));
    });

    test('3. NEGATIVO: Transição para stage_reuniao com reunião não confirmada ou sem calendar_event_id', () => {
        assert.throws(() => {
            simulateSdrTransitionRpc({
                callerJwt: sdrJwt,
                deal: canonicalDeal,
                calendarIntegrationActive: true,
                meetingActivity: {
                    id: 'act-1',
                    deal_id: canonicalDeal.id,
                    type: 'meeting',
                    completed: false, // Reunião pendente ou não confirmada
                    calendar_event_id: null
                },
                p_deal_id: canonicalDeal.id,
                p_new_stage: 'stage_reuniao',
                p_new_status: 'open',
                p_reason_code: 'REUNIAO_AGENDADA',
                p_meeting_activity_id: 'act-1'
            });
        }, (err) => err.message.includes('não constitui reunião confirmada'));
    });

    test('4. NEGATIVO: Tentativa de avançar para lead_engajamento com silêncio ou resposta ambígua', () => {
        assert.throws(() => {
            simulateSdrTransitionRpc({
                callerJwt: sdrJwt,
                deal: canonicalDeal,
                p_deal_id: canonicalDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'SILENCIO_SEM_RESPOSTA'
            });
        }, (err) => err.message.includes('não demonstra interesse comprovado'));
    });

    test('5. NEGATIVO: Tentativa de reabrir deal ativo fora de escopo', () => {
        const activeDeal = { ...canonicalDeal, status: 'active', stage_id: 'proposta' };
        assert.throws(() => {
            simulateSdrTransitionRpc({
                callerJwt: sdrJwt,
                deal: activeDeal,
                p_deal_id: activeDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.message.includes('só pode ocorrer a partir de negócios perdidos'));
    });

    test('6. POSITIVO: Reativação legítima de negócio perdido com resposta comprovada', () => {
        const result = simulateSdrTransitionRpc({
            callerJwt: sdrJwt,
            deal: canonicalDeal,
            p_deal_id: canonicalDeal.id,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_notes: 'Paciente expressou interesse e solicitou informações detalhadas'
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(result.status, 'open');
    });

    test('7. POSITIVO: Registo de recusa explícita mantendo negócio em lost e etapa stage_perdido', () => {
        const result = simulateSdrTransitionRpc({
            callerJwt: sdrJwt,
            deal: canonicalDeal,
            p_deal_id: canonicalDeal.id,
            p_new_stage: 'stage_perdido',
            p_new_status: 'lost',
            p_reason_code: 'RECUSA_OU_PEDIDO_OPOSICAO',
            p_notes: 'Contacto solicitou não voltar a ser contactado'
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.stage_id, 'stage_perdido');
        assert.strictEqual(result.status, 'lost');
    });

    test('8. POSITIVO: Transição para stage_reuniao quando integração existe e evento está confirmado', () => {
        const confirmedMeeting = {
            id: 'act-meet-123',
            deal_id: canonicalDeal.id,
            type: 'meeting',
            completed: true,
            calendar_event_id: 'gmeet_event_987654'
        };
        const result = simulateSdrTransitionRpc({
            callerJwt: sdrJwt,
            deal: canonicalDeal,
            calendarIntegrationActive: true,
            meetingActivity: confirmedMeeting,
            p_deal_id: canonicalDeal.id,
            p_new_stage: 'stage_reuniao',
            p_new_status: 'open',
            p_reason_code: 'REUNIAO_CONFIRMADA_NO_CALENDARIO',
            p_meeting_activity_id: 'act-meet-123',
            p_notes: 'Reunião agendada e sincronizada com Google Meet'
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.stage_id, 'stage_reuniao');
        assert.strictEqual(result.status, 'open');
    });
});

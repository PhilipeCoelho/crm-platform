/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES DE INTEGRIDADE E EVIDÊNCIAS FACTUAIS (B.12.3.2)
 * ============================================================================
 * Valida a camada de regras da B.12.3.2:
 * 1. NEGATIVO: Reativação sem p_inbound_activity_id -> Erro 23514
 * 2. NEGATIVO: Reativação com p_inbound_activity_id inexistente ou de outro deal -> Erro 23514
 * 3. NEGATIVO: Reativação com p_reason_code 'SILENCIO_SEM_RESPOSTA' mesmo que passe ID -> Erro 23514
 * 4. NEGATIVO: Tentativa de status 'won' -> Erro 23514
 * 5. POSITIVO: Reativação legítima com inbound_activity comprovada -> Sucesso
 * 6. POSITIVO: Recusa comercial aciona registo de supressão duradoura -> Sucesso
 * 7. PRE-SEND SUPPRESSION: Disparador bloqueia se o contacto estiver na lista -> Bloqueio
 * 8. PRE-SEND FAIL-SAFE: Indisponibilidade da lista de supressão resulta em Fail-Closed -> Bloqueio
 * ============================================================================
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { checkSuppression, createSuppressionRecord } from './sdr_suppression_engine.mjs';

function simulateB1232Rpc({
    callerClaims = {},
    deal,
    inboundActivity = null,
    meetingActivity = null,
    calendarIntegrationActive = false,
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

    // 2. Status restrito (SDR nunca marca won)
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
        if (p_new_status === 'open' || p_new_stage === 'stage_lead_engajamento') {
            const err = new Error(`Transição proibida: Motivo comercial "${p_reason_code}" não demonstra interesse`);
            err.code = '23514';
            throw err;
        }
    }

    // 4.2 Reativação exige evidência factual de inbound
    if (p_new_stage === 'stage_lead_engajamento') {
        if (deal.status !== 'lost' && deal.stage_id !== 'stage_lead_engajamento') {
            const err = new Error('Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"');
            err.code = '23514';
            throw err;
        }
        if (p_new_status !== 'open') {
            const err = new Error('stage_lead_engajamento exige status="open"');
            err.code = '23514';
            throw err;
        }
        if (!p_inbound_activity_id) {
            const err = new Error('Reativação proibida: Ausência de identificador p_inbound_activity_id comprovando resposta real recebida');
            err.code = '23514';
            throw err;
        }
        if (!inboundActivity || inboundActivity.id !== p_inbound_activity_id || inboundActivity.deal_id !== p_deal_id) {
            const err = new Error(`Atividade de resposta inbound ${p_inbound_activity_id} não encontrada para o negócio ${p_deal_id}`);
            err.code = '23514';
            throw err;
        }
        if (p_reason_code !== 'RESPOSTA_COM_INTERESSE_COMPROVADO') {
            const err = new Error('Reativação para Lead de Engajamento exige motivo formal "RESPOSTA_COM_INTERESSE_COMPROVADO"');
            err.code = '23514';
            throw err;
        }
    }

    // 4.3 Recusa aciona supressão duradoura
    let suppressionCreated = false;
    if (['RECUSA_OU_PEDIDO_OPOSICAO', 'OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL'].includes(p_reason_code)) {
        if (p_new_status !== 'lost') {
            const err = new Error('Transição de recusa exige status="lost"');
            err.code = '23514';
            throw err;
        }
        suppressionTable.push({
            deal_id: p_deal_id,
            contact_id: deal.contact_id,
            motivo_bloqueio: p_reason_code === 'OPTOUT_EXPLICITO' ? 'OPTOUT_EXPLICITO' : 'RECUSA_COMERCIAL',
            origem_bloqueio: 'RESPOSTA_INBOUND',
            canal_bloqueado: 'TODOS',
            evidencia: p_notes || 'Recusa registada',
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

describe('Suíte B.12.3.2: Evidências Factuais de Interesse e Supressão', () => {
    const canonicalLostDeal = {
        id: '5b0f44c1-57d3-4a30-8de5-7df432207b34',
        contact_id: 'c-888',
        user_id: 'u-999',
        status: 'lost',
        stage_id: 'stage_perdido'
    };
    const sdrClaims = { role: 'sdr_worker', is_service: true };

    test('1. NEGATIVO: Reativação sem p_inbound_activity_id é rejeitada mesmo com claim e reason_code', () => {
        assert.throws(() => {
            simulateB1232Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: null // Ausência de evidência factual
            });
        }, (err) => err.message.includes('Ausência de identificador p_inbound_activity_id'));
    });

    test('2. NEGATIVO: Reativação com p_inbound_activity_id pertencente a outro deal é rejeitada', () => {
        assert.throws(() => {
            simulateB1232Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                inboundActivity: { id: 'act-outra', deal_id: 'outro-deal-123' },
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: 'act-outra'
            });
        }, (err) => err.message.includes('não encontrada para o negócio'));
    });

    test('3. NEGATIVO: Silêncio com reason_code inventado é bloqueado para reativação', () => {
        assert.throws(() => {
            simulateB1232Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'SILENCIO_SEM_RESPOSTA'
            });
        }, (err) => err.message.includes('não demonstra interesse'));
    });

    test('4. NEGATIVO: Proibição absoluta de transitar para status "won"', () => {
        assert.throws(() => {
            simulateB1232Rpc({
                callerClaims: sdrClaims,
                deal: canonicalLostDeal,
                p_deal_id: canonicalLostDeal.id,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'won', // Proibido para SDR
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.message.includes('Apenas open ou lost permitidos'));
    });

    test('5. POSITIVO: Reativação aprovada quando existe inbound_activity real associada ao deal', () => {
        const realInbound = {
            id: 'act-inbound-valid',
            deal_id: canonicalLostDeal.id,
            type: 'message',
            completed: true
        };
        const res = simulateB1232Rpc({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            inboundActivity: realInbound,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: 'act-inbound-valid'
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(res.status, 'open');
    });

    test('6. POSITIVO: Recusa comercial cria registo imediato na tabela de supressão', () => {
        const suppressionDb = [];
        const res = simulateB1232Rpc({
            callerClaims: sdrClaims,
            deal: canonicalLostDeal,
            p_deal_id: canonicalLostDeal.id,
            p_new_stage: 'stage_perdido',
            p_new_status: 'lost',
            p_reason_code: 'RECUSA_COMERCIAL',
            p_notes: 'Dr. indicou não ter interesse',
            suppressionTable: suppressionDb
        });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.suppression_created, true);
        assert.strictEqual(suppressionDb.length, 1);
        assert.strictEqual(suppressionDb[0].deal_id, canonicalLostDeal.id);
        assert.strictEqual(suppressionDb[0].motivo_bloqueio, 'RECUSA_COMERCIAL');
    });

    test('7. SUPRESSÃO PRE-SEND: Dispatcher bloqueia imediatamente envio para contacto suprimido', () => {
        const suppressionList = [
            {
                deal_id: canonicalLostDeal.id,
                telefone_normalizado: '351912345678',
                email_normalizado: 'diniz@salgueiro.pt',
                canal_bloqueado: 'TODOS',
                estado: 'ativo',
                motivo_bloqueio: 'RECUSA_COMERCIAL'
            }
        ];
        const check = checkSuppression({
            deal_id: canonicalLostDeal.id,
            telefone: '912345678',
            email: 'diniz@salgueiro.pt',
            canal: 'WHATSAPP'
        }, suppressionList);
        assert.strictEqual(check.bloqueado, true);
        assert.strictEqual(check.motivo, 'RECUSA_COMERCIAL');
    });

    test('8. PRE-SEND FAIL-SAFE: Indisponibilidade da lista de supressão resulta em Fail-Closed', () => {
        const check = checkSuppression({
            deal_id: canonicalLostDeal.id,
            telefone: '912345678'
        }, null); // Lista corrompida / nula
        assert.strictEqual(check.bloqueado, true);
        assert.strictEqual(check.motivo, 'FALHA_SISTEMA_FAIL_SAFE_CLOSED');
    });
});

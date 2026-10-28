/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE HOMOLOGAÇÃO EM AMBIENTE ISOLADO (FASE B.12.4)
 * ============================================================================
 * Executa testes rigorosos com dados puramente sintéticos no motor isolado:
 * - Prova de ROLLBACK atómico em cada teste negativo (dados permanecem inalterados)
 * - Prova de persistência atómica em cada teste positivo
 * - Validação da máquina de estados, supressão e trigger de defesa de colunas
 * ============================================================================
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { IsolatedStagingDatabase } from './sdr_isolated_staging_db.mjs';
import { checkSuppression } from './sdr_suppression_engine.mjs';

describe('Homologação Controlada da RPC e Ciclo de Supressão (Fase B.12.4)', () => {
    let db;
    const workerClaims = { role: 'sdr_worker', is_service: true };
    const userClaims = { role: 'authenticated' };

    // Dados sintéticos descartáveis
    const synthDealId = '11111111-2222-3333-4444-555555555555';
    const synthContactId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const synthUserId = '99999999-8888-7777-6666-555555555555';

    beforeEach(() => {
        db = new IsolatedStagingDatabase();
        // Carga inicial de dados sintéticos
        db.tables.deals.set(synthDealId, {
            id: synthDealId,
            user_id: synthUserId,
            contact_id: synthContactId,
            title: 'Negócio Sintético Teste Staging',
            value: 2500,
            priority: 'high',
            stage_id: 'new',
            status: 'lost',
            pipeline_id: 'sales',
            created_at: '2026-01-01T10:00:00Z',
            updated_at: '2026-01-01T10:00:00Z'
        });
        db.tables.contacts.set(synthContactId, {
            id: synthContactId,
            name: 'Dr. Sintético Teste',
            email: 'sintetico.teste@staging.internal',
            phone: '+351919999999'
        });
    });

    test('1. POSITIVO: Reativação autorizada de negócio sintético perdido com atividade inbound factual', () => {
        const actId = 'inbound-synth-1';
        db.tables.activities.set(actId, {
            id: actId,
            user_id: synthUserId,
            deal_id: synthDealId,
            type: 'message',
            title: 'WhatsApp: Mensagem recebida de teste',
            notes: 'Sim, pretendemos conhecer a vossa metodologia.',
            completed: true,
            date: '2026-10-10T22:00:00Z'
        });

        const initialDeal = { ...db.tables.deals.get(synthDealId) };
        const res = db.executeSdrTransitionRpc({
            callerClaims: workerClaims,
            p_deal_id: synthDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: actId
        });

        assert.strictEqual(res.success, true);
        const updatedDeal = db.tables.deals.get(synthDealId);
        assert.strictEqual(updatedDeal.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(updatedDeal.status, 'open');
        // Preservação de colunas financeiras e proprietário
        assert.strictEqual(updatedDeal.value, initialDeal.value);
        assert.strictEqual(updatedDeal.user_id, initialDeal.user_id);
        assert.strictEqual(updatedDeal.contact_id, initialDeal.contact_id);
    });

    test('2. ROLLBACK: Rejeição de atividade inexistente mantém dados estritamente inalterados', () => {
        const initialDeal = { ...db.tables.deals.get(synthDealId) };
        const initialActsCount = db.tables.activities.size;

        assert.throws(() => {
            db.executeSdrTransitionRpc({
                callerClaims: workerClaims,
                p_deal_id: synthDealId,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: 'inexistente-123'
            });
        }, (err) => err.code === '23514');

        // Confirmação de Rollback total
        const dealAfter = db.tables.deals.get(synthDealId);
        assert.deepStrictEqual(dealAfter, initialDeal);
        assert.strictEqual(db.tables.activities.size, initialActsCount);
    });

    test('3. ROLLBACK: Rejeição de disparo outbound apresentado como inbound mantém dados inalterados', () => {
        const outboundActId = 'outbound-synth-1';
        db.tables.activities.set(outboundActId, {
            id: outboundActId,
            user_id: synthUserId,
            deal_id: synthDealId,
            type: 'message',
            title: 'WhatsApp: Mensagem inicial',
            notes: 'Apresentação enviada pela Vamuss',
            completed: true,
            date: '2026-10-10T22:00:00Z'
        });

        const initialDeal = { ...db.tables.deals.get(synthDealId) };

        assert.throws(() => {
            db.executeSdrTransitionRpc({
                callerClaims: workerClaims,
                p_deal_id: synthDealId,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
                p_inbound_activity_id: outboundActId
            });
        }, (err) => err.message.includes('representa disparo outbound'));

        assert.deepStrictEqual(db.tables.deals.get(synthDealId), initialDeal);
    });

    test('4. ROLLBACK: Silêncio, auto-reply ou ambiguidade mantém negócio inalterado como lost', () => {
        const initialDeal = { ...db.tables.deals.get(synthDealId) };

        for (const code of ['SILENCIO_SEM_RESPOSTA', 'RESPOSTA_AMBIGUA', 'MENSAGEM_APENAS_PREPARADA', 'RESPOSTA_AUTOMATICA']) {
            assert.throws(() => {
                db.executeSdrTransitionRpc({
                    callerClaims: workerClaims,
                    p_deal_id: synthDealId,
                    p_new_stage: 'stage_lead_engajamento',
                    p_new_status: 'open',
                    p_reason_code: code
                });
            }, (err) => err.code === '23514');

            assert.deepStrictEqual(db.tables.deals.get(synthDealId), initialDeal);
        }
    });

    test('5. ROLLBACK: Tentativa de status won é rejeitada e mantida sem mutação', () => {
        const initialDeal = { ...db.tables.deals.get(synthDealId) };

        assert.throws(() => {
            db.executeSdrTransitionRpc({
                callerClaims: workerClaims,
                p_deal_id: synthDealId,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'won', // Ilegal para SDR
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '23514');

        assert.deepStrictEqual(db.tables.deals.get(synthDealId), initialDeal);
    });

    test('6. ROLLBACK: Reunião bloqueada enquanto não houver integração de calendário real', () => {
        const initialDeal = { ...db.tables.deals.get(synthDealId) };

        assert.throws(() => {
            db.executeSdrTransitionRpc({
                callerClaims: workerClaims,
                p_deal_id: synthDealId,
                p_new_stage: 'stage_reuniao',
                p_new_status: 'open',
                p_reason_code: 'REUNIAO_AGENDADA',
                p_meeting_activity_id: 'meet-1',
                calendarIntegrationActive: false // Sem calendário
            });
        }, (err) => err.message.includes('Ausência de integração operacional ativa com calendário'));

        assert.deepStrictEqual(db.tables.deals.get(synthDealId), initialDeal);
    });

    test('7. ROLLBACK: Utilizador autenticado comum recebe 42501 e dados permanecem intactos', () => {
        const initialDeal = { ...db.tables.deals.get(synthDealId) };

        assert.throws(() => {
            db.executeSdrTransitionRpc({
                callerClaims: userClaims, // Utilizador comum
                p_deal_id: synthDealId,
                p_new_stage: 'stage_lead_engajamento',
                p_new_status: 'open',
                p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
            });
        }, (err) => err.code === '42501');

        assert.deepStrictEqual(db.tables.deals.get(synthDealId), initialDeal);
    });

    test('8. POSITIVO: Recusa comercial persiste supressão duradoura e atualiza deal atomicamente', () => {
        const res = db.executeSdrTransitionRpc({
            callerClaims: workerClaims,
            p_deal_id: synthDealId,
            p_new_stage: 'stage_perdido',
            p_new_status: 'lost',
            p_reason_code: 'RECUSA_COMERCIAL',
            p_notes: 'Dr. Sintético recusou contacto'
        });

        assert.strictEqual(res.success, true);
        const updatedDeal = db.tables.deals.get(synthDealId);
        assert.strictEqual(updatedDeal.stage_id, 'stage_perdido');
        assert.strictEqual(updatedDeal.status, 'lost');

        // Verificação da supressão na tabela
        const supEntries = Array.from(db.tables.sdr_suppression_list.values());
        assert.strictEqual(supEntries.length, 1);
        assert.strictEqual(supEntries[0].deal_id, synthDealId);
        assert.strictEqual(supEntries[0].motivo_bloqueio, 'RECUSA_COMERCIAL');
        assert.strictEqual(supEntries[0].estado, 'ativo');
    });

    test('9. SUPRESSÃO FAIL-CLOSED: Tabela de supressão offline aborta transação e faz ROLLBACK total', () => {
        db.suppressionTableOnline = false; // Simulação de indisponibilidade da tabela
        const initialDeal = { ...db.tables.deals.get(synthDealId) };
        const initialSupCount = db.tables.sdr_suppression_list.size;

        assert.throws(() => {
            db.executeSdrTransitionRpc({
                callerClaims: workerClaims,
                p_deal_id: synthDealId,
                p_new_stage: 'stage_perdido',
                p_new_status: 'lost',
                p_reason_code: 'RECUSA_COMERCIAL'
            });
        }, (err) => err.code === '42P01');

        // Confirmação de que o deal NÃO mudou de estado sem que a supressão pudesse ser salva
        assert.deepStrictEqual(db.tables.deals.get(synthDealId), initialDeal);
        assert.strictEqual(db.tables.sdr_suppression_list.size, initialSupCount);
    });

    test('10. PRE-SEND VERIFICATION: Tentativa de envio subsequente para o contacto suprimido é bloqueada', () => {
        // Inserir registo sintético suprimido
        const supRecord = {
            deal_id: synthDealId,
            telefone_normalizado: '351919999999',
            email_normalizado: 'sintetico.teste@staging.internal',
            canal_bloqueado: 'TODOS',
            estado: 'ativo',
            motivo_bloqueio: 'RECUSA_COMERCIAL'
        };

        const checkPhone = checkSuppression({
            deal_id: synthDealId,
            telefone: '919999999',
            canal: 'WHATSAPP'
        }, [supRecord]);

        const checkEmail = checkSuppression({
            deal_id: synthDealId,
            email: 'sintetico.teste@staging.internal',
            canal: 'EMAIL'
        }, [supRecord]);

        assert.strictEqual(checkPhone.bloqueado, true);
        assert.strictEqual(checkPhone.motivo, 'RECUSA_COMERCIAL');
        assert.strictEqual(checkEmail.bloqueado, true);
        assert.strictEqual(checkEmail.motivo, 'RECUSA_COMERCIAL');
    });
});

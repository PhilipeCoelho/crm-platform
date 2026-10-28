/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE HOMOLOGAÇÃO TRANSACIONAL EM STAGING (FASE B.12.4.2)
 * ============================================================================
 * Execução de 15 testes de integração com dados sintéticos no Supabase de Staging:
 * URL: iqplpcwasjmqwfdvzvsc.supabase.co
 * 
 * Regra Inegociável: Produção NUNCA é contactada ou modificada.
 * ============================================================================
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
dotenv.config();

const stagingUrl = process.env.STAGING_SUPABASE_URL || '';
const stagingAnonKey = process.env.STAGING_SUPABASE_ANON_KEY || '';
const prodUrl = process.env.VITE_SUPABASE_URL || '';

describe('VAMUSS SDR — Homologação Transacional em Staging Real (B.12.4.2)', () => {
    let authedClient;
    let unauthedClient;
    let workerUserId;
    let syntheticContactId;
    let syntheticDealId;

    before(async () => {
        // 1. ISOLAMENTO ESTRITO
        assert.ok(stagingUrl, 'STAGING_SUPABASE_URL deve estar definido');
        assert.ok(stagingAnonKey, 'STAGING_SUPABASE_ANON_KEY deve estar definido');
        const stagingHost = new URL(stagingUrl).host;
        const prodHost = prodUrl ? new URL(prodUrl).host : '';
        assert.notStrictEqual(stagingHost, prodHost, 'CRÍTICO: Staging não pode apontar para produção!');
        assert.strictEqual(stagingHost, 'iqplpcwasjmqwfdvzvsc.supabase.co', 'Staging deve ser iqplpcwasjmqwfdvzvsc.supabase.co');

        unauthedClient = createClient(stagingUrl, stagingAnonKey);

        // 2. Autenticação do Worker Sintético no Staging
        const { data: authData, error: authErr } = await unauthedClient.auth.signInWithPassword({
            email: 'sdr.worker.staging@vamuss.com',
            password: 'Password_Staging_2026_Secure!'
        });
        assert.strictEqual(authErr, null, 'Login do sdr_worker em staging deve ser bem-sucedido');
        assert.ok(authData?.session?.access_token, 'JWT de sessão deve existir');
        assert.strictEqual(authData.user.app_metadata?.role, 'sdr_worker', 'Usuário deve possuir papel sdr_worker');
        workerUserId = authData.user.id;

        authedClient = createClient(stagingUrl, stagingAnonKey, {
            global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
        });

        // 3. Criar Contacto e Negócio Sintético de Base
        const { data: contact, error: contactErr } = await authedClient.from('contacts').insert({
            user_id: workerUserId,
            name: 'Lead Sintético Homologação B12.4.2',
            email: 'lead.sintetico.b1242@vamuss.com',
            phone: '+351919999999'
        }).select().single();
        assert.strictEqual(contactErr, null, 'Contacto sintético deve ser criado');
        syntheticContactId = contact.id;

        const { data: deal, error: dealErr } = await authedClient.from('deals').insert({
            user_id: workerUserId,
            contact_id: syntheticContactId,
            title: 'Negócio Sintético B12.4.2 Homologação',
            value: 2000,
            status: 'lost',
            stage_id: 'stage_perdido',
            pipeline_id: 'sales'
        }).select().single();
        assert.strictEqual(dealErr, null, 'Negócio sintético inicial deve ser criado com status=lost');
        syntheticDealId = deal.id;
    });

    test('1. Isolamento Absoluto de Ambientes: Staging !== Produção', () => {
        const stagingHost = new URL(stagingUrl).host;
        const prodHost = new URL(prodUrl).host;
        assert.notStrictEqual(stagingHost, prodHost);
        assert.strictEqual(stagingHost, 'iqplpcwasjmqwfdvzvsc.supabase.co');
        assert.strictEqual(prodHost, 'ueildehrskvsonnlegtx.supabase.co');
    });

    test('2. Rejeição de Status "won" pelo SDR (Proibição Estatutária)', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'won',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO'
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('Status inválido para SDR: won'), 'Deve rejeitar status won');
    });

    test('3. Rejeição de Reativação Sem Inbound Activity ID', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: null
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('Ausência de p_inbound_activity_id comprovando mensagem real recebida'));
    });

    test('4. Rejeição de Atividade Inexistente', async () => {
        const fakeActivityId = '00000000-0000-0000-0000-000000000001';
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: fakeActivityId
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('não encontrada para o negócio'));
    });

    test('5. Rejeição de Atividade Outbound (Disparo Inicial)', async () => {
        const { data: outboundAct } = await authedClient.from('activities').insert({
            user_id: workerUserId,
            deal_id: syntheticDealId,
            type: 'email',
            title: 'Enviar apresentação comercial de vendas',
            notes: 'Apresentação comercial enviada pelo SDR',
            date: new Date().toISOString(),
            completed: true
        }).select().single();

        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: outboundAct.id
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('representa disparo outbound, não mensagem recebida'));
    });

    test('6. Rejeição de Atividade do Tipo "status_change"', async () => {
        const { data: statusAct } = await authedClient.from('activities').insert({
            user_id: workerUserId,
            deal_id: syntheticDealId,
            type: 'status_change',
            title: 'Transição anterior de teste',
            notes: 'Nota técnica de transição',
            date: new Date().toISOString(),
            completed: true
        }).select().single();

        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: statusAct.id
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('não constitui mensagem inbound'));
    });

    test('7. Rejeição de Reativação Baseada em Silêncio ou Ausência de Resposta', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'SILENCIO_SEM_RESPOSTA'
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('não demonstra interesse comprovado'));
    });

    test('8. Rejeição de Reativação Baseada em Resposta Ambígua', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_AMBIGUA'
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('não demonstra interesse comprovado'));
    });

    test('9. Rejeição de Reativação Baseada em Resposta Automática', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_AUTOMATICA'
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('não demonstra interesse comprovado'));
    });

    test('10. Rejeição de Transição para stage_reuniao Sem Integração Ativa de Calendário', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_reuniao',
            p_new_status: 'open',
            p_reason_code: 'REUNIAO_AGENDADA_PELO_SDR'
        });
        assert.strictEqual(data, null);
        assert.ok(error?.message.includes('Ausência de integração operacional ativa com calendário'));
    });

    test('11. Reativação Factualmente Legítima com Mensagem Inbound Comprovada', async () => {
        const { data: validInbound } = await authedClient.from('activities').insert({
            user_id: workerUserId,
            deal_id: syntheticDealId,
            type: 'whatsapp',
            title: 'Mensagem Inbound Recebida do Lead',
            notes: 'Gostaria de agendar uma demonstração do CRM para a nossa equipa de vendas na próxima semana.',
            date: new Date().toISOString(),
            completed: true
        }).select().single();

        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_lead_engajamento',
            p_new_status: 'open',
            p_reason_code: 'RESPOSTA_COM_INTERESSE_COMPROVADO',
            p_inbound_activity_id: validInbound.id,
            p_notes: 'Reativação legítima em Staging após validação estrita de mensagem inbound'
        });

        assert.strictEqual(error, null);
        assert.strictEqual(data?.success, true);
        assert.strictEqual(data?.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(data?.status, 'open');

        // Verificar persistência no banco
        const { data: dealInDb } = await authedClient.from('deals').select('*').eq('id', syntheticDealId).single();
        assert.strictEqual(dealInDb.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(dealInDb.status, 'open');
        assert.strictEqual(dealInDb.lost_at, null);
    });

    test('12. Inserção Automática de Atividade de Auditoria na Timeline', async () => {
        const { data: auditActivities } = await authedClient.from('activities')
            .select('*')
            .eq('deal_id', syntheticDealId)
            .eq('type', 'status_change')
            .order('created_at', { ascending: false });

        assert.ok(auditActivities && auditActivities.length > 0);
        const latest = auditActivities[0];
        assert.ok(latest.title.includes('stage_lead_engajamento'));
        assert.ok(latest.title.includes('RESPOSTA_COM_INTERESSE_COMPROVADO'));
    });

    test('13. Transição Atómica de Recusa com Registo em sdr_suppression_list', async () => {
        const { data, error } = await authedClient.rpc('fn_sdr_transition_deal_stage', {
            p_deal_id: syntheticDealId,
            p_new_stage: 'stage_perdido',
            p_new_status: 'lost',
            p_reason_code: 'RECUSA_OU_PEDIDO_OPOSICAO',
            p_notes: 'Contacto manifestou oposição expressa a novas comunicações'
        });

        assert.strictEqual(error, null);
        assert.strictEqual(data?.success, true);
        assert.strictEqual(data?.stage_id, 'stage_perdido');
        assert.strictEqual(data?.status, 'lost');

        // Validar inserção na lista de supressão
        const { data: suppressionRows, error: suppErr } = await authedClient.from('sdr_suppression_list')
            .select('*')
            .eq('deal_id', syntheticDealId)
            .eq('estado', 'ativo');

        assert.strictEqual(suppErr, null);
        assert.ok(suppRowsValid(suppressionRows));
    });

    test('14. Proteção de Colunas Protegidas via Trigger (trg_guard_sdr_deal_columns)', async () => {
        // Tentar alterar title ou value diretamente via SDR Worker
        const { error } = await authedClient.from('deals')
            .update({ title: 'Hacked Title Tentativa' })
            .eq('id', syntheticDealId);

        // O trigger trg_guard_sdr_deal_columns deve rejeitar a alteração de title pelo SDR
        assert.ok(error !== null, 'Alteração de title por SDR worker deve ser bloqueada pelo trigger');
        assert.ok(error?.message.includes('trg_guard_sdr_deal_columns') || error?.message.includes('SDR Worker'));
    });

    test('15. Respeito Integral à Inexistência da Coluna updated_at em Deals', async () => {
        // Verificar que a tabela deals não possui updated_at e a RPC não tenta atualizá-la
        const { data: deal } = await authedClient.from('deals').select('*').eq('id', syntheticDealId).single();
        assert.strictEqual(deal.updated_at, undefined, 'deals.updated_at não deve existir');
        assert.ok(deal.id);
        assert.ok(deal.status === 'lost');
    });
});

function suppRowsValid(rows) {
    if (!rows || rows.length === 0) return false;
    const item = rows[rows.length - 1];
    return item.motivo_bloqueio === 'RECUSA_COMERCIAL' &&
           item.origem_bloqueio === 'RESPOSTA_INBOUND' &&
           item.canal_bloqueado === 'TODOS' &&
           item.estado === 'ativo';
}

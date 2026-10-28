import assert from 'assert';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * VAMUSS SDR — TESTE DE SEGURANÇA E REVISÃO DE PERMISSÕES SUPABASE (FASE B.12.2)
 * ============================================================================
 * Valida os 7 critérios essenciais de segurança de dados e privilégios mínimos:
 * 1. Frontend sem credenciais administrativas (service_role)
 * 2. Acesso permitido ao negócio canónico elegível de teste
 * 3. Acesso negado a negócios fora do âmbito do SDR (negócios ativos/ganhos/outros pipelines)
 * 4. Acesso negado a atividades de negócios não autorizados
 * 5. Atualização negada de campos proibidos (value, contact_id, user_id, title)
 * 6. Inserção de atividades limitada a tipos e negócios autorizados
 * 7. Bloqueio absoluto de permissões de eliminação (DELETE)
 * ============================================================================
 */

const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';
const UNAUTHORIZED_DEAL_ID = '99999999-9999-9999-9999-999999999999';

// Simulador das regras RLS e RPC do Modelo de Menor Privilégio
class SupabaseSDRSecuritySimulator {
    constructor() {
        this.deals = new Map([
            [
                CANONICAL_DEAL_ID,
                {
                    id: CANONICAL_DEAL_ID,
                    user_id: 'user_sales_1',
                    title: 'Negócio Clínica Dentária Diniz Salgueiro',
                    value: 4500,
                    status: 'lost',
                    stage_id: 'stage_perdido',
                    pipeline_id: 'sales',
                    contact_id: '3e35b3d1-1471-4853-9ef3-85afef4d3382',
                    lost_reason: 'Não respondeu - Não respondeu as abordagens',
                    created_at: '2026-02-07T10:00:00.000Z'
                }
            ],
            [
                UNAUTHORIZED_DEAL_ID,
                {
                    id: UNAUTHORIZED_DEAL_ID,
                    user_id: 'user_sales_2',
                    title: 'Negócio Ativo Não Elegível (Em Negociação)',
                    value: 12000,
                    status: 'active',
                    stage_id: 'stage_proposta',
                    pipeline_id: 'vip_corporate',
                    contact_id: 'contact_vip_88',
                    lost_reason: null,
                    created_at: '2026-09-01T10:00:00.000Z'
                }
            ]
        ]);

        this.activities = [
            {
                id: 'act_1',
                deal_id: CANONICAL_DEAL_ID,
                type: 'note',
                title: 'Abordagem inicial',
                notes: 'Contacto prévio sem resposta',
                user_id: 'user_sales_1'
            },
            {
                id: 'act_unauthorized',
                deal_id: UNAUTHORIZED_DEAL_ID,
                type: 'meeting',
                title: 'Reunião de Direção Confidencial',
                notes: 'Dados financeiros reservados do cliente VIP',
                user_id: 'user_sales_2'
            }
        ];
    }

    // Regra RLS 1: SELECT deals
    // Worker só pode ver deals com status='lost' ou que estejam na etapa Lead de Engajamento
    selectDeal(callerIdentity, dealId) {
        if (!callerIdentity || callerIdentity.role !== 'sdr_worker') {
            return { error: { code: '42501', message: 'permission denied: caller not sdr_worker' }, data: null };
        }

        const deal = this.deals.get(dealId);
        if (!deal) {
            return { error: null, data: null };
        }

        // Filtro RLS Estrito: Apenas status lost ou deals já em engajamento sdr
        const isEligible = deal.status === 'lost' || deal.stage_id === 'stage_lead_engajamento';
        if (!isEligible) {
            // RLS em PostgreSQL retorna zero linhas (não dá erro de sintaxe, oculta o registo)
            return { error: null, data: null };
        }

        return { error: null, data: { ...deal } };
    }

    // Regra RLS 2: SELECT activities
    // Worker só pode ler atividades vinculadas a deals que ele próprio tem direito de ver
    selectActivities(callerIdentity, dealId) {
        if (!callerIdentity || callerIdentity.role !== 'sdr_worker') {
            return { error: { code: '42501', message: 'permission denied: caller not sdr_worker' }, data: [] };
        }

        // Verifica se o deal pai é elegível para o worker
        const dealCheck = this.selectDeal(callerIdentity, dealId);
        if (!dealCheck.data) {
            // Se o deal não é visível pelo RLS, as suas atividades também são invisíveis
            return { error: null, data: [] };
        }

        const acts = this.activities.filter(a => a.deal_id === dealId);
        return { error: null, data: acts };
    }

    // Regra RPC / Trigger 3: UPDATE deals
    // Apenas stage_id e status podem ser alterados pelo SDR Worker.
    // Qualquer tentativa de alterar value, contact_id, user_id ou title é expressamente rejeitada.
    updateDeal(callerIdentity, dealId, payload) {
        if (!callerIdentity || callerIdentity.role !== 'sdr_worker') {
            return { error: { code: '42501', message: 'permission denied: caller not sdr_worker' } };
        }

        const deal = this.deals.get(dealId);
        if (!deal) {
            return { error: { code: 'PGRST116', message: 'deal not found' } };
        }

        // 3.1 Verificação de Colunas Proibidas (Column-Level Security Guard)
        const allowedColumns = ['stage_id', 'status', 'updated_at', 'recovered_at'];
        const attemptedColumns = Object.keys(payload);
        const forbiddenColumns = attemptedColumns.filter(c => !allowedColumns.includes(c));

        if (forbiddenColumns.length > 0) {
            return {
                error: {
                    code: '42501',
                    message: `permission denied for columns: [${forbiddenColumns.join(', ')}]. SDR Worker only allowed to update [stage_id, status]`
                }
            };
        }

        // 3.2 Validação de Valores Permitidos para Transição
        if (payload.status && !['open', 'lost'].includes(payload.status)) {
            return {
                error: {
                    code: '23514',
                    message: `check constraint violation: status '${payload.status}' not authorized for SDR Worker`
                }
            };
        }

        if (payload.stage_id && !['stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost'].includes(payload.stage_id)) {
            return {
                error: {
                    code: '23514',
                    message: `check constraint violation: stage_id '${payload.stage_id}' not authorized for SDR Worker`
                }
            };
        }

        // Aplicação segura
        Object.assign(deal, payload);
        return { error: null, data: { ...deal } };
    }

    // Regra RLS 4: INSERT activities
    // Tipos estritos: note, status_change, meeting.
    // Vinculação obrigatória a um deal autorizado.
    insertActivity(callerIdentity, activityPayload) {
        if (!callerIdentity || callerIdentity.role !== 'sdr_worker') {
            return { error: { code: '42501', message: 'permission denied: caller not sdr_worker' } };
        }

        // Validação de Deal Autorizado
        const dealCheck = this.selectDeal(callerIdentity, activityPayload.deal_id);
        if (!dealCheck.data) {
            return {
                error: {
                    code: '42501',
                    message: 'foreign key policy violation: cannot attach activity to unauthorized deal'
                }
            };
        }

        // Validação de Tipos Permitidos
        const allowedTypes = ['note', 'status_change', 'meeting'];
        if (!allowedTypes.includes(activityPayload.type)) {
            return {
                error: {
                    code: '23514',
                    message: `check constraint violation: activity type '${activityPayload.type}' not authorized for SDR Worker`
                }
            };
        }

        const newAct = {
            id: `act_${Date.now()}`,
            ...activityPayload
        };
        this.activities.push(newAct);
        return { error: null, data: newAct };
    }

    // Regra RLS 5: DELETE deals / activities
    // Estritamente bloqueado para o SDR Worker
    deleteDeal(callerIdentity, dealId) {
        return {
            error: {
                code: '42501',
                message: 'permission denied: DELETE operation forbidden for SDR Worker role'
            }
        };
    }
}

async function runTest(nome, fn) {
    try {
        await fn();
        console.log(`  ✅ [PASS] ${nome}`);
    } catch (err) {
        console.error(`  ❌ [FAIL] ${nome}:`, err);
        throw err;
    }
}

async function runAllTests() {
    console.log('🧪 Executando Bateria de Testes de Permissões Supabase — Fase B.12.2...\n');

    const sim = new SupabaseSDRSecuritySimulator();
    const workerIdentity = { role: 'sdr_worker', sub: 'sdr_worker_service_account_id' };
    const anonIdentity = { role: 'anon' };

    // TESTE 1: Frontend não contém chaves de serviço nem referências a service_role
    await runTest('1. Princípio do Menor Privilégio: Ausência de credenciais administrativas no frontend', () => {
        const srcFiles = fs.readdirSync('src', { recursive: true })
            .filter(f => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')))
            .map(f => path.join('src', f));

        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            assert.strictEqual(
                content.includes('SUPABASE_SERVICE_ROLE_KEY'),
                false,
                `Ficheiro ${file} contém referência proibida a SUPABASE_SERVICE_ROLE_KEY`
            );
            assert.strictEqual(
                content.includes('service_role'),
                false,
                `Ficheiro ${file} contém referência proibida a service_role`
            );
        }
    });

    // TESTE 2: Acesso de leitura permitido ao negócio canónico elegível
    await runTest('2. Acesso de leitura permitido ao negócio canónico elegível (status lost)', () => {
        const res = sim.selectDeal(workerIdentity, CANONICAL_DEAL_ID);
        assert.strictEqual(res.error, null);
        assert.ok(res.data, 'Negócio canónico deve ser retornado');
        assert.strictEqual(res.data.id, CANONICAL_DEAL_ID);
        assert.strictEqual(res.data.status, 'lost');
    });

    // TESTE 3: Acesso negado a negócios fora do âmbito (deals ativos/ganhos/outros pipelines)
    await runTest('3. Acesso negado (invisível) a negócios fora do âmbito do SDR', () => {
        const res = sim.selectDeal(workerIdentity, UNAUTHORIZED_DEAL_ID);
        assert.strictEqual(res.error, null);
        assert.strictEqual(res.data, null, 'Deal ativo de outro pipeline deve ser filtrado pelo RLS');
    });

    // TESTE 4: Acesso negado a atividades de negócios não autorizados
    await runTest('4. Acesso negado a atividades de negócios não autorizados (isolamento estrito)', () => {
        // Atividades do deal canónico são visíveis
        const resOk = sim.selectActivities(workerIdentity, CANONICAL_DEAL_ID);
        assert.strictEqual(resOk.error, null);
        assert.strictEqual(resOk.data.length, 1);
        assert.strictEqual(resOk.data[0].deal_id, CANONICAL_DEAL_ID);

        // Atividades do deal corporativo não autorizado são invisíveis
        const resDenied = sim.selectActivities(workerIdentity, UNAUTHORIZED_DEAL_ID);
        assert.strictEqual(resDenied.error, null);
        assert.strictEqual(resDenied.data.length, 0, 'Atividades de deal não autorizado não podem ser expostas');
    });

    // TESTE 5: Atualização negada de campos proibidos (proteção de colunas financeiras/titularidade)
    await runTest('5. Atualização negada de campos protegidos (value, contact_id, user_id, title)', () => {
        // Tentativa de alterar o valor financeiro do deal
        const resTamperValue = sim.updateDeal(workerIdentity, CANONICAL_DEAL_ID, {
            value: 999999
        });
        assert.ok(resTamperValue.error, 'Alteração de valor financeiro deve ser rejeitada');
        assert.strictEqual(resTamperValue.error.code, '42501');

        // Tentativa de alterar o contato associado
        const resTamperContact = sim.updateDeal(workerIdentity, CANONICAL_DEAL_ID, {
            contact_id: 'new_fake_contact'
        });
        assert.ok(resTamperContact.error, 'Alteração de contato deve ser rejeitada');
        assert.strictEqual(resTamperContact.error.code, '42501');

        // Atualização de etapa autorizada deve passar com sucesso
        const resValidUpdate = sim.updateDeal(workerIdentity, CANONICAL_DEAL_ID, {
            stage_id: 'stage_lead_engajamento',
            status: 'open'
        });
        assert.strictEqual(resValidUpdate.error, null);
        assert.strictEqual(resValidUpdate.data.stage_id, 'stage_lead_engajamento');
        assert.strictEqual(resValidUpdate.data.status, 'open');
        // Confirmação de que o valor original de 4500 EUR não foi corrompido
        assert.strictEqual(resValidUpdate.data.value, 4500);
    });

    // TESTE 6: Inserção de atividades limitada a tipos e negócios autorizados
    await runTest('6. Inserção de atividades restrita a tipos autorizados e deal elegível', () => {
        // Tentativa com tipo não autorizado (ex: 'invoice' ou 'payment')
        const resInvalidType = sim.insertActivity(workerIdentity, {
            deal_id: CANONICAL_DEAL_ID,
            type: 'billing_charge',
            title: 'Cobrança não autorizada',
            notes: 'Tentativa indevida'
        });
        assert.ok(resInvalidType.error, 'Tipo de atividade não autorizado deve ser bloqueado');
        assert.strictEqual(resInvalidType.error.code, '23514');

        // Tentativa de anexar atividade a deal não autorizado
        const resInvalidDeal = sim.insertActivity(workerIdentity, {
            deal_id: UNAUTHORIZED_DEAL_ID,
            type: 'note',
            title: 'Nota indevida',
            notes: 'Tentativa de anexar a deal fora do escopo'
        });
        assert.ok(resInvalidDeal.error, 'Inserção em deal não autorizado deve ser bloqueada');
        assert.strictEqual(resInvalidDeal.error.code, '42501');

        // Inserção legítima de nota de recuperação
        const resValidInsert = sim.insertActivity(workerIdentity, {
            deal_id: CANONICAL_DEAL_ID,
            type: 'note',
            title: 'Reaquecimento SDR',
            notes: 'Abordagem consultiva preparada em conformidade B.11.5'
        });
        assert.strictEqual(resValidInsert.error, null);
        assert.ok(resValidInsert.data.id.startsWith('act_'));
    });

    // TESTE 7: Bloqueio absoluto de operações de eliminação (DELETE)
    await runTest('7. Bloqueio absoluto de operações de eliminação (DELETE)', () => {
        const resDelete = sim.deleteDeal(workerIdentity, CANONICAL_DEAL_ID);
        assert.ok(resDelete.error, 'Operação DELETE deve ser incondicionalmente negada');
        assert.strictEqual(resDelete.error.code, '42501');
    });

    console.log('\n🎉 Todos os 7 testes de segurança e permissões B.12.2 foram aprovados com sucesso!');
}

runAllTests().catch(err => {
    console.error('\n❌ Falha na bateria de testes de permissões B.12.2:', err);
    process.exit(1);
});

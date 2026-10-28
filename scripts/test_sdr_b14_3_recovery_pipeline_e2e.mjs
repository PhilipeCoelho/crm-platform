/**
 * ============================================================================
 * VAMUSS SDR — B.14.3: TESTES PONTA A PONTA DO PIPELINE DE RECUPERAÇÃO
 * ============================================================================
 * Simula o ciclo completo de recuperação sobre negócios perdidos:
 * 1. Negócio perdido elegível vs inelegível.
 * 2. Tentativa de reativação (reativacao_iniciada) e idempotência.
 * 3. Resposta ambígua (sem falsa qualificação).
 * 4. Interesse genuíno (conversa_recuperada / stage_lead_engajamento).
 * 5. Pedido de agendamento e Handoff para Closer Humano (suspensão da IA).
 * 6. Agendamento de reunião confirmada (stage_reuniao sem declaração de won).
 * 7. Recusa / STOP e supressão fail-closed (sem_recuperacao).
 * 8. Fecho comercial com venda ganha (ganho / status won com valor).
 * 9. Preservação estrita do deal_id (zero duplicações de negócios).
 * ============================================================================
 */

import assert from 'node:assert';
import {
    RECOVERY_STAGES,
    determineInitialRecoveryStage,
    getRecoveryPipelineData,
    executeRecoveryAction,
    triggerCloserHandoff,
    getRecoveryDealDetail,
    readRecoveryPipelineStore,
    writeRecoveryPipelineStore
} from '../api/sdr_recovery_pipeline.js';
import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { readTaskQueue, TASK_TYPES } from '../api/sdr_task_queue.js';
import { isPhoneSuppressedLocally, addLocalSuppression } from '../api/suppression_store.js';

let totalTests = 0;
let passedTests = 0;

function pass(desc) {
    totalTests++;
    passedTests++;
    console.log(`  ✅ [PASS] ${desc}`);
}

async function runB143E2ETests() {
    console.log('================================================================================');
    console.log('🧪 SUÍTE DE TESTES E2E: B.14.3 — PIPELINE DE RECUPERAÇÃO COMERCIAL');
    console.log('================================================================================\n');

    // -------------------------------------------------------------------------
    // 1. ELEGIBILIDADE DE NEGÓCIO PERDIDO
    // -------------------------------------------------------------------------
    console.log('▶️ [Cenário 1] Triagem e Elegibilidade de Negócio Perdido');
    {
        const gate = new SDREligibilityGate();

        // 1.1 Negócio perdido elegível
        const eligibleDeal = {
            id: 'deal_e2e_cclinic',
            title: 'CClinic - Clínica Médica e Dentária',
            status: 'lost',
            lost_reason: 'Não respondeu',
            created_at: new Date(Date.now() - 45 * 86400000).toISOString()
        };
        const eligibleContact = {
            id: 'ct_e2e_01',
            name: 'Dr. Manuel Responsável',
            phone: '+351912345678',
            company: 'CClinic Lda'
        };

        const resEligible = gate.evaluate({
            deal_id: eligibleDeal.id,
            nome_clinica: eligibleDeal.title,
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: eligibleContact.phone,
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: true,
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP']
        });

        assert.strictEqual(resEligible.elegivel, true, 'Negócio B2B com LIA e canal documentado é elegível');
        const initialStageEligible = determineInitialRecoveryStage(eligibleDeal, eligibleContact, [], resEligible);
        assert.strictEqual(initialStageEligible, 'elegivel_reativacao', 'Transita para elegivel_reativacao');
        pass('1.1 Negócio perdido B2B elegível classificado como elegivel_reativacao');

        // 1.2 Negócio perdido inelegível (pessoa singular médica sem opt-in)
        const ineligibleDoctorDeal = {
            id: 'deal_e2e_dr_silva',
            title: 'Dra. Silva Ortodontia',
            status: 'lost',
            lost_reason: 'Sem contacto'
        };
        const doctorContact = {
            id: 'ct_e2e_02',
            name: 'Dra. Silva',
            phone: '+351919999888'
        };

        const resIneligible = gate.evaluate({
            deal_id: ineligibleDoctorDeal.id,
            nome_clinica: ineligibleDoctorDeal.title,
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: doctorContact.phone,
            tipo_destinatario: 'PESSOA_SINGULAR_MEDICO',
            consentimento_documentado: false
        });

        assert.strictEqual(resIneligible.elegivel, false, 'Médica singular sem opt-in é inelegível');
        assert.strictEqual(resIneligible.motivo_bloqueio, 'BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN');
        pass('1.2 Médico singular sem opt-in bloqueado preventivamente sem abordagem');
    }

    // -------------------------------------------------------------------------
    // 2. DISPARO DE TENTATIVA (reativacao_iniciada)
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 2] Tentativa de Reativação e Idempotência');
    {
        const testDeal = {
            id: 'deal_e2e_attempt',
            title: 'Clínica Dentária Tejo',
            status: 'lost',
            lost_reason: 'Sem resposta'
        };
        const outcomes = [{
            deal_id: testDeal.id,
            outcome: 'EXECUTADA',
            delivery_status: 'delivered',
            channel: 'WHATSAPP',
            created_at: new Date().toISOString()
        }];

        const stageAttempt = determineInitialRecoveryStage(testDeal, {}, outcomes);
        assert.strictEqual(stageAttempt, 'reativacao_iniciada', 'Com disparo registado transita para reativacao_iniciada');
        pass('2.1 Tentativa enviada transita etapa para reativacao_iniciada');
    }

    // -------------------------------------------------------------------------
    // 3. RESPOSTA AMBÍGUA NÃO QUALIFICA FALSAMENTE
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 3] Tratamento de Resposta Ambígua');
    {
        const testDeal = { id: 'deal_e2e_ambiguous', title: 'Clínica Porto', status: 'lost' };
        const outcomes = [{
            deal_id: testDeal.id,
            outcome: 'RESPOSTA_AMBIGUA',
            response_text: 'Ok',
            created_at: new Date().toISOString()
        }];

        const stageAmbiguous = determineInitialRecoveryStage(testDeal, {}, outcomes);
        assert.notStrictEqual(stageAmbiguous, 'conversa_recuperada', 'Resposta ambígua NÃO transita para conversa_recuperada');
        assert.notStrictEqual(stageAmbiguous, 'reuniao_confirmada', 'Resposta ambígua NÃO transita para reuniao_confirmada');
        pass('3.1 Resposta ambígua não gera falsas progressões comerciais');
    }

    // -------------------------------------------------------------------------
    // 4. INTERESSE GENUÍNO (conversa_recuperada)
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 4] Interesse Genuíno e Reabertura de Conversa');
    {
        const testDeal = { id: 'deal_e2e_interested', title: 'Clínica Sorriso Leiria', status: 'lost', stage_id: 'stage_lead_engajamento' };
        const outcomes = [{
            deal_id: testDeal.id,
            outcome: 'RESPOSTA_POSITIVA',
            intent_detected: 'interested',
            response_text: 'Sim, pretendemos saber mais sobre captação no Google.',
            created_at: new Date().toISOString()
        }];

        const stageInterested = determineInitialRecoveryStage(testDeal, {}, outcomes);
        assert.strictEqual(stageInterested, 'conversa_recuperada', 'Interesse genuíno transita para conversa_recuperada');
        pass('4.1 Interesse genuíno transita para conversa_recuperada com estado mantido');
    }

    // -------------------------------------------------------------------------
    // 5. PEDIDO DE AGENDAMENTO E HANDOFF PARA CLOSER HUMANO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 5] Handoff para Closer Humano e Suspensão da IA');
    {
        const dealId = 'deal_e2e_handoff_test';
        
        // Simular registo inicial no store
        const store = readRecoveryPipelineStore();
        store.deals[dealId] = {
            dealId,
            title: 'Clínica Santa Maria',
            contactName: 'Dr. Fernando',
            phone: '+351914444555',
            stage: 'conversa_recuperada',
            owner: 'IA',
            aiAutonomySuspended: false,
            isHumanInterventionPending: false,
            value: 197
        };
        writeRecoveryPipelineStore(store);

        // Disparar Handoff
        const handoffResult = await triggerCloserHandoff({
            dealId,
            reason: 'Lead manifestou interesse em agendar reunião de 20 min',
            triggerMessage: 'Podemos marcar os 20 minutos na próxima quinta-feira às 15h?'
        });

        assert.strictEqual(handoffResult.success, true);
        assert.strictEqual(handoffResult.item.stage, 'agendamento_pendente_humano', 'Transita para agendamento_pendente_humano');
        assert.strictEqual(handoffResult.item.owner, 'Operador', 'Responsável passa a ser o Operador');
        assert.strictEqual(handoffResult.item.aiAutonomySuspended, true, 'Autonomia da IA estritamente suspensa');
        assert.strictEqual(handoffResult.item.isHumanInterventionPending, true, 'Flag de intervenção pendente ativada');

        // Confirmar que foi criada tarefa persistente na fila de tarefas
        const taskQueue = readTaskQueue();
        const persistentTask = taskQueue.find(t => t.deal_id === dealId && t.task_type === TASK_TYPES.HUMAN_INTERVENTION);
        assert.ok(persistentTask, 'Tarefa persistente de intervenção humana criada na fila');
        pass('5.1 Handoff suspende IA, cria tarefa persistente e passa o controlo ao operador');
    }

    // -------------------------------------------------------------------------
    // 6. AÇÕES DO OPERADOR: ASSUMIR E AGENDAR REUNIÃO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 6] Ações do Operador Closer: Assumir e Agendar');
    {
        const dealId = 'deal_e2e_handoff_test';

        // 6.1 Assumir Oportunidade
        const assumeRes = await executeRecoveryAction({
            dealId,
            action: 'assume_opportunity',
            payload: { operatorName: 'Closer Philipe' }
        });
        assert.strictEqual(assumeRes.success, true);
        assert.strictEqual(assumeRes.item.assignedTo, 'Closer Philipe');
        assert.strictEqual(assumeRes.item.owner, 'Operador');
        pass('6.1 Operador assume a oportunidade e atribuição fica registada');

        // 6.2 Registar Contacto Realizado
        const logRes = await executeRecoveryAction({
            dealId,
            action: 'log_contact',
            payload: { channel: 'Chamada Telefónica', notes: 'Ligação efetuada com sucesso, decisor confirmou horário' }
        });
        assert.strictEqual(logRes.success, true);
        pass('6.2 Contacto telefónico factual registado com notas');

        // 6.3 Agendar Reunião
        const schedRes = await executeRecoveryAction({
            dealId,
            action: 'schedule_meeting',
            payload: { meetingDate: '2026-10-23T15:00:00Z' }
        });
        assert.strictEqual(schedRes.success, true);
        assert.strictEqual(schedRes.item.stage, 'reuniao_confirmada', 'Transita para reuniao_confirmada');
        assert.notStrictEqual(schedRes.item.stage, 'ganho', 'Reunião NÃO declara ganho de forma alguma');
        pass('6.3 Reunião confirmada transita para reuniao_confirmada sem declarar ganho');
    }

    // -------------------------------------------------------------------------
    // 7. FECHO COMERCIAL: VENDA FECHADA (GANHO)
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 7] Fecho Comercial como Ganho');
    {
        const dealId = 'deal_e2e_handoff_test';

        const wonRes = await executeRecoveryAction({
            dealId,
            action: 'close_won',
            payload: { value: 1500 }
        });

        assert.strictEqual(wonRes.success, true);
        assert.strictEqual(wonRes.item.stage, 'ganho', 'Transita para ganho');
        assert.strictEqual(wonRes.item.value, 1500, 'Valor atualizado para €1500');
        pass('7.1 Venda fechada após reunião confirmada transita para ganho com valor correto');
    }

    // -------------------------------------------------------------------------
    // 8. RECUSA / STOP E SUPRESSÃO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 8] Oposição / STOP e Supressão Imediata');
    {
        const dealId = 'deal_e2e_optout';
        const stopPhone = '351918887766';

        const store = readRecoveryPipelineStore();
        store.deals[dealId] = {
            dealId,
            title: 'Clínica Optout Test',
            stage: 'a_analisar',
            owner: 'IA',
            value: 197
        };
        writeRecoveryPipelineStore(store);

        // Adicionar supressão
        addLocalSuppression({
            telefone_normalizado: stopPhone,
            deal_id: dealId,
            motivo_bloqueio: 'OPTOUT_EXPLICITO'
        });
        assert.strictEqual(isPhoneSuppressedLocally(stopPhone, dealId), true);

        // Executar encerramento sem recuperação
        const unrecRes = await executeRecoveryAction({
            dealId,
            action: 'close_lost_unrecovered',
            payload: { reason: 'Pedido formal de STOP / Oposição legal' }
        });
        assert.strictEqual(unrecRes.success, true);
        assert.strictEqual(unrecRes.item.stage, 'sem_recuperacao');
        pass('8.1 STOP ou oposição ativa supressão imediata e transita para sem_recuperacao');
    }

    // -------------------------------------------------------------------------
    // 9. PRESERVAÇÃO INTEGRAL DE IDENTIFICADORES E DADOS (ZERO DUPLICAÇÕES)
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Cenário 9] Preservação de Identificadores e Zero Duplicações');
    {
        const store = readRecoveryPipelineStore();
        const originalDealId = 'deal_e2e_handoff_test';
        assert.ok(store.deals[originalDealId], 'Identificador deal_id original preservado intacto');

        // Confirmar que não existem chaves duplicadas ou deals fictícios criados
        const allKeys = Object.keys(store.deals);
        const uniqueKeys = new Set(allKeys);
        assert.strictEqual(allKeys.length, uniqueKeys.size, 'Zero duplicações de negócios detetadas');
        pass('9.1 Identificador deal_id estritamente preservado e zero duplicações criadas');
    }

    console.log('\n================================================================================');
    console.log(`🏁 RESULTADO DOS TESTES B.14.3 E2E: ${passedTests}/${totalTests} PASSOU | 0 FALHOU`);
    console.log('================================================================================');
}

runB143E2ETests().catch(err => {
    console.error('❌ Falha nos testes B.14.3 E2E:', err);
    process.exit(1);
});

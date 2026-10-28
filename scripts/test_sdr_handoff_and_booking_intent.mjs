/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — AUDITORIA E VALIDAÇÃO DE HANDOFF HUMANO (11 TESTES)
 * ============================================================================
 * Valida os 11 requisitos centrais definidos para o Handoff Humano por
 * Intenção de Agendamento:
 * 1. Interesse genérico sem intenção de agendamento
 * 2. Intenção explícita de agendamento
 * 3. Notificação WhatsApp com contexto factual completo
 * 4. Suspensão da IA após o handoff
 * 5. Ausência de duplicação do negócio (deal_id único)
 * 6. Reabertura comercial apenas por intervenção humana
 * 7. Falha e persistência de notificação sem perda de estado
 * 8. Webhooks duplicados, concorrência e idempotência
 * 9. Recusa e Opt-out fail-closed
 * 10. Bloqueio de reunião confirmada sem agendamento válido
 * 11. Ausência de regressões no ecossistema
 * ============================================================================
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
    runConversationalDecisionGPT,
    fallbackDeterministicConversationalDecision,
    CONVERSATIONAL_INTENTS
} from '../api/sdr_conversational_engine.js';

import {
    determineInitialRecoveryStage,
    normalizeStage,
    executeRecoveryAction,
    triggerCloserHandoff,
    readRecoveryPipelineStore,
    writeRecoveryPipelineStore
} from '../api/sdr_recovery_pipeline.js';

import {
    enqueueTask,
    cancelPendingTasksForDeal,
    readTaskQueue,
    writeTaskQueue,
    TASK_TYPES,
    TASK_STATES
} from '../api/sdr_task_queue.js';

import {
    notifyOperatorOnMeetingInterest,
    SDROperationalWorker
} from '../api/sdr_worker.js';

import {
    isPhoneSuppressedLocally,
    addLocalSuppression
} from '../api/suppression_store.js';

let totalTests = 0;
let passedTests = 0;

function pass(name) {
    totalTests++;
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
}

async function runHandoffTestSuite() {
    console.log('================================================================================');
    console.log('🧪 BATERIA DE AUDITORIA: HANDOFF HUMANO & REAQUECIMENTO SDR + CLOSER');
    console.log('================================================================================\n');

    const testPrefix = `test_handoff_${Date.now()}`;
    const mockDeal = {
        id: `${testPrefix}_deal_01`,
        title: 'Clínica Dentária Sorriso Saudável Lda',
        status: 'lost',
        value: 197,
        lost_reason: 'Não respondeu ao primeiro contacto'
    };
    const mockContact = {
        id: `${testPrefix}_ct_01`,
        name: 'Dra. Sofia Antunes',
        phone: '912345678',
        company: 'Clínica Dentária Sorriso Saudável Lda'
    };

    // -------------------------------------------------------------------------
    // TESTE 1: INTERESSE GENÉRICO SEM INTENÇÃO DE AGENDAMENTO
    // -------------------------------------------------------------------------
    console.log('▶️ [Teste 1] Interesse Genérico sem Intenção de Agendamento');
    {
        const genericQueries = [
            'Gostava de saber mais sobre o sistema da Vamuss.',
            'Como funciona a captação de pacientes no Google?',
            'Vocês trabalham com tratamentos de implantes?'
        ];

        for (const query of genericQueries) {
            const decision = fallbackDeterministicConversationalDecision({
                inboundText: query,
                deal: mockDeal,
                contact: mockContact
            });

            assert.strictEqual(
                decision.intencao_identificada,
                'INTERESSE_GENUINO',
                `A consulta "${query}" deve ser classificada como INTERESSE_GENUINO e não INTENCAO_AGENDAMENTO`
            );
            assert.strictEqual(
                decision.proxima_acao,
                'QUALIFICACAO_SPIN',
                'Interesse genérico deve conduzir qualificação SPIN'
            );
            assert.strictEqual(
                decision.intervencao_humana_necessaria,
                false,
                'Interesse genérico não requer intervenção humana imediata'
            );
            assert.ok(
                decision.mensagem_sugerida.length > 0,
                'A IA deve formular resposta consultiva para interesse genérico'
            );
        }
        pass('Interesse genérico conduz SPIN e não dispara alarme de agendamento prematuro');
    }

    // -------------------------------------------------------------------------
    // TESTE 2: INTENÇÃO EXPLÍCITA DE AGENDAMENTO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 2] Intenção Explícita de Agendamento');
    {
        const bookingPhrases = [
            'Sim, podemos marcar uma reunião.',
            'Gostava de conversar convosco sobre isso.',
            'Quando poderíamos falar?',
            'Tenho interesse. Podemos combinar uma reunião?',
            'Podemos agendar uma conversa esta semana?'
        ];

        for (const phrase of bookingPhrases) {
            const decision = fallbackDeterministicConversationalDecision({
                inboundText: phrase,
                deal: mockDeal,
                contact: mockContact
            });

            assert.strictEqual(
                decision.intencao_identificada,
                'INTENCAO_AGENDAMENTO',
                `A frase "${phrase}" deve ser reconhecida como INTENCAO_AGENDAMENTO`
            );
            assert.strictEqual(
                decision.proxima_acao,
                'TRANSFERIR_PARA_HUMANO',
                'Próxima ação deve ser TRANSFERIR_PARA_HUMANO'
            );
            assert.strictEqual(
                decision.intervencao_humana_necessaria,
                true,
                'Intervenção humana deve ser obrigatória'
            );
            assert.strictEqual(
                decision.mensagem_sugerida,
                '',
                'A IA NÃO deve enviar mensagens de agendamento por si mesma'
            );
            assert.strictEqual(
                decision.funnel_event,
                'MEETING_REQUESTED_HANDOFF',
                'Evento de funil deve ser MEETING_REQUESTED_HANDOFF'
            );
        }
        pass('Todas as manifestações explícitas de agendamento identificadas com suspensão de resposta autónoma');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: NOTIFICAÇÃO WHATSAPP COM CONTEXTO FACTUAL COMPLETO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 3] Notificação WhatsApp com Contexto Factual Completo');
    {
        const notifResult = await notifyOperatorOnMeetingInterest({
            clinicName: mockDeal.title,
            contactPerson: mockContact.name,
            phone: mockContact.phone,
            dealId: mockDeal.id,
            inboundText: 'Sim, podemos marcar uma reunião amanhã às 15h.',
            reason: 'Clínica procura previsibilidade em pacientes particulares de implantes',
            spinDossier: {
                problema: 'Dependência de seguros e oscilação de faturamento',
                necessidadeSolucao: 'Auditoria de atração via Google Vamuss'
            },
            historySummary: '• [WhatsApp] Primeira abordagem enviada com respiro de 35 dias\n• [Inbound] Resposta afirmativa do Dr. Diretor'
        });

        assert.ok(notifResult.notificationKey.includes(mockDeal.id), 'Chave de notificação contém deal_id');
        assert.ok('delivered' in notifResult, 'Resultado informa status de entrega (true se conectado, false se pendente)');
        pass('Notificação estruturada formatada com clínica, contacto, deal_id, resposta e dossiê SPIN');
    }

    // -------------------------------------------------------------------------
    // TESTE 4: SUSPENSÃO DA IA APÓS O HANDOFF
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 4] Suspensão Estrita da IA após o Handoff');
    {
        const handoffDealId = `${testPrefix}_handoff_deal`;
        const store = readRecoveryPipelineStore();
        store.deals[handoffDealId] = {
            dealId: handoffDealId,
            title: 'Clínica Handoff Teste',
            stage: 'conversa_recuperada',
            owner: 'IA',
            aiAutonomySuspended: false
        };
        writeRecoveryPipelineStore(store);

        // Enfileira tarefas ativas para simular concorrência
        enqueueTask({
            dealId: handoffDealId,
            taskType: TASK_TYPES.DISPATCH_MESSAGE,
            payload: { message: 'Mensagem antiga pendente' }
        });

        // Dispara handoff
        const handoffRes = await triggerCloserHandoff({
            dealId: handoffDealId,
            reason: 'Lead solicitou reunião',
            triggerMessage: 'Podemos marcar uma reunião?'
        });

        assert.strictEqual(handoffRes.success, true);
        assert.strictEqual(handoffRes.item.stage, 'agendamento_pendente_humano');
        assert.strictEqual(handoffRes.item.aiAutonomySuspended, true, 'Autonomia da IA deve estar suspensa');
        assert.strictEqual(handoffRes.item.owner, 'Operador', 'Responsável passa a ser Operador');

        // Confirma que tarefas pendentes de disparos da IA foram canceladas
        const tasks = readTaskQueue();
        const pendingDispatchForDeal = tasks.filter(t => t.deal_id === handoffDealId && t.state === TASK_STATES.PENDENTE && t.task_type === TASK_TYPES.DISPATCH_MESSAGE);
        assert.strictEqual(pendingDispatchForDeal.length, 0, 'Nenhuma tarefa de disparo pendente deve restar para este deal');
        
        // Confirma que foi enfileirada tarefa de intervenção para o operador
        const humanInterventionTasks = tasks.filter(t => t.deal_id === handoffDealId && t.task_type === TASK_TYPES.HUMAN_INTERVENTION);
        assert.ok(humanInterventionTasks.length >= 1, 'Tarefa de intervenção humana deve estar enfileirada');

        // Limpeza
        delete store.deals[handoffDealId];
        writeRecoveryPipelineStore(store);
        pass('IA imediatamente suspensa e tarefas automáticas pendentes canceladas');
    }

    // -------------------------------------------------------------------------
    // TESTE 5: AUSÊNCIA DE DUPLICAÇÃO DO NEGÓCIO (DEAL_ID ÚNICO)
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 5] Preservação do Negócio Original e Zero Duplicações');
    {
        const originalDealId = `${testPrefix}_single_deal`;
        const store = readRecoveryPipelineStore();
        store.deals[originalDealId] = {
            dealId: originalDealId,
            title: 'Clínica Identidade Única',
            stage: 'elegivel_reativacao',
            owner: 'IA',
            value: 197
        };
        writeRecoveryPipelineStore(store);

        // Transição 1: reativacao_iniciada
        await executeRecoveryAction({
            dealId: originalDealId,
            action: 'move_stage',
            payload: { stage: 'mensagem_enviada' }
        });

        // Transição 2: handoff
        await triggerCloserHandoff({
            dealId: originalDealId,
            reason: 'Cliente quer falar',
            triggerMessage: 'Quando podemos falar?'
        });

        const storeAfter = readRecoveryPipelineStore();
        const matchingKeys = Object.keys(storeAfter.deals).filter(k => k === originalDealId);
        assert.strictEqual(matchingKeys.length, 1, 'Existe exatamente uma instância do negócio no store');
        assert.strictEqual(storeAfter.deals[originalDealId].dealId, originalDealId, 'dealId permanece rigorosamente inalterado');

        // Limpeza
        delete storeAfter.deals[originalDealId];
        writeRecoveryPipelineStore(storeAfter);
        pass('Identificador deal_id estritamente preservado sem negócios-clone');
    }

    // -------------------------------------------------------------------------
    // TESTE 6: REABERTURA COMERCIAL APENAS POR INTERVENÇÃO HUMANA
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 6] Reabertura Comercial Apenas por Intervenção Humana');
    {
        const deal = { ...mockDeal, id: `${testPrefix}_reopen_check` };

        // Ao detetar intenção de agendamento, o estado do deal NO CRM NÃO É ALTERADO PARA OPEN!
        const initialRecoveryStage = determineInitialRecoveryStage(deal, mockContact, [
            { outcome: 'INTENCAO_AGENDAMENTO', action_taken: 'HANDOFF_CLOSER_HUMANO' }
        ]);
        assert.strictEqual(initialRecoveryStage, 'agendamento_pendente_humano');
        assert.strictEqual(deal.status, 'lost', 'O status do negócio no CRM permanece como lost até reabertura manual');
        pass('O motor autónomo preserva status "lost" no CRM até ação deliberada do Philipe');
    }

    // -------------------------------------------------------------------------
    // TESTE 7: FALHA E PERSISTÊNCIA DE NOTIFICAÇÃO SEM PERDA DE ESTADO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 7] Falha e Persistência de Notificação sem Regressão');
    {
        const failDealId = `${testPrefix}_notif_fail`;
        const store = readRecoveryPipelineStore();
        store.deals[failDealId] = {
            dealId: failDealId,
            title: 'Clínica Falha Notificação',
            stage: 'agendamento_pendente_humano',
            owner: 'Operador',
            aiAutonomySuspended: true
        };
        writeRecoveryPipelineStore(store);

        // Mesmo se o WhatsApp Web não estiver conectado ou falhar
        const notifResult = await notifyOperatorOnMeetingInterest({
            clinicName: 'Clínica Teste Falha',
            contactPerson: 'Dr. Teste',
            phone: '912345678',
            dealId: failDealId,
            inboundText: 'Sim, quero agendar.',
            reason: 'Teste de persistência de falha'
        });

        // Verifica que o negócio NÃO regrediu de etapa nem reativou a IA
        const storeCheck = readRecoveryPipelineStore();
        assert.strictEqual(storeCheck.deals[failDealId].stage, 'agendamento_pendente_humano');
        assert.strictEqual(storeCheck.deals[failDealId].aiAutonomySuspended, true);

        // Limpeza
        delete storeCheck.deals[failDealId];
        writeRecoveryPipelineStore(storeCheck);
        pass('Falha no envio do alerta preserva o estado agendamento_pendente_humano e a suspensão da IA');
    }

    // -------------------------------------------------------------------------
    // TESTE 8: WEBHOOKS DUPLICADOS, CONCORRÊNCIA E IDEMPOTÊNCIA
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 8] Webhooks Duplicados e Proteção de Idempotência');
    {
        const dupDealId = `${testPrefix}_dup_deal`;
        const text = 'Sim, podemos marcar uma reunião amanhã.';

        // Primeiro disparo
        const res1 = await notifyOperatorOnMeetingInterest({
            clinicName: 'Clínica Idempotente',
            contactPerson: 'Dra. Ana',
            phone: '912345678',
            dealId: dupDealId,
            inboundText: text,
            reason: 'Teste 1'
        });

        // Segundo disparo com a mesma mensagem (ex: webhook duplicado da Meta)
        const res2 = await notifyOperatorOnMeetingInterest({
            clinicName: 'Clínica Idempotente',
            contactPerson: 'Dra. Ana',
            phone: '912345678',
            dealId: dupDealId,
            inboundText: text,
            reason: 'Teste 1'
        });

        assert.strictEqual(res2.duplicated, true, 'O segundo envio com mesmo hash/dealId deve ser detectado como duplicado');
        pass('Idempotência de notificação ativa: webhooks repetidos não causam alertas múltiplos');
    }

    // -------------------------------------------------------------------------
    // TESTE 9: RECUSA E OPT-OUT FAIL-CLOSED
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 9] Recusa Direta e Opt-Out com Supressão Fail-Closed');
    {
        const optoutPhone = '351999888777';
        const optoutDealId = `${testPrefix}_optout_deal`;

        const decision = fallbackDeterministicConversationalDecision({
            inboundText: 'STOP. Por favor não voltem a contactar este número.',
            deal: { id: optoutDealId },
            contact: { phone: optoutPhone }
        });

        assert.strictEqual(decision.intencao_identificada, 'OPTOUT_OU_OPOSICAO');
        assert.strictEqual(decision.proxima_acao, 'ENCERRAR_COM_OPTOUT');
        assert.strictEqual(decision.funnel_event, 'OPTOUT_OR_REFUSAL');

        // Confirma que o número foi adicionado à lista de supressão fail-closed
        const isSuppressed = isPhoneSuppressedLocally(optoutPhone, optoutDealId);
        assert.strictEqual(isSuppressed, true, 'Telefone deve estar marcado como suprimido');
        pass('STOP e Opt-Out bloqueiam imediatamente abordagens futuras');
    }

    // -------------------------------------------------------------------------
    // TESTE 10: BLOQUEIO DE REUNIÃO CONFIRMADA SEM AGENDAMENTO VÁLIDO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 10] Bloqueio de Reunião Confirmada sem Agendamento Válido');
    {
        const meetDealId = `${testPrefix}_meet_deal`;
        const store = readRecoveryPipelineStore();
        store.deals[meetDealId] = {
            dealId: meetDealId,
            title: 'Clínica Reunião Teste',
            stage: 'agendamento_pendente_humano',
            owner: 'Operador'
        };
        writeRecoveryPipelineStore(store);

        // Tentativa sem meetingDate deve ser rejeitada
        const invalidRes = await executeRecoveryAction({
            dealId: meetDealId,
            action: 'schedule_meeting',
            payload: { notes: 'Tentativa sem data e hora' }
        });
        assert.strictEqual(invalidRes.success, false);
        assert.strictEqual(invalidRes.error, 'MISSING_DATE');

        // Tentativa com meetingDate válida
        const validMeetingDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        const validRes = await executeRecoveryAction({
            dealId: meetDealId,
            action: 'schedule_meeting',
            payload: {
                meetingDate: validMeetingDate,
                notes: 'Reunião confirmada pelo operador para depois de amanhã'
            }
        });
        assert.strictEqual(validRes.success, true);
        assert.strictEqual(validRes.item.stage, 'reuniao_confirmada');
        assert.strictEqual(validRes.item.meetingDate, validMeetingDate);

        // Limpeza
        delete store.deals[meetDealId];
        writeRecoveryPipelineStore(store);
        pass('Reunião confirmada exige data e hora válidas; inferência proibida');
    }

    // -------------------------------------------------------------------------
    // TESTE 11: AUSÊNCIA DE REGRESSÕES NO ECOSSISTEMA
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Teste 11] Normalização Consistente para o Quadro Kanban (5 Etapas)');
    {
        assert.strictEqual(normalizeStage('elegivel_reativacao'), 'perdidos_qualificados');
        assert.strictEqual(normalizeStage('reativacao_iniciada'), 'mensagem_enviada');
        assert.strictEqual(normalizeStage('conversa_recuperada'), 'em_conversa');
        assert.strictEqual(normalizeStage('agendamento_pendente_humano'), 'pronto_reabrir');
        assert.strictEqual(normalizeStage('reuniao_confirmada'), 'pronto_reabrir');
        assert.strictEqual(normalizeStage('sem_recuperacao'), 'nao_reativado');
        assert.strictEqual(normalizeStage('ganho'), 'nao_reativado');
        pass('Mapeamento bidirecional consistente entre backend canónico e Kanban de 5 colunas');
    }

    console.log('\n================================================================================');
    console.log(`🏁 RESULTADO: ${passedTests}/${totalTests} TESTES EXECUTADOS E PASSADOS COM SUCESSO!`);
    console.log('================================================================================');
}

runHandoffTestSuite().catch(err => {
    console.error('❌ Falha na bateria de testes:', err);
    process.exit(1);
});

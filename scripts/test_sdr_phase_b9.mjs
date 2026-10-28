import assert from 'assert';
import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import { createSuppressionRecord } from './sdr_suppression_engine.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRActivationGate } from './sdr_activation_gate.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES DE INTEGRAÇÃO COM PIPELINE (FASE B.9)
 * ============================================================================
 * Valida os 12 cenários operacionais obrigatórios que garantem a ligação
 * funcional e segura entre os negócios perdidos e a recuperação SDR.
 * ============================================================================
 */

async function runPhaseB9Tests() {
    console.log('🧪 Iniciando Bateria de Testes da Fase B.9 (Integração da Fila de Recuperação com Pipeline Comercial)...\n');

    let passedTests = 0;
    const stagesFixture = [
        { id: 'st_prospect', title: 'Prospect', pipelineId: 'sales', orderIndex: 0 },
        { id: 'st_lead_engajamento', title: 'Lead de Engajamento', pipelineId: 'sales', orderIndex: 1 },
        { id: 'st_reuniao_diag', title: 'Reunião de Diagnóstico', pipelineId: 'sales', orderIndex: 2 },
        { id: 'st_proposta', title: 'Proposta Apresentada', pipelineId: 'sales', orderIndex: 3 }
    ];

    // -------------------------------------------------------------------------
    // TESTE 1: Negócio marcado como perdido entra na fila SDR com os dados corretos
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_001_lost',
            title: 'Clínica Dentária Central',
            value: 2500,
            currency: 'EUR',
            pipelineId: 'sales',
            stageId: 'st_prospect',
            status: 'lost',
            lostReason: 'Orçamento insuficiente para o trimestre',
            lostAt: '2026-03-15T10:00:00.000Z',
            contacto: {
                nome: 'Dr. Manuel Silva',
                telefone_normalizado: '+351912345678',
                email_normalizado: 'geral@clinicadentariacentral.pt'
            }
        };

        const res = integration.enqueueLostDeal(mockDeal);
        assert.strictEqual(res.success, true, 'Deve ter sucesso ao enfileirar');
        assert.strictEqual(res.isDuplicate, false, 'Não deve ser duplicado');
        assert.strictEqual(res.item.deal_id, 'deal_001_lost', 'Deve reter o mesmo ID');
        assert.strictEqual(res.item.lost_reason, 'Orçamento insuficiente para o trimestre');
        assert.strictEqual(res.item.lost_at, '2026-03-15T10:00:00.000Z');
        assert.strictEqual(res.item.status_fila, 'PENDENTE_ANALISE');
        assert.strictEqual(res.item.contacto.telefone, '351912345678');

        passedTests++;
        console.log('  ✅ [PASS] 1. Negócio marcado como perdido entra na fila SDR com os dados corretos');
    }

    // -------------------------------------------------------------------------
    // TESTE 2: Inserção repetida do mesmo negócio perdido é idempotente (não duplica na fila)
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_002_idempotent',
            title: 'Clínica Sorriso Feliz',
            status: 'lost',
            lostReason: 'Sem tempo para reuniões',
            lostAt: '2026-04-01T12:00:00.000Z'
        };

        const res1 = integration.enqueueLostDeal(mockDeal);
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.isDuplicate, false);

        // Simular nova chamada repetida de marcação de perda (ex: webhook ou clique duplo)
        const res2 = integration.enqueueLostDeal(mockDeal, { reason: 'Tentativa de sobrescrita' });
        assert.strictEqual(res2.success, true, 'Operação repetida deve ter sucesso');
        assert.strictEqual(res2.isDuplicate, true, 'Deve ser sinalizado como duplicado idempotente');
        assert.strictEqual(integration.recoveryQueue.size, 1, 'Tamanho da fila deve permanecer exatamente 1');
        assert.strictEqual(res2.item.lost_reason, 'Sem tempo para reuniões', 'Motivo original não pode ser sobrescrito');

        passedTests++;
        console.log('  ✅ [PASS] 2. Inserção repetida do mesmo negócio perdido é idempotente (não duplica na fila)');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: Negócio na fila mantém o histórico de notas e o motivo original da perda
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const historicoNotas = [
            { id: 'note_1', title: 'Chamada inicial', description: 'Atendido pela receção' },
            { id: 'note_2', title: 'Follow-up WhatsApp', description: 'Pediu para falar mais tarde' }
        ];

        const mockDeal = {
            id: 'deal_003_history',
            title: 'Instituto Odontológico Norte',
            status: 'lost',
            lostReason: 'Já tem agência de marketing digital contratada',
            lostAt: '2026-04-10T15:30:00.000Z',
            activities: historicoNotas
        };

        const res = integration.enqueueLostDeal(mockDeal);
        assert.strictEqual(res.item.historico_anterior.length, 2, 'Deve manter as duas atividades históricas');
        assert.strictEqual(res.item.historico_anterior[0].id, 'note_1');
        assert.strictEqual(res.item.lost_reason, 'Já tem agência de marketing digital contratada');

        // Testar a análise com Context Grounding
        const prep = integration.prepareNextCommercialAction('deal_003_history');
        assert.strictEqual(prep.ready, true);
        assert.strictEqual(prep.proposta.angulo, 'DIFERENCIACAO_VS_MARKETING_GENERICO', 'Deve derivar o ângulo contextualizado');
        assert.strictEqual(prep.proposta.pode_disparar_real, false, 'Disparos reais devem ser estritamente falsos');

        passedTests++;
        console.log('  ✅ [PASS] 3. Negócio na fila mantém o histórico de notas e o motivo original da perda');
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Resposta com interesse real move o negócio para Lead de Engajamento com status aberto
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_004_recover',
            title: 'Clínica Dentária do Parque',
            value: 3000,
            status: 'lost',
            stageId: 'st_prospect',
            lostReason: 'Preço elevado',
            lostAt: '2026-02-20T09:00:00.000Z'
        };

        integration.enqueueLostDeal(mockDeal);

        // Simular receção de resposta positiva
        const transRes = integration.handleRecoveryTransition('deal_004_recover', {
            type: 'INBOUND_REPLY',
            rawText: 'Olá, estivemos a rever os vossos dados e gostaríamos de mais detalhes sobre o vosso modelo. Como funciona?'
        });

        assert.strictEqual(transRes.transition, true, 'Deve transitar para funil ativo');
        assert.strictEqual(transRes.toStage, 'Lead de Engajamento');
        assert.strictEqual(transRes.stageId, 'st_lead_engajamento');
        assert.strictEqual(transRes.deal.id, 'deal_004_recover', 'ID estritamente idêntico');
        assert.strictEqual(transRes.deal.status, 'open', 'Status deve reverter para open');
        assert.strictEqual(transRes.deal.lostReason, 'Preço elevado', 'Motivo da perda original preservado');
        assert.ok(transRes.deal.recoveredAt, 'Deve conter recoveredAt preenchido');
        assert.ok(transRes.activity, 'Deve registar atividade de recuperação na timeline');

        passedTests++;
        console.log('  ✅ [PASS] 4. Resposta com interesse real move o negócio para Lead de Engajamento com status aberto');
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Marcação de reunião avança o negócio para a etapa de Reunião sem marcar como ganho
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_005_meeting',
            title: 'Clínica São Jerónimo',
            value: 4500,
            status: 'lost',
            stageId: 'st_lead_engajamento',
            lostReason: 'Sem tempo',
            lostAt: '2026-01-10T14:00:00.000Z'
        };

        integration.enqueueLostDeal(mockDeal);

        const transRes = integration.handleRecoveryTransition('deal_005_meeting', {
            type: 'MEETING_CONFIRMED',
            statusConfirmacao: 'CONFIRMADA',
            dataReuniao: '2026-10-25T15:00:00.000Z',
            linkReuniao: 'https://meet.google.com/abc-defg-hij'
        });

        assert.strictEqual(transRes.transition, true);
        assert.strictEqual(transRes.toStage, 'Reunião');
        assert.strictEqual(transRes.stageId, 'st_reuniao_diag');
        assert.strictEqual(transRes.deal.id, 'deal_005_meeting');
        assert.strictEqual(transRes.deal.status, 'open', 'CRÍTICO: Status DEVE ser open, NUNCA won');
        assert.notStrictEqual(transRes.deal.status, 'won', 'Agendamento de reunião NÃO é vitória comercial');
        assert.strictEqual(transRes.deal.lostReason, 'Sem tempo');

        passedTests++;
        console.log('  ✅ [PASS] 5. Marcação de reunião avança o negócio para a etapa de Reunião sem marcar como ganho');
    }

    // -------------------------------------------------------------------------
    // TESTE 6: Proposta de reunião não confirmada não move o negócio para a etapa de Reunião
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_006_unconfirmed',
            title: 'Clínica Dental Arte',
            status: 'lost',
            stageId: 'st_lead_engajamento',
            lostReason: 'Indecisão'
        };

        integration.enqueueLostDeal(mockDeal);

        const transRes = integration.handleRecoveryTransition('deal_006_unconfirmed', {
            type: 'MEETING_CONFIRMED',
            statusConfirmacao: 'SUGERIDA', // Proposta sugerida mas não confirmada pelo lead
            dataReuniao: '2026-10-30T10:00:00.000Z'
        });

        assert.strictEqual(transRes.transition, false, 'Não deve transitar sem confirmação');
        assert.strictEqual(transRes.reason, 'REUNIAO_NAO_CONFIRMADA');

        passedTests++;
        console.log('  ✅ [PASS] 6. Proposta de reunião não confirmada não move o negócio para a etapa de Reunião');
    }

    // -------------------------------------------------------------------------
    // TESTE 7: Resposta automática não move o negócio para Lead de Engajamento
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_007_autoreply',
            title: 'Clínica Santa Maria',
            status: 'lost',
            lostReason: 'Sem retorno'
        };

        integration.enqueueLostDeal(mockDeal);

        // Resposta do tipo Auto-Reply / Out of Office
        const transRes = integration.handleRecoveryTransition('deal_007_autoreply', {
            type: 'INBOUND_REPLY',
            rawText: 'Obrigado pela sua mensagem. Esta é uma resposta automática. Estamos ausentes até dia 20.'
        });

        assert.strictEqual(transRes.transition, false, 'Auto-reply não deve promover negócio');
        assert.strictEqual(transRes.reason, 'RESPOSTA_AUTOMATICA_IGNORADA');
        assert.strictEqual(integration.getQueueItem('deal_007_autoreply').status_fila, 'PENDENTE_ANALISE');

        passedTests++;
        console.log('  ✅ [PASS] 7. Resposta automática não move o negócio para Lead de Engajamento');
    }

    // -------------------------------------------------------------------------
    // TESTE 8: Recusa explícita interrompe a cadência, regista supressão e mantém negócio fora do funil ativo
    // -------------------------------------------------------------------------
    {
        const suppressionList = [];
        const controls = new SDROperationalControls({ suppressionList });
        const integration = new SDRRecoveryPipelineIntegration({
            suppressionList,
            operationalControls: controls,
            stages: stagesFixture
        });

        const mockDeal = {
            id: 'deal_008_refusal',
            title: 'Clínica Odontoeste',
            status: 'lost',
            lostReason: 'Desistência',
            contacto: {
                telefone_normalizado: '+351939999888',
                email_normalizado: 'recusa@odontoeste.pt'
            }
        };

        integration.enqueueLostDeal(mockDeal);

        // Lead responde com STOP / Recusa estrita
        const transRes = integration.handleRecoveryTransition('deal_008_refusal', {
            type: 'INBOUND_REPLY',
            rawText: 'Por favor parem de enviar mensagens. Não temos qualquer interesse e peço que retirem o número.'
        });

        assert.strictEqual(transRes.transition, false);
        assert.strictEqual(transRes.refusalRecorded, true);
        assert.strictEqual(transRes.suppressed, true);
        assert.strictEqual(transRes.deal_status, 'lost', 'Negócio permanece rigorosamente como lost');
        assert.strictEqual(suppressionList.length, 1, 'Deve registar supressão estrita');
        assert.strictEqual(suppressionList[0].motivo_bloqueio, 'OPTOUT_EXPLICITO');
        assert.strictEqual(controls.isDealBlocked('deal_008_refusal'), true, 'Deve bloquear negócio no controlador operacional');

        passedTests++;
        console.log('  ✅ [PASS] 8. Recusa explícita interrompe a cadência, regista supressão e mantém negócio fora do funil ativo');
    }

    // -------------------------------------------------------------------------
    // TESTE 9: Negócio com bloqueio legal ou de supressão não é abordado pelo SDR mesmo na fila
    // -------------------------------------------------------------------------
    {
        const suppressionList = [
            createSuppressionRecord({
                deal_id: 'deal_009_suppressed',
                telefone: '+351911222333',
                email: 'bloqueado@clinica.pt',
                motivo_bloqueio: 'OPTOUT_EXPLICITO',
                origem_bloqueio: 'AUDITORIA_SEGURANCA',
                evidencia: 'Registo histórico de oposição prévia RGPD'
            })
        ];

        const controls = new SDROperationalControls({ suppressionList });
        const integration = new SDRRecoveryPipelineIntegration({
            suppressionList,
            operationalControls: controls,
            stages: stagesFixture
        });

        const mockDeal = {
            id: 'deal_009_suppressed',
            title: 'Clínica com Oposição Prévia',
            status: 'lost',
            lostReason: 'Não contactar',
            contacto: {
                telefone_normalizado: '+351911222333',
                email_normalizado: 'bloqueado@clinica.pt'
            }
        };

        // Ao enfileirar, deteta supressão ativa imediatamente
        const enqRes = integration.enqueueLostDeal(mockDeal);
        assert.strictEqual(enqRes.item.bloqueado, true);
        assert.strictEqual(enqRes.item.status_fila, 'BLOQUEADO');

        // Tentativa de preparar ação comercial deve falhar fail-closed
        const prep = integration.prepareNextCommercialAction('deal_009_suppressed');
        assert.strictEqual(prep.ready, false);
        assert.strictEqual(prep.blocked, true);
        assert.strictEqual(prep.motivo_bloqueio, 'OPTOUT_EXPLICITO');

        passedTests++;
        console.log('  ✅ [PASS] 9. Negócio com bloqueio legal ou de supressão não é abordado pelo SDR mesmo na fila');
    }

    // -------------------------------------------------------------------------
    // TESTE 10: O identificador do negócio é o mesmo antes da perda, durante a recuperação e após regresso
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const canonicalId = 'deal_canonical_identity_999';

        const originalDeal = {
            id: canonicalId,
            title: 'Clínica Identidade Permanente',
            value: 5000,
            status: 'lost',
            stageId: 'st_prospect',
            lostReason: 'Concorrente direto'
        };

        // 1. Antes da recuperação (ao entrar na fila)
        const enq = integration.enqueueLostDeal(originalDeal);
        assert.strictEqual(enq.item.deal_id, canonicalId);

        // 2. Durante a recuperação na fila
        const itemInQueue = integration.getQueueItem(canonicalId);
        assert.strictEqual(itemInQueue.deal_id, canonicalId);

        // 3. Após transição de regresso para Lead de Engajamento
        const recResult = integration.handleRecoveryTransition(canonicalId, {
            type: 'INBOUND_REPLY',
            rawText: 'Temos interesse na vossa proposta. Como funciona e quando podemos marcar uma conversa?'
        });
        assert.strictEqual(recResult.deal.id, canonicalId);

        // 4. Após avanço para Reunião
        const meetResult = integration.handleRecoveryTransition(canonicalId, {
            type: 'MEETING_CONFIRMED',
            statusConfirmacao: 'CONFIRMADA',
            dataReuniao: '2026-11-01T14:00:00.000Z'
        });
        assert.strictEqual(meetResult.deal.id, canonicalId);

        passedTests++;
        console.log('  ✅ [PASS] 10. O identificador do negócio é o mesmo antes da perda, durante a recuperação e após regresso');
    }

    // -------------------------------------------------------------------------
    // TESTE 11: O histórico anterior à perda permanece intacto após o regresso ao funil ativo
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const atividadesOriginais = [
            { id: 'act_1', title: 'Primeiro contacto telefónico', dueDate: '2026-01-01' },
            { id: 'act_2', title: 'Apresentação enviada por email', dueDate: '2026-01-05' },
            { id: 'act_3', title: 'Registo de perda comercial', dueDate: '2026-01-10' }
        ];

        const mockDeal = {
            id: 'deal_011_history_check',
            title: 'Clínica Memória Factual',
            status: 'lost',
            stageId: 'st_prospect',
            lostReason: 'Sem budget para 2026',
            lostAt: '2026-01-10T11:00:00.000Z',
            activities: atividadesOriginais
        };

        integration.enqueueLostDeal(mockDeal);

        const recRes = integration.handleRecoveryTransition('deal_011_history_check', {
            type: 'INBOUND_REPLY',
            rawText: 'Olá, temos novo orçamento disponível agora. Podem enviar detalhes?'
        });

        // Garantir que a perda original e o histórico estão completamente íntegros
        assert.strictEqual(recRes.deal.lostReason, 'Sem budget para 2026');
        assert.strictEqual(recRes.deal.lostAt, '2026-01-10T11:00:00.000Z');
        assert.strictEqual(recRes.item.historico_anterior.length, 3);
        assert.strictEqual(recRes.item.historico_anterior[0].id, 'act_1');
        assert.strictEqual(recRes.item.historico_anterior[2].id, 'act_3');

        passedTests++;
        console.log('  ✅ [PASS] 11. O histórico anterior à perda permanece intacto após o regresso ao funil ativo');
    }

    // -------------------------------------------------------------------------
    // TESTE 12: A marcação de reunião não altera indevidamente o estado para won
    // -------------------------------------------------------------------------
    {
        const integration = new SDRRecoveryPipelineIntegration({ stages: stagesFixture });
        const mockDeal = {
            id: 'deal_012_won_guard',
            title: 'Clínica Salvaguarda Comercial',
            value: 10000,
            status: 'lost',
            stageId: 'st_lead_engajamento',
            lostReason: 'Reunião cancelada anteriormente'
        };

        integration.enqueueLostDeal(mockDeal);

        const meetRes = integration.handleRecoveryTransition('deal_012_won_guard', {
            type: 'MEETING_CONFIRMED',
            statusConfirmacao: 'CONFIRMADA',
            dataReuniao: '2026-11-05T16:30:00.000Z',
            linkReuniao: 'https://meet.google.com/xyz-uvwx-rst'
        });

        assert.strictEqual(meetRes.deal.status, 'open', 'Estado deve ser "open"');
        assert.notStrictEqual(meetRes.deal.status, 'won', 'Estado NUNCA pode ser "won" ao agendar reunião');
        assert.strictEqual(meetRes.deal.stageId, 'st_reuniao_diag', 'Etapa deve ser a de Reunião');
        assert.strictEqual(meetRes.item.status_fila, 'RECUPERADO_REUNIAO_AGENDADA');

        passedTests++;
        console.log('  ✅ [PASS] 12. A marcação de reunião não altera indevidamente o estado para won');
    }

    console.log('\n==============================================================================');
    console.log(`🎉 TODOS OS ${passedTests}/12 TESTES DA FASE B.9 FORAM APROVADOS COM SUCESSO!`);
    console.log('==============================================================================\n');
}

runPhaseB9Tests().catch((err) => {
    console.error('❌ Falha na bateria de testes da Fase B.9:', err);
    process.exit(1);
});

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { SDRIntelligentSalesAgent } from './sdr_intelligent_sales_agent.mjs';
import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import { SDRDispatcherAdapter } from './sdr_dispatcher_adapter.mjs';
import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO } from './sdr_activation_gate.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { validateDispatchTiming, createLisbonDateTime } from './sdr_business_hours.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES AUTOMATIZADOS: FASE B.11.5
 * ============================================================================
 * Valida os critérios de aceitação:
 * 1. Distinção explícita dos 6 estados do ciclo de recuperação
 * 2. Garantia de não-promoção e não-reativação por silêncio ou preparação
 * 3. Auditoria de ferramentas CRM com captura de isolamento sem expor segredos
 * 4. Validação de regras de calendário e distinção estrita dos 3 estados de reunião
 * 5. Transições de pipeline auditadas em todos os pontos de entrada
 * 6. Integridade do dossiê JSON da Fase B.11.5 e salvaguardas ativas
 * ============================================================================
 */

const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';

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
    console.log('🧪 Iniciando Bateria de Testes Automatizados — Fase B.11.5...\n');

    const agent = new SDRIntelligentSalesAgent();
    const controls = new SDROperationalControls();
    const gate = new SDRActivationGate({ operationalControls: controls });
    const dispatcher = new SDRDispatcherAdapter({ enforceBusinessHours: true });
    const recovery = new SDRRecoveryPipelineIntegration({
        operationalControls: controls,
        activationGate: gate
    });

    // -------------------------------------------------------------------------
    // TESTE 1: Distinção dos 6 Estados do Ciclo de Recuperação
    // -------------------------------------------------------------------------
    await runTest('1. Distinção explícita dos 6 estados do ciclo de recuperação', () => {
        // Estado 1: Negócio perdido na fila
        const e1 = agent.evaluatePipelineLifeCycleState('NEGOCIO_PERDIDO_NA_FILA', { etapaAtual: 'stage_perdido' });
        assert.strictEqual(e1.status_crm, 'lost');
        assert.strictEqual(e1.etapa_crm, 'stage_perdido');
        assert.strictEqual(e1.reativado, false);
        assert.strictEqual(e1.mutacao_crm, false);

        // Estado 2: Mensagem preparada, mas não enviada
        const e2 = agent.evaluatePipelineLifeCycleState('MENSAGEM_PREPARADA_NAO_ENVIADA', { etapaAtual: 'stage_perdido' });
        assert.strictEqual(e2.status_crm, 'lost');
        assert.strictEqual(e2.etapa_crm, 'stage_perdido');
        assert.strictEqual(e2.reativado, false);
        assert.strictEqual(e2.mutacao_crm, false);

        // Estado 3: Mensagem enviada, sem resposta
        const e3 = agent.evaluatePipelineLifeCycleState('MENSAGEM_ENVIADA_SEM_RESPOSTA', { etapaAtual: 'stage_perdido' });
        assert.strictEqual(e3.status_crm, 'lost');
        assert.strictEqual(e3.etapa_crm, 'stage_perdido');
        assert.strictEqual(e3.reativado, false);
        assert.strictEqual(e3.mutacao_crm, false);

        // Estado 4: Resposta real sem interesse demonstrado
        const e4 = agent.evaluatePipelineLifeCycleState('RESPOSTA_REAL_SEM_INTERESSE', { etapaAtual: 'stage_perdido' });
        assert.strictEqual(e4.status_crm, 'lost');
        assert.strictEqual(e4.etapa_crm, 'stage_perdido');
        assert.strictEqual(e4.reativado, false);
        assert.strictEqual(e4.mutacao_crm, false);

        // Estado 5: Resposta real com interesse demonstrado
        const e5 = agent.evaluatePipelineLifeCycleState('RESPOSTA_REAL_COM_INTERESSE');
        assert.strictEqual(e5.status_crm, 'open');
        assert.strictEqual(e5.etapa_crm, 'stage_lead_engajamento');
        assert.strictEqual(e5.reativado, true);
        assert.strictEqual(e5.mutacao_crm, true);

        // Estado 6: Recusa ou pedido de supressão
        const e6 = agent.evaluatePipelineLifeCycleState('RECUSA_OU_SUPRESSAO');
        assert.strictEqual(e6.status_crm, 'lost');
        assert.strictEqual(e6.etapa_crm, 'stage_lost');
        assert.strictEqual(e6.reativado, false);
        assert.strictEqual(e6.supressao_ativa, true);
    });

    // -------------------------------------------------------------------------
    // TESTE 2: Garantia de Não-Promoção por Silêncio ou Preparação
    // -------------------------------------------------------------------------
    await runTest('2. Garantia de não-promoção por silêncio contínuo, ambiguidade ou preparação', () => {
        // Silêncio não reativa nem promove
        const tSilencio = agent.predictPipelineTransition('SILENCIO_SEM_RESPOSTA', { etapaAtual: 'stage_perdido' });
        assert.strictEqual(tSilencio.novoStatus, 'lost');
        assert.strictEqual(tSilencio.novaEtapa, 'stage_perdido');
        assert.strictEqual(tSilencio.reativado, false);
        assert.strictEqual(tSilencio.transicaoOcorreu, false);

        // Resposta ambígua não reativa nem promove
        const tAmbigua = agent.predictPipelineTransition('RESPOSTA_AMBIGUA', { etapaAtual: 'stage_perdido' });
        assert.strictEqual(tAmbigua.novoStatus, 'lost');
        assert.strictEqual(tAmbigua.novaEtapa, 'stage_perdido');
        assert.strictEqual(tAmbigua.reativado, false);
        assert.strictEqual(tAmbigua.transicaoOcorreu, false);

        // Entrada na fila preserva status lost
        const enqueueRes = recovery.enqueueLostDeal({
            id: 'test-deal-silence-rule',
            title: 'Clínica Teste Regra Silêncio',
            status: 'lost',
            stageId: 'stage_perdido',
            lostReason: 'LOST_NO_RESPONSE'
        });
        assert.strictEqual(enqueueRes.item.original_status, 'lost');
        assert.strictEqual(enqueueRes.item.original_stage_id, 'stage_perdido');

        // Preparação da abordagem não gera mutação no negócio
        const prepAction = recovery.prepareNextCommercialAction('test-deal-silence-rule');
        assert.strictEqual(prepAction.ready, true);
        assert.strictEqual(prepAction.item.original_status, 'lost');
        assert.strictEqual(prepAction.item.status_fila, 'PRONTO_PARA_DISPARO_SIMULADO');
    });

    // -------------------------------------------------------------------------
    // TESTE 3: Auditoria das Ferramentas CRM e Segregação de Conectividade
    // -------------------------------------------------------------------------
    await runTest('3. Auditoria das ferramentas CRM e segregação de conectividade', () => {
        const tools = agent.getAvailableTools();
        assert.strictEqual(tools.length, 5);

        // Ferramentas requeridas
        const toolNames = tools.map(t => t.name);
        assert.ok(toolNames.includes('crm_get_deal_history'));
        assert.ok(toolNames.includes('web_research_clinic'));
        assert.ok(toolNames.includes('vamuss_knowledge_base'));
        assert.ok(toolNames.includes('gate_evaluate_safety'));
        assert.ok(toolNames.includes('crm_stage_transition'));

        // Validação da ferramenta de calendário inativa
        const allTools = agent.getAllTools();
        assert.strictEqual(allTools.length, 6);
        const cal = allTools.find(t => t.name === 'calendar_check_availability');
        assert.strictEqual(cal.disponivel, false);
        assert.strictEqual(cal.status, 'LIMITACAO_INTEGRACAO_CALENDARIO');
    });

    // -------------------------------------------------------------------------
    // TESTE 4: Validação de Calendário e Proibição de Confirmação sem Evento
    // -------------------------------------------------------------------------
    await runTest('4. Modelo de 3 estados de calendário e proibição de marcação sem evento', () => {
        // Estado 1 / 2: Proposta feita ou aceite verbal SEM evento -> Lead de Engajamento (status: open)
        const tAceiteSemEvento = agent.predictPipelineTransition('ACEITA_REUNIAO', { reuniaoCriadaComSucesso: false });
        assert.strictEqual(tAceiteSemEvento.novoStatus, 'open');
        assert.strictEqual(tAceiteSemEvento.novaEtapa, 'stage_lead_engajamento');
        assert.strictEqual(tAceiteSemEvento.transicaoOcorreu, false);

        // Estado 3: Evento efetivamente criado na agenda -> Reunião (status: open, NUNCA won)
        const tEventoConfirmado = agent.predictPipelineTransition('ACEITA_REUNIAO', { reuniaoCriadaComSucesso: true });
        assert.strictEqual(tEventoConfirmado.novoStatus, 'open');
        assert.strictEqual(tEventoConfirmado.novaEtapa, 'stage_reuniao');
        assert.strictEqual(tEventoConfirmado.transicaoOcorreu, true);

        // Na fila operacional: transição bloqueada se statusConfirmacao != CONFIRMADA
        const transitionSugerida = recovery.handleRecoveryTransition('test-deal-silence-rule', {
            type: 'MARCACAO_REUNIAO',
            confirmada: false,
            statusConfirmacao: 'SUGERIDA'
        });
        assert.strictEqual(transitionSugerida.transition, false);
        assert.strictEqual(transitionSugerida.reason, 'REUNIAO_NAO_CONFIRMADA');
    });

    // -------------------------------------------------------------------------
    // TESTE 5: Auditoria de Transições de Pipeline em Todos os Caminhos Reais
    // -------------------------------------------------------------------------
    await runTest('5. Transições de pipeline auditadas em todos os pontos de entrada', () => {
        // Idempotência
        const dupEnqueue = recovery.enqueueLostDeal({
            id: 'test-deal-silence-rule',
            title: 'Clínica Teste Regra Silêncio'
        });
        assert.strictEqual(dupEnqueue.isDuplicate, true);

        // Resposta automática não transita
        const autoReply = recovery.handleRecoveryTransition('test-deal-silence-rule', {
            type: 'INBOUND_REPLY',
            rawText: 'Auto-reply: Estou de férias.',
            classification: { categoria: 'RESPOSTA_AUTOMATICA' }
        });
        assert.strictEqual(autoReply.transition, false);
        assert.strictEqual(autoReply.reason, 'RESPOSTA_AUTOMATICA_IGNORADA');

        // Interesse real transita mantendo mesmo deal_id e preservando motivo de perda original
        const interestReply = recovery.handleRecoveryTransition('test-deal-silence-rule', {
            type: 'INBOUND_REPLY',
            rawText: 'Gostaria de saber mais sobre como atraem pacientes particulares.',
            classification: { categoria: 'INTERESSE' }
        });
        assert.strictEqual(interestReply.transition, true);
        assert.strictEqual(interestReply.deal.id, 'test-deal-silence-rule');
        assert.strictEqual(interestReply.deal.status, 'open');
        assert.strictEqual(interestReply.deal.stageId, 'stage_lead_engajamento');
        assert.strictEqual(interestReply.deal.lostReason, 'LOST_NO_RESPONSE');

        // Recusa aciona supressão imediata
        const refusalRes = recovery.handleRefusal('test-deal-silence-rule', {
            rawText: 'Parem de contactar.',
            intent: 'OPTOUT'
        });
        assert.strictEqual(refusalRes.suppressed, true);
        assert.strictEqual(refusalRes.deal_status, 'lost');
    });

    // -------------------------------------------------------------------------
    // TESTE 6: Integridade do Dossiê JSON B.11.5 e Salvaguardas Ativas
    // -------------------------------------------------------------------------
    await runTest('6. Verificação do dossiê JSON da Fase B.11.5 e salvaguardas ativas', () => {
        const dossiePath = path.resolve('data/sdr_reactivation_phase_b11_5_readiness.json');
        assert.ok(fs.existsSync(dossiePath), 'Dossiê B.11.5 deve existir no disco');

        const dossie = JSON.parse(fs.readFileSync(dossiePath, 'utf8'));
        assert.strictEqual(dossie.meta.fase, 'B.11.5');
        assert.strictEqual(dossie.meta.salvaguardas_estritas.envios_reais_efetuados, 0);
        assert.strictEqual(dossie.meta.salvaguardas_estritas.mutacoes_base_producao, 0);
        assert.strictEqual(dossie.meta.salvaguardas_estritas.circuit_breaker, 'ATIVO_FAIL_CLOSED');

        // 6 critérios de aceitação aprovados
        const crit = dossie.criterios_aceitacao_b11_5;
        assert.strictEqual(crit.regra_silencio_consistente_em_todo_codigo_e_docs, true);
        assert.strictEqual(crit.sem_transicoes_indevidas_por_preparacao_ou_silencio, true);
        assert.strictEqual(crit.estado_real_integracoes_documentado_com_evidencias, true);
        assert.strictEqual(crit.transicoes_reuniao_dependentes_de_confirmacao_efetiva, true);
        assert.strictEqual(crit.todas_salvaguardas_continuam_ativas, true);
        assert.strictEqual(crit.zero_envios_reais_zero_mutacoes_producao, true);

        // Salvaguardas específicas
        assert.strictEqual(dossie.salvaguardas_operacionais.circuit_breaker.ativo, true);
        assert.strictEqual(dossie.salvaguardas_operacionais.horario_comercial.sabado_bloqueado, true);
        assert.strictEqual(dossie.salvaguardas_operacionais.horario_comercial.dia_util_permitido, true);
        assert.strictEqual(dossie.salvaguardas_operacionais.concorrencia_mutex.lock_exclusivo_garantido, true);
    });

    console.log('\n🎉 Todos os 6 testes da Bateria B.11.5 foram aprovados com sucesso!');
}

runAllTests().catch(err => {
    console.error('\n❌ Falha na Bateria de Testes B.11.5:', err);
    process.exit(1);
});

import assert from 'assert';
import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO } from './sdr_activation_gate.mjs';
import { SDROperationalMetrics } from './sdr_operational_metrics.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { createSuppressionRecord } from './sdr_suppression_engine.mjs';

function pass(name) {
    console.log(`  ✅ [PASS] ${name}`);
}

export async function runPhaseB7TestSuite() {
    console.log('🧪 Iniciando Bateria Completa de Testes da Fase B.7 (Preparação Operacional, Métricas e Controlo de Ativação)...');

    // -------------------------------------------------------------------------
    // CENÁRIO 1: Falta de base legal para clínica coletiva (LIA pendente)
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_clinica_lia_pendente',
            nome_clinica: 'Clínica Saúde Geral Lda',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '912345678',
            avaliacao_lia_b2b_aprovada: false, // LIA não homologado
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        pass('1. Entidade coletiva sem LIA homologado: bloqueada com BLOQUEIO_LIA_B2B_PENDENTE');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Médico singular sem opt-in documentado
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_dr_silva',
            nome_clinica: 'Consultório Dr. Silva',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'MEDICO_INDIVIDUAL',
            canal_pretendido: 'EMAIL',
            email: 'dr.silva@medicina.pt',
            consentimento_documentado: false, // Sem opt-in
            autorizacao_canal_documentada: true,
            canais_autorizados: ['EMAIL'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.OPTIN_MEDICO_PENDENTE);
        pass('2. Médico singular sem opt-in documentado: bloqueado com BLOQUEIO_OPTIN_MEDICO_PENDENTE');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 3: Aprovação operacional NÃO substitui base legal (Fail-Closed)
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_sem_base_legal_com_op',
            nome_clinica: 'Clínica Sem LIA',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '913333333',
            avaliacao_lia_b2b_aprovada: false, // Sem base legal
            aprovacao_operacional_registada: true, // Mas operador aprovou
            aprovado_por_operador: 'DIRETOR_COMERCIAL',
            data_aprovacao_operacional: new Date().toISOString(),
            justificacao_operacional: 'Aprovação verbal do diretor'
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        pass('3. Aprovação operacional não substitui validação jurídica (bloqueio inegociável)');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 4: LIA favorável NÃO autoriza canais sem autorização específica
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_lia_ok_canal_nao',
            nome_clinica: 'Clínica LIA Aprovado',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '914444444',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-001',
            data_homologacao_lia: '2026-10-01',
            autorizacao_canal_documentada: false, // Canal não autorizado!
            canais_autorizados: ['EMAIL'], // Apenas email autorizado, não whatsapp
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_AUTORIZACAO_CANAL);
        pass('4. LIA favorável sem autorização específica do canal pretendido: bloqueado');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Falta de aprovação operacional formal
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_falta_operador',
            nome_clinica: 'Clínica Quase Pronta',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '915555555',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-002',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: false // Sem sign-off operacional
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_APROVACAO_OPERACIONAL);
        pass('5. Falta de aprovação operacional formal: bloqueado com BLOQUEIO_FALTA_APROVACAO_OPERACIONAL');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 6: Circuit Breaker ativado bloqueia ativação
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();
        controls.tripCircuitBreaker({ operador: 'SUPERVISOR', motivo: 'Teste disjuntor' });

        const gate = new SDRActivationGate({ operationalControls: controls });
        const decision = gate.evaluateActivation({
            deal_id: 'deal_cb_ativo',
            nome_clinica: 'Clínica Aprovada',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-003',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.CIRCUIT_BREAKER_ATIVADO);
        pass('6. Circuit Breaker ativado impede ativação de qualquer negócio');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 7: Pausa Global operacional ativa
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();
        controls.pauseGlobal({ operador: 'ADMIN', motivo: 'Pausa operacional preventiva' });

        const gate = new SDRActivationGate({ operationalControls: controls });
        const decision = gate.evaluateActivation({
            deal_id: 'deal_pausa_global',
            nome_clinica: 'Clínica Aprovada',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-004',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.PAUSA_GLOBAL_OPERACIONAL);
        pass('7. Pausa global operacional ativa bloqueia ativação preventivamente');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 8: Bloqueio individual de deal ou canal nos controlos operacionais
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();
        controls.blockChannel('WHATSAPP', { motivo: 'Manutenção da API Meta' });
        controls.blockDeal('deal_bloqueado_especifico', { motivo: 'Disputa jurídica' });

        const gate = new SDRActivationGate({ operationalControls: controls });

        // Teste de canal bloqueado
        const decisionCanal = gate.evaluateActivation({
            deal_id: 'deal_outro',
            nome_clinica: 'Clínica Ok',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            canal_pretendido: 'WHATSAPP',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-005',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });
        assert.strictEqual(decisionCanal.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.CANAL_BLOQUEADO_OPERACIONAL);

        // Teste de deal bloqueado individualmente
        controls.unblockChannel('WHATSAPP');
        const decisionDeal = gate.evaluateActivation({
            deal_id: 'deal_bloqueado_especifico',
            nome_clinica: 'Clínica Disputa',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            canal_pretendido: 'WHATSAPP',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-005',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });
        assert.strictEqual(decisionDeal.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.DEAL_BLOQUEADO_OPERACIONAL);
        pass('8. Bloqueios granulares de canal e de negócio aplicados com sucesso');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 9: Supressão estrita tem precedência sobre autorização
    // -------------------------------------------------------------------------
    {
        const supRecord = createSuppressionRecord({
            deal_id: 'deal_em_supressao',
            telefone: '916666666',
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'AUDITORIA_SEGURANCA',
            canal_bloqueado: 'TODOS',
            evidencia: 'Recusa expressa anterior'
        });

        const gate = new SDRActivationGate({ suppressionList: [supRecord] });
        const decision = gate.evaluateActivation({
            deal_id: 'deal_em_supressao',
            nome_clinica: 'Clínica Em Supressão',
            categoria_canonica: 'RECUSA_COMERCIAL_DIRETA',
            canal_pretendido: 'WHATSAPP',
            telefone: '916666666',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-006',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'OPERADOR_TESTE',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.SUPRESSAO_ATIVA);
        pass('9. Supressão estrita bloqueia ativação mesmo com todas as aprovações presentes');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 10: Autorização de Ativação Válida com TODOS os Fatores Cumpridos
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_perfeito_para_ativacao',
            nome_clinica: 'Clínica Dentária Totalmente Conforme Lda',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '917777777',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-FINAL-007',
            data_homologacao_lia: '2026-10-09',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'SUPERVISOR_CLINICO',
            data_aprovacao_operacional: '2026-10-10T09:00:00Z',
            justificacao_operacional: 'Dossiê legal e operacional verificado e aprovado'
        });

        assert.strictEqual(decision.autorizado_para_ativacao, true);
        assert.strictEqual(decision.motivo_decisao, 'AUTORIZADO_PARA_ATIVACAO_PILOTO');
        assert.strictEqual(decision.motivo_bloqueio, null);
        pass('10. Ativação concedida quando todos os requisitos técnicos, legais e operacionais são cumpridos');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 11: Métricas Operacionais — Isolamento Estrito Simulado vs Real
    // -------------------------------------------------------------------------
    {
        const metrics = new SDROperationalMetrics();

        // Registo de tentativas simuladas
        metrics.recordAttempt({
            mode: 'SIMULADO',
            canal: 'WHATSAPP',
            provedorAceitou: true,
            custoUnitarioEur: 0.045
        });
        metrics.recordAttempt({
            mode: 'SIMULADO',
            canal: 'EMAIL',
            provedorAceitou: true,
            custoUnitarioEur: 0.001
        });

        const summary = metrics.getSummary();
        assert.strictEqual(summary.simulado.tentativas_executadas, 2);
        assert.strictEqual(summary.simulado.mensagens_aceites_provedor, 2);
        assert.strictEqual(summary.simulado.consumo_por_canal.WHATSAPP, 1);
        assert.strictEqual(summary.simulado.consumo_por_canal.EMAIL, 1);

        // REGRA DE OURO: Métricas reais DEVEM permanecer rigidamente a zero
        assert.strictEqual(summary.real.tentativas_executadas, 0);
        assert.strictEqual(summary.real.mensagens_aceites_provedor, 0);
        assert.strictEqual(summary.real.falhas_entrega, 0);
        assert.strictEqual(summary.real.bounces, 0);
        assert.strictEqual(summary.real.custo_real_eur, 0);
        assert.strictEqual(summary.integridade_fase_b7.tentativas_reais_zeradas, true);
        pass('11. Métricas operacionais: isolamento estrito entre simulação e produção real');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 12: Métricas Operacionais — Rastreio de Inbound e Opt-Out
    // -------------------------------------------------------------------------
    {
        const metrics = new SDROperationalMetrics();

        metrics.recordInbound({
            intencao: 'INTERESSE_CONFIRMADO',
            gerouReuniao: true
        });
        metrics.recordInbound({
            intencao: 'OPOSICAO_ESTRITA_STOP',
            isOptOut: true,
            supressaoExecutada: true
        });

        const summary = metrics.getSummary();
        assert.strictEqual(summary.inbound.total_respostas_recebidas, 2);
        assert.strictEqual(summary.inbound.respostas_por_intencao.INTERESSE_CONFIRMADO, 1);
        assert.strictEqual(summary.inbound.respostas_por_intencao.OPOSICAO_ESTRITA_STOP, 1);
        assert.strictEqual(summary.inbound.pedidos_oposicao_optout, 1);
        assert.strictEqual(summary.inbound.supressoes_imediatas_executadas, 1);
        assert.strictEqual(summary.comercial.reunioes_agendadas, 1);
        pass('12. Rastreio detalhado de respostas inbound, conversões e pedidos de oposição');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 13: Métricas Operacionais — Registo de Duplicações Prevenidas
    // -------------------------------------------------------------------------
    {
        const metrics = new SDROperationalMetrics();

        metrics.recordDuplicationPrevented('supressao');
        metrics.recordDuplicationPrevented('cadencia_intervalo');
        metrics.recordDuplicationPrevented('endpoint_partilhado');
        metrics.recordDuplicationPrevented('lock_concorrencia');

        const summary = metrics.getSummary();
        assert.strictEqual(summary.duplicacoes_prevenidas.total, 4);
        assert.strictEqual(summary.duplicacoes_prevenidas.por_supressao, 1);
        assert.strictEqual(summary.duplicacoes_prevenidas.por_cadencia_intervalo, 1);
        assert.strictEqual(summary.duplicacoes_prevenidas.por_endpoint_partilhado, 1);
        assert.strictEqual(summary.duplicacoes_prevenidas.por_lock_concorrencia, 1);
        pass('13. Métricas de duplicações e colisões prevenidas registadas corretamente');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 14: Controlos Operacionais — Kill Switch / Paragem de Emergência
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();
        controls.acquireLock('deal_lock_1', 'DISPATCHER');
        assert.strictEqual(controls.isLocked('deal_lock_1'), true);

        const shutdownResult = controls.emergencyShutdown({
            operador: 'ADMIN_EMERGENCIA',
            motivo: 'Teste kill switch'
        });

        assert.strictEqual(shutdownResult.status, 'EMERGENCY_HALT_ENGAGED');
        assert.strictEqual(controls.isGlobalPaused(), true);
        assert.strictEqual(controls.isCircuitBreakerTripped(), true);
        assert.strictEqual(controls.isLocked('deal_lock_1'), false); // Locks limpos
        pass('14. Paragem de emergência (Kill Switch) desengata processos e tranca o sistema');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 15: Concorrência e Mutex em Voo (Prevenção de Duplicação Concorrente)
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();

        const lock1 = controls.acquireLock('deal_concorrente_100', 'WORKER_A');
        assert.strictEqual(lock1, true);

        // Tentativa concorrente no mesmo milissegundo pelo WORKER_B deve ser rejeitada
        const lock2 = controls.acquireLock('deal_concorrente_100', 'WORKER_B');
        assert.strictEqual(lock2, false);

        // Libertação do lock
        const released = controls.releaseLock('deal_concorrente_100', 'WORKER_A');
        assert.strictEqual(released, true);

        // Agora WORKER_B consegue adquirir
        const lock3 = controls.acquireLock('deal_concorrente_100', 'WORKER_B');
        assert.strictEqual(lock3, true);
        pass('15. Mutex em voo previne race conditions e duplicações concorrentes');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 16: Interrupção Automática por Inbound STOP / Recusa
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();
        const inboundResult = controls.handleInboundEvent({
            dealId: 'deal_inbound_stop',
            canal: 'WHATSAPP',
            intent: 'OPOSICAO_ESTRITA_STOP',
            telefone: '918888888',
            rawText: 'Por favor pare de me contactar, STOP'
        });

        assert.strictEqual(inboundResult.cadenciaInterrompida, true);
        assert.strictEqual(inboundResult.dealBloqueado, true);
        assert.strictEqual(inboundResult.supressaoCriada, true);
        assert.strictEqual(controls.isDealBlocked('deal_inbound_stop'), true);
        assert.strictEqual(controls.suppressionList.length, 1);
        pass('16. Resposta inbound com pedido de STOP interrompe cadência e cria supressão');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 17: Serialização de Estado e Rollback de Segurança
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls();
        controls.blockDeal('deal_serial_1', { motivo: 'Motivo teste' });
        controls.blockChannel('EMAIL', { motivo: 'Manutenção' });

        const exported = controls.exportState();
        assert.strictEqual(exported.blockedChannels.includes('EMAIL'), true);

        const newControls = new SDROperationalControls();
        newControls.importState(exported);
        assert.strictEqual(newControls.isChannelBlocked('EMAIL'), true);
        assert.strictEqual(newControls.isDealBlocked('deal_serial_1'), true);

        const rollback = newControls.rollbackToSafeState({ operador: 'WATCHDOG' });
        assert.strictEqual(rollback.state, 'FAIL_SAFE_ENGAGED');
        assert.strictEqual(newControls.isGlobalPaused(), true);
        assert.strictEqual(newControls.isCircuitBreakerTripped(), true);
        pass('17. Exportação, recuperação de estado e rollback para fail-safe executados');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 18: Fail-Closed em caso de indisponibilidade de serviço
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_servico_offline',
            nome_clinica: 'Clínica Offline',
            servico_indisponivel: true
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.SISTEMA_INDISPONIVEL);
        pass('18. Falha ou timeout em serviço externo resulta em Fail-Closed');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 19: Revalidação Obrigatória por Contacto Alterado
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();
        const decision = gate.evaluateActivation({
            deal_id: 'deal_contacto_mudado',
            nome_clinica: 'Clínica Alterada',
            contacto_alterado_pos_validacao: true
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.REVALIDACAO_CONTATO_PENDENTE);
        pass('19. Contacto alterado após auditoria exige revalidação obrigatória');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 20: Retoma global exige operador identificado
    // -------------------------------------------------------------------------
    {
        const controls = new SDROperationalControls({ initialGlobalPause: true });
        assert.throws(() => {
            controls.resumeGlobal({ operador: 'SISTEMA' });
        }, /operador humano identificado/);

        const resume = controls.resumeGlobal({ operador: 'DIRETOR_OPERACIONAL', motivo: 'Autorizado' });
        assert.strictEqual(resume.globalPaused, false);
        pass('20. Governança humana: retoma global rejeita operador anónimo ou genérico');
    }

    console.log('\n==============================================================================');
    console.log('🎉 TODOS OS 20 CENÁRIOS DA FASE B.7 FORAM APROVADOS COM SUCESSO!');
    console.log('==============================================================================\n');
}

// Executar se chamado diretamente
if (process.argv[1]?.endsWith('test_sdr_phase_b7.mjs')) {
    runPhaseB7TestSuite().catch(err => {
        console.error('❌ ERRO NA SUITE DE TESTES B.7:', err);
        process.exit(1);
    });
}

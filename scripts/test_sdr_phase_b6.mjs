import assert from 'assert';
import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { SDRDispatcherAdapter, SecurityException } from './sdr_dispatcher_adapter.mjs';
import { SDRCadenceSimulator } from './sdr_cadence_simulator.mjs';
import { classifyInboundResponse } from './sdr_inbound_response_classifier.mjs';
import { SDRPilotSimulationEngine } from './sdr_pilot_simulation_engine.mjs';
import { createSuppressionRecord, checkSuppression } from './sdr_suppression_engine.mjs';

function pass(name) {
    console.log(`  ✅ [PASS] ${name}`);
}

async function runPhaseB6TestSuite() {
    console.log('🧪 Iniciando Bateria Completa de Testes da Fase B.6 (20 Cenários Obrigatórios)...');

    // -------------------------------------------------------------------------
    // CENÁRIO 1: Recusa comercial direta -> bloqueio de todos os canais
    // -------------------------------------------------------------------------
    {
        const supRecord = createSuppressionRecord({
            deal_id: 'deal_recusa_01',
            telefone: '351912000001',
            email: 'recusa@clinica.pt',
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'TODOS',
            evidencia: 'Cliente disse que não tem interesse'
        });

        const gate = new SDREligibilityGate({ suppressionList: [supRecord] });
        const resWhatsApp = gate.evaluate({
            deal_id: 'deal_recusa_01',
            nome_clinica: 'Clínica Recusa',
            categoria_canonica: 'RECUSA_COMERCIAL_DIRETA',
            canal_pretendido: 'WHATSAPP',
            telefone: '912000001'
        });
        const resEmail = gate.evaluate({
            deal_id: 'deal_recusa_01',
            nome_clinica: 'Clínica Recusa',
            categoria_canonica: 'RECUSA_COMERCIAL_DIRETA',
            canal_pretendido: 'EMAIL',
            email: 'recusa@clinica.pt'
        });

        assert.strictEqual(resWhatsApp.autorizado_para_disparo, false);
        assert.strictEqual(resWhatsApp.motivo_bloqueio, 'SUPRESSAO_ATIVA');
        assert.strictEqual(resEmail.autorizado_para_disparo, false);
        assert.strictEqual(resEmail.motivo_bloqueio, 'SUPRESSAO_ATIVA');
        pass('1. Recusa comercial direta: bloqueio de todos os canais abrangidos pela supressão');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Restrição exclusiva de WhatsApp -> WhatsApp bloqueado sem autorizar outros automaticamente
    // -------------------------------------------------------------------------
    {
        const supRecord = createSuppressionRecord({
            deal_id: 'deal_restr_wa',
            telefone: '351912000002',
            email: 'geral@clinicaexclusiva.pt',
            motivo_bloqueio: 'RESTRICAO_CANAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'WHATSAPP',
            evidencia: 'Não enviar por WhatsApp'
        });
        const gate = new SDREligibilityGate({ suppressionList: [supRecord] });

        // WhatsApp bloqueado por restrição expressa
        const resWA = gate.evaluate({
            deal_id: 'deal_restr_wa',
            nome_clinica: 'Clínica Exclusiva',
            categoria_canonica: 'RESTRICAO_CANAL',
            canal_pretendido: 'WHATSAPP',
            telefone: '912000002'
        });
        assert.strictEqual(resWA.autorizado_para_disparo, false);
        assert.strictEqual(resWA.motivo_bloqueio, 'SUPRESSAO_ATIVA');

        // Canal alternativo EMAIL não pode ser presumido como autorizado automaticamente
        const resEmailSemAutorizacao = gate.evaluate({
            deal_id: 'deal_restr_wa',
            nome_clinica: 'Clínica Exclusiva',
            categoria_canonica: 'RESTRICAO_CANAL',
            canal_pretendido: 'EMAIL',
            email: 'geral@clinicaexclusiva.pt',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: false // LIA pendente para Email
        });
        assert.strictEqual(resEmailSemAutorizacao.autorizado_para_disparo, false);
        assert.strictEqual(resEmailSemAutorizacao.motivo_bloqueio, 'PENDENTE_AVALIACAO_LIA_B2B');
        pass('2. Restrição exclusiva de WhatsApp: WhatsApp bloqueado, sem assumir outros canais como autorizados');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 3: Contacto partilhado com negócio suprimido -> bloqueio preventivo
    // -------------------------------------------------------------------------
    {
        const supRecord = createSuppressionRecord({
            deal_id: 'deal_origem_bloqueio',
            telefone: '351912000003',
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'TODOS',
            evidencia: 'Oposição formal'
        });
        const gate = new SDREligibilityGate({ suppressionList: [supRecord] });

        // Deal B (diferente) tentando usar o mesmo telefone suprimido
        const resHeranca = gate.evaluate({
            deal_id: 'deal_herdeiro_inocente',
            nome_clinica: 'Clínica Secundária',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            canal_pretendido: 'WHATSAPP',
            telefone: '912000003',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resHeranca.autorizado_para_disparo, false);
        assert.strictEqual(resHeranca.motivo_bloqueio, 'SUPRESSAO_ATIVA');
        pass('3. Contacto partilhado com negócio suprimido: bloqueio preventivo de acordo com a regra do endpoint');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 4: Médico singular sem opt-in documentado -> bloqueado
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resDoc = gate.evaluate({
            deal_id: 'deal_dr_silva',
            nome_clinica: 'Dr. Fernando Silva',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912000004',
            tipo_destinatario: 'PESSOA_SINGULAR_MEDICO',
            consentimento_documentado: false
        });
        assert.strictEqual(resDoc.autorizado_para_disparo, false);
        assert.strictEqual(resDoc.motivo_bloqueio, 'BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN');
        pass('4. Médico singular sem opt-in documentado: bloqueado');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Clínica coletiva com LIA pendente -> bloqueada
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resClinica = gate.evaluate({
            deal_id: 'deal_clinica_lia',
            nome_clinica: 'Clínica Dentária de Lisboa',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912000005',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: false
        });
        assert.strictEqual(resClinica.autorizado_para_disparo, false);
        assert.strictEqual(resClinica.motivo_bloqueio, 'PENDENTE_AVALIACAO_LIA_B2B');
        pass('5. Clínica coletiva com LIA pendente: bloqueada');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 6: Negócio com histórico incompleto -> bloqueado
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resIncompleto = gate.evaluate({
            deal_id: 'deal_sem_notas',
            nome_clinica: 'Clínica Histórico Vazio',
            categoria_canonica: 'HISTORICO_INCOMPLETO_SEM_EVIDENCIA',
            telefone: '912000006'
        });
        assert.strictEqual(resIncompleto.autorizado_para_disparo, false);
        assert.strictEqual(resIncompleto.motivo_bloqueio, 'COMERCIALMENTE_INELEGIVEL');
        assert.strictEqual(resIncompleto.metadata.categoria_canonica_origem, 'HISTORICO_INCOMPLETO_SEM_EVIDENCIA');
        pass('6. Negócio com histórico incompleto: bloqueado até resolução da insuficiência');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 7: Negócio sem telefone nem email -> não encaminhado
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resSemEndpoint = gate.evaluate({
            deal_id: 'deal_sem_contactos',
            nome_clinica: 'Clínica Sem Meios',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: null,
            email: null,
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resSemEndpoint.autorizado_para_disparo, false);
        assert.strictEqual(resSemEndpoint.motivo_bloqueio, 'SEM_ENDPOINT_VALIDO');
        pass('7. Negócio sem telefone nem email: não encaminhado para envio');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 8: Resposta automática -> encaminhada para tratamento manual
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resAuto = gate.evaluate({
            deal_id: 'deal_auto_reply',
            nome_clinica: 'Clínica Resposta Eletrónica',
            categoria_canonica: 'RESPOSTA_AUTOMATICA',
            telefone: '912000008'
        });
        assert.strictEqual(resAuto.autorizado_para_disparo, false);
        assert.strictEqual(resAuto.motivo_bloqueio, 'RESPOSTA_AUTOMATICA_PENDENTE_MANUAL');
        pass('8. Resposta automática: encaminhada para tratamento manual');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 9: Caso ambíguo -> encaminhado para revisão humana
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resAmbiguo = gate.evaluate({
            deal_id: 'deal_ambiguo_01',
            nome_clinica: 'Clínica Receção Conflituosa',
            categoria_canonica: 'AMBIGUO_OU_GATEKEEPER',
            telefone: '912000009'
        });
        assert.strictEqual(resAmbiguo.autorizado_para_disparo, false);
        assert.strictEqual(resAmbiguo.motivo_bloqueio, 'REVISAO_HUMANA_OBRIGATORIA');
        pass('9. Caso ambíguo: encaminhado para revisão humana');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 10: Proposta comercial anterior -> closer humano, sem template
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resProposta = gate.evaluate({
            deal_id: 'deal_pos_proposta',
            nome_clinica: 'Clínica Proposta 2025',
            categoria_canonica: 'SILENCIO_APOS_PROPOSTA',
            telefone: '912000010'
        });
        assert.strictEqual(resProposta.autorizado_para_disparo, false);
        assert.strictEqual(resProposta.motivo_bloqueio, 'ENCAMINHAMENTO_CLOSER_HUMANO');
        pass('10. Proposta comercial anterior: encaminhada para closer humano, sem template automático');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 11: Pedido de STOP, PARE, SAIR ou CANCELAR -> bloqueio e cancelamento
    // -------------------------------------------------------------------------
    {
        const termosParagem = ['STOP', 'PARE', 'SAIR', 'CANCELAR'];
        for (const t of termosParagem) {
            const classif = classifyInboundResponse({ texto: t, canal_origem: 'WHATSAPP' });
            assert.strictEqual(classif.categoria, 'OPTOUT');
            assert.strictEqual(classif.bloqueio_contacto, true);
        }

        const sim = new SDRCadenceSimulator();
        sim.simulateAttempt({
            deal_id: 'deal_paragem_cadencia',
            nome_clinica: 'Clínica Paragem',
            canal_pretendido: 'WHATSAPP',
            telefone_normalizado: '912000011',
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO_SIMULADO'
        });
        const inboundStop = sim.simulateInboundResponse({
            deal_id: 'deal_paragem_cadencia',
            texto_resposta: 'PARE DE ENVIAR MENSAGENS'
        });
        assert.strictEqual(inboundStop.classificacao.categoria, 'OPTOUT');
        assert.strictEqual(inboundStop.novo_status_cadencia, 'INTERROMPIDA');
        assert.strictEqual(inboundStop.seguimento_cancelado, true);
        pass('11. Pedido de STOP, PARE, SAIR ou CANCELAR: bloqueio e cancelamento dos seguimentos');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 12: Resposta recebida entre duas tentativas -> cancelamento do seguimento
    // -------------------------------------------------------------------------
    {
        const sim = new SDRCadenceSimulator();
        // Tentativa 1 (Dia 1)
        sim.simulateAttempt({
            deal_id: 'deal_interv_resp',
            nome_clinica: 'Clínica Resposta No Meio',
            canal_pretendido: 'WHATSAPP',
            telefone_normalizado: '912000012',
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO_SIMULADO',
            simulatedCurrentDay: 1
        });
        // Resposta inbound recebida no Dia 3
        sim.simulateInboundResponse({
            deal_id: 'deal_interv_resp',
            texto_resposta: 'Não temos interesse neste momento, obrigado.'
        });
        // Tentativa 2 agendada para Dia 7 deve ser sumariamente bloqueada
        const tent2 = sim.simulateAttempt({
            deal_id: 'deal_interv_resp',
            nome_clinica: 'Clínica Resposta No Meio',
            canal_pretendido: 'WHATSAPP',
            telefone_normalizado: '912000012',
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO_SIMULADO',
            simulatedCurrentDay: 7
        });
        assert.strictEqual(tent2.sucesso, false);
        assert.strictEqual(tent2.motivo, 'CADENCIA_INTERROMPIDA');
        pass('12. Resposta recebida entre duas tentativas: cancelamento do seguimento garantido');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 13: Timeout ou erro do CRM -> falha fechada, sem envio
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resTimeout = gate.evaluate({
            deal_id: 'deal_crm_timeout',
            nome_clinica: 'Clínica Timeout',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912000013',
            timeout_crm: true
        });
        assert.strictEqual(resTimeout.autorizado_para_disparo, false);
        assert.strictEqual(resTimeout.motivo_bloqueio, 'FALHA_CRM_FAIL_CLOSED');
        pass('13. Timeout ou erro do CRM: falha fechada, sem envio');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 14: Indisponibilidade do serviço de autorização -> falha fechada
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resServIndisp = gate.evaluate({
            deal_id: 'deal_auth_service_down',
            nome_clinica: 'Clínica Auth Down',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912000014',
            servico_autorizacao_indisponivel: true
        });
        assert.strictEqual(resServIndisp.autorizado_para_disparo, false);
        assert.strictEqual(resServIndisp.motivo_bloqueio, 'SERVICO_AUTORIZACAO_INDISPONIVEL');
        pass('14. Indisponibilidade do serviço de autorização: falha fechada');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 15: Duas execuções concorrentes para o mesmo negócio -> sem duplicação
    // -------------------------------------------------------------------------
    {
        const sim = new SDRCadenceSimulator();
        sim.inFlightLocks.add('deal_concorrente_01'); // simula lock em voo

        const tentConcorrente = sim.simulateAttempt({
            deal_id: 'deal_concorrente_01',
            nome_clinica: 'Clínica Concorrente',
            canal_pretendido: 'WHATSAPP',
            telefone_normalizado: '912000015',
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO_SIMULADO'
        });
        assert.strictEqual(tentConcorrente.sucesso, false);
        assert.strictEqual(tentConcorrente.motivo, 'CONCORRENCIA_BLOQUEADA_MUTEX_ATIVO');
        pass('15. Duas execuções concorrentes para o mesmo negócio: ausência de duplicação');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 16: Circuit Breaker ativado -> nenhum envio real
    // -------------------------------------------------------------------------
    {
        const dispatcher = new SDRDispatcherAdapter({ mode: 'SIMULATION', dryRunOnly: true });
        await assert.rejects(async () => {
            await dispatcher.dispatchReal({
                deal_id: 'deal_real_attempt',
                canal: 'WHATSAPP',
                destinatario: '351912000016',
                mensagem: 'Tentativa real indevida'
            });
        }, SecurityException);

        const stats = dispatcher.getStats();
        assert.strictEqual(stats.chamadas_reais_efetuadas, 0);
        assert.strictEqual(stats.bytes_externos_transmitidos, 0);
        pass('16. Circuit Breaker ativado: nenhum envio real');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 17: Tentativa de iniciar dispatcher real em modo de simulação -> rejeitada
    // -------------------------------------------------------------------------
    {
        // Construtor bloqueia combinação inválida
        assert.throws(() => {
            new SDRDispatcherAdapter({ dryRunOnly: true, allowRealDispatch: true });
        }, SecurityException);

        // Método startRealDispatcher bloqueia em modo de simulação
        const dispatcherSim = new SDRDispatcherAdapter({ dryRunOnly: true });
        assert.throws(() => {
            dispatcherSim.startRealDispatcher();
        }, SecurityException);
        pass('17. Tentativa de iniciar um dispatcher real durante o modo de simulação: rejeitada');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 18: Reinício do processo -> estado de bloqueio e supressão preservado
    // -------------------------------------------------------------------------
    {
        const sim1 = new SDRCadenceSimulator();
        sim1.simulateAttempt({
            deal_id: 'deal_reinicio_01',
            nome_clinica: 'Clínica Reinício',
            canal_pretendido: 'WHATSAPP',
            telefone_normalizado: '912000018',
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO_SIMULADO',
            simulatedCurrentDay: 1
        });
        sim1.simulateInboundResponse({
            deal_id: 'deal_reinicio_01',
            texto_resposta: 'Não voltem a contactar.'
        });

        const exportedState = sim1.exportState();

        // Novo processo / nova instância após crash
        const sim2 = new SDRCadenceSimulator();
        sim2.importState(exportedState);

        const tentPosReinicio = sim2.simulateAttempt({
            deal_id: 'deal_reinicio_01',
            nome_clinica: 'Clínica Reinício',
            canal_pretendido: 'WHATSAPP',
            telefone_normalizado: '912000018',
            elegibilidade_comercial: true,
            autorizacao_contacto: 'AUTORIZADO_SIMULADO',
            simulatedCurrentDay: 7
        });
        assert.strictEqual(tentPosReinicio.sucesso, false);
        assert.strictEqual(tentPosReinicio.motivo, 'CADENCIA_INTERROMPIDA');
        pass('18. Reinício do processo: estado de bloqueio e supressão preservado sem duplicados');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 19: Contacto alterado depois da validação -> revalidação obrigatória
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const resReval = gate.evaluate({
            deal_id: 'deal_mudou_telefone',
            nome_clinica: 'Clínica Telefone Atualizado',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912000019',
            contacto_alterado_pos_validacao: true
        });
        assert.strictEqual(resReval.autorizado_para_disparo, false);
        assert.strictEqual(resReval.motivo_bloqueio, 'REVALIDACAO_CONTATO_OBRIGATORIA');
        pass('19. Contacto alterado depois da validação: revalidação obrigatória');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 20: Ausência de evidência de autorização por canal -> bloqueio
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        // Clínica com LIA, mas sem evidência específica para canal WhatsApp
        const resCanalNaoAutorizado = gate.evaluate({
            deal_id: 'deal_sem_autorizacao_canal',
            nome_clinica: 'Clínica Sem Autorização Canal',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912000020',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: true,
            autorizacao_canal_documentada: false
        });
        assert.strictEqual(resCanalNaoAutorizado.autorizado_para_disparo, false);
        assert.strictEqual(resCanalNaoAutorizado.motivo_bloqueio, 'AUSENCIA_AUTORIZACAO_CANAL');

        // Canal pretendido (WHATSAPP) não consta da lista de canais autorizados (apenas EMAIL)
        const resCanalIncompativel = gate.evaluate({
            deal_id: 'deal_apenas_email',
            nome_clinica: 'Clínica Apenas Email',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            canal_pretendido: 'WHATSAPP',
            telefone: '912000020',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: true,
            canais_autorizados: ['EMAIL']
        });
        assert.strictEqual(resCanalIncompativel.autorizado_para_disparo, false);
        assert.strictEqual(resCanalIncompativel.motivo_bloqueio, 'AUSENCIA_AUTORIZACAO_CANAL');
        pass('20. Ausência de evidência de autorização por canal: bloqueio obrigatório');
    }

    // -------------------------------------------------------------------------
    // TESTE ADICIONAL: Motor de Simulação do Piloto em DRY_RUN
    // -------------------------------------------------------------------------
    {
        const engine = new SDRPilotSimulationEngine();
        const simRecord = await engine.simulateDeal({
            deal_id: 'deal_pilot_test',
            nome_clinica: 'Clínica Teste Piloto',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            canal_pretendido: 'WHATSAPP',
            telefone: '912999888',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: false // LIA pendente
        });
        assert.strictEqual(simRecord.modo_execucao, 'DRY_RUN');
        assert.strictEqual(simRecord.garantias_seguranca.mensagem_real_enviada, false);
        assert.strictEqual(simRecord.categoria_piloto, 'AUTORIZACAO_PENDENTE');
        pass('21. Motor de Simulação do Piloto opera estritamente em DRY_RUN com zero mensagens');
    }

    console.log('\n==============================================================================');
    console.log('🎉 TODOS OS 20+1 CENÁRIOS DA FASE B.6 FORAM APROVADOS COM SUCESSO!');
    console.log('==============================================================================\n');
}

runPhaseB6TestSuite().catch(err => {
    console.error('❌ Erro na suite da Fase B.6:', err);
    process.exit(1);
});

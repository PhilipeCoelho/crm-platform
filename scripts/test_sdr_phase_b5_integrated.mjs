import assert from 'assert';
import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { SDRCadenceSimulator } from './sdr_cadence_simulator.mjs';
import { SDRDispatcherAdapter, SecurityException } from './sdr_dispatcher_adapter.mjs';
import { SDROperationalPipeline } from './sdr_operational_pipeline.mjs';
import {
    checkSuppression,
    createSuppressionRecord,
    deduplicateSuppressionList
} from './sdr_suppression_engine.mjs';
import { classifyInboundResponse } from './sdr_inbound_response_classifier.mjs';

/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES DE INTEGRAÇÃO PROFUNDA (FASE B.5)
 * ============================================================================
 * Cobertura completa dos 16 cenários críticos e funcionais obrigatórios.
 * ============================================================================
 */

async function runPhaseB5Tests() {
    console.log('🧪 Iniciando Bateria de Testes de Integração e Segurança — Vamuss SDR Fase B.5...');
    let passedTests = 0;

    // Helper para registar sucesso
    function pass(descricao) {
        passedTests++;
        console.log(`  ✅ [PASS] ${passedTests}. ${descricao}`);
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 1: AUSÊNCIA DE AUTORIZAÇÃO (SILÊNCIO NÃO É AUTORIZAÇÃO)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Autorização Legal e Estado Comercial ---');
    {
        const gate = new SDREligibilityGate();
        // Pessoa singular (Médico) sem consentimento documentado
        const resDoctor = gate.evaluate({
            deal_id: 'deal_doc_01',
            nome_clinica: 'Dr. Manuel Silva',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'PESSOA_SINGULAR_MEDICO',
            consentimento_documentado: false,
            telefone: '912345678'
        });
        assert.strictEqual(resDoctor.autorizado_para_disparo, false);
        assert.strictEqual(resDoctor.motivo_bloqueio, 'BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN');

        // Entidade coletiva sem LIA B2B aprovado
        const resClinic = gate.evaluate({
            deal_id: 'deal_cli_01',
            nome_clinica: 'Clínica Sorriso Aberto Lda',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            avaliacao_lia_b2b_aprovada: false,
            telefone: '213456789'
        });
        assert.strictEqual(resClinic.autorizado_para_disparo, false);
        assert.strictEqual(resClinic.motivo_bloqueio, 'PENDENTE_AVALIACAO_LIA_B2B');
        pass('Ausência de autorização: Silêncio comercial bloqueia disparos para pessoa singular e coletiva sem base legal');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 2: RECUSA FORMAL (OPTOUT / ART. 13º DL 7/2004)
    // -------------------------------------------------------------------------
    {
        const supRecord = createSuppressionRecord({
            deal_id: 'deal_optout_01',
            telefone: '912999000',
            motivo_bloqueio: 'OPTOUT_EXPLICITO',
            origem_bloqueio: 'RESPOSTA_INBOUND',
            canal_bloqueado: 'TODOS',
            evidencia: 'Cliente exigiu remoção imediata'
        });
        const gate = new SDREligibilityGate({ suppressionList: [supRecord] });

        const res = gate.evaluate({
            deal_id: 'deal_optout_01',
            nome_clinica: 'Clínica X',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912999000',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(res.autorizado_para_disparo, false);
        assert.strictEqual(res.motivo_bloqueio, 'SUPRESSAO_ATIVA');
        pass('Recusa formal (OPTOUT): Bloqueio absoluto imposto pelo Gate');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 3: RESTRIÇÃO DE CANAL (WHATSAPP BLOQUEADO COM EMAIL PERMITIDO)
    // -------------------------------------------------------------------------
    {
        const supRecord = createSuppressionRecord({
            deal_id: 'deal_restr_01',
            telefone: '912888777',
            motivo_bloqueio: 'RESTRICAO_CANAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'WHATSAPP',
            evidencia: 'Pediu contacto estritamente por email'
        });
        const gate = new SDREligibilityGate({ suppressionList: [supRecord] });

        // Tentativa via WhatsApp deve ser bloqueada
        const resWhatsApp = gate.evaluate({
            deal_id: 'deal_restr_01',
            nome_clinica: 'Clínica Y',
            categoria_canonica: 'RESTRICAO_CANAL',
            canal_pretendido: 'WHATSAPP',
            telefone: '912888777',
            email: 'contacto@clinicay.pt',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resWhatsApp.autorizado_para_disparo, false);
        assert.strictEqual(resWhatsApp.motivo_bloqueio, 'SUPRESSAO_ATIVA');

        // Consulta direta de supressão para EMAIL não conflita
        const checkEmail = checkSuppression({
            deal_id: 'deal_restr_01',
            telefone: '912888777',
            email: 'contacto@clinicay.pt',
            canal: 'EMAIL'
        }, [supRecord]);
        assert.strictEqual(checkEmail.bloqueado, false);
        pass('Restrição de canal: Bloqueia WhatsApp no servidor sem contaminar o canal Email válido');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 4: CONTACTO PARTILHADO (AMBIGUIDADE ENTRE ENTIDADES)
    // -------------------------------------------------------------------------
    {
        const sharedMap = new Map();
        sharedMap.set('351910111222', ['deal_entidade_A', 'deal_entidade_B']);

        const gate = new SDREligibilityGate({ sharedEndpointsMap: sharedMap });
        const res = gate.evaluate({
            deal_id: 'deal_entidade_C', // deal desconhecido tentando usar telefone partilhado
            nome_clinica: 'Clínica C',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '910111222',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(res.autorizado_para_disparo, false);
        assert.strictEqual(res.motivo_bloqueio, 'CONFLITO_ENDPOINT_PARTILHADO');
        pass('Contacto partilhado: Bloqueia disparo perante ambiguidade de endpoint entre clínicas distintas');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 5: IDENTIDADE AMBÍGUA OU DADOS INCOMPLETOS
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        // Deal sem identificador
        const resNoId = gate.evaluate({
            deal_id: '',
            nome_clinica: 'Clínica Teste',
            categoria_canonica: 'SILENCIO_CONFIRMADO'
        });
        assert.strictEqual(resNoId.autorizado_para_disparo, false);
        assert.strictEqual(resNoId.motivo_bloqueio, 'INTEGRIDADE_DADOS_INVALIDA');

        // Deal sem telefone nem email
        const resNoEndpoints = gate.evaluate({
            deal_id: 'deal_sem_endpoint',
            nome_clinica: 'Clínica Sem Meio',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: null,
            email: null,
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resNoEndpoints.autorizado_para_disparo, false);
        assert.strictEqual(resNoEndpoints.motivo_bloqueio, 'SEM_ENDPOINT_VALIDO');
        pass('Identidade ambígua / Dados incompletos: Fail-safe closed imediato');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 6: HISTÓRICO INSUFICIENTE (SEM EVIDÊNCIA FACTUAL)
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        const res = gate.evaluate({
            deal_id: 'deal_no_history',
            nome_clinica: 'Clínica Fantasma',
            categoria_canonica: 'HISTORICO_INCOMPLETO_SEM_EVIDENCIA',
            telefone: '914000111'
        });
        assert.strictEqual(res.autorizado_para_disparo, false);
        assert.strictEqual(res.motivo_bloqueio, 'COMERCIALMENTE_INELEGIVEL');
        pass('Histórico insuficiente: Bloqueado preventivamente para revisão de cadastro');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 7: RESPOSTA NEGATIVA INBOUND (RECUSA COMERCIAL)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Respostas Inbound e Cadência ---');
    {
        const simulator = new SDRCadenceSimulator();
        simulator.simulateAttempt({
            deal_id: 'deal_inbound_neg',
            nome_clinica: 'Clínica Alpha',
            canal_pretendido: 'WHATSAPP',
            autorizacao_contacto: 'AUTORIZADO',
            simulatedCurrentDay: 1
        });

        const inbound = simulator.simulateInboundResponse({
            deal_id: 'deal_inbound_neg',
            texto_resposta: 'Agradecemos o vosso contacto, mas não temos interesse de momento.'
        });
        assert.strictEqual(inbound.classificacao.categoria, 'RECUSA_COMERCIAL');
        assert.strictEqual(inbound.novo_status_cadencia, 'INTERROMPIDA');
        assert.strictEqual(inbound.seguimento_cancelado, true);

        // Tentativa de follow-up posterior é bloqueada
        const followUp = simulator.simulateAttempt({
            deal_id: 'deal_inbound_neg',
            nome_clinica: 'Clínica Alpha',
            canal_pretendido: 'WHATSAPP',
            autorizacao_contacto: 'AUTORIZADO',
            simulatedCurrentDay: 7
        });
        assert.strictEqual(followUp.sucesso, false);
        assert.strictEqual(followUp.motivo, 'CADENCIA_INTERROMPIDA');
        pass('Resposta negativa inbound: Cancela cadência imediatamente e impede qualquer novo envio');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 8: PEDIDO DE PARAGEM (STOP / PARE / SAIR)
    // -------------------------------------------------------------------------
    {
        const classifStop = classifyInboundResponse({ texto: 'STOP' });
        assert.strictEqual(classifStop.categoria, 'OPTOUT');
        assert.strictEqual(classifStop.bloqueio_contacto, true);

        const classifPare = classifyInboundResponse({ texto: 'PARE DE ENVIAR MENSAGENS' });
        assert.strictEqual(classifPare.categoria, 'OPTOUT');
        assert.strictEqual(classifPare.bloqueio_contacto, true);
        pass('Pedido de paragem (STOP / PARE): Reconhecido como OPTOUT formal com bloqueio absoluto');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 9: EVENTOS DUPLICADOS (IDEMPOTÊNCIA ESTRITA)
    // -------------------------------------------------------------------------
    {
        const r1 = createSuppressionRecord({
            deal_id: 'deal_dup_01',
            telefone: '915555444',
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'TODOS',
            evidencia: 'Recusou na chamada'
        });
        const r2 = createSuppressionRecord({
            deal_id: 'deal_dup_01',
            telefone: '915555444',
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'TODOS',
            evidencia: 'Recusou na chamada (evento repetido)'
        });
        const deduplicated = deduplicateSuppressionList([r1, r2]);
        assert.strictEqual(deduplicated.length, 1);
        pass('Eventos duplicados: Idempotência estrita na deduplicação de registos de supressão');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 10: TENTATIVAS CONCORRENTES (MUTEX EM VOO)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Concorrência, Resiliência e Falhas ---');
    {
        const simulator = new SDRCadenceSimulator();
        simulator.inFlightLocks.add('deal_concorrente_01'); // Simula corrida em voo

        const attemptConcurrent = simulator.simulateAttempt({
            deal_id: 'deal_concorrente_01',
            nome_clinica: 'Clínica Concorrente',
            autorizacao_contacto: 'AUTORIZADO',
            simulatedCurrentDay: 1
        });
        assert.strictEqual(attemptConcurrent.sucesso, false);
        assert.strictEqual(attemptConcurrent.motivo, 'CONCORRENCIA_BLOQUEADA_MUTEX_ATIVO');
        pass('Tentativas concorrentes: Mutex atómico em voo impede execuções simultâneas no mesmo negócio');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 11: REINÍCIO DO PROCESSO (CRASH RECOVERY / RESUME STATE)
    // -------------------------------------------------------------------------
    {
        const sim1 = new SDRCadenceSimulator();
        sim1.simulateAttempt({
            deal_id: 'deal_persist_01',
            nome_clinica: 'Clínica Persistente',
            autorizacao_contacto: 'AUTORIZADO',
            simulatedCurrentDay: 1
        });

        // Exporta estado simulando crash / fecho do processo
        const savedState = sim1.exportState();
        assert.strictEqual(savedState.totalSimulatedSends, 1);

        // Novo processo reiniciado
        const sim2 = new SDRCadenceSimulator();
        const importedOk = sim2.importState(savedState);
        assert.strictEqual(importedOk, true);
        assert.strictEqual(sim2.totalSimulatedSends, 1);

        const restoredDeal = sim2.cadenceStates.get('deal_persist_01');
        assert.strictEqual(restoredDeal.tentativas_realizadas, 1);
        assert.strictEqual(restoredDeal.status_cadencia, 'EM_ANDAMENTO');

        // Tentativa prematura no dia 3 deve respeitar o intervalo mínimo de 5 dias
        const prematureAttempt = sim2.simulateAttempt({
            deal_id: 'deal_persist_01',
            nome_clinica: 'Clínica Persistente',
            autorizacao_contacto: 'AUTORIZADO',
            simulatedCurrentDay: 3
        });
        assert.strictEqual(prematureAttempt.sucesso, false);
        assert.strictEqual(prematureAttempt.motivo, 'INTERVALO_MINIMO_NAO_ATINGIDO');
        pass('Reinício do processo: Serialização e restauração mantêm integridade sem disparos duplicados');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 12: FALHA DE CONSULTA DE SUPRESSÃO (FAIL-SAFE CLOSED)
    // -------------------------------------------------------------------------
    {
        // Passa lista nula ou formato corrupto
        const resNullList = checkSuppression({ deal_id: 'deal_check_err' }, null);
        assert.strictEqual(resNullList.bloqueado, true);
        assert.strictEqual(resNullList.motivo, 'FALHA_SISTEMA_FAIL_SAFE_CLOSED');
        assert.strictEqual(resNullList.criterio_match, 'fail_safe_closed');
        pass('Falha de consulta de supressão: Fail-safe closed garante bloqueio preventivo');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 13: FALHA DE VERIFICAÇÃO DE AUTORIZAÇÃO (FAIL-SAFE CLOSED)
    // -------------------------------------------------------------------------
    {
        const gate = new SDREligibilityGate();
        // Dispara com payload corrompido que causaria crash se não protegido
        const resGateFail = gate.evaluate(null);
        assert.strictEqual(resGateFail.autorizado_para_disparo, false);
        assert.strictEqual(resGateFail.etapa_falha, 10);
        pass('Falha de verificação de autorização: Payload nulo resulta em bloqueio seguro');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 14: KILLSWITCH ATIVO (GLOBAL E INDIVIDUAL)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Travas de Segurança Operacional ---');
    {
        const gateGlobal = new SDREligibilityGate({ killswitchGlobal: true });
        const resGlobal = gateGlobal.evaluate({
            deal_id: 'deal_ks_01',
            nome_clinica: 'Clínica KS',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912345678',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resGlobal.autorizado_para_disparo, false);
        assert.strictEqual(resGlobal.motivo_bloqueio, 'KILLSWITCH_GLOBAL_ATIVO');

        const gateContact = new SDREligibilityGate({ killswitchContacts: new Set(['deal_ks_target']) });
        const resTarget = gateContact.evaluate({
            deal_id: 'deal_ks_target',
            nome_clinica: 'Clínica Alvo KS',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912345678',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resTarget.autorizado_para_disparo, false);
        assert.strictEqual(resTarget.motivo_bloqueio, 'KILLSWITCH_INDIVIDUAL_ATIVO');

        const resOther = gateContact.evaluate({
            deal_id: 'deal_ks_other',
            nome_clinica: 'Outra Clínica',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '912345678',
            avaliacao_lia_b2b_aprovada: true
        });
        assert.strictEqual(resOther.autorizado_para_disparo, true);
        pass('Killswitch ativo: Global bloqueia tudo; Individual protege apenas o contacto visado');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 15: ISOLAMENTO ENTRE ORGANIZAÇÕES (MULTI-TENANT BOUNDARY)
    // -------------------------------------------------------------------------
    {
        const supOrgA = createSuppressionRecord({
            deal_id: 'deal_shared_key',
            telefone: '916666777',
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'TODOS',
            evidencia: 'Recusa na Org A',
            organization_id: 'tenant_org_A'
        });

        // Consulta da Org B pelo mesmo telefone não sofre contaminação indevida da Org A
        const checkOrgB = checkSuppression({
            deal_id: 'deal_diff_org',
            telefone: '916666777',
            organization_id: 'tenant_org_B'
        }, [supOrgA]);
        assert.strictEqual(checkOrgB.bloqueado, false);

        // Consulta da Org A com o mesmo telefone bloqueia corretamente
        const checkOrgA = checkSuppression({
            deal_id: 'deal_same_org',
            telefone: '916666777',
            organization_id: 'tenant_org_A'
        }, [supOrgA]);
        assert.strictEqual(checkOrgA.bloqueado, true);
        assert.strictEqual(checkOrgA.criterio_match, 'telefone');
        pass('Isolamento entre organizações: Supressões de tenants independentes não se contaminam mutuamente');
    }

    // -------------------------------------------------------------------------
    // CENÁRIO 16: TENTATIVA DE ATIVAÇÃO DO ADAPTADOR REAL DURANTE SIMULAÇÃO
    // -------------------------------------------------------------------------
    {
        const dispatcher = new SDRDispatcherAdapter({ mode: 'SIMULATION' });
        let caughtSecurityException = false;

        try {
            await dispatcher.dispatchReal({
                deal_id: 'deal_trap_01',
                canal: 'WHATSAPP',
                destinatario: '351912345678',
                mensagem: 'Tentativa indevida'
            });
        } catch (err) {
            if (err instanceof SecurityException) {
                caughtSecurityException = true;
            }
        }

        assert.strictEqual(caughtSecurityException, true);
        const stats = dispatcher.getStats();
        assert.strictEqual(stats.total_alertas_seguranca_bloqueados, 1);
        assert.strictEqual(stats.chamadas_reais_efetuadas, 0);
        assert.strictEqual(stats.bytes_externos_transmitidos, 0);
        pass('Tentativa de disparo real durante simulação: Hard throw e Circuit Breaker ativado com sucesso');
    }

    // -------------------------------------------------------------------------
    // TESTE DE FLUXO INTEGRADO COMPLETO (ORQUESTRADOR)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Teste do Fluxo Operacional Integrado ---');
    {
        const pipeline = new SDROperationalPipeline();

        // Submete um negócio coletivo com LIA aprovado e resposta inbound de interesse
        const runResult = await pipeline.processDeal({
            deal: {
                id: 'deal_full_run_01',
                title: 'Clínica Dentária Luz do Rio',
                categoria_final_canonica: 'SILENCIO_CONFIRMADO',
                telefone: '919888999',
                canal_candidato: 'WHATSAPP'
            },
            legalOverride: { avaliacao_lia_b2b_aprovada: true },
            simulatedCurrentDay: 1,
            simulatedInboundReply: 'Boa tarde, poderiam enviar mais detalhes sobre as vossas soluções?'
        });

        assert.strictEqual(runResult.passos['01_selecao_negocio'].status, 'CONCLUIDO');
        assert.strictEqual(runResult.passos['03_gate_elegibilidade'].autorizado_para_disparo, true);
        assert.strictEqual(runResult.passos['07_dispatcher_simulado'].modo, 'SIMULACAO_EM_MEMORIA');
        assert.strictEqual(runResult.resultado_final.categoria_resposta, 'PEDIDO_INFORMACAO');
        assert.strictEqual(runResult.resultado_final.novo_status_cadencia, 'CONCLUIDA_COM_INTERESSE');
        pass('Fluxo Operacional Integrado: Execução completa de ponta-a-ponta validada com auditoria rastreável');
    }

    console.log('\n==============================================================================');
    console.log(`🎉 TODOS OS ${passedTests}/${passedTests} TESTES DE INTEGRAÇÃO DA FASE B.5 FORAM APROVADOS!`);
    console.log('==============================================================================\n');
}

runPhaseB5Tests().catch(err => {
    console.error('❌ Falha na bateria de testes da Fase B.5:', err);
    process.exit(1);
});

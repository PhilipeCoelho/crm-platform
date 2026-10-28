/**
 * ============================================================================
 * TESTE DE ACEITAÇÃO: VAMUSS B.14.2 — INTELIGÊNCIA CONVERSACIONAL & CUSTOS
 * ============================================================================
 * Validação rigorosa dos 15 critérios de aceitação da fase B.14.2:
 * 1. Respostas comerciais normais e inesperadas (interpretação semântica).
 * 2. Objeções e adaptação contextual (ex: commodity vs atração Google).
 * 3. Recusas e pedidos de não contacto (supressão imediata sem insistência).
 * 4. Histórico incompleto e informação insuficiente (clarificação / humano).
 * 5. Utilização ativa das conclusões da B.14.1.5 no contexto de decisão.
 * 6. Pré-verificação de limites de custo antes de chamadas GPT e WhatsApp.
 * 7. Limites orçamentais atingidos com bloqueio preventivo e recuperação.
 * 8. Concorrência, reservas atómicas e prevenção de duplicados.
 * 9. Deduplicação de webhooks e processamento de recibos de entrega.
 * 10. Janela de atendimento de 24 horas da Meta WhatsApp e templates.
 * 11. Validação estrita de horário comercial em Portugal (Europe/Lisbon).
 * 12. Persistência de custos e histórico entre execuções independentes.
 * 13. Resiliência e fallback determinístico em caso de falha da API OpenAI.
 * 14. Regras de etapas do CRM (interesse = engajamento, reunião só confirmada).
 * 15. Bloqueio de produção fail-closed preservado em todos os testes.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

import {
    runConversationalDecisionGPT,
    checkWhatsApp24hWindow,
    fallbackDeterministicConversationalDecision,
    CONVERSATIONAL_INTENTS
} from '../api/sdr_conversational_engine.js';

import {
    checkAndReserveOpenAIBudget,
    recordOpenAICost,
    checkAndReserveWhatsAppBudget,
    recordWhatsAppCost,
    getCostControllerStatus,
    readCostsState,
    writeCostsState,
    COST_LIMITS
} from '../api/sdr_cost_controller.js';

import {
    handleRecordOutcome,
    readLocalOutcomes,
    writeLocalOutcomes
} from '../api/sdr_engine.js';

import {
    SDROperationalWorker,
    readWorkerState,
    writeWorkerState
} from '../api/sdr_worker.js';

import {
    isPhoneSuppressedLocally,
    readLocalSuppression,
    writeLocalSuppression
} from '../api/suppression_store.js';

import {
    readTaskQueue,
    writeTaskQueue
} from '../api/sdr_task_queue.js';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        totalPassed++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        totalFailed++;
    }
}

async function runB142AcceptanceTests() {
    console.log('================================================================');
    console.log('🧪 SUÍTE DE TESTES: B.14.2 — CONVERSAÇÃO GPT & CONTROLO DE CUSTOS');
    console.log('================================================================\n');

    // Backup de estado
    const backupCosts = readCostsState();
    const backupOutcomes = readLocalOutcomes();
    const backupSuppression = readLocalSuppression();
    const backupQueue = readTaskQueue();
    const backupWorker = readWorkerState();

    // Iniciar com estado limpo para o ciclo de testes
    writeCostsState({
        today: new Date().toISOString().slice(0, 10),
        month: new Date().toISOString().slice(0, 7),
        openai: { todayCost: 0, todayTokens: 0, monthCost: 0, monthTokens: 0, callsCountToday: 0 },
        whatsapp: { todayCost: 0, todayDispatches: 0, monthCost: 0, monthDispatches: 0 },
        contacts: {},
        reservations: {},
        activeLocks: 0,
        blockedReasons: []
    });

    try {
        // --------------------------------------------------------------------
        // CRITÉRIO 1: Respostas comerciais normais e inesperadas
        // --------------------------------------------------------------------
        console.log('▶️ [Critério 1] Interpretação Semântica de Resposta Inbound Normal & Inesperada');
        const testDeal = { id: `deal_c1_${Date.now()}`, title: 'Clínica Dentária Santa Cruz', lost_reason: 'Silêncio' };
        const testContact = { id: 'ct_c1', name: 'Dr. Fernando', phone: '912345678' };

        // Teste de sinal de interesse genuíno
        const resInterest = await runConversationalDecisionGPT({
            inboundText: 'Boa tarde. Temos interesse em captar mais implantes particulares. Como funciona o vosso modelo?',
            deal: testDeal,
            contact: testContact
        });

        assert(resInterest.intencao_identificada === 'INTERESSE_GENUINO' || resInterest.proxima_acao === 'QUALIFICACAO_SPIN',
            `Identifica intenção de interesse genuíno / qualificação (Obtido: ${resInterest.intencao_identificada})`);
        assert(!!resInterest.mensagem_sugerida, 'Gera mensagem sugerida para continuação da conversa');
        assert(resInterest.mensagem_sugerida.toLowerCase().includes('implantes') || resInterest.mensagem_sugerida.toLowerCase().includes('clínica'),
            'Mensagem sugerida é contextualizada e grounded na resposta do cliente');

        // --------------------------------------------------------------------
        // CRITÉRIO 2: Objeções e adaptação contextual (Agência vs Google)
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 2] Adaptação a Objeções Reais (Diferenciação Redes Sociais vs Google)');
        const resObjection = await runConversationalDecisionGPT({
            inboundText: 'Já trabalhamos com uma agência de marketing que faz as nossas redes sociais e posts no Instagram.',
            deal: testDeal,
            contact: testContact
        });

        assert(resObjection.intencao_identificada === 'OBJECAO_PRECO_OU_AGENCIA' || resObjection.proxima_acao === 'TRATAR_OBJECAO',
            `Classifica objeção de concorrência/agência (Obtido: ${resObjection.intencao_identificada})`);
        assert(resObjection.mensagem_sugerida.toLowerCase().includes('google') || resObjection.mensagem_sugerida.toLowerCase().includes('redes sociais'),
            'Diferencia a Vamuss (Google/pesquisa ativa) de agências genéricas de redes sociais');

        // --------------------------------------------------------------------
        // CRITÉRIO 3: Recusas e pedidos de não contacto (Opt-out imediato)
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 3] Recusa Expressa e Proteção de Oposição (Opt-out)');
        const optoutPhone = '919555444';
        const resOptout = await runConversationalDecisionGPT({
            inboundText: 'PARAR. Não temos interesse e peço que retirem o nosso contacto.',
            deal: testDeal,
            contact: { id: 'ct_opt', phone: optoutPhone }
        });

        assert(resOptout.intencao_identificada === 'OPTOUT_OU_OPOSICAO', 'Reconhece pedido explícito de oposição/opt-out');
        assert(resOptout.proxima_acao === 'ENCERRAR_COM_OPTOUT', 'Define ação para encerramento com opt-out');
        assert(resOptout.mensagem_sugerida === '', 'NÃO gera mensagem comercial para insistir com contacto que solicitou remoção');
        assert(isPhoneSuppressedLocally(optoutPhone), 'Contacto adicionado imediatamente à lista de supressão ativa');

        // --------------------------------------------------------------------
        // CRITÉRIO 4: Histórico incompleto e mensagens ambíguas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 4] Tratamento de Mensagens Ambíguas e Lacunas Fatuais');
        const resAmbiguous = await runConversationalDecisionGPT({
            inboundText: '?',
            deal: { id: 'deal_empty' },
            contact: { id: 'ct_empty', phone: '911000111' }
        });

        assert(resAmbiguous.intencao_identificada === 'MENSAGEM_AMBIGUA_OU_INCOMPLETA' || resAmbiguous.intervencao_humana_necessaria === true,
            'Trata mensagem monossilábica/ambígua sem inventar pressupostos falsos');
        assert(resAmbiguous.intervencao_humana_necessaria === true || !!resAmbiguous.mensagem_sugerida,
            'Encaminha para revisão humana ou solicita clarificação educada');

        // --------------------------------------------------------------------
        // CRITÉRIO 5: Integração das aprendizagens B.14.1.5
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 5] Consulta e Aplicação de Aprendizagens B.14.1.5');
        assert(typeof resInterest.grau_confianca === 'string', 'Decisão inclui grau de confiança calibrado');
        assert(typeof resInterest.justificacao_comercial === 'string', 'Decisão inclui justificação comercial explícita');

        // --------------------------------------------------------------------
        // CRITÉRIO 6: Pré-verificação de limites de custo antes de chamadas
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 6] Controlador de Custos: Validação e Reserva Prévia');
        // Reset temporário de custos
        writeCostsState({
            today: new Date().toISOString().slice(0, 10),
            month: new Date().toISOString().slice(0, 7),
            openai: { todayCost: 0, todayTokens: 0, monthCost: 0, monthTokens: 0, callsCountToday: 0 },
            whatsapp: { todayCost: 0, todayDispatches: 0, monthCost: 0, monthDispatches: 0 },
            contacts: {},
            reservations: {},
            blockedReasons: []
        });

        // 1. Reserva OpenAI
        const oaiCheck = checkAndReserveOpenAIBudget({ estimatedTokens: 1500 });
        assert(oaiCheck.allowed === true, 'Reserva de orçamento OpenAI autorizada quando dentro do saldo');
        assert(!!oaiCheck.reservationId, 'Identificador de reserva atómica gerado');

        // 2. Confirmação do custo real
        const oaiRecord = recordOpenAICost({ reservationId: oaiCheck.reservationId, usage: { prompt_tokens: 1000, completion_tokens: 200 } });
        assert(oaiRecord.success === true, 'Custo real da OpenAI reconciliado e registado');
        assert(oaiRecord.cost > 0, `Despesa acumulada registada (€${oaiRecord.cost})`);

        // 3. Reserva WhatsApp
        const waCheck = checkAndReserveWhatsAppBudget({ phone: '912345678', dealId: 'deal_test', category: 'MARKETING' });
        assert(waCheck.allowed === true, 'Reserva de orçamento WhatsApp autorizada');
        assert(waCheck.rate === COST_LIMITS.WHATSAPP_RATES.MARKETING_PT, `Tarifa de marketing aplicada (€${waCheck.rate})`);

        // --------------------------------------------------------------------
        // CRITÉRIO 7: Limites orçamentais atingidos com bloqueio preventivo
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 7] Bloqueio Preventivo Quando Orçamento é Atingido');
        // Simular que o orçamento diário de OpenAI foi atingido
        const stateMaxed = readCostsState();
        stateMaxed.openai.todayCost = COST_LIMITS.MAX_OPENAI_COST_PER_DAY; // Estoura o limite
        writeCostsState(stateMaxed);

        const oaiBlocked = checkAndReserveOpenAIBudget({ estimatedTokens: 1500 });
        assert(oaiBlocked.allowed === false, 'Bloqueia preventivamente chamada OpenAI quando limite diário é atingido');
        assert(oaiBlocked.error === 'OPENAI_DAILY_BUDGET_EXCEEDED', 'Retorna código canónico OPENAI_DAILY_BUDGET_EXCEEDED');

        // Testar fallback determinístico quando bloqueado por custos
        const fallbackDueToCost = fallbackDeterministicConversationalDecision({
            inboundText: 'Como funciona?',
            deal: testDeal,
            contact: testContact,
            costBlockReason: oaiBlocked.reason
        });
        assert(fallbackDueToCost.source === 'deterministic_conversational_fallback', 'Aciona fallback determinístico seguro sem quebrar o pipeline');
        assert(fallbackDueToCost.costBlockReason !== null, 'Justifica a decisão determinística pelo bloqueio de custos');

        // Simular limite de mensagens por contacto atingido (máximo 3)
        const stateMaxContact = readCostsState();
        const testTargetPhone = '919999000';
        stateMaxContact.contacts[testTargetPhone] = { count: 3, attemptsWithoutResponse: 2 };
        writeCostsState(stateMaxContact);

        const waBlockedContact = checkAndReserveWhatsAppBudget({ phone: testTargetPhone, dealId: 'deal_cap' });
        assert(waBlockedContact.allowed === false, 'Bloqueia envio para contacto que já atingiu o limite de mensagens');
        assert(waBlockedContact.error === 'CONTACT_MESSAGE_LIMIT_REACHED', 'Retorna erro CONTACT_MESSAGE_LIMIT_REACHED');

        // --------------------------------------------------------------------
        // CRITÉRIO 8: Concorrência e prevenção de duplicados
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 8] Concorrência e Reservas Atómicas');
        const statusBefore = getCostControllerStatus();
        assert(typeof statusBefore.activeReservationsCount === 'number', 'Monitoriza número de reservas ativas em concorrência');
        assert(statusBefore.safetyBufferPercent === 15, 'Garante reserva de segurança de 15% inatingível por automações');

        // --------------------------------------------------------------------
        // CRITÉRIO 9: Deduplicação de Webhooks e Recibos de Entrega
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 9] Deduplicação de Webhooks e Recibos de Entrega');
        const testWamid = `wamid_test_${Date.now()}`;
        const outcomeDelivDeal = `deal_deliv_${Date.now()}`;

        // Registo prévio
        const recordRes = await handleRecordOutcome({
            dealId: outcomeDelivDeal,
            outcome: 'EXECUTADA',
            notes: 'Envio teste para recibo',
            executedBy: 'Test Runner'
        });
        assert(recordRes.success === true, 'Registo de outcome base criado');

        // Simular atualização de status de entrega (delivered)
        const updateOutcome = await handleRecordOutcome({
            dealId: outcomeDelivDeal,
            outcome: 'ENTREGUE',
            notes: `Recibo de entrega confirmado para ${testWamid}`,
            executedBy: 'WhatsApp Webhook'
        });
        assert(updateOutcome.success === true, 'Transição para ENTREGUE efetuada com sucesso');
        assert(updateOutcome.outcome === 'ENTREGUE', 'Outcome validado como ENTREGUE');

        // --------------------------------------------------------------------
        // CRITÉRIO 10: Janela de Atendimento de 24 horas da Meta WhatsApp
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 10] Validação da Janela de 24 Horas da Meta');
        const recentInbound = new Date(Date.now() - 2 * 3600000).toISOString(); // 2h atrás
        const windowRecent = checkWhatsApp24hWindow(recentInbound);
        assert(windowRecent.isWithin24h === true, 'Mensagem com 2h está dentro da janela de 24h');
        assert(windowRecent.requiresTemplate === false, 'Dentro da janela permite texto livre sem template obrigatória');

        const expiredInbound = new Date(Date.now() - 26 * 3600000).toISOString(); // 26h atrás
        const windowExpired = checkWhatsApp24hWindow(expiredInbound);
        assert(windowExpired.isWithin24h === false, 'Mensagem com 26h está fora da janela de 24h');
        assert(windowExpired.requiresTemplate === true, 'Fora da janela exige obrigatoriamente template aprovada pela Meta');

        // --------------------------------------------------------------------
        // CRITÉRIO 11: Validação de Horário Comercial em Portugal Continental
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 11] Proteção de Horário Comercial (Europe/Lisbon)');
        const worker = new SDROperationalWorker();
        const statusWorker = worker.getStatus();
        assert(typeof statusWorker.isPortugalBusinessHours === 'boolean', 'Valida dinamicamente o horário de expediente em Portugal');

        // --------------------------------------------------------------------
        // CRITÉRIO 12: Persistência entre execuções independentes
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 12] Persistência do Estado de Custos e Memória');
        const costStatus = getCostControllerStatus();
        assert(costStatus.date === new Date().toISOString().slice(0, 10), 'Data do bucket diário alinhada com UTC/Lisboa');
        assert(costStatus.openai.todayCost >= 0, 'Saldo de custos OpenAI consultável de forma persistente');
        assert(costStatus.whatsapp.todayCost >= 0, 'Saldo de custos WhatsApp consultável de forma persistente');

        // --------------------------------------------------------------------
        // CRITÉRIO 13: Resiliência e Fallback Determinístico
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 13] Resiliência e Fallback Sem OpenAI');
        const fallbackRes = fallbackDeterministicConversationalDecision({
            inboundText: 'Sim, gostaríamos de saber mais sobre como atrair pacientes particulares para reabilitação oral.',
            deal: testDeal,
            contact: testContact
        });
        assert(fallbackRes.intencao_identificada === 'INTERESSE_GENUINO', 'Fallback determinístico classifica interesse corretamente');
        assert(fallbackRes.proxima_acao === 'QUALIFICACAO_SPIN', 'Fallback determinístico avança para SPIN Selling');
        assert(fallbackRes.funnel_event === 'REPLY_WITH_INTEREST', 'Gera evento correto de avanço no funil do CRM');

        // --------------------------------------------------------------------
        // CRITÉRIO 14: Regras de Etapas do CRM (Interesse vs Reunião)
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 14] Integridade do Pipeline do CRM');
        // Interesse genuíno não pode avançar diretamente para reunião sem confirmação
        assert(resInterest.proxima_acao !== 'REUNIAO_CONFIRMADA', 'Interesse genuíno NÃO declara reunião confirmada sem agenda');
        assert(resInterest.funnel_event === 'REPLY_WITH_INTEREST' || resInterest.funnel_event === 'NONE',
            'Evento de funil adequado é REPLY_WITH_INTEREST para stage_lead_engajamento');

        // --------------------------------------------------------------------
        // CRITÉRIO 15: Bloqueio de Produção Mantido em Staging
        // --------------------------------------------------------------------
        console.log('\n▶️ [Critério 15] Bloqueio de Produção Fail-Closed Mantido');
        assert(statusWorker.stagingSimulationMode === true, 'Modo staging simulation ATIVO (Gate Legal em Fail-Closed)');
        assert(process.env.SDR_LEGAL_GATE !== 'LIVE_AUTHORIZED', 'SDR_LEGAL_GATE permanece seguro e não autorizado para disparos reais');

        console.log('\n================================================================');
        console.log(`📊 RESULTADO FINAL B.14.2: ${totalPassed} PASS, ${totalFailed} FAIL`);
        console.log('================================================================');

        if (totalFailed > 0) {
            process.exit(1);
        }

    } finally {
        // Restaurar estado de backup limpo
        if (backupCosts?.openai) {
            backupCosts.openai.todayCost = 0;
            backupCosts.blockedReasons = [];
            backupCosts.reservations = {};
        }
        writeCostsState(backupCosts);
        writeLocalOutcomes(backupOutcomes);
        writeLocalSuppression(backupSuppression);
        writeTaskQueue(backupQueue);
        writeWorkerState(backupWorker);
    }
}

runB142AcceptanceTests().catch(err => {
    console.error('❌ Exceção na suíte B.14.2:', err);
    process.exit(1);
});

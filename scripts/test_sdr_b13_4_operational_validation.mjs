/**
 * ============================================================================
 * VAMUSS CRM — SUÍTE DE VALIDAÇÃO OPERACIONAL E INTEGRIDADE B.13.4
 * ============================================================================
 * 12 Cenários Estritos Obrigatórios de Proteção do Backend, Integridade do Funil
 * e Bloqueio de Envios Reais.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

const fetch = globalThis.fetch;

const API_BASE = 'http://localhost:3001';

// Deals de teste identificados para validação
const DEAL_DINIZ = '9810639b-a21b-4c8b-8928-0522553165e7'; // Clínica Dentária Diniz Salgueiro
const DEAL_TEST_ISOLATED = `test-b13-4-${Date.now()}`;
const TEST_SUPPRESSED_PHONE = '919999991';
const TEST_LANDLINE_PHONE = '213456789';
const TEST_VALID_MOBILE = '912345678';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n================================================================');
    console.log('🧪 INICIANDO VALIDAÇÃO OPERACIONAL B.13.4 — INTEGRIDADE & BLOQUEIOS');
    console.log('================================================================\n');

    // ------------------------------------------------------------------------
    // CENÁRIO 1: EXECUTADA só regista execução; não reabre nem avança o funil
    // ------------------------------------------------------------------------
    console.log('🔹 Cenário 1: Desfecho EXECUTADA (Registo puro sem presunção de resposta)');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: DEAL_DINIZ,
                outcome: 'EXECUTADA',
                channel: 'WHATSAPP',
                notes: 'Abordagem consultiva executada pelo operador via WhatsApp.',
                idempotencyKey: `exec_test_${Date.now()}`
            })
        });
        const data = await res.json();
        assert(res.status === 200, 'HTTP Status 200 OK');
        assert(data.success === true, 'Registo bem-sucedido no backend');
        assert(data.outcome === 'EXECUTADA', 'Desfecho registado como EXECUTADA');
        assert(data.funnelTransition?.changed === false, 'Funil mantido inalterado (sem presunção de resposta positiva)');
    } catch (e) {
        assert(false, `Exceção Cenário 1: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 2: SEM_RESPOSTA rejeitado se não houver tentativa prévia
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 2: Rejeição de SEM_RESPOSTA sem abordagem prévia registada');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: `deal-sem-historico-${Date.now()}`,
                outcome: 'SEM_RESPOSTA',
                channel: 'WHATSAPP'
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Operação rejeitada pelo backend');
        assert(data.error === 'NO_PRIOR_ATTEMPT', 'Erro canónico: NO_PRIOR_ATTEMPT');
    } catch (e) {
        assert(false, `Exceção Cenário 2: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 3: SEM_RESPOSTA rejeitado se a janela de observação (< 48h) não tiver terminado
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 3: Rejeição de SEM_RESPOSTA com janela de observação em curso (< 48h)');
    try {
        // Criar abordagem agora para um deal temporário
        const tempDeal = `temp-deal-window-${Date.now()}`;
        await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: tempDeal,
                outcome: 'EXECUTADA',
                channel: 'WHATSAPP',
                notes: 'Abordagem disparada neste instante'
            })
        });

        // Imediatamente tentar marcar SEM_RESPOSTA
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: tempDeal,
                outcome: 'SEM_RESPOSTA',
                channel: 'WHATSAPP'
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Operação rejeitada pelo backend');
        assert(data.error === 'OBSERVATION_WINDOW_NOT_ELAPSED', 'Erro canónico: OBSERVATION_WINDOW_NOT_ELAPSED');
    } catch (e) {
        assert(false, `Exceção Cenário 3: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 4: RESPOSTA_POSITIVA rejeitada se não houver notas/evidência real
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 4: Rejeição de RESPOSTA_POSITIVA sem evidência ou transcrição da resposta');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: DEAL_DINIZ,
                outcome: 'RESPOSTA_POSITIVA',
                notes: '',
                evidence: ''
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Operação rejeitada pelo backend');
        assert(data.error === 'EVIDENCE_REQUIRED', 'Erro canónico: EVIDENCE_REQUIRED');
    } catch (e) {
        assert(false, `Exceção Cenário 4: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 5: INTERESSE_QUALIFICADO rejeitado sem registo explícito de necessidade/dor
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 5: Rejeição de INTERESSE_QUALIFICADO sem detalhe de dor/necessidade clínica');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: DEAL_DINIZ,
                outcome: 'INTERESSE_QUALIFICADO',
                notes: 'sim' // trivial
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Operação rejeitada pelo backend');
        assert(data.error === 'QUALIFICATION_EVIDENCE_REQUIRED', 'Erro canónico: QUALIFICATION_EVIDENCE_REQUIRED');
    } catch (e) {
        assert(false, `Exceção Cenário 5: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 6: OPTOUT ativa supressão fail-closed e move deal para 'lost'
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 6: Desfecho OPTOUT com ativação de supressão fail-closed');
    try {
        const optoutDeal = `deal-optout-${Date.now()}`;
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: optoutDeal,
                outcome: 'OPTOUT',
                channel: 'WHATSAPP',
                notes: `Contacto solicitou expressamente a remoção do número ${TEST_SUPPRESSED_PHONE}.`
            })
        });
        const data = await res.json();
        assert(res.status === 200, 'HTTP Status 200 OK');
        assert(data.success === true, 'Opt-out registado com sucesso');
        assert(data.funnelTransition?.newStatus === 'lost' || data.funnelTransition?.success === true, 'Funil transitado para lost');
    } catch (e) {
        assert(false, `Exceção Cenário 6: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 7: REUNIAO_CONFIRMADA rejeitada sem evidência de agendamento
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 7: Rejeição estrita de REUNIAO_CONFIRMADA sem comprovação de agendamento');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: DEAL_DINIZ,
                outcome: 'REUNIAO_CONFIRMADA',
                notes: ''
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Operação rejeitada pelo backend');
        assert(data.error === 'MEETING_EVIDENCE_REQUIRED', 'Erro canónico: MEETING_EVIDENCE_REQUIRED');
    } catch (e) {
        assert(false, `Exceção Cenário 7: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 8: VENDA_GANHA rejeitada sem comprovação de fecho/contrato
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 8: Rejeição estrita de VENDA_GANHA sem comprovação formal de fecho');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealId: DEAL_DINIZ,
                outcome: 'VENDA_GANHA',
                notes: ''
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Operação rejeitada pelo backend');
        assert(data.error === 'SALE_WON_EVIDENCE_REQUIRED', 'Erro canónico: SALE_WON_EVIDENCE_REQUIRED');
    } catch (e) {
        assert(false, `Exceção Cenário 8: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 9: Bloqueio de Envio WhatsApp quando Gate Legal Fail-Closed está ativo
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 9: Bloqueio de Envio WhatsApp com Gate Legal Fail-Closed ativo');
    try {
        const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: TEST_VALID_MOBILE,
                messageText: 'Teste de salvaguarda operacional.',
                isApproved: true
            })
        });
        const data = await res.json();
        assert(res.status === 403, 'HTTP Status 403 Forbidden');
        assert(data.success === false, 'Envio bloqueado pelo backend');
        assert(data.error === 'LEGAL_GATE_FAIL_CLOSED', 'Erro canónico: LEGAL_GATE_FAIL_CLOSED');
    } catch (e) {
        assert(false, `Exceção Cenário 9: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 10: Bloqueio de Envio WhatsApp para contacto na Lista de Supressão
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 10: Bloqueio de Envio WhatsApp para número suprimido');
    try {
        // Garantir que TEST_SUPPRESSED_PHONE está suprimido
        const { addLocalSuppression } = await import('../api/suppression_store.js');
        addLocalSuppression({
            telefone_normalizado: TEST_SUPPRESSED_PHONE,
            motivo: 'Oposição expressa no piloto',
            motivo_bloqueio: 'OPTOUT_EXPLICITO'
        });

        const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: TEST_SUPPRESSED_PHONE,
                messageText: 'Tentativa de envio para número bloqueado.',
                isApproved: true
            })
        });
        const data = await res.json();
        assert(res.status === 403, 'HTTP Status 403 Forbidden');
        assert(data.success === false, 'Envio bloqueado pelo backend');
        assert(data.error === 'CONTACT_SUPPRESSED', 'Erro canónico: CONTACT_SUPPRESSED');
    } catch (e) {
        assert(false, `Exceção Cenário 10: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 11: Bloqueio de Envio WhatsApp para canal inelegível (telefone fixo 21...)
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 11: Bloqueio de Envio WhatsApp para telefone fixo (canal inelegível)');
    try {
        const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: TEST_LANDLINE_PHONE,
                messageText: 'Tentativa para rede fixa.',
                isApproved: true
            })
        });
        const data = await res.json();
        assert(res.status === 422, 'HTTP Status 422 Unprocessable Entity');
        assert(data.success === false, 'Envio rejeitado por inelegibilidade de canal');
        assert(data.error === 'INELIGIBLE_CHANNEL', 'Erro canónico: INELIGIBLE_CHANNEL');
    } catch (e) {
        assert(false, `Exceção Cenário 11: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO 12: Bloqueio de Envio WhatsApp sem aprovação humana explícita
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário 12: Bloqueio de Envio WhatsApp sem aprovação humana explícita');
    try {
        const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: TEST_VALID_MOBILE,
                messageText: 'Tentativa sem autorização do operador.',
                isApproved: false
            })
        });
        const data = await res.json();
        assert(res.status === 403, 'HTTP Status 403 Forbidden');
        assert(data.success === false, 'Envio rejeitado por ausência de aprovação');
        assert(data.error === 'APPROVAL_REQUIRED', 'Erro canónico: APPROVAL_REQUIRED');
    } catch (e) {
        assert(false, `Exceção Cenário 12: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO COMPLEMENTAR 13: Idempotência de Outcomes (Prevenção de Duplicações)
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário Complementar: Idempotência de Registo de Outcomes');
    try {
        const idempotencyKey = `idemp_test_${Date.now()}`;
        const payload = {
            dealId: DEAL_DINIZ,
            outcome: 'EXECUTADA',
            channel: 'WHATSAPP',
            notes: 'Teste de validação de idempotência.',
            idempotencyKey
        };

        const res1 = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data1 = await res1.json();

        // Segunda chamada idêntica com a mesma chave
        const res2 = await fetch(`${API_BASE}/api/sdr/record-outcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data2 = await res2.json();

        assert(res2.status === 200, 'Segunda submissão retorna HTTP 200');
        assert(data2.idempotent === true && data2.duplicated === true, 'Segunda submissão identificada como idempotente/duplicada');
        assert(data1.outcomeId === data2.outcomeId, 'Mesmo outcomeId retornado sem gerar registo duplicado');
    } catch (e) {
        assert(false, `Exceção Cenário Complementar Idempotência: ${e.message}`);
    }

    // ------------------------------------------------------------------------
    // CENÁRIO COMPLEMENTAR 14: Denominadores Explícitos de Aprendizagem & Amostra
    // ------------------------------------------------------------------------
    console.log('\n🔹 Cenário Complementar: Denominadores Explícitos e Aviso de Calibração (N < 20)');
    try {
        const res = await fetch(`${API_BASE}/api/sdr/learning`);
        const data = await res.json();
        assert(res.status === 200, 'HTTP Status 200 OK em /api/sdr/learning');
        assert(data.learning?.explicitDenominators !== undefined, 'Objeto explicitDenominators presente');
        assert(data.learning?.explicitDenominators?.taxaEntrega !== undefined, 'taxaEntrega calculada com denominador');
        assert(data.learning?.explicitDenominators?.taxaResposta !== undefined, 'taxaResposta calculada com denominador');
        assert(data.learning?.explicitDenominators?.taxaQualificacao !== undefined, 'taxaQualificacao calculada com denominador');
        assert(data.learning?.explicitDenominators?.taxaReuniao !== undefined, 'taxaReuniao calculada com denominador');
        assert(data.learning?.explicitDenominators?.taxaConversaoVenda !== undefined, 'taxaConversaoVenda calculada com denominador');
        assert(data.learning?.caution !== null || data.learning?.totalAttempts >= 20, 'Aviso estatístico de amostragem presente e explícito');
    } catch (e) {
        assert(false, `Exceção Cenário Complementar Aprendizagem: ${e.message}`);
    }

    console.log('\n================================================================');
    console.log(`📊 RESULTADO FINAL DA SUÍTE B.13.4: ${passed} PASSADOS / ${failed} FALHADOS`);
    console.log('================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();

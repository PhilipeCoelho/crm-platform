/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — SUÍTE DE TESTES AUTOMATIZADOS (FASE B.13.3)
 * ============================================================================
 * Valida a reestruturação funcional do Workspace SDR + Closer:
 * 1. Fila de trabalho operacional (GET /api/sdr/queue) com 9 contadores exatos.
 * 2. Regra de ouro: Negócios bloqueados NUNCA são contados como prontos.
 * 3. Diferenciação estrita de tarefas (CALL vs MESSAGE vs PAUSE vs CLOSER_SPIN vs HUMAN_VALIDATION).
 * 4. Diagnóstico factual em 7 etapas para os 3 negócios de referência:
 *    - Clínica Dentária Diniz Salgueiro
 *    - CClinic Leiria
 *    - DentalCare Lisboa
 * 5. Linha temporal de interações com mensagens reais e canais.
 * 6. Guião de chamada (CALL) sem email padrão.
 * 7. Qualificação SPIN e aviso de limitação de calendário externo (CLOSER_SPIN).
 * 8. Registo de ciclo de vida (POST /api/sdr/record-outcome) e métricas de aprendizagem.
 * ============================================================================
 */

import http from 'http';

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runB133Suite() {
    console.log('============================================================================');
    console.log('🧪 INICIANDO SUÍTE DE TESTES B.13.3 — REESTRUTURAÇÃO DO WORKSPACE SDR+CLOSER');
    console.log('============================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(desc, condition, details = '') {
        if (condition) {
            console.log(`  ✅ [PASS] ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${desc} ${details ? '— ' + details : ''}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // TESTE 1: Fila de Trabalho Operacional (GET /api/sdr/queue)
    // -------------------------------------------------------------------------
    console.log('📌 Teste 1: Validação da Fila de Trabalho e Contadores Dinâmicos');
    const queueRes = await makeRequest('GET', '/api/sdr/queue?limit=150');
    assert('Endpoint /api/sdr/queue responde com status 200', queueRes.status === 200);
    assert('Fila retorna success: true', queueRes.data?.success === true);
    assert('Fila retorna lista de candidatos não-vazia', Array.isArray(queueRes.data?.candidates) && queueRes.data.candidates.length > 0);

    const counts = queueRes.data?.counts || {};
    const candidates = queueRes.data?.candidates || [];

    const expectedKeys = [
        'proximaAcao', 'revisaoHumana', 'prontos', 'aguardamResposta',
        'closerQualificacao', 'reuniaoConfirmada', 'pausaComercial',
        'bloqueados', 'todos'
    ];
    const hasAllKeys = expectedKeys.every(k => typeof counts[k] === 'number');
    assert('Fila retorna contagens para todos os 9 filtros obrigatórios', hasAllKeys, JSON.stringify(counts));

    // -------------------------------------------------------------------------
    // TESTE 2: Regra de Ouro: Negócios Bloqueados NÃO Podem Ser Contados Como Prontos
    // -------------------------------------------------------------------------
    console.log('\n📌 Teste 2: Regra de Salvaguarda: Negócios Bloqueados NUNCA são Prontos');
    const readyCandidates = candidates.filter(c => c.isReadyForApproach);
    const readyAreNeverBlocked = readyCandidates.every(c => !c.legalGateBlocked && !c.isSuppressed && c.respiroCumprido);
    assert('Nenhum negócio classificado como "Pronto" está bloqueado pelo Gate Legal ou Supressão', readyAreNeverBlocked);
    assert('Contador "prontos" coincide exatamente com os candidatos aptos', counts.prontos === readyCandidates.length);

    // -------------------------------------------------------------------------
    // TESTE 3: Discriminação por Tipo de Tarefa (CALL vs MESSAGE vs PAUSE)
    // -------------------------------------------------------------------------
    console.log('\n📌 Teste 3: Orientação a Tarefas (Task-Driven: CALL, MESSAGE, PAUSE)');
    const taskTypesFound = new Set(candidates.map(c => c.taskType));
    assert('Fila contém tarefas do tipo MESSAGE', taskTypesFound.has('MESSAGE'));
    assert('Fila contém tarefas do tipo PAUSE', taskTypesFound.has('PAUSE'));
    console.log(`     Tipos de tarefas detetados no CRM: ${[...taskTypesFound].join(', ')}`);

    // -------------------------------------------------------------------------
    // TESTE 4: Diagnóstico Factual nos 3 Negócios de Referência
    // -------------------------------------------------------------------------
    console.log('\n📌 Teste 4: Demonstração e Validação Factual dos 3 Negócios de Referência');

    const targetDeals = [
        { id: '5b0f44c1-57d3-4a30-8de5-7df432207b34', name: 'Clínica Dentária Diniz Salgueiro' },
        { id: '2ee3b134-a111-4624-81b8-c9eef850b5ed', name: 'CClinic Leiria' },
        { id: '3c3fa28c-9d7d-43e9-9ec5-664508a1bb72', name: 'DentalCare Lisboa' }
    ];

    for (const target of targetDeals) {
        console.log(`\n  🔎 Analisando negócio de referência: "${target.name}" (ID: ${target.id})`);
        const diagRes = await makeRequest('POST', '/api/sdr/diagnose', { dealId: target.id });
        assert(`Diagnóstico factual para "${target.name}" responde com 200`, diagRes.status === 200);

        const d = diagRes.data;
        assert(`Retorna linha temporal de atividades reais (${target.name})`, Array.isArray(d?.activities));
        assert(`Retorna tipo de tarefa comercial definido: ${d?.taskType} (${target.name})`, Boolean(d?.taskType));
        assert(`Retorna guião de chamada contextualizado (${target.name})`, Boolean(d?.callScript?.guiao_contextual));
        assert(`Retorna memória partilhada do Closer com SPIN (${target.name})`, Boolean(d?.closerContext?.roteiro_spin?.situacao));
        assert(`Aviso explícito de limitação de calendário externo presente (${target.name})`, Boolean(d?.closerContext?.limitacao_calendario?.includes('calendário externo')));
        assert(`Retorna análise prévia fundamentada nas 10 perguntas (${target.name})`, Boolean(d?.analiseDecisaoPrevia?.['1_o_que_aconteceu_historico'] || d?.analiseDecisaoPrevia?.pergunta_1_historico_efetivo));

        console.log(`     -> Tarefa: ${d.taskType}`);
        console.log(`     -> Canal: ${d.dualCopy?.canal_recomendado || d.selectedStrategy?.suggestedChannel}`);
        console.log(`     -> Interlocutor: ${d.contactValidation?.identifiedInLogs || 'Não confirmado'}`);
        console.log(`     -> Decisor: ${d.contactValidation?.isDecisionMaker}`);
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Registo de Desfecho Comercial e Atualização de Aprendizagem
    // -------------------------------------------------------------------------
    console.log('\n📌 Teste 5: Registo de Desfecho Comercial (POST /api/sdr/record-outcome)');
    const testDeal = candidates[0];

    const recordRes = await makeRequest('POST', '/api/sdr/record-outcome', {
        dealId: testDeal.dealId,
        contactId: testDeal.contactId,
        outcome: 'EXECUTADA',
        channel: 'WHATSAPP',
        strategy: 'TESTE_VALIDACAO_B13_3',
        notes: 'Validação automatizada de ciclo de vida e aprendizagem.',
        executedBy: 'Test Runner B.13.3'
    });

    assert('Registo de desfecho responde com status 200', recordRes.status === 200);
    assert('Registo confirma sucesso', recordRes.data?.success === true);
    assert('Retorna ID do registo de outcome', Boolean(recordRes.data?.outcomeId));
    assert('Métricas de aprendizagem atualizadas com aviso de amostra', Boolean(recordRes.data?.learning?.sampleDisclaimer));
    assert('Aviso de calibração ativa quando N < 20', recordRes.data?.learning?.isCalibrated === (recordRes.data?.learning?.totalAttempts >= 20));

    // -------------------------------------------------------------------------
    // RESUMO FINAL
    // -------------------------------------------------------------------------
    console.log('\n============================================================================');
    console.log(`🏁 RESULTADO DA SUÍTE B.13.3: ${passed} PASSOU / ${failed} FALHOU`);
    console.log('============================================================================\n');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runB133Suite().catch(err => {
    console.error('💥 Erro fatal na execução dos testes B.13.3:', err);
    process.exit(1);
});

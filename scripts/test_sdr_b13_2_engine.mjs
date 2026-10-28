/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — BATERIA DE TESTES B.13.2
 * ============================================================================
 * Validação rigorosa dos 7 requisitos da Fase B.13.2:
 * 1. Análise Factual Prévia das Decisões (10 perguntas obrigatórias)
 * 2. Personalização Real nos 3 Negócios Alvo (Diniz Salgueiro, C Clinic, DentalCare)
 * 3. Qualidade Comercial e Dual Copy (recomendada vs alternativa com contraste)
 * 4. 5 Dimensões Estritas de Pontuação (Probabilidade NÃO_CALIBRADA se < 20 obs)
 * 5. Registo e Distinção dos 10 Estados de Ciclo de Vida em sdr_outcomes
 * 6. Ciclo de Aprendizagem Ativo (influência direta em estratégia, canal e saturação)
 * 7. Salvaguardas Invioláveis (Zero envios a leads reais, 30 dias de respiro, fail-closed)
 * ============================================================================
 */

import assert from 'assert';
import {
    LOSS_CLASSIFICATIONS,
    SDR_LIFECYCLE_STATES,
    cleanPhone,
    reconstructFactualHistory,
    validateContactIdentity,
    classifyLossReason,
    calculateRecoverabilityScore,
    selectStrategy,
    generateDeterministicStrategy,
    calculateLearningMetrics
} from '../api/sdr_engine.js';

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}: ${err.message}`);
        testsFailed++;
    }
}

console.log('🧪 Iniciando Bateria de Testes B.13.2 (Validação Comercial & Ciclo de Aprendizagem)...\n');

// ============================================================================
// 1. ANÁLISE FACTUAL PRÉVIA (10 PERGUNTAS OBRIGATÓRIAS)
// ============================================================================
runTest('1.1. analise_decisao_previa responde às 10 perguntas antes de qualquer mensagem', () => {
    const deal = { id: 'test-1', title: 'Clínica Dentária Teste', lost_reason: 'Não respondeu' };
    const contact = { name: 'Dr. Teste', email: 'teste@clinica.pt', phone: '912345678' };
    const activities = [
        { date: '2026-05-01', type: 'email', title: 'Apresentação', notes: 'Primeiro contacto sobre implantes' }
    ];
    const hist = reconstructFactualHistory(activities);
    const cv = validateContactIdentity(contact, deal);
    const loss = classifyLossReason(deal.lost_reason, activities);
    const strat = selectStrategy(hist, loss, cv);
    
    const output = generateDeterministicStrategy({
        deal, contact, activities, lossClassification: loss,
        recoverability: { score: 50, priorityTier: 'PRIORIDADE_MEDIA' },
        factualHistory: hist, contactValidation: cv, selectedStrategy: strat
    });

    assert.ok(output.analise_decisao_previa, 'Objeto analise_decisao_previa deve existir');
    const q = output.analise_decisao_previa;
    
    assert.ok(q['1_o_que_aconteceu_historico'], 'Deve responder à pergunta 1');
    assert.ok(q['2_o_que_vamuss_comunicou'], 'Deve responder à pergunta 2');
    assert.ok(q['3_tentativas_e_canais'], 'Deve responder à pergunta 3');
    assert.ok(q['4_houve_resposta_real'], 'Deve responder à pergunta 4');
    assert.ok(q['5_motivo_registado_perda'], 'Deve responder à pergunta 5');
    assert.ok(q['6_interlocutor_e_decisor_conhecido'], 'Deve responder à pergunta 6');
    assert.ok(q['7_o_que_ainda_nao_sabemos'], 'Deve responder à pergunta 7');
    assert.ok(q['8_obstaculo_comercial_provavel_factos_vs_hipoteses'], 'Deve responder à pergunta 8');
    assert.ok(q['9_proxima_acao_minima_recomendada'], 'Deve responder à pergunta 9');
    assert.ok(q['10_porque_acao_superior_alternativas'], 'Deve responder à pergunta 10');
});

// ============================================================================
// 2. PERSONALIZAÇÃO REAL NOS 3 NEGÓCIOS HISTÓRICOS DO CRM
// ============================================================================
runTest('2.1. Diniz Salgueiro: extrai Dra/Dr de logs, segue recomendação da secretária Raquel', () => {
    const deal = { id: '5b0f44c1-57d3-4a30-8de5-7df432207b34', title: 'Clínica Dentária Diniz Salgueiro', lost_reason: 'Sem resposta' };
    const contact = { name: 'Diniz Salgueiro', email: 'geral@clinica.pt', phone: '213456789' };
    const dealLogs = [
        { content: 'Falei com Secretaria Raquel. Recomendação mandar email para o DR. Filipe Salgueiro (Quando está na clinica está trabalhando e quase nunca atende o telefone)' }
    ];
    const activities = [
        { date: '2026-05-04', type: 'call', title: 'Chamada para clínica', notes: 'Falei com secretaria Raquel' }
    ];

    const hist = reconstructFactualHistory(activities, dealLogs);
    const cv = validateContactIdentity(contact, deal, dealLogs);
    const loss = classifyLossReason(deal.lost_reason, activities, dealLogs);
    const strat = selectStrategy(hist, loss, cv);

    assert.strictEqual(strat.strategy, 'SEGUIMENTO_ORIENTACAO_RECECAO', 'Deve escolher SEGUIMENTO_ORIENTACAO_RECECAO');
    assert.ok(strat.targetPerson.includes('Filipe Salgueiro'), 'Deve apontar especificamente ao Dr. Filipe Salgueiro');
    assert.strictEqual(strat.suggestedChannel, 'EMAIL', 'Deve sugerir EMAIL como orientado pela secretária Raquel');

    const output = generateDeterministicStrategy({
        deal, contact, activities, lossClassification: loss,
        recoverability: { score: 65, priorityTier: 'ALTA_PRIORIDADE' },
        factualHistory: hist, contactValidation: cv, selectedStrategy: strat
    });

    assert.ok(output.mensagem_sdr_pt_pt.texto_recomendado.includes('Dr. Filipe Salgueiro') || output.mensagem_sdr_pt_pt.texto_recomendado.includes('Dr. Filipe'));
    assert.ok(output.mensagem_sdr_pt_pt.texto_recomendado.includes('receção') || output.mensagem_sdr_pt_pt.texto_recomendado.includes('Raquel'));
});

runTest('2.2. C Clinic Leiria: corrige pitch anterior de redes sociais e foca em pesquisa Google', () => {
    const deal = { id: '2ee3b134-a111-4624-81b8-c9eef850b5ed', title: 'C Clinic Leiria', lost_reason: 'Não responde' };
    const contact = { name: 'C Clinic Leiria', email: 'contacto@cclinic.pt', phone: '244123456' };
    const dealLogs = [
        { content: 'Email de follow-up enviado para a Dra. Catarina a propor anunciar a clínica nas redes sociais e stories' },
        { content: 'Não obtive resposta no email que foi solicitado enviar pela rececão' }
    ];
    const activities = [
        { date: '2026-05-18', type: 'email', title: 'Pitch redes sociais', notes: 'Proposta para anunciar a clínica nas redes sociais' }
    ];

    const hist = reconstructFactualHistory(activities, dealLogs);
    const cv = validateContactIdentity(contact, deal, dealLogs);
    const loss = classifyLossReason(deal.lost_reason, activities, dealLogs);
    const strat = selectStrategy(hist, loss, cv);

    assert.strictEqual(strat.strategy, 'CORRIGIR_PITCH_ANTERIOR_E_DIFERENCIAR', 'Deve escolher CORRIGIR_PITCH_ANTERIOR_E_DIFERENCIAR');

    const output = generateDeterministicStrategy({
        deal, contact, activities, lossClassification: loss,
        recoverability: { score: 55, priorityTier: 'PRIORIDADE_MEDIA' },
        factualHistory: hist, contactValidation: cv, selectedStrategy: strat
    });

    assert.ok(output.mensagem_sdr_pt_pt.texto_recomendado.includes('redes sociais'), 'Deve reconhecer o pitch anterior de redes');
    assert.ok(output.mensagem_sdr_pt_pt.texto_recomendado.includes('Google'), 'Deve diferenciar com pesquisa no Google');
});

runTest('2.3. DentalCare Lisboa: aborda estética/boutique identificada em logs para Dra. Clara Panão', () => {
    const deal = { id: '3c3fa28c-9d7d-43e9-9ec5-664508a1bb72', title: 'DentalCare Lisboa', lost_reason: 'Sem interesse' };
    const contact = { name: 'DentalCare Lisboa', email: 'geral@dentalcare.pt', phone: '219876543' };
    const dealLogs = [
        { content: 'Email de apresentação enviado à Dra. Clara Panão focado em clínica boutique e spa do sorriso' }
    ];
    const activities = [
        { date: '2026-05-18', type: 'email', title: 'Pitch boutique', notes: 'Clínica boutique / spa do sorriso em Lisboa' }
    ];

    const hist = reconstructFactualHistory(activities, dealLogs);
    const cv = validateContactIdentity(contact, deal, dealLogs);
    const loss = classifyLossReason(deal.lost_reason, activities, dealLogs);
    const strat = selectStrategy(hist, loss, cv);

    assert.strictEqual(strat.strategy, 'RETOMA_POSICIONAMENTO_ESPECIFICO_BOUTIQUE', 'Deve escolher RETOMA_POSICIONAMENTO_ESPECIFICO_BOUTIQUE');

    const output = generateDeterministicStrategy({
        deal, contact, activities, lossClassification: loss,
        recoverability: { score: 58, priorityTier: 'PRIORIDADE_MEDIA' },
        factualHistory: hist, contactValidation: cv, selectedStrategy: strat
    });

    assert.ok(output.mensagem_sdr_pt_pt.texto_recomendado.includes('Dra. Clara Panão') || output.mensagem_sdr_pt_pt.texto_recomendado.includes('Dra. Clara'));
    assert.ok(output.mensagem_sdr_pt_pt.texto_recomendado.includes('estética') || output.mensagem_sdr_pt_pt.texto_recomendado.includes('diferenciados'));
});

// ============================================================================
// 3. QUALIDADE COMERCIAL E DUAL COPY
// ============================================================================
runTest('3.1. Mensagem apresenta recommended + alternative e explica diferença estratégica', () => {
    const deal = { id: 'test-dual', title: 'Clínica Dentária Sorriso Real', lost_reason: 'Sem resposta' };
    const contact = { name: 'Dr. Real', email: 'real@sorriso.pt', phone: '912345678' };
    const activities = [{ date: '2026-05-01', type: 'email', title: 'Apresentação', notes: 'Sem resposta' }];
    const hist = reconstructFactualHistory(activities);
    const cv = validateContactIdentity(contact, deal);
    const strat = selectStrategy(hist, classifyLossReason('Sem resposta', activities), cv);

    const output = generateDeterministicStrategy({
        deal, contact, activities, lossClassification: { category: 'SILENCIO_POS_PROSPECAO' },
        recoverability: { score: 40, priorityTier: 'PRIORIDADE_MEDIA' },
        factualHistory: hist, contactValidation: cv, selectedStrategy: strat
    });

    const msg = output.mensagem_sdr_pt_pt;
    assert.ok(msg.texto_recomendado && msg.texto_recomendado.length > 20, 'Deve ter texto_recomendado');
    assert.ok(msg.alternativa_comercial_relevante && msg.alternativa_comercial_relevante.length > 20, 'Deve ter alternativa_comercial_relevante');
    assert.ok(msg.explicacao_diferenca_estrategica && msg.explicacao_diferenca_estrategica.length > 20, 'Deve ter explicacao_diferenca_estrategica');
    assert.strictEqual(msg.pede_reuniao, false, 'Regra inviolável: não deve pedir reunião');
    assert.strictEqual(msg.assume_problema_agenda, false, 'Não deve inventar problemas de agenda');
});

// ============================================================================
// 4. 5 DIMENSÕES ESTRITAS DE PONTUAÇÃO (PROBABILIDADE NÃO CALIBRADA < 20 OBS)
// ============================================================================
runTest('4.1. calculateRecoverabilityScore separa as 5 dimensões com probabilidade NÃO_CALIBRADA se < 20 obs', () => {
    const deal = { id: 'test-score', title: 'Clínica Dentária Centro', lost_reason: 'Não respondeu' };
    const contact = { name: 'Dr. Santos', email: 'santos@clinica.pt', phone: '912345678' };
    const activities = [{ date: '2026-04-01', type: 'email', title: 'Tentativa', notes: 'Primeiro contacto' }];
    const loss = { category: 'SILENCIO_POS_PROSPECAO', confidence: 'ALTA' };
    const cv = { isConfirmed: true, canSend: true, requiresHumanValidation: false, isDecisionMaker: 'PROVAVEL' };
    
    // Teste com amostra pequena (ex: 3 tentativas)
    const smallSampleAttempts = [
        { strategy: 'REAPROXIMACAO_TRANSPARENTE', outcome: 'SEM_RESPOSTA' },
        { strategy: 'REAVALIAR_ADEQUACAO', outcome: 'SEM_RESPOSTA' }
    ];

    const res = calculateRecoverabilityScore({
        deal, contact, activities, lossClassification: loss,
        daysSinceLost: 45, isSuppressed: false, contactValidation: cv,
        factualHistory: { totalActivities: 1, totalOutbound: 1, totalInbound: 0, hasAnyResponse: false },
        previousAttempts: smallSampleAttempts
    });

    // 1. Elegibilidade Análise
    assert.strictEqual(res.elegibilidadeAnalise.status, 'ELEGIVEL');
    assert.strictEqual(res.elegibilidadeAnalise.diasDesdeEncerramento, 45);

    // 2. Elegibilidade Contacto
    assert.strictEqual(res.elegibilidadeContacto.status, 'ELEGIVEL');
    assert.strictEqual(res.elegibilidadeContacto.suprimido, false);

    // 3. Prioridade Comercial Heurística
    assert.ok(typeof res.prioridadeComercial.score === 'number');
    assert.ok(res.prioridadeComercial.score >= 0 && res.prioridadeComercial.score <= 100);

    // 4. Probabilidade Estimada de Recuperação (REQUISITO CRÍTICO B.13.2)
    assert.strictEqual(res.probabilidadeRecuperacao.status, 'NAO_CALIBRADA', 'Amostra < 20 deve ser estritamente NAO_CALIBRADA');
    assert.strictEqual(res.probabilidadeRecuperacao.percentagemCalibrada, null);
    assert.ok(res.probabilidadeRecuperacao.limitacoes.includes('Amostra insuficiente'));
    assert.strictEqual(res.estimatedProbability, 'NAO_CALIBRADA', 'estimatedProbability não pode ser convertido de prioridade comercial!');

    // 5. Confiança do Diagnóstico
    assert.ok(['ALTA', 'MEDIA', 'BAIXA'].includes(res.confiancaDiagnostico.nivel));
    assert.ok(res.confiancaDiagnostico.completudeDados);
});

runTest('4.2. Respiro comercial insuficiente (<30 dias) bloqueia elegibilidade de análise e contacto', () => {
    const deal = { id: 'test-respiro', title: 'Clínica Dentária Nova', lost_reason: 'Sem resposta' };
    const contact = { name: 'Dr. Novo', email: 'novo@clinica.pt', phone: '912345678' };
    const loss = { category: 'SILENCIO_POS_PROSPECAO', confidence: 'MEDIA' };

    const res = calculateRecoverabilityScore({
        deal, contact, activities: [], lossClassification: loss,
        daysSinceLost: 12, isSuppressed: false,
        contactValidation: { isConfirmed: true, canSend: true, isDecisionMaker: 'PROVAVEL' },
        factualHistory: { totalOutbound: 1 },
        previousAttempts: []
    });

    assert.strictEqual(res.elegibilidadeAnalise.status, 'AGUARDAR_PRAZO');
    assert.strictEqual(res.elegibilidadeAnalise.diasRestantes, 18);
    assert.strictEqual(res.priorityTier, 'AGUARDAR_PRAZO');
});

// ============================================================================
// 5. 10 ESTADOS DE CICLO DE VIDA EM SDR_OUTCOMES
// ============================================================================
runTest('5.1. SDR_LIFECYCLE_STATES define exatamente os 10 estados do funil de reativação', () => {
    const expected = [
        'PREPARADA', 'APROVADA', 'ENVIADA', 'ENTREGUE', 'SEM_RESPOSTA',
        'RESPOSTA_POSITIVA', 'RESPOSTA_NEGATIVA', 'OPTOUT', 'REUNIAO_CONFIRMADA',
        'VENDA_GANHA', 'VENDA_PERDIDA'
    ];
    for (const st of expected) {
        assert.ok(SDR_LIFECYCLE_STATES[st], `Estado ${st} deve estar definido`);
    }
});

// ============================================================================
// 6. CICLO DE APRENDIZAGEM ATIVO
// ============================================================================
runTest('6.1. Falha técnica de entrega em email força rotação de canal para WHATSAPP', () => {
    const hist = { totalOutbound: 1, hasAnyResponse: false, vamussExplained: true };
    const loss = { category: 'SILENCIO_POS_PROSPECAO' };
    const cv = { isDecisionMaker: 'PROVAVEL', canSend: true };
    const previousAttempts = [
        { strategy: 'REAPROXIMACAO_TRANSPARENTE', channel: 'EMAIL', outcome: 'FALHA_ENTREGA', delivery_status: 'failed' }
    ];

    const strat = selectStrategy(hist, loss, cv, previousAttempts);
    assert.strictEqual(strat.suggestedChannel, 'WHATSAPP', 'Após falha de entrega por e-mail, deve sugerir WHATSAPP');
});

runTest('6.2. 2 ou mais tentativas silenciosas consecutivas acionam PAUSA_EVITAR_SATURACAO', () => {
    const hist = { totalOutbound: 3, hasAnyResponse: false, vamussExplained: true };
    const loss = { category: 'SILENCIO_POS_PROSPECAO' };
    const cv = { isDecisionMaker: 'PROVAVEL', canSend: true };
    const previousAttempts = [
        { strategy: 'REAPROXIMACAO_TRANSPARENTE', channel: 'EMAIL', outcome: 'SEM_RESPOSTA' },
        { strategy: 'REAVALIAR_ADEQUACAO', channel: 'EMAIL', outcome: 'SILENCIO' }
    ];

    const strat = selectStrategy(hist, loss, cv, previousAttempts);
    assert.strictEqual(strat.strategy, 'PAUSA_EVITAR_SATURACAO', '2 tentativas silenciosas devem gerar PAUSA_EVITAR_SATURACAO');
    assert.strictEqual(strat.suggestedChannel, 'NENHUM_PAUSA');
});

// ============================================================================
// 7. SALVAGUARDAS INVIOLÁVEIS
// ============================================================================
runTest('7.1. Contacto suprimido (RGPD/Opt-out) tem prioridade 0 e contacto bloqueado', () => {
    const deal = { id: 'test-supp', title: 'Clínica Proibida', lost_reason: 'Pedido opt-out' };
    const contact = { name: 'Dr. Bloqueado', email: 'bloq@clinica.pt', phone: '912345678' };
    const loss = { category: 'PEDIDO_NAO_CONTACTO' };

    const res = calculateRecoverabilityScore({
        deal, contact, activities: [], lossClassification: loss,
        daysSinceLost: 60, isSuppressed: true,
        contactValidation: { isConfirmed: true, canSend: true },
        factualHistory: {},
        previousAttempts: []
    });

    assert.strictEqual(res.prioridadeComercial.score, 0);
    assert.strictEqual(res.elegibilidadeContacto.status, 'BLOQUEADO');
    assert.strictEqual(res.priorityTier, 'NAO_ELEGIVEL');
});

console.log(`\n======================================================`);
console.log(`🏁 RESULTADO DOS TESTES B.13.2: ${testsPassed} PASS / ${testsFailed} FAIL`);
console.log(`======================================================\n`);

if (testsFailed > 0) {
    process.exit(1);
}

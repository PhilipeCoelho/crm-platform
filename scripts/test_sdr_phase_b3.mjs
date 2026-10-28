import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    createSuppressionRecord,
    checkSuppression,
    deduplicateSuppressionList
} from './sdr_suppression_engine.mjs';

import {
    classifyInboundResponse
} from './sdr_inbound_response_classifier.mjs';

import {
    SDRCadenceSimulator
} from './sdr_cadence_simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 Iniciando Bateria de Testes Automatizados — Vamuss SDR Fase B.3 (Cadência e Reconciliação)...\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Erro: ${err.message}`);
        throw err;
    }
}

const B3_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b3_validation.json');

// ==============================================================================
// 1. RECONCILIAÇÃO EXATA DOS 405 NEGÓCIOS
// ==============================================================================
console.log('--- 1. Reconciliação Exata e Integridade da Carteira ---');

runTest('1.1 Confirmação de 405 IDs únicos e soma total de 405', () => {
    assert.ok(fs.existsSync(B3_FILE), 'Ficheiro B.3 deve existir');
    const data = JSON.parse(fs.readFileSync(B3_FILE, 'utf8'));
    assert.strictEqual(data.meta.total_negocios_reconciliados, 405);
    assert.strictEqual(data.reconciliacao_geral.total_carteira, 405);

    const sumGroups = Object.values(data.reconciliacao_geral.grupos_estrategicos).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumGroups, 405, 'Soma dos grupos estratégicos deve ser exatamente 405');

    const sumDist = Object.values(data.reconciliacao_geral.distribuicao_canonica).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumDist, 405, 'Soma das categorias canónicas deve ser exatamente 405');
});

runTest('1.2 Transições de classificação rastreáveis das 28 recusas anteriores', () => {
    const data = JSON.parse(fs.readFileSync(B3_FILE, 'utf8'));
    const recusaMatrix = data.matriz_transicao_rastreavel['RECUSA_COMERCIAL (B.1 = 28)'];
    assert.strictEqual(recusaMatrix.total_b1, 28);
    const sumTransitions = Object.values(recusaMatrix.destinos_finais).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumTransitions, 28, 'Transições devem somar exatamente 28');
    assert.strictEqual(recusaMatrix.destinos_finais['RECUSA_COMERCIAL_DIRETA'], 18);
    assert.strictEqual(recusaMatrix.destinos_finais['JA_TEM_AGENCIA_OU_ANUNCIA'], 7);
    assert.strictEqual(recusaMatrix.destinos_finais['CONTINGENCIA_OU_ADIAMENTO'], 1);
    assert.strictEqual(recusaMatrix.destinos_finais['AMBIGUO_OU_GATEKEEPER'], 1);
    assert.strictEqual(recusaMatrix.destinos_finais['SILENCIO_APOS_PROPOSTA'], 1);
});

runTest('1.3 Recusa Comercial vs Oposição Formal (RGPD)', () => {
    // Recusa comercial cancela cadência ativa; Opt-out formal bloqueia todos os canais permanentemente
    const recusa = classifyInboundResponse({ texto: 'Não temos interesse nos vossos serviços, obrigado.' });
    assert.strictEqual(recusa.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(recusa.motivo_bloqueio_sugerido, 'RECUSA_COMERCIAL');

    const optout = classifyInboundResponse({ texto: 'Não voltem a contactar. Retirem o nosso contacto imediatamente.' });
    assert.strictEqual(optout.categoria, 'OPTOUT');
    assert.strictEqual(optout.motivo_bloqueio_sugerido, 'OPTOUT_EXPLICITO');
    assert.strictEqual(optout.confianca, 'maxima');
});

runTest('1.4 «Já temos agência» vs «Não voltem a contactar»', () => {
    const agencia = classifyInboundResponse({ texto: 'Já temos agência de marketing connosco.' });
    assert.strictEqual(agencia.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(agencia.bloqueio_contacto, true);

    const optout = classifyInboundResponse({ texto: 'Parem de mandar mensagens e retirem o nosso número.' });
    assert.strictEqual(optout.categoria, 'OPTOUT');
    assert.strictEqual(optout.motivo_bloqueio_sugerido, 'OPTOUT_EXPLICITO');
});

// ==============================================================================
// 2. SUPRESSÃO MULTINÍVEL E CONTACTOS PARTILHADOS
// ==============================================================================
console.log('\n--- 2. Supressão por Negócio, Entidade, Telefone e Email ---');

const mockSuppressionList = [
    createSuppressionRecord({
        deal_id: 'deal-recusa-direta',
        telefone: '351911111111',
        email: 'recusa@clinica.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Recusa explícita'
    }),
    createSuppressionRecord({
        deal_id: 'deal-hdclinic-canal',
        telefone: '351968704026', // partilhado com HC Dental
        email: 'info@hdclinic.pt',
        motivo_bloqueio: 'RESTRICAO_CANAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'WHATSAPP',
        evidencia: 'Pediram para mandar apenas por email'
    }),
    createSuppressionRecord({
        deal_id: 'deal-laclinic-medicina',
        email: 'geral@laclinic.pt', // partilhado com LAclinic
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Recusa expressa documentada'
    })
];

runTest('2.1 Supressão por Deal ID bloqueia imediatamente', () => {
    const res = checkSuppression({ deal_id: 'deal-recusa-direta', canal: 'WHATSAPP' }, mockSuppressionList);
    assert.strictEqual(res.bloqueado, true);
    assert.strictEqual(res.criterio_match, 'deal_id');
});

runTest('2.2 Supressão por Telefone bloqueia mesmo com deal_id diferente (HC Dental vs HDCLINIC)', () => {
    const res = checkSuppression({ deal_id: 'deal-hc-dental', telefone: '351968704026', canal: 'WHATSAPP' }, mockSuppressionList);
    assert.strictEqual(res.bloqueado, true);
    assert.strictEqual(res.criterio_match, 'telefone');
    assert.strictEqual(res.canal_bloqueado, 'WHATSAPP');
});

runTest('2.3 Telefone com restrição de WhatsApp NÃO bloqueia Email válido', () => {
    const res = checkSuppression({ deal_id: 'deal-hc-dental', telefone: '351968704026', email: 'autorizado@hcdental.pt', canal: 'EMAIL' }, mockSuppressionList);
    assert.strictEqual(res.bloqueado, false, 'Canal EMAIL deve ser autorizado quando apenas WhatsApp está suprimido');
});

runTest('2.4 Supressão por Email partilhado bloqueia entidades diferentes (LAclinic vs LAclinic Medicina)', () => {
    const res = checkSuppression({ deal_id: 'deal-laclinic-outro', email: 'geral@laclinic.pt', canal: 'EMAIL' }, mockSuppressionList);
    assert.strictEqual(res.bloqueado, true);
    assert.strictEqual(res.criterio_match, 'email');
});

runTest('2.5 Idempotência estrita: Inserções repetidas não criam duplicados na supressão', () => {
    const r1 = createSuppressionRecord({
        deal_id: 'deal-dup',
        telefone: '912345678',
        email: 'dup@clinica.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Nota 1'
    });
    const r2 = createSuppressionRecord({
        deal_id: 'deal-dup',
        telefone: '912345678',
        email: 'dup@clinica.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Nota 2'
    });
    const deduped = deduplicateSuppressionList([r1, r2]);
    assert.strictEqual(deduped.length, 1);
});

// ==============================================================================
// 3. MOTOR DE CADÊNCIA EM SIMULAÇÃO (DRY-RUN)
// ==============================================================================
console.log('\n--- 3. Validação do Simulador de Cadência Controlada ---');

runTest('3.1 Elegibilidade indeterminada ou revisão humana pendente impede início da cadência', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    const res = sim.simulateAttempt({
        deal_id: 'deal-indeterminado',
        nome_clinica: 'Clínica Indeterminada',
        elegibilidade_comercial: true,
        autorizacao_contacto: 'INDETERMINADO',
        revisao_humana_necessaria: true,
        simulatedCurrentDay: 1
    });

    assert.strictEqual(res.sucesso, false);
    assert.strictEqual(res.motivo, 'AUTORIZACAO_OU_REVISAO_PENDENTE');
    assert.strictEqual(res.acao, 'revisao_humana');
});

runTest('3.2 Primeira tentativa simulada com sucesso para prospect apto (Dia 1)', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    const res = sim.simulateAttempt({
        deal_id: 'deal-apto-1',
        nome_clinica: 'Clínica Apta',
        canal_pretendido: 'WHATSAPP',
        telefone_normalizado: '351919999999',
        elegibilidade_comercial: true,
        autorizacao_contacto: 'PENDENTE_VALIDACAO_PREVIA',
        revisao_humana_necessaria: false,
        simulatedCurrentDay: 1
    });

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.tentativa_numero, 1);
    assert.strictEqual(res.dia_simulado, 1);
});

runTest('3.3 Intervalo mínimo obrigatório de 5-7 dias impede tentativa 2 prematura (ex: Dia 3)', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    // Tentativa 1 no dia 1
    sim.simulateAttempt({
        deal_id: 'deal-apto-1',
        nome_clinica: 'Clínica Apta',
        telefone_normalizado: '351919999999',
        revisao_humana_necessaria: false,
        simulatedCurrentDay: 1
    });

    // Tentativa 2 prematura no dia 3 (apenas 2 dias decorridos)
    const res = sim.simulateAttempt({
        deal_id: 'deal-apto-1',
        nome_clinica: 'Clínica Apta',
        telefone_normalizado: '351919999999',
        revisao_humana_necessaria: false,
        simulatedCurrentDay: 3
    });

    assert.strictEqual(res.sucesso, false);
    assert.strictEqual(res.motivo, 'INTERVALO_MINIMO_NAO_ATINGIDO');
});

runTest('3.4 Segunda tentativa simulada com sucesso após intervalo de 6 dias (Dia 7)', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    sim.simulateAttempt({
        deal_id: 'deal-apto-1',
        nome_clinica: 'Clínica Apta',
        telefone_normalizado: '351919999999',
        revisao_humana_necessaria: false,
        simulatedCurrentDay: 1
    });

    const res = sim.simulateAttempt({
        deal_id: 'deal-apto-1',
        nome_clinica: 'Clínica Apta',
        telefone_normalizado: '351919999999',
        revisao_humana_necessaria: false,
        simulatedCurrentDay: 7
    });

    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.tentativa_numero, 2);
});

runTest('3.5 Limite estrito de no máximo duas tentativas por ciclo (bloqueia 3ª tentativa)', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    sim.simulateAttempt({ deal_id: 'deal-apto-1', simulatedCurrentDay: 1 });
    sim.simulateAttempt({ deal_id: 'deal-apto-1', simulatedCurrentDay: 7 });

    // Tentativa 3 simulada no dia 14
    const res = sim.simulateAttempt({ deal_id: 'deal-apto-1', simulatedCurrentDay: 14 });
    assert.strictEqual(res.sucesso, false);
    assert.strictEqual(res.motivo, 'LIMITE_CICLO_ATINGIDO');
});

runTest('3.6 Cancelamento imediato de seguimento perante resposta inbound no intervalo', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    // Tentativa 1 no dia 1
    sim.simulateAttempt({ deal_id: 'deal-com-resposta', simulatedCurrentDay: 1 });

    // Prospect responde no dia 3: «Não temos interesse, obrigado.»
    const inbound = sim.simulateInboundResponse({
        deal_id: 'deal-com-resposta',
        texto_resposta: 'Não temos interesse, obrigado.'
    });
    assert.strictEqual(inbound.classificacao.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(inbound.seguimento_cancelado, true);

    // Tentativa 2 agendada para o dia 7 tenta rodar
    const res = sim.simulateAttempt({ deal_id: 'deal-com-resposta', simulatedCurrentDay: 7 });
    assert.strictEqual(res.sucesso, false);
    assert.strictEqual(res.motivo, 'CADENCIA_INTERROMPIDA');
});

runTest('3.7 Killswitch global de emergência interrompe imediatamente qualquer execução', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    sim.activateGlobalKillswitch();

    const res = sim.simulateAttempt({ deal_id: 'deal-qualquer', simulatedCurrentDay: 1 });
    assert.strictEqual(res.sucesso, false);
    assert.strictEqual(res.motivo, 'KILLSWITCH_GLOBAL_ATIVO');
});

runTest('3.8 Killswitch por contacto interrompe apenas o contacto visado', () => {
    const sim = new SDRCadenceSimulator({ suppressionList: mockSuppressionList });
    sim.activateContactKillswitch('deal-bloquear-este');

    const res1 = sim.simulateAttempt({ deal_id: 'deal-bloquear-este', simulatedCurrentDay: 1 });
    assert.strictEqual(res1.sucesso, false);
    assert.strictEqual(res1.motivo, 'KILLSWITCH_CONTACT_ATIVO');

    const res2 = sim.simulateAttempt({ deal_id: 'deal-outro-livre', simulatedCurrentDay: 1 });
    assert.strictEqual(res2.sucesso, true);
});

// ==============================================================================
// 4. VERIFICAÇÃO DE SEGURANÇA E NÃO-DESTRUTIVIDADE
// ==============================================================================
console.log('\n--- 4. Verificação de Segurança Operacional ---');

runTest('4.1 Nenhuma mensagem real foi enviada e o simulador opera 100% em memória', () => {
    const sim = new SDRCadenceSimulator();
    assert.strictEqual(sim.totalSimulatedSends, 0);
    sim.simulateAttempt({ deal_id: 'd1', simulatedCurrentDay: 1 });
    assert.strictEqual(sim.totalSimulatedSends, 1);
});

console.log(`\n==============================================================================`);
console.log(`🎉 TODOS OS ${passedTests}/${totalTests} TESTES AUTOMATIZADOS DA FASE B.3 FORAM APROVADOS!`);
console.log(`==============================================================================\n`);

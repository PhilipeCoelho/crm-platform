import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    SDRCadenceSimulator
} from './sdr_cadence_simulator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const B4_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b4_readiness.json');

console.log('🧪 Iniciando Bateria de Testes Automatizados — Vamuss SDR Fase B.4 (Readiness e Reconciliação)...\n');

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

// ==============================================================================
// 1. RECONCILIAÇÃO MATEMÁTICA E CASOS ESPECIAIS
// ==============================================================================
console.log('--- 1. Reconciliação dos 405 Negócios e Casos Especiais ---');

runTest('1.1 Ficheiro B.4 existe e contém exatamente 405 negócios', () => {
    assert.ok(fs.existsSync(B4_FILE), 'Ficheiro B.4 deve existir');
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    assert.strictEqual(data.reconciliacao_carteira_405.total_negocios, 405);
    assert.strictEqual(data.tabela_reconciliacao_completa_405.length, 405);

    const sumCategories = Object.values(data.reconciliacao_carteira_405.distribuicao_canonica).reduce((a, b) => a + b, 0);
    assert.strictEqual(sumCategories, 405, 'Soma das 11 categorias canónicas deve ser exatamente 405');
});

runTest('1.2 Tratamento explícito e fundamentado dos 4 casos de Resposta Automática', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const auto = data.reconciliacao_carteira_405.tratamento_casos_especiais.respostas_automaticas;
    assert.strictEqual(auto.length, 4);
    auto.forEach(item => {
        assert.ok(item.deal_id);
        assert.ok(item.tratamento_operacional.includes('horário comercial') || item.tratamento_operacional.includes('recepção'));
    });
});

runTest('1.3 Tratamento explícito dos 3 casos de Adiamento ou Contingência', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const cont = data.reconciliacao_carteira_405.tratamento_casos_especiais.adiamento_ou_contingencia;
    assert.strictEqual(cont.length, 3);
    cont.forEach(item => {
        assert.ok(item.deal_id);
        assert.ok(item.tratamento_operacional.includes('Quarentena') || item.tratamento_operacional.includes('reavaliação'));
    });
});

runTest('1.4 Tratamento explícito do 1 caso de Silêncio Após Proposta', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const prop = data.reconciliacao_carteira_405.tratamento_casos_especiais.silencio_apos_proposta;
    assert.strictEqual(prop.length, 1);
    assert.strictEqual(prop[0].nome, 'Negócio Medina Smile Dental Clinic');
    assert.ok(prop[0].tratamento_operacional.includes('Closer Humano'));
});

// ==============================================================================
// 2. AUDITORIA LEGAL E DE ELEGIBILIDADE DOS 116 SILÊNCIO
// ==============================================================================
console.log('\n--- 2. Auditoria Legal e Travas de Envio dos 116 Negócios ---');

runTest('2.1 Nenhum negócio dos 116 tem autorização automática imediata para disparo', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const stats = data.auditoria_legal_e_elegibilidade_116_silencio.resumo_estatistico;
    assert.strictEqual(stats.autorizados_a_disparar_agora_sem_validacao, 0, 'ZERO negócios autorizados a disparo sem validação prévia');
    assert.strictEqual(stats.total_avaliados, 116);
});

runTest('2.2 Pessoas singulares (médicos) sem opt-in documental são bloqueadas', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const stats = data.auditoria_legal_e_elegibilidade_116_silencio.resumo_estatistico;
    assert.strictEqual(stats.estado_validacao_envio_real.BLOQUEADO_PESSOA_SINGULAR_SEM_OPTIN, 10);
});

runTest('2.3 Restrição de canal herdada em endpoint partilhado gera bloqueio de envio (HC Dental vs HDCLINIC)', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const detail = data.auditoria_legal_e_elegibilidade_116_silencio.negocios_detalhe;
    const hc = detail.find(d => d.nome_clinica.includes('HC Dental Clinic'));
    assert.ok(hc);
    assert.strictEqual(hc.estado_validacao_envio_real, 'BLOQUEADO_HERANCA_ENDPOINT');
    assert.strictEqual(hc.revisao_humana_obrigatoria, true);
});

runTest('2.4 Entidades coletivas permanecem sob PENDENTE_AVALIACAO_LIA_B2B', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    const stats = data.auditoria_legal_e_elegibilidade_116_silencio.resumo_estatistico;
    assert.strictEqual(stats.estado_validacao_envio_real.PENDENTE_AVALIACAO_LIA_B2B, 100);
});

// ==============================================================================
// 3. SIMULAÇÃO DA CADÊNCIA CONTROLADA
// ==============================================================================
console.log('\n--- 3. Verificação do Simulador de Cadência ---');

runTest('3.1 Simulação executa estritamente em memória com 2 tentativas e intervalo de 6 dias', () => {
    const sim = new SDRCadenceSimulator({ maxAttemptsPerCycle: 2, intervalDays: 6 });
    const r1 = sim.simulateAttempt({ deal_id: 'test-d1', simulatedCurrentDay: 1 });
    assert.strictEqual(r1.sucesso, true);
    assert.strictEqual(r1.tentativa_numero, 1);

    // Tentativa prematura no dia 3 é bloqueada
    const rPrematura = sim.simulateAttempt({ deal_id: 'test-d1', simulatedCurrentDay: 3 });
    assert.strictEqual(rPrematura.sucesso, false);
    assert.strictEqual(rPrematura.motivo, 'INTERVALO_MINIMO_NAO_ATINGIDO');

    // Tentativa válida no dia 7 é permitida
    const r2 = sim.simulateAttempt({ deal_id: 'test-d1', simulatedCurrentDay: 7 });
    assert.strictEqual(r2.sucesso, true);
    assert.strictEqual(r2.tentativa_numero, 2);

    // 3ª tentativa é bloqueada
    const r3 = sim.simulateAttempt({ deal_id: 'test-d1', simulatedCurrentDay: 14 });
    assert.strictEqual(r3.sucesso, false);
    assert.strictEqual(r3.motivo, 'LIMITE_CICLO_ATINGIDO');
});

runTest('3.2 Resposta recebida cancela imediatamente o follow-up pendente', () => {
    const sim = new SDRCadenceSimulator();
    sim.simulateAttempt({ deal_id: 'test-d2', simulatedCurrentDay: 1 });
    const inbound = sim.simulateInboundResponse({ deal_id: 'test-d2', texto_resposta: 'Não temos interesse neste momento.' });
    assert.strictEqual(inbound.seguimento_cancelado, true);

    const rFollowUp = sim.simulateAttempt({ deal_id: 'test-d2', simulatedCurrentDay: 7 });
    assert.strictEqual(rFollowUp.sucesso, false);
    assert.strictEqual(rFollowUp.motivo, 'CADENCIA_INTERROMPIDA');
});

runTest('3.3 Killswitch global interrompe qualquer tentativa instantaneamente', () => {
    const sim = new SDRCadenceSimulator();
    sim.activateGlobalKillswitch();
    const res = sim.simulateAttempt({ deal_id: 'test-d3', simulatedCurrentDay: 1 });
    assert.strictEqual(res.sucesso, false);
    assert.strictEqual(res.motivo, 'KILLSWITCH_GLOBAL_ATIVO');
});

runTest('3.4 Killswitch individual por contacto protege apenas o prospect específico', () => {
    const sim = new SDRCadenceSimulator();
    sim.activateContactKillswitch('test-bloqueado');
    const rBloqueado = sim.simulateAttempt({ deal_id: 'test-bloqueado', simulatedCurrentDay: 1 });
    assert.strictEqual(rBloqueado.sucesso, false);
    assert.strictEqual(rBloqueado.motivo, 'KILLSWITCH_CONTACT_ATIVO');

    const rLivre = sim.simulateAttempt({ deal_id: 'test-livre', simulatedCurrentDay: 1 });
    assert.strictEqual(rLivre.sucesso, true);
});

// ==============================================================================
// 4. SEGURANÇA E NÃO-DESTRUTIVIDADE
// ==============================================================================
console.log('\n--- 4. Segurança Operacional e Zero Efeitos Colaterais ---');

runTest('4.1 Zero mensagens enviadas e zero alterações no CRM/Supabase', () => {
    const data = JSON.parse(fs.readFileSync(B4_FILE, 'utf8'));
    assert.strictEqual(data.meta.mensagens_reais_enviadas, 0);
    assert.strictEqual(data.meta.escritas_producao_efetuadas, 0);
    assert.strictEqual(data.meta.modo, 'simulacao_read_only_estrita');
});

console.log(`\n==============================================================================`);
console.log(`🎉 TODOS OS ${passedTests}/${totalTests} TESTES AUTOMATIZADOS DA FASE B.4 FORAM APROVADOS!`);
console.log(`==============================================================================\n`);

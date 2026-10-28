import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    normalizePhone,
    normalizeEmail,
    createSuppressionRecord,
    checkSuppression,
    deduplicateSuppressionList
} from './sdr_suppression_engine.mjs';

import {
    classifyInboundResponse
} from './sdr_inbound_response_classifier.mjs';

import {
    classifyDealPhaseB2
} from './sdr_phase_b2_audit_runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 Iniciando Bateria de Testes Automatizados — Vamuss SDR Fase B.2 (Auditoria Corretiva)...\n');

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
// 1. RECLASSIFICAÇÃO DAS 28 RECUSAS ANTERIORES
// ==============================================================================
console.log('--- 1. Auditoria das 28 Recusas Comerciais da Fase B.1 ---');

runTest('Recusa explícita pura ("não tem interesse") permanece RECUSA_COMERCIAL_DIRETA', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica Emília Pires', lost_reason: 'não tem interesse' });
    assert.strictEqual(res.categoria_b2, 'RECUSA_COMERCIAL_DIRETA');
    assert.strictEqual(res.bloqueio_sugerido, 'TODOS');
    assert.strictEqual(res.elegivel_reativacao, false);
});

runTest('Recusa explícita polida ("não estamos a necessitar de serviços...") -> RECUSA_COMERCIAL_DIRETA', () => {
    const res = classifyDealPhaseB2({ 
        title: 'LAclinic - Medicina Dentária', 
        lost_reason: 'Não teve interesse - Obrigada pelo contacto e pelo interesse. Neste momento, não estamos a necessitar de serviços de anúncios online ou marketing digital, pelo que não será necessário falar com a pessoa responsável.' 
    });
    assert.strictEqual(res.categoria_b2, 'RECUSA_COMERCIAL_DIRETA');
    assert.strictEqual(res.bloqueio_sugerido, 'TODOS');
});

runTest('"Já anuncia / já temos equipe de marketing" é reclassificado para JA_TEM_AGENCIA_OU_ANUNCIA (Quarentena, não Optout)', () => {
    const res = classifyDealPhaseB2({ 
        title: 'Pura Dental Studio', 
        lost_reason: 'Já anuncia - Boa tarde. Agradecemos o contacto, mas já temos uma equipe de marketing. Muito obrigada' 
    });
    assert.strictEqual(res.categoria_b2, 'JA_TEM_AGENCIA_OU_ANUNCIA');
    assert.strictEqual(res.bloqueio_sugerido, null, 'Não deve ir para a lista de supressão de oposição legal');
    assert.strictEqual(res.acao_comercial, 'quarentena_benchmark_3_a_6_meses');
    assert.strictEqual(res.elegivel_reativacao, false);
});

runTest('"Já tem agência" simples é reclassificado para JA_TEM_AGENCIA_OU_ANUNCIA', () => {
    const res = classifyDealPhaseB2({ title: 'LAclinic', lost_reason: 'já tem agência ' });
    assert.strictEqual(res.categoria_b2, 'JA_TEM_AGENCIA_OU_ANUNCIA');
    assert.strictEqual(res.bloqueio_sugerido, null);
});

runTest('CMD Viseu (passa por migração operacional) é reclassificado para CONTINGENCIA_OU_ADIAMENTO', () => {
    const res = classifyDealPhaseB2({ 
        title: 'CMD Viseu', 
        lost_reason: 'Secretaria sem educação e sem interesse em repassar a informação. Margarete, disse que clinica passa por uma migração e este não seria o melhor momento' 
    });
    assert.strictEqual(res.categoria_b2, 'CONTINGENCIA_OU_ADIAMENTO');
    assert.strictEqual(res.bloqueio_sugerido, null);
});

runTest('Hiclinic Dental Care (secretária cansada de ligações) é reclassificado para AMBIGUO_OU_GATEKEEPER', () => {
    const res = classifyDealPhaseB2({ 
        title: 'Hiclinic Dental Care', 
        lost_reason: 'Conversei com a secretaria, ela disse que estava cansada de ligaççoes de agências... o contato parou nela, mas disse que a Dra, não teria interesse' 
    });
    assert.strictEqual(res.categoria_b2, 'AMBIGUO_OU_GATEKEEPER');
    assert.strictEqual(res.revisao_humana, true);
    assert.strictEqual(res.bloqueio_sugerido, null);
});

runTest('Medina Smile (parou de responder após proposta) é reclassificado para SILENCIO_APOS_PROPOSTA', () => {
    const res = classifyDealPhaseB2({ 
        title: 'Medina Smile Dental Clinic', 
        lost_reason: 'Não teve interesse - Depois que recebeu a prosposta parou de responder. Ainda em 2025' 
    });
    assert.strictEqual(res.categoria_b2, 'SILENCIO_APOS_PROPOSTA');
    assert.strictEqual(res.elegivel_reativacao, true);
    assert.strictEqual(res.acao_comercial, 'follow_up_consultivo_de_proposta');
});

// ==============================================================================
// 2. RECLASSIFICAÇÃO DOS 361 CASOS DE SILÊNCIO
// ==============================================================================
console.log('\n--- 2. Auditoria dos 361 Casos SILENCIO da Fase B.1 ---');

runTest('Silêncio puro e factual ("Não respondeu") -> SILENCIO_CONFIRMADO', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica A', lost_reason: 'Não respondeu' });
    assert.strictEqual(res.categoria_b2, 'SILENCIO_CONFIRMADO');
    assert.strictEqual(res.elegivel_reativacao, true);
    assert.strictEqual(res.bloqueio_sugerido, null);
});

runTest('Desqualificado genérico no CRM -> DESQUALIFICADO_INCOMPATIVEL (Não elegível)', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica B', lost_reason: 'Desqualificado' });
    assert.strictEqual(res.categoria_b2, 'DESQUALIFICADO_INCOMPATIVEL');
    assert.strictEqual(res.elegivel_reativacao, false, 'Não deve ser considerado elegível para reativação');
});

runTest('Desqualificado sem presença digital / redes sociais -> DESQUALIFICADO_INCOMPATIVEL', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica C', lost_reason: 'Desqualificado - sem presença digital' });
    assert.strictEqual(res.categoria_b2, 'DESQUALIFICADO_INCOMPATIVEL');
    assert.strictEqual(res.subcategoria, 'imaturidade_digital');
});

runTest('Grande grupo corporativo (ex: Medis / grande rede) -> DESQUALIFICADO_INCOMPATIVEL', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica D', lost_reason: 'grande grupo- Medis' });
    assert.strictEqual(res.categoria_b2, 'DESQUALIFICADO_INCOMPATIVEL');
    assert.strictEqual(res.subcategoria, 'grande_grupo_corporativo');
});

runTest('Clínica fechada permanentemente no Google -> DESQUALIFICADO_INCOMPATIVEL', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica Cavalcanti', lost_reason: 'Desqualificado - Medicina Dentária Cavalcanti fechou permanentemente. Se esta informação estiver errada, pode sugerir uma edição.' });
    assert.strictEqual(res.categoria_b2, 'DESQUALIFICADO_INCOMPATIVEL');
    assert.strictEqual(res.subcategoria, 'fechada_ou_inexistente');
});

runTest('Especialidade incompatível (clínica médica geral / escola técnica) -> DESQUALIFICADO_INCOMPATIVEL', () => {
    const res = classifyDealPhaseB2({ title: 'Centro E', lost_reason: 'Desqualificado - Centro técnico, uma escola' });
    assert.strictEqual(res.categoria_b2, 'DESQUALIFICADO_INCOMPATIVEL');
    assert.strictEqual(res.subcategoria, 'especialidade_incompativel');
});

runTest('Biblioteca de anúncios confirmada no histórico -> JA_TEM_AGENCIA_OU_ANUNCIA', () => {
    const res = classifyDealPhaseB2({ 
        title: 'Clínica Dentária do Marquês', 
        lost_reason: 'Biblioteca de Anúncios confirmada — 3 anúncios activos desde 19 de março de 2026... Têm agência ou gestor de tráfego a trabalhar com eles. Clínica Dentária do Marquês está fora.' 
    });
    assert.strictEqual(res.categoria_b2, 'JA_TEM_AGENCIA_OU_ANUNCIA');
});

runTest('Restrição explícita de canal no histórico ("WhatsApp não é o meio habitual...") -> RESTRICAO_CANAL', () => {
    const res = classifyDealPhaseB2({ 
        title: 'Clínica F', 
        lost_reason: 'Desqualificado - Obrigado pela sua mensagem. O WhatsApp não é o nosso meio de contacto habitual. Para marcações, dúvidas e esclarecimentos pedimos que nos ligue para: 914 508 164' 
    });
    assert.strictEqual(res.categoria_b2, 'RESTRICAO_CANAL');
    assert.strictEqual(res.bloqueio_sugerido, 'WHATSAPP');
});

runTest('Problema técnico de contacto ("Discador não chama / Só caixa postal") -> INATINGIVEL_TECNICO', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica G', lost_reason: 'Não chama o discador' });
    assert.strictEqual(res.categoria_b2, 'INATINGIVEL_TECNICO');
    assert.strictEqual(res.revisao_humana, true);
});

runTest('Resposta automática isolada no histórico -> RESPOSTA_AUTOMATICA', () => {
    const res = classifyDealPhaseB2({ title: 'Clínica H', lost_reason: 'só mensagem automatica, sem resposta humana' });
    assert.strictEqual(res.categoria_b2, 'RESPOSTA_AUTOMATICA');
    assert.strictEqual(res.elegivel_reativacao, true);
});

// ==============================================================================
// 3. VALIDAÇÃO DE IDENTIDADE E CONFLITOS TRANSVERSAIS
// ==============================================================================
console.log('\n--- 3. Validação de Identidade e Conflitos de Oposição Transversal ---');

runTest('Detecção e bloqueio de telefone partilhado entre entidades (HC Dental vs HDCLINIC)', () => {
    const phone = '351968704026';
    const mockList = [
        createSuppressionRecord({
            deal_id: 'deal-hdclinic',
            telefone: phone,
            motivo_bloqueio: 'RESTRICAO_CANAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'WHATSAPP',
            evidencia: 'Solicitado envio exclusivo por email'
        })
    ];

    // Verificar se a verificação pré-envio para HC Dental Clinic (mesmo telefone) é bloqueada
    const check = checkSuppression({ deal_id: 'deal-hc-dental', telefone: phone, canal: 'WHATSAPP' }, mockList);
    assert.strictEqual(check.bloqueado, true);
    assert.strictEqual(check.criterio_match, 'telefone');
    assert.strictEqual(check.canal_bloqueado, 'WHATSAPP');
});

runTest('Detecção e bloqueio de email partilhado entre entidades (LAclinic vs LAclinic Medicina)', () => {
    const email = 'geral@laclinic.pt';
    const mockList = [
        createSuppressionRecord({
            deal_id: 'deal-laclinic-medicina',
            email: email,
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            canal_bloqueado: 'TODOS',
            evidencia: 'Recusa explícita documentada'
        })
    ];

    const check = checkSuppression({ deal_id: 'deal-laclinic-geral', email: email, canal: 'EMAIL' }, mockList);
    assert.strictEqual(check.bloqueado, true);
    assert.strictEqual(check.criterio_match, 'email');
});

// ==============================================================================
// 4. TESTES EXPANDIDOS DO CLASSIFICADOR INBOUND (ITEM 5 DO PROMPT)
// ==============================================================================
console.log('\n--- 4. Testes Expandidos do Classificador Inbound (Item 5) ---');

runTest('1. «Já temos agência.» -> RECUSA_COMERCIAL / Interromper cadência ativa', () => {
    const res = classifyInboundResponse({ texto: 'Já temos agência.' });
    assert.strictEqual(res.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(res.bloqueio_contacto, true);
    assert.strictEqual(res.revisao_humana, false);
});

runTest('2. «Já anunciamos.» -> RECUSA_COMERCIAL / Interromper cadência ativa', () => {
    const res = classifyInboundResponse({ texto: 'Já anunciamos.' });
    assert.strictEqual(res.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(res.bloqueio_contacto, true);
    assert.strictEqual(res.revisao_humana, false);
});

runTest('3. «Não temos interesse neste momento.» -> RECUSA_COMERCIAL', () => {
    const res = classifyInboundResponse({ texto: 'Não temos interesse neste momento.' });
    assert.strictEqual(res.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(res.bloqueio_contacto, true);
    assert.strictEqual(res.revisao_humana, false);
});

runTest('4. «Não voltem a contactar.» -> OPTOUT formal', () => {
    const res = classifyInboundResponse({ texto: 'Não voltem a contactar.' });
    assert.strictEqual(res.categoria, 'OPTOUT');
    assert.strictEqual(res.bloqueio_contacto, true);
    assert.strictEqual(res.revisao_humana, false);
    assert.strictEqual(res.motivo_bloqueio_sugerido, 'OPTOUT_EXPLICITO');
});

runTest('5. «Enviem apenas por email.» -> RESTRICAO_CANAL (permite EMAIL)', () => {
    const res = classifyInboundResponse({ texto: 'Enviem apenas por email.' });
    assert.strictEqual(res.categoria, 'RESTRICAO_CANAL');
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.canal_permitido, 'EMAIL');
    assert.strictEqual(res.revisao_humana, false);
});

runTest('6. «Contactem-nos em janeiro.» -> ADIAMENTO (data: janeiro)', () => {
    const res = classifyInboundResponse({ texto: 'Contactem-nos em janeiro.' });
    assert.strictEqual(res.categoria, 'ADIAMENTO');
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.data_seguimento, 'janeiro');
    assert.strictEqual(res.revisao_humana, false);
});

runTest('7. Interesse acompanhado de pedido de oposição -> OPTOUT PREVALECE SEMPRE', () => {
    const res = classifyInboundResponse({ texto: 'A vossa proposta é excelente e temos interesse, mas não nos voltem a contactar e retirem o nosso número!' });
    assert.strictEqual(res.categoria, 'OPTOUT', 'OPTOUT deve prevalecer inegociavelmente sobre interesse');
    assert.strictEqual(res.bloqueio_contacto, true);
});

runTest('8. Respostas automáticas -> RESPOSTA_AUTOMATICA (não bloqueia, sem erro)', () => {
    const res = classifyInboundResponse({ texto: 'Esta é uma resposta automática: estamos ausentes até segunda-feira.' });
    assert.strictEqual(res.categoria, 'RESPOSTA_AUTOMATICA');
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.revisao_humana, false);
});

runTest('9. Respostas contraditórias ou ambíguas -> RESPOSTA_INDETERMINADA (Revisão humana obrigatória)', () => {
    const res = classifyInboundResponse({ texto: 'Talvez sim, talvez não, neste momento é complicado mas não sei bem o que dizer.' });
    assert.strictEqual(res.categoria, 'RESPOSTA_INDETERMINADA');
    assert.strictEqual(res.revisao_humana, true, 'Casos ambíguos exigem revisão humana');
    assert.strictEqual(res.bloqueio_contacto, false);
});

// ==============================================================================
// 5. INTEGRIDADE DO FICHEIRO DE AUDITORIA B.2
// ==============================================================================
console.log('\n--- 5. Integridade do Ficheiro de Auditoria B.2 ---');

runTest('Ficheiro de auditoria B.2 gerado e coerente com os 405 negócios', () => {
    const auditFile = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');
    assert.ok(fs.existsSync(auditFile), 'Ficheiro data/sdr_reactivation_phase_b2_audit.json deve existir');
    const content = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    assert.strictEqual(content.meta.total_negocios_analisados, 405);
    assert.strictEqual(content.estatisticas_gerais.total_analisado, 405);
    assert.strictEqual(content.auditoria_completa_405_negocios.length, 405);
});

console.log(`\n==============================================================================`);
console.log(`🎉 TODOS OS ${passedTests}/${totalTests} TESTES AUTOMATIZADOS DA FASE B.2 FORAM APROVADOS!`);
console.log(`==============================================================================\n`);

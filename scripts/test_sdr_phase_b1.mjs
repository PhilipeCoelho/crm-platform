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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 Iniciando Bateria de Testes Automatizados — Vamuss SDR Fase B.1...\n');

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
// 1. TESTES DE NORMALIZAÇÃO DE TELEFONE
// ==============================================================================
console.log('--- 1. Normalização de Telefones (Portugal e Internacional) ---');

runTest('Móvel PT simples (9 dígitos) -> 351912345678', () => {
    assert.strictEqual(normalizePhone('912345678'), '351912345678');
    assert.strictEqual(normalizePhone('963456789'), '351963456789');
    assert.strictEqual(normalizePhone('925123456'), '351925123456');
    assert.strictEqual(normalizePhone('931234567'), '351931234567');
});

runTest('Fixo PT simples (9 dígitos com 2) -> 351213456789', () => {
    assert.strictEqual(normalizePhone('213456789'), '351213456789');
    assert.strictEqual(normalizePhone('229876543'), '351229876543');
});

runTest('Telefone PT com formato internacional +351 e espaços/pontos/hífens', () => {
    assert.strictEqual(normalizePhone('+351 912 345 678'), '351912345678');
    assert.strictEqual(normalizePhone('+351-963-456-789'), '351963456789');
    assert.strictEqual(normalizePhone('+351.213.456.789'), '351213456789');
    assert.strictEqual(normalizePhone('(351) 912345678'), '351912345678');
});

runTest('Telefone com prefixo 00351', () => {
    assert.strictEqual(normalizePhone('00351912345678'), '351912345678');
});

runTest('Telefones internacionais válidos (ex: Espanha, Brasil, UK)', () => {
    assert.strictEqual(normalizePhone('+34 612 345 678'), '34612345678');
    assert.strictEqual(normalizePhone('+55 11 98765 4321'), '5511987654321');
    assert.strictEqual(normalizePhone('+44 20 7946 0958'), '442079460958');
});

runTest('Telefones inválidos ou nulos retornam null com segurança', () => {
    assert.strictEqual(normalizePhone(null), null);
    assert.strictEqual(normalizePhone(undefined), null);
    assert.strictEqual(normalizePhone(''), null);
    assert.strictEqual(normalizePhone('abc'), null);
    assert.strictEqual(normalizePhone('123'), null); // menos de 8 dígitos
});

// ==============================================================================
// 2. TESTES DE NORMALIZAÇÃO DE E-MAIL
// ==============================================================================
console.log('\n--- 2. Normalização de E-mails ---');

runTest('E-mail com maiúsculas e espaços é limpo para lowercase', () => {
    assert.strictEqual(normalizeEmail('  Geral@ClinicaDental.PT  '), 'geral@clinicadental.pt');
    assert.strictEqual(normalizeEmail('Dr.Silva@GMAIL.com'), 'dr.silva@gmail.com');
});

runTest('E-mails com formato inválido ou nulos retornam null', () => {
    assert.strictEqual(normalizeEmail(null), null);
    assert.strictEqual(normalizeEmail(''), null);
    assert.strictEqual(normalizeEmail('invalido_sem_arroba.pt'), null);
    assert.strictEqual(normalizeEmail('clinica@'), null);
    assert.strictEqual(normalizeEmail('@dominio.pt'), null);
});

// ==============================================================================
// 3. IDEMPOTÊNCIA DO MOTOR DE SUPRESSÃO
// ==============================================================================
console.log('\n--- 3. Idempotência e Construção de Registos de Supressão ---');

runTest('Criação validada de registo de supressão', () => {
    const record = createSuppressionRecord({
        deal_id: 'deal-123',
        telefone: '+351 912 345 678',
        email: 'Direcao@Clinica.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Cliente declarou não ter interesse'
    });

    assert.strictEqual(record.deal_id, 'deal-123');
    assert.strictEqual(record.telefone_normalizado, '351912345678');
    assert.strictEqual(record.email_normalizado, 'direcao@clinica.pt');
    assert.strictEqual(record.motivo_bloqueio, 'RECUSA_COMERCIAL');
    assert.strictEqual(record.estado, 'ativo');
    assert.ok(record.data_bloqueio);
});

runTest('Rejeição estrita de dados inválidos no construtor de supressão', () => {
    assert.throws(() => {
        createSuppressionRecord({
            motivo_bloqueio: 'MOTIVO_INEXISTENTE',
            origem_bloqueio: 'HISTORICO_CRM',
            evidencia: 'teste'
        });
    }, /motivo_bloqueio inválido/);

    assert.throws(() => {
        createSuppressionRecord({
            motivo_bloqueio: 'RECUSA_COMERCIAL',
            origem_bloqueio: 'HISTORICO_CRM',
            evidencia: '   ' // evidência vazia
        });
    }, /evidencia é obrigatória/);
});

runTest('Deduplicação e consolidação idempotente de múltiplos registos idênticos', () => {
    const r1 = createSuppressionRecord({
        deal_id: 'deal-abc',
        telefone: '912345678',
        email: 'info@teste.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Primeira inserção'
    });

    const r2 = createSuppressionRecord({
        deal_id: 'deal-abc',
        telefone: '912345678',
        email: 'info@teste.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Segunda inserção duplicada'
    });

    const deduped = deduplicateSuppressionList([r1, r2]);
    assert.strictEqual(deduped.length, 1, 'Deve manter apenas 1 registo após deduplicação');
});

// ==============================================================================
// 4. VERIFICAÇÃO PRÉ-ENVIO CONTRA A LISTA DE SUPRESSÃO
// ==============================================================================
console.log('\n--- 4. Verificação Pré-Envio (Firewall de Supressão) ---');

const mockSuppressionList = [
    createSuppressionRecord({
        deal_id: 'deal-bloqueado-1',
        telefone: '911111111',
        email: 'bloqueado@clinica.pt',
        motivo_bloqueio: 'OPTOUT_EXPLICITO',
        origem_bloqueio: 'RESPOSTA_INBOUND',
        canal_bloqueado: 'TODOS',
        evidencia: 'Pediu remoção formal da lista'
    }),
    createSuppressionRecord({
        deal_id: 'deal-whatsapp-only',
        telefone: '922222222',
        email: 'apenas_email@clinica.pt',
        motivo_bloqueio: 'RESTRICAO_CANAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'WHATSAPP',
        evidencia: 'Contacto médico. Solicitaram envio exclusivo por email.'
    }),
    createSuppressionRecord({
        deal_id: 'deal-revogado',
        telefone: '933333333',
        email: 'revogado@clinica.pt',
        motivo_bloqueio: 'RECUSA_COMERCIAL',
        origem_bloqueio: 'HISTORICO_CRM',
        canal_bloqueado: 'TODOS',
        evidencia: 'Registo revogado por autorização posterior',
        estado: 'revogado'
    })
];

runTest('Bloqueia envio quando deal_id está suprimido (canal TODOS)', () => {
    const check = checkSuppression({ deal_id: 'deal-bloqueado-1', canal: 'WHATSAPP' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, true);
    assert.strictEqual(check.motivo, 'OPTOUT_EXPLICITO');
    assert.strictEqual(check.criterio_match, 'deal_id');
});

runTest('Bloqueia envio quando telefone está suprimido (match por telefone normalizado)', () => {
    const check = checkSuppression({ telefone: '+351 911 111 111', canal: 'WHATSAPP' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, true);
    assert.strictEqual(check.motivo, 'OPTOUT_EXPLICITO');
    assert.strictEqual(check.criterio_match, 'telefone');
});

runTest('Bloqueia envio quando email está suprimido', () => {
    const check = checkSuppression({ email: 'BLOQUEADO@clinica.pt', canal: 'EMAIL' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, true);
    assert.strictEqual(check.motivo, 'OPTOUT_EXPLICITO');
    assert.strictEqual(check.criterio_match, 'email');
});

runTest('Permite envio para contacto não suprimido', () => {
    const check = checkSuppression({ deal_id: 'deal-livre-999', telefone: '960000000', email: 'livre@clinica.pt' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, false);
    assert.strictEqual(check.motivo, null);
});

runTest('Permite envio quando o bloqueio foi revogado (estado !== ativo)', () => {
    const check = checkSuppression({ deal_id: 'deal-revogado', telefone: '933333333' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, false, 'Registo revogado não deve bloquear');
});

// ==============================================================================
// 5. SUPRESSÃO POR CANAL ESPECÍFICO (WHATSAPP vs E-MAIL)
// ==============================================================================
console.log('\n--- 5. Supressão por Canal Específico ---');

runTest('Bloqueio restrito de WHATSAPP bloqueia tentativa de WhatsApp', () => {
    const check = checkSuppression({ deal_id: 'deal-whatsapp-only', canal: 'WHATSAPP' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, true);
    assert.strictEqual(check.motivo, 'RESTRICAO_CANAL');
    assert.strictEqual(check.canal_bloqueado, 'WHATSAPP');
});

runTest('Bloqueio restrito de WHATSAPP NÃO bloqueia tentativa de E-MAIL', () => {
    const check = checkSuppression({ deal_id: 'deal-whatsapp-only', canal: 'EMAIL' }, mockSuppressionList);
    assert.strictEqual(check.bloqueado, false, 'Canal EMAIL deve ser autorizado quando apenas WhatsApp está restrito');
});

// ==============================================================================
// 6. CLASSIFICAÇÃO DOS 6 EXEMPLOS OBRIGATÓRIOS DE INBOUND
// ==============================================================================
console.log('\n--- 6. Classificação dos 6 Exemplos Obrigatórios de Inbound ---');

runTest('Exemplo 1: Opt-out / Direito de oposição formal', () => {
    const input = 'Não voltem a contactar. Retirem o nosso número da vossa lista.';
    const res = classifyInboundResponse({ texto: input });
    assert.strictEqual(res.categoria, 'OPTOUT');
    assert.strictEqual(res.bloqueio_contacto, true);
    assert.strictEqual(res.revisao_humana, false);
    assert.strictEqual(res.canal_permitido, null);
    assert.strictEqual(res.motivo_bloqueio_sugerido, 'OPTOUT_EXPLICITO');
});

runTest('Exemplo 2: Recusa comercial direta', () => {
    const input = 'Neste momento não temos interesse, obrigado.';
    const res = classifyInboundResponse({ texto: input });
    assert.strictEqual(res.categoria, 'RECUSA_COMERCIAL');
    assert.strictEqual(res.bloqueio_contacto, true);
    assert.strictEqual(res.revisao_humana, false);
    assert.strictEqual(res.canal_permitido, null);
    assert.strictEqual(res.motivo_bloqueio_sugerido, 'RECUSA_COMERCIAL');
});

runTest('Exemplo 3: Adiamento com data / condição temporária', () => {
    const input = 'Estamos em obras até setembro, contactem nessa altura.';
    const res = classifyInboundResponse({ texto: input });
    assert.strictEqual(res.categoria, 'ADIAMENTO');
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.revisao_humana, false);
    assert.strictEqual(res.data_seguimento, 'setembro');
});

runTest('Exemplo 4: Restrição explícita de canal (médico / apenas email)', () => {
    const input = 'Este contacto é apenas para marcações de pacientes. Enviem para o nosso email geral@clinica.pt.';
    const res = classifyInboundResponse({ texto: input });
    assert.strictEqual(res.categoria, 'RESTRICAO_CANAL');
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.revisao_humana, false);
    assert.strictEqual(res.canal_permitido, 'EMAIL');
    assert.strictEqual(res.motivo_bloqueio_sugerido, 'RESTRICAO_CANAL');
});

runTest('Exemplo 5: Interesse comercial / Pedido de informação', () => {
    const input = 'Como funciona o vosso serviço e quanto custa?';
    const res = classifyInboundResponse({ texto: input });
    assert.ok(['PEDIDO_INFORMACAO', 'INTERESSE'].includes(res.categoria));
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.revisao_humana, false);
    assert.strictEqual(res.acao_recomendada, 'encaminhar_closer_alta_prioridade');
});

runTest('Exemplo 6: Resposta indeterminada / ambígua', () => {
    const input = 'Neste momento não dá.';
    const res = classifyInboundResponse({ texto: input });
    assert.strictEqual(res.categoria, 'RESPOSTA_INDETERMINADA');
    assert.strictEqual(res.bloqueio_contacto, false);
    assert.strictEqual(res.revisao_humana, true, 'Casos dúbios exigem obrigatoriamente revisão humana');
});

// ==============================================================================
// 7. COMPORTAMENTO DEFENSIVO EM CONFLITOS DE INTENÇÃO (OPT-OUT PREVALECE)
// ==============================================================================
console.log('\n--- 7. Comportamento Defensivo: Conflito de Intenções ---');

runTest('Interesse misturado com pedido de opt-out: OPTOUT PREVALECE SEMPRE', () => {
    const mixedInput = 'A proposta é fantástica e temos interesse no serviço, mas por favor parem de mandar mensagens e retirem o meu contacto imediatamente!';
    const res = classifyInboundResponse({ texto: mixedInput });
    assert.strictEqual(res.categoria, 'OPTOUT', 'A regra de ouro exige que OPTOUT prevaleça sobre INTERESSE');
    assert.strictEqual(res.bloqueio_contacto, true);
});

runTest('Interesse misturado com recusa comercial: RECUSA COMERCIAL PREVALECE', () => {
    const mixedInput = 'O vosso trabalho parece muito bom, mas não temos interesse e não pretendemos contratar nada obrigado.';
    const res = classifyInboundResponse({ texto: mixedInput });
    assert.strictEqual(res.categoria, 'RECUSA_COMERCIAL', 'RECUSA expressa prevalece sobre elogios ou interesse prévio');
    assert.strictEqual(res.bloqueio_contacto, true);
});

// ==============================================================================
// 8. VERIFICAÇÃO DE SEGURANÇA E NÃO-DESTRUTIVIDADE (DRY-RUN CONFIRMADO)
// ==============================================================================
console.log('\n--- 8. Verificação de Segurança Operacional e Segredos ---');

runTest('Ficheiro de simulação existe e preserva 405 negócios sem perda de dados', () => {
    const simFile = path.join(ROOT_DIR, 'data', 'sdr_suppression_historical_triage_405.json');
    assert.ok(fs.existsSync(simFile), 'Ficheiro de triagem deve existir');
    const content = JSON.parse(fs.readFileSync(simFile, 'utf8'));
    assert.strictEqual(content.estatisticas.total_analisado, 405, 'Todos os 405 negócios foram avaliados');
    assert.strictEqual(content.meta.modo, 'simulacao_leitura_estrita_sem_escrita_producao');
});

runTest('Não há exposição de OPENAI_API_KEY no ficheiro de triagem ou nos registos', () => {
    const simFile = path.join(ROOT_DIR, 'data', 'sdr_suppression_historical_triage_405.json');
    const rawContent = fs.readFileSync(simFile, 'utf8');
    assert.ok(!rawContent.includes('sk-proj-'), 'Ficheiro de dados não pode conter chaves reais da OpenAI');
});

console.log(`\n==============================================================================`);
console.log(`🎉 TODOS OS ${passedTests}/${totalTests} TESTES AUTOMATIZADOS DA FASE B.1 FORAM APROVADOS!`);
console.log(`==============================================================================\n`);

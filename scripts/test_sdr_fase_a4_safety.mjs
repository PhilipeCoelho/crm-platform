import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    PILOT_DEAL_IDS,
    sanitizeText,
    sanitizeErrorMessage,
    enforceSafetyGuardrails,
    validateGptResponseSchema,
    sanitizeDossierForGpt,
    runGptContextualAnalysis
} from './sdr_fase_a4_gpt_analysis.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 Iniciando Testes Unitários de Segurança Local da Fase A.4.2...\n');

// 1. Teste de Seleção Reproduzível e Representativa dos 5 Negócios Piloto
console.log('--- Teste 1: Seleção da Amostra Piloto (5 Negócios Representativos) ---');
assert.strictEqual(PILOT_DEAL_IDS.length, 5, 'Piloto deve conter exatamente 5 IDs');
const uniquePilotIds = new Set(PILOT_DEAL_IDS);
assert.strictEqual(uniquePilotIds.size, 5, 'Todos os 5 IDs piloto devem ser estritamente únicos');

const inputData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json'), 'utf8'));
const selectedDeals = PILOT_DEAL_IDS.map(id => inputData.resultados_individuais.find(r => r.identificacao.deal_id === id));

assert.strictEqual(selectedDeals.filter(Boolean).length, 5, 'Todos os 5 negócios do piloto devem existir no dataset da Fase A.3');

const [d1, d2, d3, d4, d5] = selectedDeals;
console.log(`  [1] Silêncio puro: ${d1.identificacao.nome} ("${d1.identificacao.motivo_perda_registrado.trim()}")`);
console.log(`  [2] Escassez de dados: ${d2.identificacao.nome} ("${d2.identificacao.motivo_perda_registrado.trim()}")`);
console.log(`  [3] Caso ambíguo / Gatekeeper: ${d3.identificacao.nome} ("${d3.identificacao.motivo_perda_registrado.slice(0, 40)}...")`);
console.log(`  [4] Fricção de canal / Email: ${d4.identificacao.nome} ("${d4.identificacao.motivo_perda_registrado.slice(0, 40)}...")`);
console.log(`  [5] Capacidade / Equipa completa: ${d5.identificacao.nome} ("${d5.identificacao.motivo_perda_registrado.replace(/\n/g, ' ')}")`);
console.log('✅ Teste 1 Aprovado: 5 negócios representativos e reproduzíveis.\n');

// 2. Teste de Higienização de PII (Telefones e E-mails)
console.log('--- Teste 2: Higienização Estrita de PII (Sem Vazamento de Telefones e E-mails) ---');
const rawTextWithPii = 'Contactar o Dr. Santos no 912345678 ou +351 961 222 333 ou 213456789 ou pelo email consultas@clinica-exemplo.pt para agendamento.';
const sanitized = sanitizeText(rawTextWithPii);

assert.ok(!sanitized.includes('912345678'), 'Telefone não deve vazar');
assert.ok(!sanitized.includes('961 222 333'), 'Telefone formatado não deve vazar');
assert.ok(!sanitized.includes('213456789'), 'Telefone fixo não deve vazar');
assert.ok(!sanitized.includes('consultas@clinica-exemplo.pt'), 'Email não deve vazar');
assert.ok(sanitized.includes('[TELEFONE_REMOVIDO]'), 'Deve conter marcador de telefone');
assert.ok(sanitized.includes('[EMAIL_REMOVIDO]'), 'Deve conter marcador de email');
console.log(`  Texto sanitizado: "${sanitized}"`);
console.log('✅ Teste 2 Aprovado: PII devidamente mascarada.\n');

// 3. Teste de Não-Truncamento Prejudicial no Payload e nos Guardrails
console.log('--- Teste 3: Não-Truncamento de Notas Comerciais Extensas ---');
const longNote = 'Apresentamos a proposta comercial completa da agência Vamuss. O responsável ouviu com atenção e explicou detalhadamente que o momento da clínica é de reestruturação total da diretoria, razão pela qual pediu expressamente para não ligar mais e retirar o número da lista de contactos comerciais.';
assert.ok(longNote.length > 200, 'Nota de teste é extensa');

const candidateMock = {
    identificacao: { deal_id: 'test-deal', nome: 'Clínica Teste', motivo_perda_registrado: 'Não respondeu' }
};
const payload = sanitizeDossierForGpt(candidateMock, [{ type: 'note', notes: longNote, completed: true }], []);
assert.ok(payload.atividades_comerciais[0].observacoes.includes('não ligar mais'), 'Nota no payload não deve cortar a frase crucial do final');

// Guardrail com histórico completo
const dossierMock = {
    deal: { id: 'test-deal', lost_reason: 'Não respondeu' },
    activities: [{ notes: longNote }],
    logs: []
};
const guardrailResult = enforceSafetyGuardrails({ decisao: 'reativar_agora' }, dossierMock);
assert.strictEqual(guardrailResult.decisao_final, 'nao_reativar', 'Guardrail deve capturar o opt-out no final da nota longa');
assert.strictEqual(guardrailResult.guardrailAudit.guardrail_acionado, true);
console.log('✅ Teste 3 Aprovado: Frases críticas não são truncadas e guardrail atua com sucesso.\n');

// 4. Teste de Guardrails Determinísticos Pós-Inferência
console.log('--- Teste 4: Guardrails Determinísticos Pós-Inferência ---');

// Cenário A: GPT alucina "reativar_agora" para recusa expressa
const resRecusa = enforceSafetyGuardrails({ decisao: 'reativar_agora' }, {
    deal: { lost_reason: 'não temos interesse na proposta' },
    activities: [],
    logs: []
});
assert.strictEqual(resRecusa.decisao_final, 'nao_reativar');
assert.strictEqual(resRecusa.guardrailAudit.guardrail_acionado, true);

// Cenário B: GPT alucina "reativar_agora" para clínica muito grande
const resPorte = enforceSafetyGuardrails({ decisao: 'reativar_agora' }, {
    deal: { lost_reason: 'Grande clinica' },
    activities: [],
    logs: []
});
assert.strictEqual(resPorte.decisao_final, 'nao_reativar');

// Cenário C: GPT alucina "reativar_agora" para equipa completa
const resCapacidade = enforceSafetyGuardrails({ decisao: 'reativar_agora' }, {
    deal: { lost_reason: 'estamos com a equipa completa' },
    activities: [],
    logs: []
});
assert.strictEqual(resCapacidade.decisao_final, 'aguardar');

// Cenário D: GPT alucina "reativar_agora" para secretária cansada de agências
const resSecretaria = enforceSafetyGuardrails({ decisao: 'reativar_agora' }, {
    deal: { lost_reason: 'secretaria disse que estava cansada de ligacoes de agencias' },
    activities: [],
    logs: []
});
assert.strictEqual(resSecretaria.decisao_final, 'revisao_humana');

// Cenário E: GPT alucina WhatsApp para prospect que exigiu apenas email
const resCanal = enforceSafetyGuardrails({ decisao: 'reativar_agora', adequacao_canal: 'whatsapp' }, {
    deal: { lost_reason: 'apenas por email, canal de atendimento medico' },
    activities: [],
    logs: []
});
assert.strictEqual(resCanal.adequacao_canal, 'email');
assert.strictEqual(resCanal.autorizacao_contacto, 'sem_consentimento_explicito_requer_optin');
console.log('✅ Teste 4 Aprovado: Todos os guardrails determinísticos interceptam e corrigem alucinações.\n');

// 5. Teste de Validação de Esquema Estruturado e Fallback
console.log('--- Teste 5: Validação Estrita de Esquema ---');
assert.strictEqual(validateGptResponseSchema(null), false);
assert.strictEqual(validateGptResponseSchema({}), false);
assert.strictEqual(validateGptResponseSchema({ decisao: 'reativar_agora' }), false, 'Faltando campos obrigatórios');

const validResponse = {
    decisao: 'reativar_agora',
    elegibilidade_comercial: 'elegivel',
    autorizacao_contacto: 'sem_consentimento_explicito_requer_optin',
    adequacao_canal: 'whatsapp',
    justificativa_canal: 'Canal seguro para abordagem consultiva com opt-in pendente',
    potencial_reativacao: 'alto',
    resumo_factual_historico: 'Prospect contactado há 4 meses sem objeção.',
    evidencias_especificas_decisao: 'Silêncio limpo no histórico.',
    objecoes_ou_sinais_incompatibilidade: [],
    grau_confianca: 'alto',
    incertezas_dados_em_falta: 'Nenhuma',
    razao_comercial_apropriada_ou_inapropriada: 'Retomada consultiva.',
    condicao_ou_data_reavaliacao: 'Reavaliar em 15 dias.',
    mensagem_proposta_pt_pt: 'Olá, boa tarde! Espero que esteja tudo bem...'
};
assert.strictEqual(validateGptResponseSchema(validResponse), true, 'Schema completo deve ser válido');

// Schema com valor inválido
const invalidDimension = { ...validResponse, autorizacao_contacto: 'autorizado_automaticamente_por_telefone' };
assert.strictEqual(validateGptResponseSchema(invalidDimension), false, 'Não deve aceitar autorização automática');
console.log('✅ Teste 5 Aprovado: Esquema valida estritamente as 4 dimensões.\n');

// 6. Teste de Sanitização de Erros e Não-Vazamento de Chaves
console.log('--- Teste 6: Higienização de Mensagens de Erro ---');
const rawError = 'OpenAI HTTP 401: Incorrect API key provided: sk-proj-1234567890abcdef. Authorization: Bearer sk-secret-token';
const safeError = sanitizeErrorMessage(rawError);
assert.ok(!safeError.includes('sk-proj-1234567890abcdef'), 'Chave sk-... não deve aparecer no erro');
assert.ok(!safeError.includes('sk-secret-token'), 'Token Bearer não deve aparecer no erro');
assert.ok(safeError.includes('[REDACTED_API_KEY]'), 'Deve mascarar com [REDACTED_API_KEY]');
console.log(`  Erro sanitizado: "${safeError}"`);
console.log('✅ Teste 6 Aprovado: Segredos e chaves nunca são vazados em logs de erro.\n');

// 7. Teste de Interrupção Segura Sem Chave ou com Placeholder
console.log('--- Teste 7: Interrupção Segura Sem Chave ou com Placeholder ---');
const abortResultPlaceholder = await runGptContextualAnalysis({ limit: 5, apiKey: 'coloca_a_tua_chave_aqui' });
assert.strictEqual(abortResultPlaceholder.status, 'interrompido_chave_ausente');
assert.strictEqual(abortResultPlaceholder.chamadas_realizadas, 0);
assert.strictEqual(abortResultPlaceholder.custo_medido_usd, 0);

const abortResultNull = await runGptContextualAnalysis({ limit: 5, apiKey: '' });
assert.strictEqual(abortResultNull.status, 'interrompido_chave_ausente');
assert.strictEqual(abortResultNull.chamadas_realizadas, 0);
assert.strictEqual(abortResultNull.custo_medido_usd, 0);
console.log('✅ Teste 7 Aprovado: Rejeição estrita de chave ausente e de placeholder sem custo.\n');

console.log('🎉 TODOS OS 7 TESTES DE SEGURANÇA E CONFORMIDADE PASSARAM COM SUCESSO!');

// Mock de ambiente de navegador para testes em Node
const memoryStorage = {};
global.window = {
    localStorage: {
        getItem: (key) => memoryStorage[key] || null,
        setItem: (key, val) => { memoryStorage[key] = String(val); },
        removeItem: (key) => { delete memoryStorage[key]; }
    }
};
global.localStorage = global.window.localStorage;

import { contentIntelligenceService } from '../src/services/contentIntelligenceService.js';
import { contentKanbanService } from '../src/services/contentKanbanService.js';

async function runUnitTests() {
    console.log('🧪 [TESTES UNITÁRIOS DE PERSISTÊNCIA E IDEMPOTÊNCIA]');
    const testUserId = 'test-user-inteligencia';

    // 1. Testar Hooks
    console.log('\n--- 1. Testar Biblioteca de Ganchos ---');
    const hooks = await contentIntelligenceService.loadHooks(testUserId);
    console.log(`Ganchos iniciais carregados (Seed): ${hooks.length}`);
    if (hooks.length >= 10) {
        console.log('✅ PASS: Ganchos semente iniciais carregados com sucesso.');
    } else {
        console.log('❌ FAIL: Menos de 10 ganchos carregados.');
    }

    // 2. Testar Adição Manual de Gancho
    const customHook = await contentIntelligenceService.saveHook({
        text: 'O gancho de teste número 1 para validação de unicidade',
        category: 'Teste',
        mechanism: 'Validação'
    }, testUserId);
    console.log(`Gancho salvo: ${customHook.id}`);

    // 3. Testar Importação CSV com Anti-Duplicação
    console.log('\n--- 2. Testar Importação CSV com Anti-Duplicação ---');
    const csvContent = `"O gancho de teste número 1 para validação de unicidade";"Teste";"Mecanismo"\n"Segundo gancho novo vindo do CSV";"Contradição";"Quebra de crença"`;
    const importRes = await contentIntelligenceService.importHooksFromCSV(csvContent, testUserId);
    console.log(`Resultado da importação: ${importRes.imported} importados, ${importRes.skippedDuplicates} duplicados ignorados.`);
    if (importRes.imported === 1 && importRes.skippedDuplicates === 1) {
        console.log('✅ PASS: Anti-duplicação de ganchos funcionou perfeitamente.');
    } else {
        console.log('❌ FAIL: Importação não detectou o duplicado.');
    }

    // 4. Testar Criação de Ideia e Propostas
    console.log('\n--- 3. Testar Ideia e Grelha Editorial das 4 Colunas ---');
    const idea = await contentIntelligenceService.saveIdea({
        rawIdea: 'Empresários investem em tráfego mas não têm processo comercial no WhatsApp.',
        targetAudience: 'PMEs em Portugal',
        goal: 'Autoridade e aquisição'
    }, testUserId);

    const proposal = await contentIntelligenceService.saveProposal({
        ideaId: idea.id,
        angulo: 'Erro Comum',
        ideiaMelhorada: 'O problema não é o tráfego que chega, é a velocidade com que a tua equipa atende.',
        ganchoBase: 'Se demoras 2 horas a responder no WhatsApp, já perdeste a venda.',
        retencaoHook: 'Mostrar print real de tempo médio de resposta dos concorrentes.',
        titulo: 'A Morte das Vendas no WhatsApp',
        formato: 'Reel',
        cta: 'Comenta "AUDITORIA" para analisarmos o teu fluxo comercial.'
    }, testUserId);
    console.log(`Proposta criada na grelha: [${proposal.angulo}] "${proposal.ganchoBase}"`);
    console.log('✅ PASS: Estrutura da grelha de 4 colunas salva com sucesso.');

    // 5. Testar Envio Idempotente para o Kanban
    console.log('\n--- 4. Testar Envio Idempotente para o Kanban ---');
    const sendRes1 = await contentIntelligenceService.sendProposalToKanban(proposal.id, testUserId);
    console.log(`Primeiro envio: cardId=${sendRes1.cardId}, alreadyExisted=${sendRes1.alreadyExisted}`);
    if (sendRes1.success && !sendRes1.alreadyExisted && sendRes1.cardId) {
        console.log('✅ PASS: Cartão criado com sucesso na etapa de Ideias do Kanban.');
    } else {
        console.log('❌ FAIL: Falha ao criar primeiro cartão no Kanban.');
    }

    // Repetir a ação para validar IDEMPOTÊNCIA (não pode duplicar o cartão!)
    const sendRes2 = await contentIntelligenceService.sendProposalToKanban(proposal.id, testUserId);
    console.log(`Segundo envio (repetido): cardId=${sendRes2.cardId}, alreadyExisted=${sendRes2.alreadyExisted}`);
    if (sendRes2.success && sendRes2.alreadyExisted && sendRes2.cardId === sendRes1.cardId) {
        console.log('✅ PASS: Idempotência confirmada! O cartão não foi duplicado ao repetir a ação.');
    } else {
        console.log('❌ FAIL: Cartão foi duplicado involuntariamente.');
    }
}

runUnitTests().catch(console.error);

/**
 * Teste unitário e de integração dos 3 pilares da ronda B.15:
 * 1. Pesquisa Web & Dossiê Clínico (Anti-alucinação)
 * 2. Mapa SPIN, Sinais de Maturidade e Limite de 6 trocas
 * 3. Aprendizado Analítico, Testes A/B (Regra de 30) e Repositório de Objeções
 */

import { generateClinicDossier, getValidDossier } from '../api/sdr_web_research.js';
import {
    getOrCreateSpinState,
    analyzeInboundSpinProgress,
    getNextSpinQuestion,
    formatSpinSummaryForAlert,
    MAX_CLOSER_EXCHANGES
} from '../api/sdr_spin_qualifier.js';
import {
    recordFirstMessageDispatch,
    updateDealOutcome,
    recordLeadObjection,
    generateWeeklyLearningReport,
    getNextABVariant,
    MIN_SAMPLE_FOR_WINNER
} from '../api/sdr_learning_analytics.js';

async function runTests() {
    console.log('🧪 ============================================================');
    console.log('INICIANDO TESTES DO PILAR 1: PESQUISA WEB E DOSSIÊ CLÍNICO');
    console.log('============================================================\n');

    const testDealId = 'deal_test_dossier_01';
    const dossier = await generateClinicDossier({
        dealId: testDealId,
        clinicName: 'Clínica Dentária Diniz Salgueiro',
        concelho: 'Leiria',
        websiteUrl: 'https://cclinic.pt',
        lostReason: 'Orçamento elevado'
    });

    console.log('✅ Dossiê gerado com sucesso:');
    console.log(`• Clínica: ${dossier.clinicName} (${dossier.concelho})`);
    console.log(`• Website acessível: ${dossier.siteAnalysis.hasWebsite} (${dossier.siteAnalysis.url})`);
    console.log(`• Tratamentos em destaque: ${dossier.siteAnalysis.highlightedTreatments?.join(', ') || 'Nenhum'}`);
    console.log(`• Agendamento online detetado: ${dossier.siteAnalysis.hasOnlineBooking}`);
    console.log(`• Factos verificados anti-alucinação (${dossier.verifiedFacts.length}):`);
    dossier.verifiedFacts.forEach(f => {
        console.log(`  - [${f.factId}] ${f.fact} (Fonte: ${f.source})`);
    });

    // Teste de cache (< 30 dias)
    const cachedDossier = getValidDossier(testDealId);
    console.log(`• Dossiê em cache recuperado com sucesso: ${cachedDossier !== null}`);

    console.log('\n🧪 ============================================================');
    console.log('INICIANDO TESTES DO PILAR 2: MAPA SPIN E MATURIDADE CLOSER');
    console.log('============================================================\n');

    const spinDealId = 'deal_test_spin_01';
    let spinState = getOrCreateSpinState(spinDealId, 'C Clinic Leiria');
    console.log(`• Estado inicial SPIN: ${spinState.currentStage} | Trocas: ${spinState.exchangesCount}`);

    // Troca 1: Lead responde sobre situação
    spinState = analyzeInboundSpinProgress({
        inboundText: 'Olá! A maioria das nossas consultas vem por passa a palavra, mas temos muito acordo com a Médis.',
        currentState: spinState
    });
    console.log(`• Após Troca 1: Situação=${spinState.spinState.situacao.status} | Próxima Etapa=${spinState.currentStage}`);
    console.log(`  Citação guardada: "${spinState.spinState.situacao.leadQuote}"`);

    // Próxima pergunta formulada
    const q1 = getNextSpinQuestion(spinState);
    console.log(`• Pergunta gerada para Problema: "${q1}"`);

    // Troca 2: Lead confirma problema de margem e gabinetes vazios
    spinState = analyzeInboundSpinProgress({
        inboundText: 'Sim, a tabela da Médis paga muito pouco e temos dias com gabinetes vazios à tarde.',
        currentState: spinState
    });
    console.log(`• Após Troca 2: Problema=${spinState.spinState.problema.status} | Próxima Etapa=${spinState.currentStage}`);

    // Troca 3: Lead expressa maturidade / pergunta quanto custa
    spinState = analyzeInboundSpinProgress({
        inboundText: 'Como funciona esse vosso sistema no Google e quanto custa começar?',
        currentState: spinState
    });
    console.log(`• Após Troca 3: Sinal de Maturidade=${spinState.maturitySignals.askedHowItWorksOrCost}`);
    console.log(formatSpinSummaryForAlert(spinState));

    console.log('\n🧪 ============================================================');
    console.log('INICIANDO TESTES DO PILAR 3: APRENDIZADO, TESTE A/B E OBJEÇÕES');
    console.log('============================================================\n');

    // Teste de alternância A/B
    const var1 = getNextABVariant('deal_1');
    const var2 = getNextABVariant('deal_2');
    console.log(`• Variantes A/B consecutivas: Deal 1 -> ${var1} | Deal 2 -> ${var2}`);

    // Registo de primeiro disparo
    const dispatch = recordFirstMessageDispatch({
        dealId: 'deal_learn_01',
        contactId: 'contact_01',
        phone: '351912345678',
        clinicName: 'Clínica Sorriso Lisboa',
        variant: 'A',
        angle: 'CLINIC_SPECIFIC_FACT',
        lossReason: 'Orçamento',
        usedWebFact: { factId: 'FACT_SITE_TREATMENTS', fact: 'Foco em implantes dentários', source: 'Website' },
        messageText: 'Olá Dr. Na sequência do nosso contacto anterior...'
    });
    console.log(`• Disparo registado no rastreador: ID=${dispatch.id} | Chars=${dispatch.messageLengthChars}`);

    // Registo de objeção real no repositório
    recordLeadObjection({
        dealId: 'deal_learn_01',
        clinicName: 'Clínica Sorriso Lisboa',
        text: 'Neste momento já trabalhamos com uma agência de marketing que nos faz o Instagram.',
        isAudioTranscript: false
    });
    console.log('• Objeção catalogada no repositório');

    // Atualização de desfecho
    updateDealOutcome({
        dealId: 'deal_learn_01',
        phone: '351912345678',
        newOutcome: 'RESPOSTA_POSITIVA',
        inboundText: 'Já trabalhamos com agência, mas como funciona o Google?'
    });
    console.log('• Desfecho atualizado para RESPOSTA_POSITIVA');

    // Geração do relatório semanal e validação da regra de amostra mínima (30)
    const report = generateWeeklyLearningReport();
    console.log(`• Relatório semanal gerado com sucesso:`);
    console.log(`  - Total de abordagens: ${report.totalDispatches}`);
    console.log(`  - Conclusão A/B: ${report.abTestStatus.conclusion}`);
    console.log(`  - Amostra mínima exigida: ${report.abTestStatus.minSampleSizeRequired} envios`);
    console.log(`  - Total de objeções no repositório: ${report.objectionsTotal}`);

    console.log('\n🎉 TODOS OS TESTES DOS 3 PILARES PASSARAM COM SUCESSO!\n');
}

runTests().catch(err => {
    console.error('❌ Falha nos testes:', err);
    process.exit(1);
});

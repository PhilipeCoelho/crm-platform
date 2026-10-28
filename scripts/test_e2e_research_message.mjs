/**
 * Teste E2E de geração da primeira mensagem com Dossiê Web e Variante A
 */
import { runGPTDiagnosisAndStrategy } from '../api/sdr_engine.js';

async function testRealDiagnosisWithMessage() {
    const deal = {
        id: '2ee3b134-a111-4624-81b8-c9eef850b5ed',
        title: 'C Clinic Leiria',
        lost_reason: 'Sem resposta após primeira abordagem',
        city: 'Leiria',
        website: 'https://cclinic.pt'
    };

    const contact = {
        name: 'Dra. Catarina',
        phone: '+351912345678',
        role: 'Diretora Clínica'
    };

    const lossClassification = {
        category: 'SILENCIO_POS_PROSPECAO',
        description: 'Não houve resposta à abordagem de prospeção inicial',
        confidence: 'ALTA'
    };

    const recoverability = {
        score: 65,
        priorityTier: 'MEDIA',
        diagnosticConfidence: 'ALTA'
    };

    const factualHistory = {
        totalActivities: 2,
        totalOutbound: 2,
        totalInbound: 0,
        hasAnyResponse: false,
        vamussExplained: true,
        specificPitches: ['Redes sociais'],
        chronologicalSummary: ['[2026-04-10] WHATSAPP: Pitch genérico de redes sociais sem resposta']
    };

    const contactValidation = {
        isConfirmed: true,
        isDecisionMaker: 'PROVAVEL',
        canSend: true,
        issues: [],
        identifiedInLogs: 'Dra. Catarina'
    };

    const selectedStrategy = {
        strategy: 'CORRIGIR_PITCH_ANTERIOR_E_DIFERENCIAR',
        suggestedChannel: 'WHATSAPP',
        reasoning: ['Corrigir erro de pitch anterior de redes sociais e focar em pesquisa Google']
    };

    console.log('🚀 Executando Diagnóstico GPT com Dossiê de Pesquisa Web...');
    const result = await runGPTDiagnosisAndStrategy({
        deal,
        contact,
        activities: [],
        daysSinceLost: 45,
        lossClassification,
        recoverability,
        factualHistory,
        contactValidation,
        selectedStrategy,
        previousAttempts: [],
        forcedVariant: 'A'
    });

    console.log('\n======================================================');
    console.log(`Variante A/B atribuída: ${result.ab_variant}`);
    console.log(`Facto de Pesquisa Usado:`, JSON.stringify(result.facto_pesquisa_usado, null, 2));
    console.log('\nMensagem Personalizada Gerada (pt-PT):');
    console.log(`"${result.mensagem_sdr_pt_pt?.texto_recomendado || result.mensagem_sdr_pt_pt?.texto}"`);
    console.log('\nAlternativa Comercial:');
    console.log(`"${result.mensagem_sdr_pt_pt?.alternativa_comercial_relevante}"`);
    console.log('======================================================\n');
}

testRealDiagnosisWithMessage().catch(console.error);

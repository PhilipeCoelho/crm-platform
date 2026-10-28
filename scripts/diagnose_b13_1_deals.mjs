// Run live diagnosis for Diniz Salgueiro, C Clinic Leiria, and DentalCare Lisboa under B.13.1
const deals = [
    { id: '5b0f44c1-57d3-4a30-8de5-7df432207b34', name: 'Clínica Dentária Diniz Salgueiro' },
    { id: '2ee3b134-a111-4624-81b8-c9eef850b5ed', name: 'C Clinic Leiria' },
    { id: '3c3fa28c-9d7d-43e9-9ec5-664508a1bb72', name: 'DentalCare Lisboa' }
];

async function run() {
    console.log('=== EXECUÇÃO DO DIAGNÓSTICO B.13.1 COM GPT-4O-MINI ===\n');
    
    for (const d of deals) {
        console.log(`======================================================================`);
        console.log(`CASO: ${d.name} (${d.id})`);
        console.log(`======================================================================`);
        
        const res = await fetch('http://localhost:3001/api/sdr/diagnose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: d.id })
        });
        
        if (!res.ok) {
            console.error(`Erro ${res.status}:`, await res.text());
            continue;
        }
        
        const data = await res.json();
        const rec = data.recoverability;
        const gpt = data.gptDiagnosis;
        const cv = data.contactValidation;
        const hist = data.factualHistory;
        const strat = data.selectedStrategy;
        
        console.log(`1. DADOS BÁSICOS & RESPIRO:`);
        console.log(`   - Título: ${data.title}`);
        console.log(`   - Motivo da Perda: "${data.lostReason}"`);
        console.log(`   - Dias de Respiro: ${data.daysSinceLost} dias (>=30d: ${data.respiroCumprido})`);
        console.log(`   - Classificação: ${data.lossClassification.category} (${data.lossClassification.confidence})`);
        
        console.log(`\n2. VALIDAÇÃO DE IDENTIDADE & CONTACTO:`);
        console.log(`   - Decisor Confirmado: ${cv?.isDecisionMaker}`);
        console.log(`   - Pode Enviar Direto: ${cv?.canSend ? 'SIM' : 'NÃO (requer validação)'}`);
        console.log(`   - Problemas Detetados: ${cv?.issues?.join(' | ') || 'Nenhum'}`);
        
        console.log(`\n3. RECONSTRUÇÃO FACTUAL:`);
        console.log(`   - Total Atividades: ${hist?.totalActivities} (Outbound: ${hist?.totalOutbound}, Inbound: ${hist?.totalInbound})`);
        console.log(`   - Respostas Reais: ${hist?.hasAnyResponse ? 'SIM' : 'NÃO'}`);
        console.log(`   - Pergunta Pendente Sem Resposta: ${hist?.hasUnansweredQuestion ? 'SIM' : 'NÃO'}`);
        console.log(`   - Oferta Vamuss Explicada: ${hist?.vamussExplained ? 'SIM' : 'NÃO'}`);
        console.log(`   - Variedade de Canais: ${hist?.approachVariety}`);
        
        console.log(`\n4. SCORE DE RECUPERABILIDADE CALIBRADO (B.13.1):`);
        console.log(`   - Score: ${rec.score}/100 (${rec.priorityTier})`);
        console.log(`   - Elegibilidade: ${rec.eligibility}`);
        console.log(`   - Confiança do Diagnóstico: ${rec.diagnosticConfidence}`);
        console.log(`   - Fatores: ${rec.factors.join('; ')}`);
        
        console.log(`\n5. SELEÇÃO DELIBERADA DE ESTRATÉGIA:`);
        console.log(`   - Estratégia Escolhida: ${strat?.strategy}`);
        console.log(`   - Raciocínio: ${strat?.reasoning?.join(' ')}`);
        console.log(`   - Alternativas Descartadas: ${strat?.alternativesConsidered?.join(', ')}`);
        console.log(`   - Porquê não alternativas: ${strat?.whyNotAlternatives}`);
        
        console.log(`\n6. RACIOCÍNIO INTERNO DO GPT:`);
        console.log(JSON.stringify(gpt?.raciocinio_interno, null, 2));
        
        console.log(`\n7. MENSAGEM SDR PROPOSTA (pt-PT):`);
        console.log(`   Canal: ${gpt?.mensagem_sdr_pt_pt?.canal_sugerido}`);
        console.log(`   Texto:\n"${gpt?.mensagem_sdr_pt_pt?.texto}"`);
        
        console.log(`\n8. CONTEXTO COMPARTILHADO PARA O CLOSER (SPIN):`);
        console.log(`   Critério de Transferência: ${gpt?.qualificacao_closer?.criterio_transferencia}`);
        console.log(`   Contexto para Closer: ${gpt?.qualificacao_closer?.contexto_para_closer}`);
        console.log(`   Roteiro SPIN:`, JSON.stringify(gpt?.qualificacao_closer?.roteiro_spin, null, 2));
        console.log(`\n`);
    }
}

run().catch(console.error);

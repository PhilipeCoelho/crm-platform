
const dealsToAnalyze = [
    { id: '2ee3b134-a111-4624-81b8-c9eef850b5ed', name: 'C Clinic Leiria' },
    { id: '3c3fa28c-9d7d-43e9-9ec5-664508a1bb72', name: 'DentalCare Lisboa' },
    { id: '5b0f44c1-57d3-4a30-8de5-7df432207b34', name: 'Clínica Dentária Diniz Salgueiro' },
    { id: '532cc40e-0f38-43a1-ab06-f13e451a12a0', name: 'Clínica Cortez (Caso de Teste dos 30 dias)' }
];

async function run() {
    console.log('Iniciando Diagnóstico Factual GPT para os negócios reais...\n');

    for (const d of dealsToAnalyze) {
        console.log(`=======================================================`);
        console.log(`Analisando Deal: ${d.name} (${d.id})`);
        console.log(`=======================================================`);

        try {
            const res = await fetch('http://localhost:3001/api/sdr/diagnose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId: d.id, forceGpt: true })
            });

            if (!res.ok) {
                console.error(`Erro HTTP ${res.status}:`, await res.text());
                continue;
            }

            const data = await res.json();
            const rec = data.recoverability;
            const gpt = data.gptDiagnosis;
            console.log(`Score: ${rec.score}/100 | Tier: ${rec.priorityTier}`);
            console.log(`Dias de Respiro: ${data.daysSinceLost} dias (Regra: >= 30 dias | Cumprido: ${data.respiroCumprido})`);
            console.log(`Classificação da Perda: ${data.lossClassification.category}`);
            console.log(`Confiança: ${data.lossClassification.confidence}`);
            console.log(`Evidência: ${data.lossClassification.evidence}`);
            console.log(`\nReconstrução Factual (${gpt.source || 'gpt'}):`);
            console.log(JSON.stringify(gpt.reconstrucao_factual, null, 2));
            console.log(`\nEstratégia Comercial:`);
            console.log(JSON.stringify(gpt.estrategia_comercial, null, 2));
            console.log(`\nMensagem Personalizada SDR (pt-PT) [${gpt.mensagem_sdr_pt_pt?.canal_sugerido || 'CANAL'}]:`);
            console.log(`"${gpt.mensagem_sdr_pt_pt?.texto}"`);
            console.log(`\nObjeções Antecipadas:`);
            console.log(JSON.stringify(gpt.objecoes_antecipadas, null, 2));
            console.log(`\nRoteiro SPIN e Qualificação Closer:`);
            console.log(JSON.stringify(gpt.qualificacao_closer, null, 2));
            console.log(`\n`);
        } catch (e) {
            console.error('Falha na chamada:', e.message);
        }
    }
}

run();

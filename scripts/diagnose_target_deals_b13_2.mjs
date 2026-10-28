import 'dotenv/config';

const targetDeals = [
    { id: '5b0f44c1-57d3-4a30-8de5-7df432207b34', name: 'Clínica Dentária Diniz Salgueiro' },
    { id: '2ee3b134-a111-4624-81b8-c9eef850b5ed', name: 'C Clinic Leiria' },
    { id: '3c3fa28c-9d7d-43e9-9ec5-664508a1bb72', name: 'DentalCare Lisboa' }
];

async function run() {
    console.log('🔍 Executando Diagnóstico Live B.13.2 para os 3 negócios alvo...\n');
    
    for (const d of targetDeals) {
        console.log(`\n================================================================================`);
        console.log(`🎯 NEGÓCIO: ${d.name} (${d.id})`);
        console.log(`================================================================================`);
        
        try {
            const res = await fetch('http://localhost:3001/api/sdr/diagnose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId: d.id })
            });

            if (!res.ok) {
                console.error(`❌ Erro HTTP ${res.status}:`, await res.text());
                continue;
            }

            const data = await res.json();
            console.log(JSON.stringify(data, null, 2));
        } catch (err) {
            console.error(`❌ Erro de conexão para ${d.name}:`, err.message);
        }
    }
}

run();

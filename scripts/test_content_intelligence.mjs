import 'dotenv/config';

const BACKEND_URL = 'http://localhost:3001/api/content-intelligence';

async function runTests() {
    console.log('🧪 [TESTES DE INTELIGÊNCIA EDITORIAL]');

    // Caso 1: Testar referência sem material (apenas URL de Instagram)
    console.log('\n--- CASO 1: Referência apenas com URL (Inacessível sem login) ---');
    try {
        const res1 = await fetch(`${BACKEND_URL}/analyze-reference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://www.instagram.com/reel/C7x9abc123',
                platform: 'instagram'
            })
        });
        const data1 = await res1.json();
        console.log('Status retornado:', data1.status);
        console.log('Mensagem:', data1.message);
        if (data1.status === 'requer_material') {
            console.log('✅ PASS: O sistema detectou corretamente a limitação da plataforma e não inventou análise.');
        } else {
            console.log('❌ FAIL: Deveria ter retornado requer_material.');
        }
    } catch (e) {
        console.error('Erro no Caso 1:', e.message);
    }

    // Caso 2: Testar referência com transcrição acessível
    console.log('\n--- CASO 2: Referência com transcrição/áudio acessível ---');
    try {
        const res2 = await fetch(`${BACKEND_URL}/analyze-reference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://www.instagram.com/reel/C7x9abc123',
                platform: 'instagram',
                transcript: 'Se você vende serviços em Portugal, pare de gastar dinheiro promovendo posts no botão azul. O botão promover é para inflar ego. Para vender de verdade você precisa de um funil para o WhatsApp em menos de 5 minutos.',
                notes: 'Atenção aos cortes rápidos e foco em venda direta.',
                hookLibrary: [
                    { text: 'A maioria dos empresários acha que o problema é tráfego...', category: 'Contradição' }
                ]
            })
        });
        const data2 = await res2.json();
        console.log('Status retornado:', data2.status);
        if (data2.data?.propostas?.length > 0) {
            console.log(`✅ PASS: Geradas ${data2.data.propostas.length} propostas originais para a Vamuss.`);
            const p = data2.data.propostas[0];
            console.log('Grelha 4 colunas da Proposta 1:');
            console.log('  Ângulo:', p.angulo);
            console.log('  Ideia melhorada:', p.ideia_melhorada);
            console.log('  Gancho base:', p.gancho_base);
            console.log('  Retenção:', p.retencao_hook);
        } else {
            console.log('⚠️ Resposta sem propostas:', data2);
        }
    } catch (e) {
        console.error('Erro no Caso 2:', e.message);
    }

    // Caso 3: Testar ideia escrita simples
    console.log('\n--- CASO 3: Ideia escrita simples ---');
    try {
        const res3 = await fetch(`${BACKEND_URL}/analyze-idea`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idea: 'Muitos empresários investem em anúncios, mas não sabem se o dinheiro investido está realmente a trazer clientes.',
                targetAudience: 'Empresários e donos de clínicas em Portugal',
                goal: 'Autoridade e consciência do problema',
                hookLibrary: [
                    { text: 'O erro de 500€ que vejo donos de clínicas cometerem...', category: 'Erro Comum' }
                ]
            })
        });
        const data3 = await res3.json();
        if (data3.data?.propostas?.length > 0) {
            console.log(`✅ PASS: Geradas ${data3.data.propostas.length} propostas com a grelha de 4 colunas.`);
            data3.data.propostas.forEach((prop, i) => {
                console.log(`  Proposta ${i + 1}: [${prop.angulo}] "${prop.gancho_base}"`);
            });
        } else {
            console.log('⚠️ Resposta da ideia:', data3);
        }
    } catch (e) {
        console.error('Erro no Caso 3:', e.message);
    }
}

runTests();

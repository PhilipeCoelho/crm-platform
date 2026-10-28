import fs from 'node:fs';
import path from 'node:path';

const action = process.argv[2]; // 'live' or 'lock'
const envPath = path.resolve(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
    console.error('❌ Ficheiro .env não encontrado no diretório atual.');
    process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');

if (action === 'live') {
    if (content.includes('SDR_LEGAL_GATE=')) {
        content = content.replace(/SDR_LEGAL_GATE=.*/g, 'SDR_LEGAL_GATE=LIVE_AUTHORIZED');
    } else {
        content += '\n# Gate Legal de Produção SDR Vamuss\nSDR_LEGAL_GATE=LIVE_AUTHORIZED\n';
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('🟢 [GATE LEGAL ATIVADO] SDR_LEGAL_GATE=LIVE_AUTHORIZED');
    console.log('⚠️  O agente agora está AUTORIZADO a realizar disparos reais via WhatsApp no horário comercial!');
} else {
    if (content.includes('SDR_LEGAL_GATE=')) {
        content = content.replace(/SDR_LEGAL_GATE=.*/g, 'SDR_LEGAL_GATE=FAIL_CLOSED');
    } else {
        content += '\n# Gate Legal de Produção SDR Vamuss\nSDR_LEGAL_GATE=FAIL_CLOSED\n';
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('🛡️ [GATE LEGAL TRAVADO] SDR_LEGAL_GATE=FAIL_CLOSED');
    console.log('🔒 Modo simulação segura ativo. Nenhum disparo real sairá.');
}

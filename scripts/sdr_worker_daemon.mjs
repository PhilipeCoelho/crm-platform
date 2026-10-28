/**
 * ============================================================================
 * VAMUSS SDR — DAEMON PERSISTENTE DO WORKER AUTÓNOMO (PRODUÇÃO & BACKGROUND)
 * ============================================================================
 * Serviço de execução contínua que opera de forma autónoma e resiliente,
 * independente de terminais interativos ou sessões de browser.
 * 
 * Adequado para:
 * - Execução standalone via Node.js (`node scripts/sdr_worker_daemon.mjs`)
 * - Process Manager (PM2 / Systemd / Docker)
 * - Cron jobs de servidor
 * ============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

import { defaultSDRWorker } from '../api/sdr_worker.js';
import { reconcileAllLostDeals } from '../api/sdr_eligibility_reconciler.js';

console.log('='.repeat(80));
console.log('🛡️  VAMUSS SDR WORKER DAEMON — INICIALIZAÇÃO DE SERVIÇO AUTÓNOMO');
console.log(`⏰ Timestamp de arranque: ${new Date().toISOString()}`);
console.log(`🆔 PID do Processo: ${process.pid}`);
console.log(`🔒 Gate Legal: ${process.env.SDR_LEGAL_GATE || 'FAIL_CLOSED'}`);
console.log('='.repeat(80));

const INTERVAL_MINUTES = parseInt(process.env.SDR_WORKER_INTERVAL_MINUTES, 10) || 5;

// Tratamento robusto de sinais do sistema operativo para terminação graciosa
let isShuttingDown = false;

function handleShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 Recebido sinal ${signal}. Encerrando SDR Worker graciosamente...`);
    defaultSDRWorker.stop();
    console.log('✅ Worker parado. Processo finalizado com segurança.');
    process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
    console.error('💥 [SDR Daemon] Exceção não capturada no processo:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [SDR Daemon] Rejeição de Promise não tratada:', reason);
});

async function bootDaemon() {
    try {
        // 1. Executa reconciliação inicial de negócios perdidos
        console.log('🔍 Executando reconciliação inicial do CRM...');
        await reconcileAllLostDeals({ limit: 500 }).catch(err => {
            console.warn('⚠️ Aviso na reconciliação inicial:', err.message);
        });

        // 2. Inicia o worker autónomo
        defaultSDRWorker.start({ intervalMinutes: INTERVAL_MINUTES });
        console.log(`🟢 [SDR Daemon] Operação autónoma ativa a cada ${INTERVAL_MINUTES} minutos.`);
        console.log('📊 Estado consolidado:', JSON.stringify(defaultSDRWorker.getStatus(), null, 2));

    } catch (err) {
        console.error('❌ Falha fatal ao inicializar SDR Daemon:', err);
        process.exit(1);
    }
}

bootDaemon();

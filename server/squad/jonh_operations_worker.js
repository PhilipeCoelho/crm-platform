/**
 * server/squad/jonh_operations_worker.js
 * ============================================================================
 * JONH — MOTOR OPERACIONAL AUTÓNOMO (REVOPS CONTROLLER WORKER)
 * ============================================================================
 * Daemon que roda em background 24h fiscalizando o CRM:
 * 1. Audita e fiscaliza os dados de todos os Prospects que entram no CRM.
 * 2. Garante a REGRA DO PRÓXIMO PASSO OBRIGATÓRIO (nenhum negócio esquecido).
 * 3. Dá vazão contínua às 3 Ondas começando por onde há maior probabilidade de Ganho:
 *    - Onda 1: Lead Engajado (4) -> Foco no Cal.com
 *    - Onda 2: Lead (15) -> Foco em Ghosting Buster
 *    - Onda 3: Prospect (215) -> Foco em enriquecimento e Touch 1 seguro (5-10/dia)
 * 4. Presta contas ao JARVIS com métricas, resultados e gargalos.
 * ============================================================================
 */

import {
    auditProspectsDataHygiene,
    ensureNextStepActivity,
    enforceNextStepActivitiesInBatch,
    getOpenDealsByPriorityWaves,
    OPS_CONFIG
} from './operations_manager.js';
import { validateDispatchTiming } from '../sdr_business_hours.js';
import { auditDailyPerformance } from './boss_agent.js';

export class JonhOperationsWorker {
    constructor() {
        this.isRunning = false;
        this.timer = null;
        this.intervalMinutes = 15;
        this.lastCycleAt = null;
        this.cycleCount = 0;
        this.lastSummary = null;
    }

    /**
     * Inicia o daemon do Jonh no servidor.
     */
    start({ intervalMinutes = 15 } = {}) {
        if (this.isRunning) {
            console.log('⚠️ [Jonh Worker] O Gerente de Operações já se encontra em execução.');
            return;
        }

        this.isRunning = true;
        this.intervalMinutes = intervalMinutes;
        console.log(`🚀 [Jonh Worker] Gerente de Operações ATIVO (Ciclos a cada ${this.intervalMinutes} minutos).`);

        // Executar o primeiro ciclo imediatamente
        this.runFullOperationalCycle().catch(err => {
            console.error('❌ [Jonh Worker] Erro no ciclo inicial:', err.message);
        });

        // Agendar loop periódico
        this.timer = setInterval(() => {
            this.runFullOperationalCycle().catch(err => {
                console.error('❌ [Jonh Worker] Erro no ciclo periódico:', err.message);
            });
        }, this.intervalMinutes * 60 * 1000);
    }

    /**
     * Para o daemon do Jonh.
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('🛑 [Jonh Worker] Gerente de Operações parado.');
    }

    /**
     * Executa o ciclo completo de fiscalização e vazão do CRM.
     */
    async runFullOperationalCycle() {
        this.cycleCount++;
        this.lastCycleAt = new Date().toISOString();
        console.log(`\n============================================================`);
        console.log(`📋 [Jonh Operações] EXECUTANDO CICLO #${this.cycleCount} (${this.lastCycleAt})...`);
        console.log(`============================================================`);

        const summary = {
            cycle: this.cycleCount,
            executedAt: this.lastCycleAt,
            dataHygiene: null,
            waves: null,
            nextStepsEnforced: 0,
            businessHours: validateDispatchTiming(),
            status: 'SUCCESS'
        };

        try {
            // 1. FISCALIZAÇÃO DE ENTRADA DE DADOS DOS PROSPECTS
            const hygiene = await auditProspectsDataHygiene();
            summary.dataHygiene = {
                totalProspects: hygiene.totalAudited,
                readyForWhatsApp: hygiene.ready?.length || 0,
                incompleteOrLandline: hygiene.incomplete?.length || 0
            };

            // 2. LEVANTAMENTO DAS 3 ONDAS DE VAZÃO
            const waves = await getOpenDealsByPriorityWaves();
            summary.waves = {
                onda1Engajados: waves.onda1.length,
                onda2Leads: waves.onda2.length,
                onda3Prospects: waves.onda3.length,
                totalOpen: waves.total
            };

            // 3. APLICAÇÃO DA REGRA DO PRÓXIMO PASSO OBRIGATÓRIO (EM LOTE ULTRA-RÁPIDO)
            // Todo negócio em aberto precisa ter uma atividade pendente
            const allDeals = [...waves.onda1, ...waves.onda2, ...waves.onda3];
            const batchNextStepRes = await enforceNextStepActivitiesInBatch(allDeals);
            summary.nextStepsEnforced = batchNextStepRes.created || 0;

            console.log(`✅ [Jonh Operações] Ciclo #${this.cycleCount} Concluído com Sucesso:`);
            console.log(`   • Negócios em Aberto Fiscalizados: ${summary.waves.totalOpen}`);
            console.log(`   • Prospects 100% Aptos para WhatsApp: ${summary.dataHygiene.readyForWhatsApp}`);
            console.log(`   • Próximos Passos Obrigatórios Criados: ${summary.nextStepsEnforced}`);
            console.log(`   • Janela Útil de Lisboa: ${summary.businessHours.permitido ? 'ABERTA' : 'FECHADA (Fim de semana/Fora de horas)'}`);

            this.lastSummary = summary;
            return summary;
        } catch (err) {
            console.error(`❌ [Jonh Operações] Falha crítica no ciclo #${this.cycleCount}:`, err.message);
            summary.status = 'ERROR';
            summary.error = err.message;
            this.lastSummary = summary;
            return summary;
        }
    }

    /**
     * Retorna o estado operacional completo do Jonh para a API e para o Jarvis.
     */
    getStatus() {
        return {
            name: 'Jonh',
            role: 'Gerente Geral de Operações (RevOps 24h)',
            supervisor: 'Jarvis (O Chefão)',
            reportsTo: 'Jarvis (O Chefão)',
            subordinates: [
                {
                    name: 'Jack Hunter',
                    role: 'Head de Prospeção & Scouting (Portugal)',
                    status: 'ONLINE_24_7',
                    reportsTo: 'Jonh',
                    description: 'Subordinado direto do Jonh. Caça clínicas dentárias 24/7 com Firecrawl e entrega estoque 100% livre de duplicidades.'
                }
            ],
            isRunning: this.isRunning,
            intervalMinutes: this.intervalMinutes,
            cycleCount: this.cycleCount,
            lastCycleAt: this.lastCycleAt,
            lastSummary: this.lastSummary,
            safeLimits: OPS_CONFIG
        };
    }
}

// Instância Singleton do Jonh
export const defaultJonhWorker = new JonhOperationsWorker();

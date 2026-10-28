import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    LISBON_TIMEZONE,
    isWithinBusinessHours,
    validateDispatchTiming,
    getNextBusinessWindow,
    createLisbonDateTime,
    getLisbonTimeParts,
    isPortugueseHoliday,
    getPortugueseHolidays,
    BusinessHoursException
} from './sdr_business_hours.mjs';

import { SDRDispatcherAdapter } from './sdr_dispatcher_adapter.mjs';
import { SDROperationalPipeline } from './sdr_operational_pipeline.mjs';
import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO } from './sdr_activation_gate.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import { SDRIntelligentSalesAgent } from './sdr_intelligent_sales_agent.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ============================================================================
 * VAMUSS SDR — BATERIA DE TESTES AUTOMATIZADOS DA FASE B.11.2
 * ============================================================================
 * Valida de forma exaustiva:
 * 1. Janela comercial determinística: Seg-Sex 09h00-17h00 Europe/Lisbon.
 * 2. Bloqueio estrito de fins de semana (sábados e domingos).
 * 3. Bloqueio estrito de feriados nacionais portugueses (fixos e móveis).
 * 4. Transições sazonais de DST (inverno WET UTC+0 vs verão WEST UTC+1).
 * 5. Bloqueio em todos os caminhos de execução (dispatcher, pipeline, gate, recovery).
 * 6. Impossibilidade de contornar a regra em retries / reprocessamentos.
 * 7. Correção da estratégia comercial de Diniz Salgueiro (3 alternativas sem chamada).
 * 8. Remoção de alegações de retorno financeiro não comprovadas.
 * ============================================================================
 */

async function runPhaseB11_2Tests() {
    console.log('🧪 Iniciando Bateria de Testes Automatizados — Vamuss SDR Fase B.11.2 (Horário Comercial e Estratégia)...\n');

    let passedTests = 0;

    // -------------------------------------------------------------------------
    // TESTE 1: Segunda-feira às 09h00 (Permitido)
    // -------------------------------------------------------------------------
    {
        // 2026-10-12 é uma Segunda-feira útil não-feriado
        const mon0900 = createLisbonDateTime(2026, 10, 12, 9, 0, 0);
        const check = validateDispatchTiming(mon0900);

        assert.strictEqual(check.permitido, true, 'Segunda-feira 09h00:00 deve ser permitida');
        assert.strictEqual(check.motivo, 'DENTRO_DO_HORARIO_COMERCIAL');
        assert.strictEqual(isWithinBusinessHours(mon0900), true);

        passedTests++;
        console.log('  ✅ [PASS] 1. Segunda-feira às 09h00:00 inclusive é permitida (Europe/Lisbon)');
    }

    // -------------------------------------------------------------------------
    // TESTE 2: Sexta-feira às 16h59:59.999 (Permitido)
    // -------------------------------------------------------------------------
    {
        // 2026-10-16 é uma Sexta-feira útil não-feriado
        const fri1659 = createLisbonDateTime(2026, 10, 16, 16, 59, 59);
        const check = validateDispatchTiming(fri1659);

        assert.strictEqual(check.permitido, true, 'Sexta-feira 16h59:59 deve ser permitida');
        assert.strictEqual(check.motivo, 'DENTRO_DO_HORARIO_COMERCIAL');
        assert.strictEqual(isWithinBusinessHours(fri1659), true);

        passedTests++;
        console.log('  ✅ [PASS] 2. Sexta-feira às 16h59:59 exclusive é permitida (Europe/Lisbon)');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: Sexta-feira às 17h00:00 (Bloqueado) e Reagendamento para Segunda 09h00
    // -------------------------------------------------------------------------
    {
        const fri1700 = createLisbonDateTime(2026, 10, 16, 17, 0, 0);
        const check = validateDispatchTiming(fri1700);

        assert.strictEqual(check.permitido, false, 'Sexta-feira 17h00:00 deve ser bloqueada');
        assert.strictEqual(check.motivo, 'APOS_HORARIO_COMERCIAL');
        assert.strictEqual(isWithinBusinessHours(fri1700), false);

        // Deve reagendar para a próxima janela útil: Segunda-feira 19/10/2026 às 09h00
        const nextParts = getLisbonTimeParts(check.proxima_janela_util);
        assert.strictEqual(nextParts.formattedDate, '2026-10-19');
        assert.strictEqual(nextParts.hour, 9);
        assert.strictEqual(nextParts.minute, 0);
        assert.strictEqual(nextParts.weekday, 'Mon');

        passedTests++;
        console.log('  ✅ [PASS] 3. Sexta-feira às 17h00:00 é estritamente bloqueada e reagendada para Segunda 09h00');
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Antes das 09h00 (Bloqueado) e Reagendamento para o Próprio Dia 09h00
    // -------------------------------------------------------------------------
    {
        // Terça-feira às 08h59:59
        const tue0859 = createLisbonDateTime(2026, 10, 13, 8, 59, 59);
        const check = validateDispatchTiming(tue0859);

        assert.strictEqual(check.permitido, false, 'Antes das 09h00 deve ser bloqueado');
        assert.strictEqual(check.motivo, 'ANTES_DO_HORARIO_COMERCIAL');

        // Deve reagendar para o mesmo dia às 09h00
        const nextParts = getLisbonTimeParts(check.proxima_janela_util);
        assert.strictEqual(nextParts.formattedDate, '2026-10-13');
        assert.strictEqual(nextParts.hour, 9);
        assert.strictEqual(nextParts.minute, 0);

        passedTests++;
        console.log('  ✅ [PASS] 4. Antes das 09h00 (08h59:59) é bloqueado e reagendado para as 09h00 do mesmo dia');
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Fins de Semana (Sábado e Domingo estritamente bloqueados)
    // -------------------------------------------------------------------------
    {
        // Sábado 17/10/2026 às 11h30
        const sat = createLisbonDateTime(2026, 10, 17, 11, 30, 0);
        const checkSat = validateDispatchTiming(sat);
        assert.strictEqual(checkSat.permitido, false);
        assert.strictEqual(checkSat.motivo, 'FIM_DE_SEMANA');

        // Domingo 18/10/2026 às 15h00
        const sun = createLisbonDateTime(2026, 10, 18, 15, 0, 0);
        const checkSun = validateDispatchTiming(sun);
        assert.strictEqual(checkSun.permitido, false);
        assert.strictEqual(checkSun.motivo, 'FIM_DE_SEMANA');

        const nextPartsSat = getLisbonTimeParts(checkSat.proxima_janela_util);
        assert.strictEqual(nextPartsSat.formattedDate, '2026-10-19');
        assert.strictEqual(nextPartsSat.weekday, 'Mon');
        assert.strictEqual(nextPartsSat.hour, 9);

        passedTests++;
        console.log('  ✅ [PASS] 5. Sábados e Domingos são estritamente bloqueados com reagendamento para Segunda 09h00');
    }

    // -------------------------------------------------------------------------
    // TESTE 6: Feriados Nacionais Portugueses Fixos Bloqueados
    // -------------------------------------------------------------------------
    {
        // 25 de Abril de 2026 às 10h00
        const diaLiberdade = createLisbonDateTime(2026, 4, 25, 10, 0, 0);
        const check25Abr = validateDispatchTiming(diaLiberdade);
        assert.strictEqual(check25Abr.permitido, false);
        assert.strictEqual(check25Abr.motivo, 'FERIADO_NACIONAL_PORTUGAL');

        // 1 de Maio de 2026 (Sexta-feira) às 14h00
        const diaTrabalhador = createLisbonDateTime(2026, 5, 1, 14, 0, 0);
        const check1Mai = validateDispatchTiming(diaTrabalhador);
        assert.strictEqual(check1Mai.permitido, false);
        assert.strictEqual(check1Mai.motivo, 'FERIADO_NACIONAL_PORTUGAL');

        // 10 de Junho de 2026 (Quarta-feira) às 11h00
        const diaPortugal = createLisbonDateTime(2026, 6, 10, 11, 0, 0);
        const check10Jun = validateDispatchTiming(diaPortugal);
        assert.strictEqual(check10Jun.permitido, false);
        assert.strictEqual(check10Jun.motivo, 'FERIADO_NACIONAL_PORTUGAL');

        // 5 de Outubro de 2026 (Segunda-feira) às 10h00
        const rep = createLisbonDateTime(2026, 10, 5, 10, 0, 0);
        const check5Out = validateDispatchTiming(rep);
        assert.strictEqual(check5Out.permitido, false);
        assert.strictEqual(check5Out.motivo, 'FERIADO_NACIONAL_PORTUGAL');

        // Próxima janela para 5 de Outubro (Segunda) deve saltar para Terça 6 de Outubro às 09h00!
        const nextFromHoliday = getLisbonTimeParts(check5Out.proxima_janela_util);
        assert.strictEqual(nextFromHoliday.formattedDate, '2026-10-06');
        assert.strictEqual(nextFromHoliday.weekday, 'Tue');
        assert.strictEqual(nextFromHoliday.hour, 9);

        passedTests++;
        console.log('  ✅ [PASS] 6. Feriados nacionais portugueses fixos (25 Abr, 1 Mai, 10 Jun, 5 Out) bloqueados');
    }

    // -------------------------------------------------------------------------
    // TESTE 7: Feriados Nacionais Portugueses Móveis (Sexta-Feira Santa e Corpo de Deus)
    // -------------------------------------------------------------------------
    {
        // Sexta-Feira Santa 2026: 03/04/2026 às 11h00
        const goodFriday = createLisbonDateTime(2026, 4, 3, 11, 0, 0);
        const checkGF = validateDispatchTiming(goodFriday);
        assert.strictEqual(checkGF.permitido, false);
        assert.strictEqual(checkGF.motivo, 'FERIADO_NACIONAL_PORTUGAL');

        // Reagendamento da Sexta-Feira Santa salta o fim de semana para Segunda 06/04/2026 às 09h00
        const nextGF = getLisbonTimeParts(checkGF.proxima_janela_util);
        assert.strictEqual(nextGF.formattedDate, '2026-04-06');
        assert.strictEqual(nextGF.weekday, 'Mon');

        // Corpo de Deus 2026 (Quinta-feira 04/06/2026) às 11h00
        const corpusChristi = createLisbonDateTime(2026, 6, 4, 11, 0, 0);
        const checkCC = validateDispatchTiming(corpusChristi);
        assert.strictEqual(checkCC.permitido, false);
        assert.strictEqual(checkCC.motivo, 'FERIADO_NACIONAL_PORTUGAL');

        // Reagendamento de Corpo de Deus vai para Sexta-feira 05/06/2026 às 09h00
        const nextCC = getLisbonTimeParts(checkCC.proxima_janela_util);
        assert.strictEqual(nextCC.formattedDate, '2026-06-05');
        assert.strictEqual(nextCC.weekday, 'Fri');

        passedTests++;
        console.log('  ✅ [PASS] 7. Feriados nacionais móveis (Sexta-Feira Santa e Corpo de Deus) calculados e bloqueados');
    }

    // -------------------------------------------------------------------------
    // TESTE 8: Transição DST Inverno (WET UTC+0) vs Verão (WEST UTC+1) em Europe/Lisbon
    // -------------------------------------------------------------------------
    {
        // Inverno (WET): 15 de Janeiro às 09h30 UTC é 09h30 Lisbon (Permitido)
        const winterUtc = new Date('2026-01-15T09:30:00.000Z');
        const winterParts = getLisbonTimeParts(winterUtc);
        assert.strictEqual(winterParts.hour, 9);
        assert.strictEqual(isWithinBusinessHours(winterUtc), true);

        // Verão (WEST): 15 de Julho às 08h30 UTC é 09h30 Lisbon (Permitido)
        const summerUtc = new Date('2026-07-15T08:30:00.000Z');
        const summerParts = getLisbonTimeParts(summerUtc);
        assert.strictEqual(summerParts.hour, 9);
        assert.strictEqual(summerParts.minute, 30);
        assert.strictEqual(isWithinBusinessHours(summerUtc), true);

        // Verão (WEST): 15 de Julho às 16h00 UTC é 17h00 Lisbon (Bloqueado!)
        const summerUtcAfter = new Date('2026-07-15T16:00:00.000Z');
        const summerAfterParts = getLisbonTimeParts(summerUtcAfter);
        assert.strictEqual(summerAfterParts.hour, 17);
        assert.strictEqual(isWithinBusinessHours(summerUtcAfter), false);

        passedTests++;
        console.log('  ✅ [PASS] 8. Transição DST rigorosamente respeitada em Europe/Lisbon (WET UTC+0 e WEST UTC+1)');
    }

    // -------------------------------------------------------------------------
    // TESTE 9: SDRDispatcherAdapter bloqueia disparo fora do horário
    // -------------------------------------------------------------------------
    {
        const dispatcher = new SDRDispatcherAdapter({ enforceBusinessHours: true });

        // Simulação fora do horário (ex.: 20h00)
        const nightTime = createLisbonDateTime(2026, 10, 14, 20, 0, 0);
        const resultSim = await dispatcher.dispatchSimulated({
            deal_id: 'deal_timing_01',
            canal: 'WHATSAPP',
            destinatario: '351912345678',
            mensagem: 'Tentativa noturna',
            timestamp: nightTime.toISOString()
        });

        assert.strictEqual(resultSim.sucesso, false);
        assert.strictEqual(resultSim.bloqueado, true);
        assert.strictEqual(resultSim.motivo, 'APOS_HORARIO_COMERCIAL');
        assert.ok(resultSim.proxima_janela_util);

        // Modo throw em simulação fora de hora
        let thrownSim = false;
        try {
            await dispatcher.dispatchSimulated({
                deal_id: 'deal_timing_02',
                canal: 'WHATSAPP',
                destinatario: '351912345678',
                mensagem: 'Tentativa com throw',
                timestamp: nightTime.toISOString(),
                throwOnBlockedTiming: true
            });
        } catch (err) {
            if (err instanceof BusinessHoursException) {
                thrownSim = true;
            }
        }
        assert.strictEqual(thrownSim, true, 'Deve lançar BusinessHoursException');

        // Disparo real fora de hora (deve lançar BusinessHoursException)
        let thrownReal = false;
        try {
            await dispatcher.dispatchReal({
                deal_id: 'deal_timing_03',
                canal: 'WHATSAPP',
                destinatario: '351912345678',
                mensagem: 'Tentativa real fora de hora',
                timestamp: nightTime.toISOString()
            });
        } catch (err) {
            if (err instanceof BusinessHoursException) {
                thrownReal = true;
            }
        }
        assert.strictEqual(thrownReal, true);

        passedTests++;
        console.log('  ✅ [PASS] 9. SDRDispatcherAdapter bloqueia disparos simulados e reais fora de hora com alerta');
    }

    // -------------------------------------------------------------------------
    // TESTE 10: SDROperationalPipeline bloqueia imediatamente antes do envio
    // -------------------------------------------------------------------------
    {
        const pipeline = new SDROperationalPipeline({ enforceBusinessHours: true });

        const deal = {
            id: 'deal_pipeline_timing_01',
            title: 'Clínica Sorriso Aberto',
            categoria_final_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '919111222',
            canal_candidato: 'WHATSAPP'
        };

        // Execução às 18h00 (fora de horário)
        const eveningTime = createLisbonDateTime(2026, 10, 14, 18, 0, 0);
        const resBlocked = await pipeline.processDeal({
            deal,
            legalOverride: { avaliacao_lia_b2b_aprovada: true },
            simulatedCurrentDay: 1,
            dispatchTimestamp: eveningTime.toISOString()
        });

        assert.strictEqual(resBlocked.resultado_final.status, 'BLOQUEADO_FORA_HORARIO_COMERCIAL');
        assert.strictEqual(resBlocked.resultado_final.motivo, 'APOS_HORARIO_COMERCIAL');
        assert.ok(resBlocked.resultado_final.reagendado_para);
        assert.strictEqual(pipeline.dispatcher.getStats().total_envios_simulados, 0);

        // Execução às 10h30 (dentro do horário com novo negócio)
        const dealAllowed = {
            id: 'deal_pipeline_timing_02',
            title: 'Clínica Sorriso Aberto 2',
            categoria_final_canonica: 'SILENCIO_CONFIRMADO',
            telefone: '919111333',
            canal_candidato: 'WHATSAPP'
        };
        const validTime = createLisbonDateTime(2026, 10, 14, 10, 30, 0);
        const resAllowed = await pipeline.processDeal({
            deal: dealAllowed,
            legalOverride: { avaliacao_lia_b2b_aprovada: true },
            simulatedCurrentDay: 1,
            dispatchTimestamp: validTime.toISOString()
        });

        assert.strictEqual(resAllowed.passos['07_dispatcher_simulado'].sucesso, true);
        assert.strictEqual(pipeline.dispatcher.getStats().total_envios_simulados, 1);

        passedTests++;
        console.log('  ✅ [PASS] 10. SDROperationalPipeline bloqueia antes do disparo fora de janela e autoriza em janela');
    }

    // -------------------------------------------------------------------------
    // TESTE 11: SDRActivationGate bloqueia ativação fora do horário
    // -------------------------------------------------------------------------
    {
        const gate = new SDRActivationGate();

        const candidateApproved = {
            deal_id: 'deal_gate_timing_01',
            nome_clinica: 'Clínica Dentária Homologada Lda',
            categoria_canonica: 'ELEGIVEL_CONSIDERACAO_PILOTO_FUTURO_COM_AUTORIZACAO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '912345678',
            // Cumpre base legal
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-2026-HOMOLOG-001',
            responsavel_homologacao_juridica: 'Dra. Maria Santos (DPO)',
            // Cumpre canal
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            // Cumpre aprovação operacional
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'Operador Chefe',
            data_aprovacao_operacional: '2026-10-10T10:00:00Z',
            // Validação de horário ativada
            checkBusinessHours: true,
            dispatchTimestamp: createLisbonDateTime(2026, 10, 14, 21, 0, 0).toISOString() // 21h00
        };

        const decisionBlocked = gate.evaluateActivation(candidateApproved);
        assert.strictEqual(decisionBlocked.autorizado_para_ativacao, false);
        assert.strictEqual(decisionBlocked.motivo_decisao, MOTIVOS_BLOQUEIO_ATIVACAO.FORA_HORARIO_COMERCIAL);
        assert.ok(decisionBlocked.proxima_janela_util);

        // Se avaliado dentro do horário às 14h00
        candidateApproved.dispatchTimestamp = createLisbonDateTime(2026, 10, 14, 14, 0, 0).toISOString();
        const decisionAllowed = gate.evaluateActivation(candidateApproved);
        assert.strictEqual(decisionAllowed.autorizado_para_ativacao, true);

        passedTests++;
        console.log('  ✅ [PASS] 11. SDRActivationGate valida cumulativamente horário comercial antes da ativação final');
    }

    // -------------------------------------------------------------------------
    // TESTE 12: SDRRecoveryPipelineIntegration e Gestão de Retries
    // -------------------------------------------------------------------------
    {
        const recovery = new SDRRecoveryPipelineIntegration();
        const lostDeal = {
            id: 'deal_recovery_timing_01',
            title: 'Clínica Dentária Nova',
            status: 'lost',
            lostReason: 'Não respondeu',
            lostAt: '2026-06-01T10:00:00Z',
            telefone: '912345678'
        };

        recovery.enqueueLostDeal(lostDeal);

        // Tentativa de preparar ação fora do horário comercial
        const outOfHoursDate = createLisbonDateTime(2026, 10, 17, 10, 0, 0); // Sábado
        const prepBlocked = recovery.prepareNextCommercialAction('deal_recovery_timing_01', {
            checkBusinessHours: true,
            dispatchTimestamp: outOfHoursDate.toISOString()
        });

        assert.strictEqual(prepBlocked.ready, false);
        assert.strictEqual(prepBlocked.blocked, true);
        assert.strictEqual(prepBlocked.motivo_bloqueio, 'FORA_HORARIO_COMERCIAL');
        assert.strictEqual(prepBlocked.reagendamento_sugerido, true);
        assert.ok(prepBlocked.reagendado_para);

        // Validação direta via validateRecoveryTiming
        const valBlocked = recovery.validateRecoveryTiming('deal_recovery_timing_01', {
            dispatchTimestamp: outOfHoursDate.toISOString()
        });
        assert.strictEqual(valBlocked.permitido, false);
        assert.strictEqual(valBlocked.motivo, 'FIM_DE_SEMANA');

        // Retries / reprocessamentos concorrentes não contornam a regra
        const retryDate = createLisbonDateTime(2026, 10, 18, 14, 0, 0); // Domingo
        const retryBlocked = recovery.validateRecoveryTiming('deal_recovery_timing_01', {
            dispatchTimestamp: retryDate.toISOString()
        });
        assert.strictEqual(retryBlocked.permitido, false);
        assert.strictEqual(retryBlocked.motivo, 'FIM_DE_SEMANA');

        passedTests++;
        console.log('  ✅ [PASS] 12. Fila de recuperação e retries impedem contorno da regra horária e sugerem reagendamento');
    }

    // -------------------------------------------------------------------------
    // TESTE 13: Correção Comercial Diniz Salgueiro (3 Alternativas sem Pedido de Chamada)
    // -------------------------------------------------------------------------
    {
        const agent = new SDRIntelligentSalesAgent();
        const dinizSalgueiroDeal = {
            id: '5b0f44c1-57d3-4a30-8de5-7df432207b34',
            title: 'Negócio Clínica Dentária Diniz Salgueiro',
            nome_clinica: 'Clínica Dentária Diniz Salgueiro',
            status: 'lost',
            lostReason: 'Não respondeu - Não respondeu as abordagens',
            contacto: { telefone: '+351929238634', email: 'geral@dinizsalgueiro.pt' }
        };

        const session = await agent.executeAgentCycle({
            dealId: dinizSalgueiroDeal.id,
            dealData: dinizSalgueiroDeal
        });

        const alts = session.alternativas_primeira_abordagem;
        assert.ok(alts, 'Sessão deve registar as alternativas estruturadas');
        assert.strictEqual(alts.alternativas.length, 3, 'Devem existir exatamente 3 alternativas comerciais');

        // Todas as 3 alternativas NÃO devem pedir chamada nem reunião
        alts.alternativas.forEach((alt, idx) => {
            assert.strictEqual(alt.pede_chamada_ou_reuniao, false, `Alternativa ${idx + 1} não pode pedir chamada`);
            assert.strictEqual(alt.assume_problema_agenda, false, `Alternativa ${idx + 1} não pode presumir problemas de agenda`);
            const lower = alt.texto.toLowerCase();
            assert.ok(!lower.includes('15 minutos') && !lower.includes('20 minutos') && !lower.includes('chamada') && !lower.includes('reunião') && !lower.includes('ligar'), `Alternativa ${idx + 1} contém termos de reunião/chamada`);
            assert.ok(!lower.includes('google'), `Alternativa ${idx + 1} não deve repetir argumento do Google`);
        });

        // Alternativa 1 selecionada ancorada em microscopia
        assert.strictEqual(alts.alternativa_selecionada, 1);
        const chosenText = session.proposta_mensagem.texto_pt_pt;
        assert.ok(chosenText.includes('microscopia operatória') || chosenText.includes('endodontia'));
        assert.ok(alts.continuidade_planeada.se_resposta_positiva);

        passedTests++;
        console.log('  ✅ [PASS] 13. Caso Diniz Salgueiro estruturado com 3 alternativas sem pedido de chamada ou presunções');
    }

    // -------------------------------------------------------------------------
    // TESTE 14: Remoção de Argumentos Não Comprovados de Retorno Financeiro
    // -------------------------------------------------------------------------
    {
        // 1. Verificar ficheiro da skill comercial
        const skillPath = path.join(ROOT_DIR, '.agent', 'skills', 'vamuss-sdr-commercial', 'SKILL.md');
        const skillRaw = fs.readFileSync(skillPath, 'utf8');
        assert.ok(!skillRaw.includes('dois ou três pacientes pagam o investimento'), 'Não deve afirmar que 2 ou 3 pacientes pagam o investimento');
        assert.ok(!skillRaw.includes('2 a 3 novos pacientes particulares de primeira consulta por mês'), 'Não deve prometer retorno de 2 a 3 pacientes');

        // 2. Verificar o agente de vendas
        const agentPath = path.join(ROOT_DIR, 'scripts', 'sdr_intelligent_sales_agent.mjs');
        const agentRaw = fs.readFileSync(agentPath, 'utf8');
        assert.ok(!agentRaw.includes('2 a 3 pacientes de primeira consulta cobrem o investimento'));
        assert.ok(!agentRaw.includes('cobrir o custo com 2 a 3 tratamentos'));

        // 3. Testar tratamento da objeção de preço no agente
        const agent = new SDRIntelligentSalesAgent();
        const objPreco = agent.evaluateConversationScenario({
            tipoCenario: 'OBJECAO_PRECO',
            textoInterlocutor: 'O vosso serviço é muito caro.'
        });

        assert.strictEqual(objPreco.propor_reuniao_imediata, false);
        assert.ok(!objPreco.proxima_acao_recomendada.includes('2 a 3 pacientes'));
        assert.ok(objPreco.proxima_acao_recomendada.includes('sem formular promessas infundadas de retorno'));

        passedTests++;
        console.log('  ✅ [PASS] 14. Remoção total de argumentos de retorno não comprovados (proibido "2 ou 3 pacientes pagam")');
    }

    console.log('\n==============================================================================');
    console.log(`🎉 TODOS OS ${passedTests}/${passedTests} TESTES DA FASE B.11.2 FORAM APROVADOS COM SUCESSO!`);
    console.log('==============================================================================\n');
}

runPhaseB11_2Tests().catch(err => {
    console.error('❌ Falha na bateria de testes da Fase B.11.2:', err);
    process.exit(1);
});

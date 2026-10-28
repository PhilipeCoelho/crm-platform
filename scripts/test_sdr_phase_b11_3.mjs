/**
 * Testes Unitários e Funcionais da Fase B.11.3
 * Validação Comercial Ponta a Ponta com o Caso Real (Clínica Dentária Diniz Salgueiro)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRIntelligentSalesAgent } from './sdr_intelligent_sales_agent.mjs';
import {
    isWithinBusinessHours,
    validateDispatchTiming,
    getNextBusinessWindow,
    createLisbonDateTime
} from './sdr_business_hours.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🧪 Iniciando Testes da Fase B.11.3 (Validação Comercial Ponta a Ponta)...\n');

let testsPassed = 0;
async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ FALHA: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';
const agent = new SDRIntelligentSalesAgent();

// Carregar dados de auditoria existentes para garantir contexto idêntico ao validador
const b2Path = path.resolve(projectRoot, 'data/sdr_reactivation_phase_b2_audit.json');
const b2Data = JSON.parse(fs.readFileSync(b2Path, 'utf8'));
const rawDealB2 = (b2Data.auditoria_completa_405_negocios || []).find(d => d.deal_id === CANONICAL_DEAL_ID);

const publicWebData = {
    dados: {
        nome_oficial: 'Clínica Dentária Diniz Salgueiro',
        localizacao: 'Avenida das Forças Armadas, 2A – 1º C, 1600-082 Lisboa (Entrecampos)',
        concelho: 'LISBOA',
        website: 'https://clinicadinizsalgueiro.pt',
        especialidades: ['Cirurgia oral', 'Endodontia', 'Ortodontia', 'Odontopediatria', 'Prostodontia', 'Reabilitação oral'],
        equipamentos: ['Microscópio endodôntico', 'Radiologia digital']
    }
};

async function main() {
    // TESTE 1: Consulta do negócio real e separação rigorosa de Factos vs Hipóteses
    await runTest('1. Consulta do caso real Diniz Salgueiro e segregação de Factos e Hipóteses', async () => {
        assert.ok(rawDealB2, 'O negócio Diniz Salgueiro deve constar da base auditada');
        assert.strictEqual(rawDealB2.deal_id, CANONICAL_DEAL_ID);
        assert.ok(rawDealB2.nome_clinica.includes('Diniz Salgueiro'));
        assert.strictEqual(rawDealB2.motivo_perda_original, 'Não respondeu - Não respondeu as abordagens');

        const session = await agent.executeAgentCycle({
            dealId: CANONICAL_DEAL_ID,
            dealData: {
                id: CANONICAL_DEAL_ID,
                title: rawDealB2.nome_clinica,
                status: 'lost',
                lostReason: rawDealB2.motivo_perda_original,
                lostAt: '2026-06-19T17:34:13.765+00:00',
                contacto: rawDealB2.contacto
            },
            publicWebPresence: publicWebData
        });

        const raciocinio = session.etapas_raciocinio['04_raciocinio_comercial_gpt'];
        assert.ok(Array.isArray(raciocinio.factos_comprovados) && raciocinio.factos_comprovados.length >= 3);
        assert.ok(Array.isArray(raciocinio.hipoteses_estrategicas) && raciocinio.hipoteses_estrategicas.length >= 1);
        assert.ok(Array.isArray(raciocinio.dados_em_falta) && raciocinio.dados_em_falta.length >= 2);
        assert.ok(raciocinio.causa_provavel_perda_anterior.length > 20);
        assert.strictEqual(raciocinio.estrategia_escolhida, 'REAQUECIMENTO_CONSULTIVO_BAIXO_ATRITO');
    });

    // TESTE 2: Avaliação de alternativas e seleção da abordagem sem pedido de reunião
    await runTest('2. Avaliação de 3 alternativas e escolha da abordagem de baixo atrito', async () => {
        const session = await agent.executeAgentCycle({
            dealId: CANONICAL_DEAL_ID,
            dealData: {
                id: CANONICAL_DEAL_ID,
                title: rawDealB2.nome_clinica,
                status: 'lost',
                lostReason: rawDealB2.motivo_perda_original,
                lostAt: '2026-06-19T17:34:13.765+00:00',
                contacto: rawDealB2.contacto
            },
            publicWebPresence: publicWebData
        });

        const alts = session.alternativas_primeira_abordagem;
        assert.strictEqual(alts.alternativas.length, 3);
        assert.strictEqual(alts.alternativa_selecionada, 1);
        assert.ok(alts.justificacao_escolha.toLowerCase().includes('microscóp'));

        // Verifica que a alternativa 1 não pede reunião nem chamada telefónica
        const alt1 = alts.alternativas.find(a => a.alternativa_id === 1);
        assert.strictEqual(alt1.pede_chamada_ou_reuniao, false);
        assert.strictEqual(alt1.assume_problema_agenda, false);
        assert.ok(alt1.texto.includes('microscopia na endodontia'));
        assert.ok(alt1.texto.includes('Na Vamuss, trabalhamos a forma como as empresas comunicam o seu valor'));
        assert.ok(alt1.texto.includes('Fiquei com curiosidade: sentem que os pacientes que procuram a clínica já conhecem essa diferenciação'));

        // Verifica que não contém alegações infundadas de retorno financeiro
        assert.ok(!alt1.texto.includes('dois ou três pacientes'));
        assert.ok(!alt1.texto.includes('pagam o investimento'));
    });

    // TESTE 3: Preparação da ação completa pelo agente SDR
    await runTest('3. Execução da análise comercial integrada pelo SDRIntelligentSalesAgent', async () => {
        const session = await agent.executeAgentCycle({
            dealId: CANONICAL_DEAL_ID,
            dealData: {
                id: CANONICAL_DEAL_ID,
                title: rawDealB2.nome_clinica,
                status: 'lost',
                lostReason: rawDealB2.motivo_perda_original,
                lostAt: '2026-06-19T17:34:13.765+00:00',
                contacto: rawDealB2.contacto
            },
            publicWebPresence: publicWebData
        });

        assert.strictEqual(session.deal_id, CANONICAL_DEAL_ID);
        assert.strictEqual(session.proposta_mensagem.pede_reuniao_ou_chamada, false);
        assert.strictEqual(session.proposta_mensagem.canal, 'WHATSAPP');
        assert.ok(session.proposta_mensagem.texto_pt_pt.length > 50);
        assert.strictEqual(session.decisao_comercial, 'MENSAGEM_PERSONALIZADA_BAIXO_ATRITO');
    });

    // TESTE 4: Simulação dos 8 cenários conversacionais
    await runTest('4. Simulação completa dos 8 cenários de continuação da conversa', () => {
        // Cenário 1: Curiosidade
        const c1 = agent.evaluateConversationScenario({
            tipoCenario: 'CURIOSIDADE_ABORDAGEM',
            textoInterlocutor: 'Como é que encontraram a nossa clínica e porque estão a falar em microscopia?'
        });
        assert.strictEqual(c1.propor_reuniao_imediata, false);
        assert.ok(c1.mensagem_proposta_pt_pt.includes('Ao mapear o setor médico-dentário em Lisboa'));

        // Cenário 2: Explicação de serviços
        const c2 = agent.evaluateConversationScenario({
            tipoCenario: 'PEDIDO_EXPLICACAO_SERVICOS',
            textoInterlocutor: 'Podem explicar melhor o que fazem exatamente na Vamuss?'
        });
        assert.strictEqual(c2.propor_reuniao_imediata, false);
        assert.ok(c2.mensagem_proposta_pt_pt.includes('não fazemos gestão genérica de redes sociais'));

        // Cenário 3: Objeção de preço
        const c3 = agent.evaluateConversationScenario({
            tipoCenario: 'OBJECAO_PRECO',
            textoInterlocutor: 'Quanto é que custa o vosso serviço para uma clínica como a nossa?'
        });
        assert.strictEqual(c3.propor_reuniao_imediata, false);
        assert.ok(c3.mensagem_proposta_pt_pt.includes('Sem conhecermos a vossa estrutura de custos e margens reais'));
        assert.ok(!c3.mensagem_proposta_pt_pt.includes('dois ou três pacientes'));

        // Cenário 4: Já tem agência
        const c4 = agent.evaluateConversationScenario({
            tipoCenario: 'JA_TEM_AGENCIA',
            textoInterlocutor: 'Já temos uma agência de marketing a tratar da nossa comunicação há 2 anos.'
        });
        assert.strictEqual(c4.propor_reuniao_imediata, false);
        assert.ok(c4.mensagem_proposta_pt_pt.includes('consultas particulares pagas que entram na clínica todos os meses'));

        // Cenário 5: Necessidade identificada (deve propor reunião de 20 min com opções)
        const c5 = agent.evaluateConversationScenario({
            tipoCenario: 'NECESSIDADE_IDENTIFICADA',
            textoInterlocutor: 'Temos dois gabinetes vazios às terças e quintas e precisamos de atrair mais pacientes particulares para endodontia e cirurgia.'
        });
        assert.strictEqual(c5.propor_reuniao_imediata, true);
        assert.ok(c5.mensagem_proposta_pt_pt.includes('Reunião de Diagnóstico de 20 minutos por Google Meet'));
        assert.ok(c5.mensagem_proposta_pt_pt.includes('Quinta-feira às 11h ou sexta-feira às 15h'));

        // Cenário 6: Pergunta inesperada
        const c6 = agent.evaluateConversationScenario({
            tipoCenario: 'PERGUNTA_INESPERADA',
            textoInterlocutor: 'Qual é a vossa experiência prática com tratamentos de harmonização orofacial?'
        });
        assert.strictEqual(c6.propor_reuniao_imediata, false);
        assert.ok(c6.mensagem_proposta_pt_pt.includes('O nosso foco está na medicina dentária'));

        // Cenário 7: Recusa explícita (deve respeitar e confirmar remoção)
        const c7 = agent.evaluateConversationScenario({
            tipoCenario: 'RECUSA_COMERCIAL',
            textoInterlocutor: 'Não temos qualquer interesse, por favor não voltem a contactar esta clínica.'
        });
        assert.strictEqual(c7.propor_reuniao_imediata, false);
        assert.ok(c7.mensagem_proposta_pt_pt.includes('retiramos de imediato os contactos da nossa lista de comunicação'));

        // Cenário 8: Ausência de resposta (silêncio)
        const c8 = agent.evaluateConversationScenario({
            tipoCenario: 'SILENCIO_SEM_RESPOSTA',
            textoInterlocutor: null
        });
        assert.strictEqual(c8.propor_reuniao_imediata, false);
        assert.ok(c8.mensagem_proposta_pt_pt.includes('Nenhuma mensagem imediata'));
        assert.ok(c8.proxima_acao_recomendada.includes('5 a 7 dias úteis'));
    });

    // TESTE 5: Mapeamento de Transições no CRM para cada cenário
    await runTest('5. Transições previstas no pipeline CRM para cada um dos 8 cenários', () => {
        // Cenários de reaquecimento positivo -> etapa Lead de Engajamento, status: open
        const transicoesPositivas = ['CURIOSIDADE_ABORDAGEM', 'PEDIDO_EXPLICACAO_SERVICOS', 'NECESSIDADE_IDENTIFICADA'];
        for (const cenario of transicoesPositivas) {
            const transicao = agent.predictPipelineTransition(cenario);
            assert.strictEqual(transicao.novoStatus, 'open');
            assert.strictEqual(transicao.novaEtapa, 'stage_lead_engajamento');
        }

        // Cenários de diálogo consultivo em curso -> permanece em diálogo / Lead de Engajamento
        const transicoesDialogo = ['OBJECAO_PRECO', 'JA_TEM_AGENCIA', 'PERGUNTA_INESPERADA'];
        for (const cenario of transicoesDialogo) {
            const transicao = agent.predictPipelineTransition(cenario);
            assert.strictEqual(transicao.novoStatus, 'open');
            assert.strictEqual(transicao.novaEtapa, 'stage_lead_engajamento');
        }

        // Cenário de aceitação de reunião verbal sem evento -> permanece em engajamento
        const transicaoAceiteSemEvento = agent.predictPipelineTransition('ACEITA_REUNIAO', { reuniaoCriadaComSucesso: false });
        assert.strictEqual(transicaoAceiteSemEvento.novoStatus, 'open');
        assert.strictEqual(transicaoAceiteSemEvento.novaEtapa, 'stage_lead_engajamento');

        // Cenário de reunião com evento criado na agenda -> avança para Reunião
        const transicaoReuniao = agent.predictPipelineTransition('ACEITA_REUNIAO', { reuniaoCriadaComSucesso: true });
        assert.strictEqual(transicaoReuniao.novoStatus, 'open');
        assert.strictEqual(transicaoReuniao.novaEtapa, 'stage_reuniao');

        // Cenário de recusa comercial -> status lost, supressão ativa
        const transicaoRecusa = agent.predictPipelineTransition('RECUSA_COMERCIAL');
        assert.strictEqual(transicaoRecusa.novoStatus, 'lost');
        assert.strictEqual(transicaoRecusa.novaEtapa, 'stage_lost');
        assert.strictEqual(transicaoRecusa.supressaoAtiva, true);

        // Cenário de silêncio -> status lost mantido na fila SDR
        const transicaoSilencio = agent.predictPipelineTransition('SILENCIO_SEM_RESPOSTA');
        assert.strictEqual(transicaoSilencio.novoStatus, 'lost');
        assert.strictEqual(transicaoSilencio.novaEtapa, 'stage_perdido');
        assert.strictEqual(transicaoSilencio.permaneceNaFila, true);
        assert.strictEqual(transicaoSilencio.reativado, false);
    });

    // TESTE 6: Verificação de Horário Comercial e Feriados Municipais (Lisboa)
    await runTest('6. Verificação determinística de horário comercial e feriado de Lisboa', () => {
        // A: Sábado às 20h45 -> Bloqueado (FIM_DE_SEMANA)
        const sabado = createLisbonDateTime(2026, 10, 10, 20, 45, 0);
        const valSabado = validateDispatchTiming(sabado);
        assert.strictEqual(valSabado.permitido, false);
        assert.strictEqual(valSabado.motivo, 'FIM_DE_SEMANA');

        // B: Segunda-feira às 10h30 -> Permitido
        const segunda1030 = createLisbonDateTime(2026, 10, 12, 10, 30, 0);
        const valSegunda = validateDispatchTiming(segunda1030, { municipality: 'LISBOA' });
        assert.strictEqual(valSegunda.permitido, true);
        assert.strictEqual(valSegunda.motivo, 'DENTRO_DO_HORARIO_COMERCIAL');

        // C: Feriado Municipal de Lisboa (Santo António - 13 de Junho)
        const santoAntonio = createLisbonDateTime(2026, 6, 13, 11, 0, 0);
        const valSantoAntonio = validateDispatchTiming(santoAntonio, { municipality: 'LISBOA' });
        assert.strictEqual(valSantoAntonio.permitido, false);
        assert.strictEqual(valSantoAntonio.motivo, 'FERIADO_MUNICIPAL_PORTUGAL');

        // D: Fora de Horas (08h30 de dia útil) -> Bloqueado (ANTES_DO_HORARIO_COMERCIAL)
        const manhaCedo = createLisbonDateTime(2026, 10, 12, 8, 30, 0);
        const valManha = validateDispatchTiming(manhaCedo);
        assert.strictEqual(valManha.permitido, false);
        assert.strictEqual(valManha.motivo, 'ANTES_DO_HORARIO_COMERCIAL');

        // E: Fora de Horas (17h30 de dia útil) -> Bloqueado (APOS_HORARIO_COMERCIAL)
        const fimTarde = createLisbonDateTime(2026, 10, 12, 17, 30, 0);
        const valTarde = validateDispatchTiming(fimTarde);
        assert.strictEqual(valTarde.permitido, false);
        assert.strictEqual(valTarde.motivo, 'APOS_HORARIO_COMERCIAL');
    });

    // TESTE 7: Conformidade e Segurança Operacional
    await runTest('7. Verificação de integridade do dossiê JSON da validação B.11.3', () => {
        const jsonPath = path.resolve(projectRoot, 'data/sdr_reactivation_phase_b11_3_validation.json');
        assert.ok(fs.existsSync(jsonPath), 'O ficheiro data/sdr_reactivation_phase_b11_3_validation.json deve existir');

        const raw = fs.readFileSync(jsonPath, 'utf8');
        const dossier = JSON.parse(raw);

        assert.strictEqual(dossier.meta.fase, 'B.11.3');
        assert.strictEqual(dossier.meta.negocio_auditado, CANONICAL_DEAL_ID);
        assert.strictEqual(dossier.meta.mensagens_reais_enviadas, 0);
        assert.strictEqual(dossier.meta.mutacoes_producao_efetuadas, 0);
        assert.strictEqual(dossier.simulacoes_conversacionais.length, 8);
    });

    console.log(`\n🎉 Todos os ${testsPassed} testes da Fase B.11.3 passaram com sucesso!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

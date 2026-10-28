/**
 * ============================================================================
 * TESTES AUTOMATIZADOS — VAMUSS SDR FASE B.11.4
 * Validação de Evidências, Calendário e Integridade Operacional
 * ============================================================================
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRIntelligentSalesAgent } from './sdr_intelligent_sales_agent.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRActivationGate } from './sdr_activation_gate.mjs';
import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import { SDRDispatcherAdapter, SecurityException, BusinessHoursException } from './sdr_dispatcher_adapter.mjs';
import {
    isWithinBusinessHours,
    validateDispatchTiming,
    getNextBusinessWindow,
    createLisbonDateTime
} from './sdr_business_hours.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🧪 Iniciando Bateria de Testes Automatizados — Fase B.11.4...\n');

let testsPassed = 0;
async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';
const b2Path = path.resolve(projectRoot, 'data/sdr_reactivation_phase_b2_audit.json');
const b2Data = JSON.parse(fs.readFileSync(b2Path, 'utf8'));
const rawDealB2 = (b2Data.auditoria_completa_405_negocios || []).find(d => d.deal_id === CANONICAL_DEAL_ID);

const agent = new SDRIntelligentSalesAgent();
const controls = new SDROperationalControls();
const gate = new SDRActivationGate({ operationalControls: controls });
const recovery = new SDRRecoveryPipelineIntegration({ operationalControls: controls, activationGate: gate });
const dispatcher = new SDRDispatcherAdapter({
    mode: 'SIMULATION',
    dryRunOnly: true,
    allowRealDispatch: false,
    enforceBusinessHours: true,
    throwOnBusinessHoursBlock: false
});

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
    // TESTE 1: Segregação Rigorosa das Fontes de Informação e Reconhecimento de Limitações
    await runTest('1. Segregação rigorosa de fontes de dados e declaração de limitações live', async () => {
        assert.ok(rawDealB2, 'Negócio canónico deve constar da base auditada');
        assert.strictEqual(rawDealB2.deal_id, CANONICAL_DEAL_ID);
        assert.ok(rawDealB2.nome_clinica.includes('Diniz Salgueiro'));
        assert.strictEqual(rawDealB2.motivo_perda_original, 'Não respondeu - Não respondeu as abordagens');

        // Reconhecimento de ferramentas
        const tools = agent.getAllTools();
        const calTool = tools.find(t => t.name === 'calendar_check_availability');
        assert.ok(calTool, 'calendar_check_availability deve constar no inventário de ferramentas');
        assert.strictEqual(calTool.disponivel, false, 'Ferramenta de calendário deve estar indisponível');
        assert.strictEqual(calTool.status, 'LIMITACAO_INTEGRACAO_CALENDARIO');

        // Declaração de calendário
        const calStatus = agent.checkCalendarAvailability();
        assert.strictEqual(calStatus.disponivel, false);
        assert.ok(calStatus.detalhe.includes('indisponível ou não autenticada'));
    });

    // TESTE 2: Eliminação de Afirmações Comerciais Sem Evidência na Mensagem de Abertura
    await runTest('2. Eliminação de afirmações não comprovadas na mensagem de abertura', async () => {
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

        const msg = session.proposta_mensagem.texto_pt_pt;
        // Característica real verificável
        assert.ok(msg.includes('microscopia na endodontia'), 'Deve referir a característica real comprovada');
        // Relevância concisa e pergunta aberta
        assert.ok(msg.includes('trabalhamos a forma como as empresas comunicam o seu valor'));
        assert.ok(msg.includes('sentem que os pacientes que procuram a clínica já conhecem essa diferenciação'));
        // Sem pedido de chamada ou reunião
        assert.strictEqual(session.proposta_mensagem.pede_reuniao_ou_chamada, false);
        assert.strictEqual(session.proposta_mensagem.assume_problema_agenda, false);
        // Sem alegações de retorno financeiro não comprovado
        assert.ok(!msg.includes('dois ou três pacientes'), 'Proibido alegar que 2 ou 3 pacientes pagam investimento');
        assert.ok(!msg.includes('pagam o investimento'), 'Proibido alegar retorno financeiro fixo');
        assert.ok(!msg.includes('clínicas de referência em Lisboa'), 'Proibido alegar acompanhamento de referência sem prova');
    });

    // TESTE 3: Validação Completa dos 10 Cenários Conversacionais com Respostas e Transições
    await runTest('3. Progressão conversacional adaptativa nos 10 cenários comerciais exigidos', () => {
        // Cenário 1: Curiosidade sobre origem do contacto
        const c1 = agent.evaluateConversationScenario({
            tipoCenario: 'CURIOSIDADE_ORIGEM_CONTACTO',
            textoInterlocutor: 'Como é que encontraram a nossa clínica e porque estão a falar em microscopia?'
        });
        assert.strictEqual(c1.propor_reuniao_imediata, false);
        assert.ok(c1.mensagem_proposta_pt_pt.includes('Ao mapear o setor médico-dentário em Lisboa'));
        assert.ok(!c1.mensagem_proposta_pt_pt.includes('Acompanhamos clínicas de referência'));

        // Cenário 2: Pedido de explicação sobre a Vamuss
        const c2 = agent.evaluateConversationScenario({
            tipoCenario: 'PEDIDO_EXPLICACAO_VAMUSS',
            textoInterlocutor: 'Podem explicar melhor o que fazem exatamente na Vamuss?'
        });
        assert.strictEqual(c2.propor_reuniao_imediata, false);
        assert.ok(c2.mensagem_proposta_pt_pt.includes('não fazemos gestão genérica de redes sociais'));

        // Cenário 3: Pergunta sobre preços
        const c3 = agent.evaluateConversationScenario({
            tipoCenario: 'PERGUNTA_PRECOS',
            textoInterlocutor: 'Quanto é que custa o vosso serviço para uma clínica como a nossa?'
        });
        assert.strictEqual(c3.propor_reuniao_imediata, false);
        assert.ok(c3.mensagem_proposta_pt_pt.includes('Sem conhecermos a vossa estrutura de custos e margens reais'));
        assert.ok(!c3.mensagem_proposta_pt_pt.includes('dois ou três pacientes'));

        // Cenário 4: Indicação de que já trabalha com uma agência
        const c4 = agent.evaluateConversationScenario({
            tipoCenario: 'JA_TEM_AGENCIA',
            textoInterlocutor: 'Já temos uma agência de marketing a tratar da nossa comunicação há 2 anos.'
        });
        assert.strictEqual(c4.propor_reuniao_imediata, false);
        assert.ok(c4.mensagem_proposta_pt_pt.includes('um desafio frequente é conseguir medir se o investimento se traduz em consultas particulares'));
        assert.ok(!c4.mensagem_proposta_pt_pt.includes('Muitas clínicas com quem trabalhamos já tinham agência'));

        // Cenário 5: Manifestação explícita de uma necessidade (proposta sem inventar slots)
        const c5 = agent.evaluateConversationScenario({
            tipoCenario: 'MANIFESTACAO_NECESSIDADE',
            textoInterlocutor: 'Temos dois gabinetes vazios às terças e quintas e precisamos de atrair mais pacientes particulares para endodontia e cirurgia.'
        });
        assert.strictEqual(c5.propor_reuniao_imediata, true);
        assert.ok(c5.mensagem_proposta_pt_pt.includes('Reunião de Diagnóstico de 20 minutos por videoconferência'));
        assert.ok(c5.mensagem_proposta_pt_pt.includes('que período da manhã ou da tarde vos seria mais conveniente'));
        assert.ok(!c5.mensagem_proposta_pt_pt.includes('Quinta-feira às 11h ou sexta-feira às 15h'), 'Não deve inventar slots fixos sem confirmação de agenda');

        // Cenário 6: Pedido de exemplos ou provas de resultados (NOVO)
        const c6 = agent.evaluateConversationScenario({
            tipoCenario: 'PEDIDO_PROVAS_OU_EXEMPLOS',
            textoInterlocutor: 'Podem mostrar exemplos concretos ou provas de resultados que tenham obtido noutras clínicas dentárias?'
        });
        assert.strictEqual(c6.propor_reuniao_imediata, false);
        assert.ok(c6.mensagem_proposta_pt_pt.includes('não partilhamos métricas genéricas nem fazemos promessas de retorno padrão'));
        assert.ok(c6.mensagem_proposta_pt_pt.includes('metodologia documentada'));

        // Cenário 7: Pergunta fora da especialidade
        const c7 = agent.evaluateConversationScenario({
            tipoCenario: 'PERGUNTA_FORA_ESPECIALIDADE',
            textoInterlocutor: 'Qual é a vossa experiência prática com tratamentos de harmonização orofacial?'
        });
        assert.strictEqual(c7.propor_reuniao_imediata, false);
        assert.ok(c7.mensagem_proposta_pt_pt.includes('O nosso foco está na medicina dentária'));

        // Cenário 8: Recusa comercial e proteção RGPD
        const c8 = agent.evaluateConversationScenario({
            tipoCenario: 'RECUSA_COMERCIAL',
            textoInterlocutor: 'Não temos qualquer interesse, por favor não voltem a contactar esta clínica.'
        });
        assert.strictEqual(c8.propor_reuniao_imediata, false);
        assert.ok(c8.mensagem_proposta_pt_pt.includes('retiramos de imediato os contactos da nossa lista de comunicação'));

        // Cenário 9: Resposta ambígua ou evasiva (NOVO)
        const c9 = agent.evaluateConversationScenario({
            tipoCenario: 'RESPOSTA_AMBIGUA',
            textoInterlocutor: 'Talvez, depende. Vamos ver isso mais para a frente.'
        });
        assert.strictEqual(c9.propor_reuniao_imediata, false);
        assert.ok(c9.mensagem_proposta_pt_pt.includes('Para não sermos inoportunos, preferem que façamos um breve ponto de situação'));

        // Cenário 10: Ausência de resposta (silêncio)
        const c10 = agent.evaluateConversationScenario({
            tipoCenario: 'SILENCIO_SEM_RESPOSTA',
            textoInterlocutor: null
        });
        assert.strictEqual(c10.propor_reuniao_imediata, false);
        assert.ok(c10.mensagem_proposta_pt_pt.includes('Nenhuma mensagem imediata'));
        assert.ok(c10.proxima_acao_recomendada.includes('5 a 7 dias úteis'));
    });

    // TESTE 4: Validação Rigorosa de Calendário e Transições de Etapa no Pipeline
    await runTest('4. Distinção estrita dos 3 estados de agendamento e transições no CRM', () => {
        // Estado 1: Reunião apenas proposta -> etapa Lead de Engajamento, status: open
        const tProposta = agent.predictPipelineTransition('MANIFESTACAO_NECESSIDADE', { reuniaoCriadaComSucesso: false });
        assert.strictEqual(tProposta.novoStatus, 'open');
        assert.strictEqual(tProposta.novaEtapa, 'stage_lead_engajamento');

        // Estado 2: Aceitação pelo interlocutor sem evidência de evento no calendário -> Lead de Engajamento
        const tAceiteSemEvento = agent.predictPipelineTransition('ACEITA_REUNIAO', { reuniaoCriadaComSucesso: false });
        assert.strictEqual(tAceiteSemEvento.novoStatus, 'open');
        assert.strictEqual(tAceiteSemEvento.novaEtapa, 'stage_lead_engajamento');

        // Estado 3: Confirmação com evento efetivamente criado -> etapa Reunião, status: open (NUNCA won!)
        const tConfirmada = agent.predictPipelineTransition('ACEITA_REUNIAO', { reuniaoCriadaComSucesso: true });
        assert.strictEqual(tConfirmada.novoStatus, 'open');
        assert.strictEqual(tConfirmada.novaEtapa, 'stage_reuniao');
        assert.notStrictEqual(tConfirmada.novoStatus, 'won', 'Reunião agendada NUNCA pode ter status won');

        // Recusa -> lost, supressão ativa
        const tRecusa = agent.predictPipelineTransition('RECUSA_COMERCIAL');
        assert.strictEqual(tRecusa.novoStatus, 'lost');
        assert.strictEqual(tRecusa.novaEtapa, 'stage_lost');
        assert.strictEqual(tRecusa.supressaoAtiva, true);

        // Silêncio -> lost mantido na fila
        const tSilencio = agent.predictPipelineTransition('SILENCIO_SEM_RESPOSTA');
        assert.strictEqual(tSilencio.novoStatus, 'lost');
        assert.strictEqual(tSilencio.novaEtapa, 'stage_perdido');
        assert.strictEqual(tSilencio.permaneceNaFila, true);
        assert.strictEqual(tSilencio.reativado, false);
    });

    // TESTE 5: Teste dos Mecanismos de Segurança de Ponta a Ponta nos Caminhos Reais
    await runTest('5. Teste de segurança em todos os caminhos reais de execução', async () => {
        // A. Envio Normal Real -> Trava de Circuito / Dispatcher bloqueia
        let disparoRealBloqueado = false;
        try {
            await dispatcher.dispatchReal({
                deal_id: CANONICAL_DEAL_ID,
                canal: 'WHATSAPP',
                destinatario: rawDealB2.contacto?.telefone_normalizado,
                mensagem: 'Tentativa real proibida'
            });
        } catch (err) {
            disparoRealBloqueado = (err instanceof SecurityException || err instanceof BusinessHoursException);
        }
        assert.ok(disparoRealBloqueado, 'Tentativa de disparo real deve ser intercetada');

        // B. Mutex de Concorrência em voo
        const lockA = controls.acquireLock(CANONICAL_DEAL_ID, 'PROCESSO_1');
        const lockB = controls.acquireLock(CANONICAL_DEAL_ID, 'PROCESSO_2');
        assert.strictEqual(lockA, true, 'Primeiro lock deve ser adquirido');
        assert.strictEqual(lockB, false, 'Segundo lock concorrente deve ser rejeitado');
        controls.releaseLock(CANONICAL_DEAL_ID);

        // C. Idempotência na fila de recuperação
        recovery.enqueueLostDeal({ id: CANONICAL_DEAL_ID, title: rawDealB2.nome_clinica, status: 'lost', lostReason: rawDealB2.motivo_perda_original });
        const secondEnqueue = recovery.enqueueLostDeal({ id: CANONICAL_DEAL_ID, title: rawDealB2.nome_clinica, status: 'lost' });
        assert.strictEqual(secondEnqueue.isDuplicate, true, 'Inserção repetida deve ser idempotente');

        // D. Resposta Automática ignorada por Webhook
        const autoReply = recovery.handleRecoveryTransition(CANONICAL_DEAL_ID, {
            type: 'INBOUND_REPLY',
            rawText: 'Mensagem automática: estamos ausentes e fora do escritório até dia 15.'
        });
        assert.strictEqual(autoReply.transition, false);
        assert.strictEqual(autoReply.reason, 'RESPOSTA_AUTOMATICA_IGNORADA');

        // E. Recusa e Supressão
        const refResult = recovery.handleRefusal(CANONICAL_DEAL_ID, { rawText: 'Parem de contactar.', intent: 'OPTOUT' });
        assert.strictEqual(refResult.refusalRecorded, true);

        // F. Gate Legal Pendente (Fail-Closed)
        const gateRes = gate.evaluateActivation({
            deal_id: CANONICAL_DEAL_ID,
            nome_clinica: rawDealB2.nome_clinica,
            categoria_canonica: 'AUTORIZACAO_PENDENTE',
            canal_pretendido: 'WHATSAPP'
        });
        assert.strictEqual(gateRes.autorizado_para_ativacao, false, 'Sem LIA aprovada, gate legal deve bloquear');

        // G. Horário Comercial: Sábado e Feriado Municipal de Lisboa bloqueados
        const sabado = createLisbonDateTime(2026, 10, 10, 21, 0, 0);
        const feriadoMun = createLisbonDateTime(2026, 6, 13, 11, 0, 0);
        const utilValido = createLisbonDateTime(2026, 10, 12, 11, 30, 0);

        assert.strictEqual(validateDispatchTiming(sabado).permitido, false);
        assert.strictEqual(validateDispatchTiming(feriadoMun, { municipality: 'LISBOA' }).permitido, false);
        assert.strictEqual(validateDispatchTiming(utilValido, { municipality: 'LISBOA' }).permitido, true);
    });

    // TESTE 6: Verificação de Integridade do Dossiê JSON B.11.4
    await runTest('6. Verificação do dossiê JSON da fase B.11.4', () => {
        const jsonPath = path.resolve(projectRoot, 'data/sdr_reactivation_phase_b11_4_validation.json');
        assert.ok(fs.existsSync(jsonPath), 'O dossiê B.11.4 deve existir em data/');

        const raw = fs.readFileSync(jsonPath, 'utf8');
        const dossier = JSON.parse(raw);

        assert.strictEqual(dossier.meta.fase, 'B.11.4');
        assert.strictEqual(dossier.meta.mensagens_reais_enviadas, 0);
        assert.strictEqual(dossier.meta.mutacoes_producao_efetuadas, 0);
        assert.strictEqual(dossier.simulacoes_10_cenarios.length, 10);
        assert.strictEqual(dossier.criterios_aceitacao.afirmacoes_sem_evidencia_eliminadas, true);
        assert.strictEqual(dossier.criterios_aceitacao.agendamento_sem_vagas_ficticias, true);
        assert.strictEqual(dossier.criterios_aceitacao.seguranca_testada_nos_caminhos_reais, true);
    });

    console.log(`\n🎉 Todos os ${testsPassed} testes da Bateria B.11.4 foram aprovados com sucesso!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

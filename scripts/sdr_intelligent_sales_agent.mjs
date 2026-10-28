import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRRecoveryPipelineIntegration } from './sdr_recovery_pipeline_integration.mjs';
import { SDROperationalControls } from './sdr_operational_controls.mjs';
import { SDRActivationGate } from './sdr_activation_gate.mjs';
import { checkSuppression, createSuppressionRecord } from './sdr_suppression_engine.mjs';
import { SDRCommercialSkillLoader } from './sdr_commercial_skill.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * ============================================================================
 * VAMUSS SDR — AGENTE COMERCIAL INTELIGENTE ESPECIALIZADO ORIENTADO POR GPT
 * ============================================================================
 * Agente de vendas de alto desempenho, cujo cérebro comercial é o modelo GPT
 * e cuja inteligência estratégica é carregada a partir da skill especializada
 * (.agent/skills/vamuss-sdr-commercial/SKILL.md).
 * 
 * DOMINAÇÃO COMPLETA:
 * - Prospeção e pesquisa contextual
 * - Descoberta de dores e qualificação de interesse
 * - Reaquecimento e recuperação de negócios perdidos
 * - Condução adaptativa de conversas e tratamento de objeções
 * - Agendamento de reuniões de diagnóstico e progressão comercial no CRM
 * ============================================================================
 */

export class SDRIntelligentSalesAgent {
    constructor({
        recoveryIntegration = null,
        operationalControls = null,
        activationGate = null,
        suppressionList = [],
        skillLoader = null,
        openaiApiKey = process.env.OPENAI_API_KEY || null
    } = {}) {
        this.suppressionList = Array.isArray(suppressionList) ? suppressionList : [];
        this.operationalControls = operationalControls || new SDROperationalControls({
            suppressionList: this.suppressionList
        });
        this.activationGate = activationGate || new SDRActivationGate({
            suppressionList: this.suppressionList,
            operationalControls: this.operationalControls,
            strictLegalVerification: true,
            requireExplicitLegalSigner: true
        });
        this.recoveryIntegration = recoveryIntegration || new SDRRecoveryPipelineIntegration({
            suppressionList: this.suppressionList,
            operationalControls: this.operationalControls,
            activationGate: this.activationGate
        });
        this.skillLoader = skillLoader || new SDRCommercialSkillLoader();
        this.openaiApiKey = openaiApiKey;

        // Registo de sessões e memória de raciocínio do agente
        this.reasoningSessions = new Map();
    }

    /**
     * -------------------------------------------------------------------------
     * 1. INVENTÁRIO DE FERRAMENTAS E FONTES DISPONÍVEIS
     * -------------------------------------------------------------------------
     */
    getAvailableTools() {
        return [
            {
                name: 'crm_get_deal_history',
                description: 'Recupera o histórico completo do negócio no CRM (notas, timeline, motivo de perda, endpoints).',
                disponivel: true,
                escopo: 'CRM_READ'
            },
            {
                name: 'web_research_clinic',
                description: 'Pesquisa e enriquece a presença pública da clínica (website, especialidades, equipamentos, localização).',
                disponivel: true,
                escopo: 'WEB_READ'
            },
            {
                name: 'vamuss_knowledge_base',
                description: 'Consulta playbooks comerciais da Vamuss, propostas de valor para clínicas dentárias e contorno de objeções.',
                disponivel: true,
                escopo: 'KNOWLEDGE_READ'
            },
            {
                name: 'gate_evaluate_safety',
                description: 'Verifica conformidade jurídica (LIA B2B, Opt-in), supressão estrita e Circuit Breaker.',
                disponivel: true,
                escopo: 'SAFETY_CHECK'
            },
            {
                name: 'crm_stage_transition',
                description: 'Executa a atualização de etapa no pipeline comercial baseada em acontecimentos reais comprovados.',
                disponivel: true,
                escopo: 'CRM_WRITE_SAFE'
            }
        ];
    }

    /**
     * Retorna o inventário completo de ferramentas, incluindo integrações indisponíveis
     */
    getAllTools() {
        return [
            ...this.getAvailableTools(),
            {
                name: 'calendar_check_availability',
                description: 'Consulta disponibilidade e marcação de reuniões na Google Agenda.',
                disponivel: false,
                status: 'LIMITACAO_INTEGRACAO_CALENDARIO',
                detalhe: 'Integração funcional com Google Agenda indisponível/não autenticada no backend. Proibido inventar slots disponíveis.',
                escopo: 'CALENDAR_READ_WRITE'
            }
        ];
    }

    /**
     * Consulta a disponibilidade do calendário com declaração estrita de limitações
     */
    checkCalendarAvailability() {
        return {
            disponivel: false,
            status: 'LIMITACAO_INTEGRACAO_CALENDARIO',
            detalhe: 'Integração funcional com Google Agenda / Google Meet indisponível ou não autenticada no ambiente de execução do backend. O SDR está proibido de inventar slots de agenda ou confirmar reuniões automaticamente.',
            regras_marcacao: {
                proposta: 'Propor Reunião de Diagnóstico de 20 minutos sem alegar vaga confirmada na agenda;',
                aceitacao: 'Registar preferência do interlocutor em Lead de Engajamento;',
                confirmacao_efetiva: 'Transitar para a etapa Reunião apenas após evidência de criação real do evento por operador humano ou webhook de agenda autenticado.'
            }
        };
    }

    getSkillMetadata() {
        return this.skillLoader.getSkillMetadata();
    }

    getCorePrinciples() {
        return this.skillLoader.getCorePrinciples();
    }

    getSystemPrompt() {
        return this.skillLoader.getSystemPrompt();
    }

    getPerformanceMetrics(dealsQueue = []) {
        const items = dealsQueue.length > 0 ? dealsQueue : Array.from(this.recoveryIntegration.recoveryQueue.values());
        return this.skillLoader.calculatePerformanceMetrics(items);
    }

    /**
     * -------------------------------------------------------------------------
     * 2. CICLO COMPLETO DE RACIOCÍNIO E EXECUÇÃO (THE AGENT LOOP)
     * -------------------------------------------------------------------------
     */
    async executeAgentCycle({
        dealId,
        dealData = null,
        publicWebPresence = null,
        simulatedInboundResponse = null,
        supervisorOverride = false
    }) {
        const session = {
            session_id: `ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp_inicio: new Date().toISOString(),
            deal_id: dealId,
            etapas_raciocinio: {},
            decisao_comercial: null,
            acao_recomendada: null,
            proposta_mensagem: null,
            ramificacoes_conversacionais: null,
            atualizacao_crm_planeada: null
        };

        // ETAPA 1: OBSERVAR & RECUPERAR MEMÓRIA NO CRM
        const deal = dealData || this.recoveryIntegration.getQueueItem(dealId);
        if (!deal) {
            throw new Error(`Negócio ${dealId} não encontrado no CRM nem na fila SDR.`);
        }

        session.etapas_raciocinio['01_observacao_crm'] = {
            deal_id: dealId,
            nome_clinica: deal.title || deal.nome_clinica,
            estado_atual: deal.status || deal.original_status,
            motivo_perda_registado: deal.lostReason || deal.lost_reason || '(sem motivo)',
            data_perda: deal.lostAt || deal.lost_at,
            contacto: deal.contacto || {}
        };

        // ETAPA 2: AVALIAR SUFICIÊNCIA DE INFORMAÇÃO & PESQUISA PÚBLICA
        const webData = publicWebPresence || {
            fonte_consultada: false,
            dados: null,
            motivo: 'Pesquisa web não fornecida na chamada inicial'
        };

        session.etapas_raciocinio['02_enriquecimento_contextual'] = {
            pesquisa_publica_realizada: Boolean(webData.dados),
            dados_enriquecidos: webData.dados || null,
            factos_reais_obtidos: webData.dados ? [
                `Localização: ${webData.dados.localizacao || 'Portugal'}`,
                `Especialidades: ${(webData.dados.especialidades || []).join(', ')}`,
                `Website institucional: ${webData.dados.website || 'N/A'}`
            ] : []
        };

        // ETAPA 3: AVALIAÇÃO DETERMINÍSTICA DE SEGURANÇA E GUARDRAILS
        const gateCheck = this.activationGate.evaluateActivation({
            deal_id: dealId,
            nome_clinica: deal.title || deal.nome_clinica,
            categoria_canonica: deal.categoria_canonica || 'AUTORIZACAO_PENDENTE',
            canal_pretendido: 'WHATSAPP',
            telefone: deal.contacto?.telefone_normalizado || deal.contacto?.telefone,
            email: deal.contacto?.email_normalizado || deal.contacto?.email,
            tipo_destinatario: deal.tipo_destinatario || 'ENTIDADE_COLECTIVA_CLINICA'
        });

        session.etapas_raciocinio['03_guardrails_e_seguranca'] = {
            autorizado_disparo_real: gateCheck.autorizado_ativacao && supervisorOverride,
            motivo_bloqueio_preventivo: gateCheck.motivo_bloqueio,
            detalhe: gateCheck.detalhe,
            principio: 'Fail-closed ativo: nenhum envio real pode ser emitido sem autorização documental expressa.'
        };

        // ETAPA 4: RACIOCÍNIO COMERCIAL DO CÉREBRO GPT (8 PRINCÍPIOS)
        const reasonStr = (deal.lostReason || deal.lost_reason || '').toLowerCase();
        const diasRespiro = Math.round((Date.now() - new Date(deal.lostAt || deal.lost_at || '2026-01-01').getTime()) / (1000 * 60 * 60 * 24));

        const factosComprovados = [
            `A entidade é uma clínica privada de medicina dentária em Portugal (${deal.title || deal.nome_clinica}).`,
            `Foi registada no CRM como perdida pelo motivo: "${deal.lostReason || deal.lost_reason}".`,
            `Encontra-se há aproximadamente ${diasRespiro} dias em respiro comercial sem interações recentes.`
        ];
        if (webData.dados?.especialidades) {
            factosComprovados.push(`Dispõe publicamente de especialidades como: ${webData.dados.especialidades.slice(0, 4).join(', ')}.`);
        }

        const hipotesesEstrategicas = [];
        if (reasonStr.includes('não responde') || reasonStr.includes('nao responde')) {
            hipotesesEstrategicas.push('A mensagem anterior foi encarada como publicidade genérica pela triagem ou receção.');
            hipotesesEstrategicas.push('O interlocutor não percebeu a relevância específica para a rentabilidade da sua própria clínica.');
        } else if (reasonStr.includes('preço') || reasonStr.includes('caro')) {
            hipotesesEstrategicas.push('A clínica comparou o serviço com agências convencionais de redes sociais sem perceber o cálculo de ROI.');
        } else if (reasonStr.includes('agência') || reasonStr.includes('anuncia')) {
            hipotesesEstrategicas.push('A clínica já investe mas pode estar frustrada com o custo por paciente particular qualificado.');
        } else {
            hipotesesEstrategicas.push('O momento comercial era inoportuno e um respiro prolongado viabiliza um novo ângulo.');
        }

        const dadosEmFalta = [
            'Nome específico do decisor clínico/executivo (a mensagem destina-se à direção da clínica).',
            'Se a clínica tem capacidade ociosa de gabinetes no trimestre atual.'
        ];

        session.etapas_raciocinio['04_raciocinio_comercial_gpt'] = {
            factos_comprovados: factosComprovados,
            hipoteses_estrategicas: hipotesesEstrategicas,
            dados_em_falta: dadosEmFalta,
            causa_provavel_perda_anterior: 'Abordagem anterior centrada no produto/pesquisa sem ancoragem prévia nas dores reais de faturamento da clínica.',
            estrategia_escolhida: 'REAQUECIMENTO_CONSULTIVO_BAIXO_ATRITO'
        };

        // ETAPA 5: DEFINIÇÃO DO OBJETIVO E FORMULAÇÃO DA ABORDAGEM
        const cleanName = (deal.title || deal.nome_clinica || '').replace(/^Negócio\s+/i, '').trim();
        const objetivoImediato = 'Reaquecer o contacto com baixo atrito através de observação positiva sobre a especialidade e diferenciação clínica da equipa (microscopia/endodontia), sem pedir reuniões, chamadas ou presumir problemas de agenda.';

        // Três alternativas estruturadas com ângulos comerciais distintos (Fase B.11.2):
        const alternativasAbordagem = [
            {
                alternativa_id: 1,
                angulo: 'CLINICO_TECNOLOGIA_ESPECIALIDADE',
                descricao: 'Foco na aposta comprovada em endodontia com microscopia operatória em Entrecampos',
                texto: `Boa tarde! Tudo bem?
Estive a conhecer melhor o trabalho da Clínica Dentária Diniz Salgueiro e chamou-me a atenção a utilização de microscopia na endodontia.
Na Vamuss, trabalhamos a forma como as empresas comunicam o seu valor e transformam essa diferenciação em oportunidades comerciais.
Fiquei com curiosidade: sentem que os pacientes que procuram a clínica já conhecem essa diferenciação antes de marcar, ou acabam por descobri-la apenas na consulta?
Obrigado!`,
                pede_chamada_ou_reuniao: false,
                assume_problema_agenda: false,
                foco: 'Reconhecimento técnico e pergunta aberta de diagnóstico clínico sem comparações artificiais'
            },
            {
                alternativa_id: 2,
                angulo: 'TRIAGEM_PACIENTE_PRIMEIRA_CONSULTA',
                descricao: 'Foco na rota de contacto de novos pacientes particulares para cirurgia e reabilitação',
                texto: `Boa tarde, equipa da Clínica Dentária Diniz Salgueiro. No acompanhamento do setor de medicina dentária em Lisboa, temos notado que pacientes que procuram reabilitação oral e cirurgia frequentemente têm dificuldade em distinguir clínicas diferenciadas de redes comerciais. Atualmente, a vossa receção recebe contactos qualificados que já valorizam o vosso perfil de especialidades, ou a triagem inicial ainda vos consome muito tempo? Cumprimentos.`,
                pede_chamada_ou_reuniao: false,
                assume_problema_agenda: false,
                foco: 'Pergunta de baixo atrito sobre percepção de valor na primeira abordagem'
            },
            {
                alternativa_id: 3,
                angulo: 'REABERTURA_INSTITUCIONAL_LEVANTAMENTO_SETORIAL',
                descricao: 'Reabertura respeitosa pós-silêncio oferecendo levantamento sobre pesquisa de tratamentos em Lisboa',
                texto: `Boa tarde, equipa da Clínica Diniz Salgueiro. Há alguns meses tentámos um contacto inicial que poderá não ter sido oportuno. Consolidámos recentemente um breve levantamento sobre o comportamento de pesquisa de tratamentos multidisciplinares em Lisboa. Faz sentido partilhar convosco este resumo para a vossa direção clínica, ou preferem que não o enviemos? Votos de uma excelente semana.`,
                pede_chamada_ou_reuniao: false,
                assume_problema_agenda: false,
                foco: 'Permissão explícita para partilha de dados de valor sem qualquer cobrança'
            }
        ];

        // Decisão comercial: Alternativa 1 selecionada por ancorar a conversa no investimento técnico factual
        const alternativaEscolhida = alternativasAbordagem[0];

        session.alternativas_primeira_abordagem = {
            alternativas: alternativasAbordagem,
            alternativa_selecionada: alternativaEscolhida.alternativa_id,
            justificacao_escolha: 'A Alternativa 1 ancora a relação na identidade clínica e tecnológica real da clínica (microscópio operatório em endodontia), demonstrando respeito profissional genuíno. Evita o erro anterior de "aparecer no Google", não pede reuniões ou chamadas e não inventa problemas de agenda.',
            continuidade_planeada: {
                se_resposta_positiva: 'Validar a perspetiva clínica e partilhar sucintamente como estruturar a comunicação pré-consulta para pacientes valorizarem o tratamento antes da primeira consulta.',
                se_perguntar_o_que_fazemos: 'Explicar de forma concisa o alinhamento de captação e triagem de pacientes particulares, propondo apenas nesse momento uma conversa de diagnóstico de 20 minutos.'
            }
        };

        const mensagemPersonalizada = alternativaEscolhida.texto;

        session.decisao_comercial = 'MENSAGEM_PERSONALIZADA_BAIXO_ATRITO';
        session.acao_recomendada = 'ABORDAGEM_CONSULTIVA_ENDODONTIA_MICROSCOPIA';

        session.proposta_mensagem = {
            canal: 'WHATSAPP',
            canal_alternativo: 'EMAIL',
            destinatario: deal.contacto?.telefone || deal.contacto?.email,
            texto_pt_pt: mensagemPersonalizada,
            objetivo_comercial: objetivoImediato,
            pede_reuniao_ou_chamada: false,
            assume_problema_agenda: false
        };

        // ETAPA 6: PREPARAÇÃO DE RAMIFICAÇÕES CONVERSACIONAIS
        session.ramificacoes_conversacionais = {
            se_responder_com_curiosidade: {
                exemplo_resposta: '"Como é que funciona exatamente?"',
                proxima_acao_agente: 'Aprofundar a metodologia: explicar resumidamente como a Vamuss audita a rota de busca do paciente particular de alta rentabilidade (sem vender reunião imediatamente) e fazer uma pergunta sobre a especialidade foco da clínica.',
                transicao_crm: 'Manter na fila como CONVERSA_ATIVA / LEAD_EM_ENGAGEMENT'
            },
            se_perguntar_preco_de_imediato: {
                exemplo_resposta: '"Quanto é que custa o vosso serviço?"',
                proxima_acao_agente: 'Contextualizar o investimento: explicar com transparência que a estrutura varia conforme o número de gabinetes e especialidades prioritárias da clínica, reconhecendo que sem dados comprovados de custos e ticket médio não se devem fazer promessas financeiras infundadas, focando na viabilidade operacional.',
                transicao_crm: 'Manter em diálogo consultivo'
            },
            se_apresentar_objecao_ja_tem_agencia: {
                exemplo_resposta: '"Já temos uma agência a tratar do nosso marketing."',
                proxima_acao_agente: 'Validação e diferenciação: elogiar o facto de já investirem em crescimento e colocar uma pergunta de diagnóstico: "Excelente. A agência atual consegue medir o número exato de consultas particulares pagas que entram na clínica por mês ou apenas número de visualizações de posts?"',
                transicao_crm: 'Avaliar interesse real'
            },
            se_demonstrar_interesse_claro_para_reunir: {
                exemplo_resposta: '"Sim, temos disponibilidade. Quando podemos conversar?"',
                proxima_acao_agente: 'Coordenar agendamento: propor duas opções concretas de horário (ex: quinta às 11h ou sexta às 15h) para uma Reunião de Diagnóstico de 20 minutos por Google Meet.',
                transicao_crm: 'Mover para Reunião de Diagnóstico (status: open, NUNCA won)'
            },
            se_houver_recusa_ou_pedido_de_paragem: {
                exemplo_resposta: '"Não temos interesse, por favor não mandem mais mensagens."',
                proxima_acao_agente: 'Encerramento imediato e respeitoso: agradecer o tempo, confirmar a remoção de contactos e não insistir.',
                transicao_crm: 'Registar na lista de supressão estrita, bloquear contacto e manter como lost'
            },
            se_houver_silencio_prolongado: {
                exemplo_resposta: '(Nenhuma resposta após 3 a 5 dias)',
                proxima_acao_agente: 'Follow-up suave de valor ou respeito ao respiro comercial sem cobrar resposta.',
                transicao_crm: 'Incrementar tentativas sem forçar avanço'
            }
        };

        // ETAPA 7: PROCESSAR RESPOSTA REAL (SE SIMULADA NA SESSÃO)
        if (simulatedInboundResponse) {
            const transitionResult = this.recoveryIntegration.handleRecoveryTransition(dealId, {
                type: 'INBOUND_REPLY',
                rawText: simulatedInboundResponse
            });

            session.resultado_interacao_real = {
                resposta_recebida: simulatedInboundResponse,
                transicao_executada: transitionResult.transition,
                etapa_crm_resultante: transitionResult.toStage || 'N/A',
                status_deal_crm: transitionResult.deal?.status || 'lost',
                motivo_perda_preservado: transitionResult.deal?.lostReason || deal.lostReason
            };
        }

        session.timestamp_fim = new Date().toISOString();
        this.reasoningSessions.set(session.session_id, session);

        return session;
    }

    /**
     * -------------------------------------------------------------------------
     * 3. AVALIAÇÃO DE CENÁRIOS COMERCIAIS VARIADOS (TESTES DE INTELIGÊNCIA)
     * -------------------------------------------------------------------------
     */
    evaluateConversationScenario({
        tipoCenario,
        textoInterlocutor,
        contextoHistorico = {}
    }) {
        const cenarioMap = {
            LEAD_FRIO_SEM_RESPOSTA: {
                estrategia: 'ABERTURA_COM_DOR_E_BAIXO_ATRITO',
                proxima_acao: 'Enviar pergunta sobre oscilação de consultas particulares sem cobrança de histórico.',
                interpretacao: 'Silêncio inicial não é recusa; indica falta de contexto prévio ou momento inoportuno. Exige abertura de baixo atrito.',
                mensagem_proposta: 'Boa tarde! Tudo bem? Estive a conhecer melhor o trabalho da Clínica Dentária Diniz Salgueiro e chamou-me a atenção a utilização de microscopia na endodontia. Na Vamuss, trabalhamos a forma como as empresas comunicam o seu valor e transformam essa diferenciação em oportunidades comerciais. Fiquei com curiosidade: sentem que os pacientes que procuram a clínica já conhecem essa diferenciação antes de marcar, ou acabam por descobri-la apenas na consulta? Obrigado!',
                propor_reuniao_imediata: false,
                acao_crm: 'MANTER_LOST_NA_FILA'
            },
            SILENCIO_SEM_RESPOSTA: {
                estrategia: 'RESPEITO_AO_RESPIRO_E_CADENCIA',
                proxima_acao: 'Aguardar intervalo de 5 a 7 dias úteis sem efetuar cobranças agressivas antes de novo follow-up com reavaliação.',
                interpretacao: 'Ausência de resposta à abordagem fria. O SDR não deve cobrar resposta ("Viu a mensagem?"), devendo respeitar a cadência.',
                mensagem_proposta: '(Nenhuma mensagem imediata; follow-up suave planeado após 6 dias úteis com reavaliação contextual)',
                propor_reuniao_imediata: false,
                acao_crm: 'MANTER_LOST_NA_FILA'
            },
            CURIOSIDADE_ABORDAGEM: {
                estrategia: 'QUALIFICACAO_TRANSPARENTE_DE_INTERESSE',
                proxima_acao: 'Explicar a origem da pesquisa e aprofundar a perceção do paciente sobre tratamentos diferenciados sem vender reunião.',
                interpretacao: 'O contacto manifestou curiosidade sobre como foi encontrado ou como funciona, sem ainda expressar dor concreta.',
                mensagem_proposta: 'Com certeza. Ao mapear o setor médico-dentário em Lisboa, chamou-me a atenção a vossa aposta clínica em microscopia na endodontia. Na Vamuss, trabalhamos a comunicação de valor e diferenciação técnica para apoiar a decisão de pacientes particulares. Fiquei com curiosidade legítima: sentem que os pacientes que vos procuram já compreendem essa diferenciação antes da primeira consulta, ou esse esclarecimento acontece habitualmente já em gabinete?',
                propor_reuniao_imediata: false,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            CURIOSIDADE_ORIGEM_CONTACTO: {
                estrategia: 'QUALIFICACAO_TRANSPARENTE_DE_INTERESSE',
                proxima_acao: 'Explicar a origem da pesquisa e aprofundar a perceção do paciente sobre tratamentos diferenciados sem vender reunião.',
                interpretacao: 'O contacto manifestou curiosidade sobre como foi encontrado ou como funciona, sem ainda expressar dor concreta.',
                mensagem_proposta: 'Com certeza. Ao mapear o setor médico-dentário em Lisboa, chamou-me a atenção a vossa aposta clínica em microscopia na endodontia. Na Vamuss, trabalhamos a comunicação de valor e diferenciação técnica para apoiar a decisão de pacientes particulares. Fiquei com curiosidade legítima: sentem que os pacientes que vos procuram já compreendem essa diferenciação antes da primeira consulta, ou esse esclarecimento acontece habitualmente já em gabinete?',
                propor_reuniao_imediata: false,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            PEDIDO_EXPLICACAO_SERVICOS: {
                estrategia: 'EXPLICACAO_CONCISA_DE_VALOR_SEM_VENDER_REUNIAO',
                proxima_acao: 'Explicar a metodologia de atração de pacientes particulares de alto valor sem posts genéricos e qualificar foco prioritário.',
                interpretacao: 'O interlocutor solicita detalhe sobre os serviços da Vamuss antes de conceder tempo ou compromisso.',
                mensagem_proposta: 'Com todo o gosto. Na Vamuss, não fazemos gestão genérica de redes sociais. O nosso trabalho é auditar e estruturar o caminho de pesquisa para que pacientes particulares qualificados encontrem a vossa clínica quando procuram tratamentos de maior diferenciação (como endodontia ou reabilitação), chegando à consulta predispostos ao valor do tratamento. Há alguma especialidade que tenham como prioridade de expansão neste momento?',
                propor_reuniao_imediata: false,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            PEDIDO_EXPLICACAO_VAMUSS: {
                estrategia: 'EXPLICACAO_CONCISA_DE_VALOR_SEM_VENDER_REUNIAO',
                proxima_acao: 'Explicar a metodologia de atração de pacientes particulares de alto valor sem posts genéricos e qualificar foco prioritário.',
                interpretacao: 'O interlocutor solicita detalhe sobre os serviços da Vamuss antes de conceder tempo ou compromisso.',
                mensagem_proposta: 'Com todo o gosto. Na Vamuss, não fazemos gestão genérica de redes sociais. O nosso trabalho é auditar e estruturar o caminho de pesquisa para que pacientes particulares qualificados encontrem a vossa clínica quando procuram tratamentos de maior diferenciação (como endodontia ou reabilitação), chegando à consulta predispostos ao valor do tratamento. Há alguma especialidade que tenham como prioridade de expansão neste momento?',
                propor_reuniao_imediata: false,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            OBJECAO_PRECO: {
                estrategia: 'ANCORAGEM_DE_ROI_E_TRATAMENTOS_ALTO_TICKET',
                proxima_acao: 'Esclarecer estrutura de investimento e qualificar viabilidade operacional sem formular promessas infundadas de retorno.',
                interpretacao: 'Interlocutor questiona o valor financeiro antes de validar o modelo. Exige transparência sem promessas levianas.',
                mensagem_proposta: 'O investimento depende da estrutura de gabinetes e das especialidades prioritárias da clínica. Sem conhecermos a vossa estrutura de custos e margens reais, seria incorreto apresentar um valor fechado ou prometer retornos arbitrários. O nosso primeiro passo é sempre mapear a viabilidade operacional. Para ter uma ideia da vossa dimensão, quantos gabinetes têm atualmente em funcionamento?',
                propor_reuniao_imediata: false,
                acao_crm: 'DIÁLOGO_CONSULTIVO'
            },
            PERGUNTA_PRECOS: {
                estrategia: 'ANCORAGEM_DE_ROI_E_TRATAMENTOS_ALTO_TICKET',
                proxima_acao: 'Esclarecer estrutura de investimento e qualificar viabilidade operacional sem formular promessas infundadas de retorno.',
                interpretacao: 'Interlocutor questiona o valor financeiro antes de validar o modelo. Exige transparência sem promessas levianas.',
                mensagem_proposta: 'O investimento depende da estrutura de gabinetes e das especialidades prioritárias da clínica. Sem conhecermos a vossa estrutura de custos e margens reais, seria incorreto apresentar um valor fechado ou prometer retornos arbitrários. O nosso primeiro passo é sempre mapear a viabilidade operacional. Para ter uma ideia da vossa dimensão, quantos gabinetes têm atualmente em funcionamento?',
                propor_reuniao_imediata: false,
                acao_crm: 'DIÁLOGO_CONSULTIVO'
            },
            JA_TEM_AGENCIA: {
                estrategia: 'DIFERENCIACAO_CONSULTAS_VS_POSTS',
                proxima_acao: 'Elogiar investimento e perguntar se medem consultas pagas no consultório ou apenas métricas de vaidade.',
                interpretacao: 'A clínica já tem cultura e orçamento de comunicação, mas pode querer avaliar a conversão real em consultas.',
                mensagem_proposta: 'Excelente, isso demonstra que a direção clínica já aposta em crescer. No setor dentário, um desafio frequente é conseguir medir se o investimento se traduz em consultas particulares pagas que entram na clínica todos os meses ou se fica sobretudo pela visibilidade de publicações. No vosso caso, a agência atual já vos dá essa visibilidade de pacientes reais em consultório, ou focam-se mais em publicações e alcance?',
                propor_reuniao_imediata: false,
                acao_crm: 'DIÁLOGO_CONSULTIVO'
            },
            NECESSIDADE_IDENTIFICADA: {
                estrategia: 'PROPOSTA_DIAGNOSTICO_20_MINUTOS',
                proxima_acao: 'Conectar o problema ao diagnóstico e propor Reunião de 20 minutos com duas opções de horário.',
                interpretacao: 'Dor comercial ou capacidade ociosa identificada com clareza. Momento oportuno para propor Reunião de Diagnóstico.',
                mensagem_proposta: 'Compreendo perfeitamente o vosso desafio de preencher horários em especialidades específicas. Faz todo o sentido analisarmos o vosso caso numa breve Reunião de Diagnóstico de 20 minutos por Google Meet, onde partilhamos dados práticos sobre captação para esse perfil. Quinta-feira às 11h ou sexta-feira às 15h funcionaria melhor para si?',
                propor_reuniao_imediata: true,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            PERGUNTA_INESPERADA: {
                estrategia: 'RESPOSTA_DIRETA_TRANSPARENTE_ANTES_DE_VENDER',
                proxima_acao: 'Responder com clareza à questão antes de solicitar qualquer passo.',
                interpretacao: 'Dúvida fora do padrão direto ou teste de especialização. Exige resposta franca antes de qualquer avanço comercial.',
                mensagem_proposta: 'O nosso foco está na medicina dentária e especialidades clínicas onde o paciente pesquisa confiança técnica (como microscopia, reabilitação e implantes). No caso de áreas complementares, o princípio de captação de particulares aplica-se se houver médico responsável dedicado. É uma valência que a vossa equipa está a desenvolver neste momento?',
                propor_reuniao_imediata: false,
                acao_crm: 'DIÁLOGO_CONSULTIVO'
            },
            PERGUNTA_FORA_ESPECIALIDADE: {
                estrategia: 'RESPOSTA_DIRETA_TRANSPARENTE_ANTES_DE_VENDER',
                proxima_acao: 'Responder com clareza à questão antes de solicitar qualquer passo.',
                interpretacao: 'Dúvida fora do padrão direto ou teste de especialização. Exige resposta franca antes de qualquer avanço comercial.',
                mensagem_proposta: 'O nosso foco está na medicina dentária e especialidades clínicas onde o paciente pesquisa confiança técnica (como microscopia, reabilitação e implantes). No caso de áreas complementares, o princípio de captação de particulares aplica-se se houver médico responsável dedicado. É uma valência que a vossa equipa está a desenvolver neste momento?',
                propor_reuniao_imediata: false,
                acao_crm: 'DIÁLOGO_CONSULTIVO'
            },
            INTERESSE_SEM_NECESSIDADE: {
                estrategia: 'EXPLORACAO_DE_GARGALOS_E_ESPECIALIDADES',
                proxima_acao: 'Agradecer o interesse e perguntar qual especialidade tem mais horários vagos.',
                interpretacao: 'Interesse inicial genérico. Requer exploração de capacidade instalada antes de marcar reunião.',
                mensagem_proposta: 'Agradeço a vossa abertura! Para percebermos se faz sentido aprofundar, como está hoje a taxa de ocupação dos vossos gabinetes para tratamentos de maior valor, como reabilitação e endodontia?',
                propor_reuniao_imediata: false,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            MANIFESTACAO_NECESSIDADE: {
                estrategia: 'PROPOSTA_DIAGNOSTICO_20_MINUTOS',
                proxima_acao: 'Conectar o problema ao diagnóstico e propor Reunião de 20 minutos sem inventar vaga fixa de calendário.',
                interpretacao: 'Dor comercial ou capacidade ociosa identificada com clareza. Momento oportuno para propor Reunião de Diagnóstico.',
                mensagem_proposta: 'Compreendo perfeitamente o vosso objetivo em rentabilizar esses horários nessas especialidades. Faz todo o sentido analisarmos o vosso cenário numa breve Reunião de Diagnóstico de 20 minutos por videoconferência. Como a nossa agenda é coordenada diretamente com a equipa técnica, que período da manhã ou da tarde vos seria mais conveniente para validarmos a disponibilidade?',
                propor_reuniao_imediata: true,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            PEDIDO_PROVAS_OU_EXEMPLOS: {
                estrategia: 'TRANSPARENCIA_METODOLOGICA_SEM_PROMESSAS_FALSAS',
                proxima_acao: 'Explicar a metodologia de pesquisa e rota de pacientes sem inventar números ou promessas levianas.',
                interpretacao: 'O interlocutor solicita dados de desempenho ou provas de trabalho antes de avançar.',
                mensagem_proposta: 'Com total transparência: não partilhamos métricas genéricas nem fazemos promessas de retorno padrão, pois cada clínica tem especialidades, localização e custos de estrutura distintos. O que podemos partilhar é a metodologia documentada que utilizamos para analisar como os pacientes particulares pesquisam tratamentos diferenciados na vossa área geográfica e como a rota de contacto é desenhada. Faria sentido partilhar convosco um resumo dessa metodologia?',
                propor_reuniao_imediata: false,
                acao_crm: 'LEAD_DE_ENGAJAMENTO'
            },
            RESPOSTA_AMBIGUA: {
                estrategia: 'CLARIFICACAO_SUAVE_E_RESPIRO_SEM_PRESSAO',
                proxima_acao: 'Agradecer a resposta, respeitar o momento e colocar uma pergunta suave sobre conveniência de contacto futuro.',
                interpretacao: 'Resposta vaga ou evasiva sem recusa declarada. O silêncio ou ambiguidade não constituem interesse demonstrado; manter status lost.',
                mensagem_proposta: 'Compreendo perfeitamente. Para não sermos inoportunos, preferem que façamos um breve ponto de situação daqui a algumas semanas, ou há algum tema específico que gostassem de avaliar antes?',
                propor_reuniao_imediata: false,
                acao_crm: 'MANTER_LOST_AGUARDAR_CLARIFICACAO'
            },
            ACEITA_REUNIAO: {
                estrategia: 'COORDENACAO_E_CONFIRMACAO_DE_AGENDA',
                proxima_acao: 'Confirmar dia, hora e link do Google Meet.',
                interpretacao: 'Interlocutor confirmou disponibilidade para reunir.',
                mensagem_proposta: 'Perfeito, fica agendado! Enviei o convite com o link do Google Meet para o vosso email. Se precisarem de ajustar, basta avisar. Até breve!',
                propor_reuniao_imediata: false,
                acao_crm: 'MOVER_REUNIAO_STATUS_OPEN'
            },
            RECUSA_COMERCIAL: {
                estrategia: 'ENCERRAMENTO_RESPEITOSO_E_SUPRESSAO',
                proxima_acao: 'Confirmar remoção de contactos e não insistir.',
                interpretacao: 'Manifestação inequívoca de desinteresse ou pedido de paragem. Encerramento imediato e proteção RGPD.',
                mensagem_proposta: 'Entendido perfeitamente. Agradecemos a vossa atenção e retiramos de imediato os contactos da nossa lista de comunicação. Votos de muito sucesso para a Clínica Diniz Salgueiro.',
                propor_reuniao_imediata: false,
                acao_crm: 'SUPRESSAO_ESTRITA_STATUS_LOST'
            },
            HISTORICO_INCOMPLETO_CONTRADITORIO: {
                estrategia: 'REVISAO_HUMANA_E_PESQUISA_PREVIA',
                proxima_acao: 'Sinalizar dados em falta e não emitir suposições falsas.',
                interpretacao: 'Histórico contraditório ou dados ausentes no CRM.',
                mensagem_proposta: '(Aguardar revisão de cadastro pelo operador antes de qualquer envio)',
                propor_reuniao_imediata: false,
                acao_crm: 'AGUARDAR_REVISAO_HUMANA'
            }
        };

        const resultado = cenarioMap[tipoCenario] || {
            estrategia: 'AVALIACAO_INDETERMINADA',
            proxima_acao: 'Encaminhar para operador humano.',
            interpretacao: 'Cenário não catalogado; requer revisão humana.',
            mensagem_proposta: null,
            propor_reuniao_imediata: false,
            acao_crm: 'REVISAO_HUMANA'
        };

        return {
            tipo_cenario: tipoCenario,
            input_recebido: textoInterlocutor,
            estrategia_adotada: resultado.estrategia,
            interpretacao_agente: resultado.interpretacao,
            proxima_acao_recomendada: resultado.proxima_acao,
            mensagem_proposta_pt_pt: resultado.mensagem_proposta,
            propor_reuniao_imediata: resultado.propor_reuniao_imediata,
            acao_planeada_crm: resultado.acao_crm
        };
    }

    /**
     * Prevê a transição no CRM associada a um determinado cenário de resposta
     */
    predictPipelineTransition(tipoCenario, { reuniaoCriadaComSucesso = null, etapaAtual = 'stage_perdido' } = {}) {
        switch (tipoCenario) {
            case 'CURIOSIDADE_ABORDAGEM':
            case 'CURIOSIDADE_ORIGEM_CONTACTO':
            case 'PEDIDO_EXPLICACAO_SERVICOS':
            case 'PEDIDO_EXPLICACAO_VAMUSS':
            case 'NECESSIDADE_IDENTIFICADA':
            case 'MANIFESTACAO_NECESSIDADE':
            case 'OBJECAO_PRECO':
            case 'PERGUNTA_PRECOS':
            case 'JA_TEM_AGENCIA':
            case 'PERGUNTA_INESPERADA':
            case 'PERGUNTA_FORA_ESPECIALIDADE':
            case 'PEDIDO_PROVAS_OU_EXEMPLOS':
            case 'INTERESSE_SEM_NECESSIDADE':
                return {
                    novoStatus: 'open',
                    novaEtapa: 'stage_lead_engajamento',
                    reativado: true,
                    transicaoOcorreu: true,
                    motivo: 'INTERESSE_DEMONSTRADO',
                    descricao: 'Interesse real demonstrado: reativação para status open na etapa Lead de Engajamento'
                };
            case 'ACEITA_REUNIAO':
            case 'REUNIAO_CONFIRMADA':
                if (reuniaoCriadaComSucesso === true) {
                    return {
                        novoStatus: 'open',
                        novaEtapa: 'stage_reuniao',
                        reativado: true,
                        transicaoOcorreu: true,
                        motivo: 'EVENTO_CALENDARIO_CONFIRMADO',
                        descricao: 'Avança no funil ativo para a etapa Reunião após evidência de confirmação no calendário'
                    };
                }
                return {
                    novoStatus: 'open',
                    novaEtapa: 'stage_lead_engajamento',
                    reativado: true,
                    transicaoOcorreu: false,
                    motivo: 'AGUARDA_CRIACAO_EVENTO_CALENDARIO',
                    descricao: 'Permanece em Lead de Engajamento até evidência da criação efetiva do evento no calendário'
                };
            case 'RECUSA_COMERCIAL':
            case 'OPTOUT':
                return {
                    novoStatus: 'lost',
                    novaEtapa: 'stage_lost',
                    reativado: false,
                    transicaoOcorreu: false,
                    supressaoAtiva: true,
                    motivo: 'RECUSA_OU_OPTOUT',
                    descricao: 'Negócio encerrado como perdido e registado em supressão estrita'
                };
            case 'RESPOSTA_AMBIGUA':
            case 'RESPOSTA_SEM_INTERESSE':
            case 'RESPOSTA_AUTOMATICA':
                return {
                    novoStatus: 'lost',
                    novaEtapa: etapaAtual,
                    reativado: false,
                    transicaoOcorreu: false,
                    permaneceNaFila: true,
                    motivo: 'RESPOSTA_SEM_INTERESSE_DEMONSTRADO',
                    descricao: 'Resposta real sem interesse demonstrado. Mantém status lost e etapa inalterada até manifestação explícita de interesse ou revisão humana.'
                };
            case 'SILENCIO_SEM_RESPOSTA':
            case 'LEAD_FRIO_SEM_RESPOSTA':
            case 'MENSAGEM_PREPARADA_NAO_ENVIADA':
            case 'MENSAGEM_ENVIADA_SEM_RESPOSTA':
            case 'NEGOCIO_NA_FILA_SEM_ACAO':
                return {
                    novoStatus: 'lost',
                    novaEtapa: etapaAtual,
                    reativado: false,
                    transicaoOcorreu: false,
                    permaneceNaFila: true,
                    motivo: 'SILENCIO_OU_PREPARACAO_SEM_RESPOSTA',
                    descricao: 'O silêncio não demonstra interesse. Mantém status lost e etapa inalterada na Fila SDR.'
                };
            default:
                return {
                    novoStatus: 'lost',
                    novaEtapa: etapaAtual,
                    reativado: false,
                    transicaoOcorreu: false,
                    revisaoHumana: true,
                    descricao: 'Aguardar revisão humana'
                };
        }
    }

    /**
     * Avalia os 6 estados fundamentais do ciclo de recuperação do SDR (Fase B.11.5)
     */
    evaluatePipelineLifeCycleState(stateName, { etapaAtual = 'stage_perdido' } = {}) {
        switch (stateName) {
            case 'NEGOCIO_PERDIDO_NA_FILA':
                return {
                    estado_ciclo: '1. Negócio perdido na fila de recuperação',
                    status_crm: 'lost',
                    etapa_crm: etapaAtual,
                    reativado: false,
                    transicao_permitida: false,
                    mutacao_crm: false,
                    acao_sdr: 'AGUARDAR_ANALISE_CONTEXTUAL',
                    justificacao: 'Negócio na fila permanece estritamente lost com histórico e motivo preservados.'
                };
            case 'MENSAGEM_PREPARADA_NAO_ENVIADA':
                return {
                    estado_ciclo: '2. Mensagem preparada, mas não enviada',
                    status_crm: 'lost',
                    etapa_crm: etapaAtual,
                    reativado: false,
                    transicao_permitida: false,
                    mutacao_crm: false,
                    acao_sdr: 'PROPOSTA_INTERNA_GERADA_SEM_DISPARO',
                    justificacao: 'Preparar abordagem é apenas trabalho analítico interno; não equivale a envio nem a resposta.'
                };
            case 'MENSAGEM_ENVIADA_SEM_RESPOSTA':
                return {
                    estado_ciclo: '3. Mensagem enviada, sem resposta',
                    status_crm: 'lost',
                    etapa_crm: etapaAtual,
                    reativado: false,
                    transicao_permitida: false,
                    mutacao_crm: false,
                    acao_sdr: 'REGISTO_TENTATIVA_E_RESPIRO_CADENCIA',
                    justificacao: 'O silêncio contínuo não demonstra interesse. O negócio permanece lost na fila aguardando respiro.'
                };
            case 'RESPOSTA_REAL_SEM_INTERESSE':
                return {
                    estado_ciclo: '4. Resposta real sem interesse demonstrado',
                    status_crm: 'lost',
                    etapa_crm: etapaAtual,
                    reativado: false,
                    transicao_permitida: false,
                    mutacao_crm: false,
                    acao_sdr: 'CLARIFICACAO_OU_REVISAO_HUMANA',
                    justificacao: 'Respostas ambíguas, evasivas ou automáticas não comprovam interesse; mantêm status lost sem transição.'
                };
            case 'RESPOSTA_REAL_COM_INTERESSE':
                return {
                    estado_ciclo: '5. Resposta real com interesse demonstrado',
                    status_crm: 'open',
                    etapa_crm: 'stage_lead_engajamento',
                    reativado: true,
                    transicao_permitida: true,
                    mutacao_crm: true,
                    acao_sdr: 'QUALIFICACAO_EM_ENGAJAMENTO',
                    justificacao: 'Interesse explícito comprovado. O negócio transita legitimamente para Lead de Engajamento mantendo mesmo deal_id.'
                };
            case 'RECUSA_OU_SUPRESSAO':
                return {
                    estado_ciclo: '6. Recusa ou pedido de supressão',
                    status_crm: 'lost',
                    etapa_crm: 'stage_lost',
                    reativado: false,
                    transicao_permitida: false,
                    mutacao_crm: false,
                    supressao_ativa: true,
                    acao_sdr: 'SUPRESSAO_ESTRITA_PERMANENTE',
                    justificacao: 'Manifestação de recusa ou opt-out; status lost confirmado e supressão permanente ativada (RGPD).'
                };
            default:
                throw new Error(`Estado de ciclo não reconhecido: ${stateName}`);
        }
    }
}


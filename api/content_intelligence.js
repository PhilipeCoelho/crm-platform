import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
    checkFfmpegAvailable,
    getVideoMetadata,
    extractAudioFromVideo,
    transcribeAudioWithWhisper,
    extractStrategicKeyframes,
    cleanupFiles,
    analyzeVideoMultimodal
} from './video_intelligence.js';
import { resolveVideoFromUrl, normalizeInstagramUrl } from './video_reference_resolver.js';

export const contentIntelligenceRouter = express.Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VAMUSS_GPT_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// System prompt padrão alinhado com o Posicionamento Vamuss
const VAMUSS_EDITORIAL_SYSTEM_PROMPT = `Tu és o Diretor Editorial de Conteúdo e Estrategista Sênior da VAMUSS, agência de marketing e sistemas de aquisição de clientes em Portugal fundada pelo Phil.

POSICIONAMENTO DA VAMUSS:
- Foco: Aquisição previsível de clientes, anúncios online, velocidade de resposta comercial (WhatsApp em < 5 min), estruturação de vendas e empreendedorismo real em Portugal.
- Público: Empresários portugueses, donos de clínicas e PMEs que dependem de indicações e querem crescer de forma previsível.
- Estilo: Direto, sem enrolação ("porta na cara"), específico, prático, contextualizado com a realidade portuguesa (euros, Portugal, clínicas, negócios locais). Sem clichês genéricos de "dicas de marketing".
- Regra de Ouro: "Mostrar > Falar". Todo conteúdo deve ter um gancho forte (0-3s), desenvolvimento conciso com cenas/provas visuais e CTA único.

REGRA DAS 4 COLUNAS EDITORIAIS OFICIAIS:
Todas as propostas geradas DEVEM conter estritamente as 4 colunas:
1. Ângulo: A perspectiva estratégica (ex: Erro comum, Crença contrariada, Problema oculto, Demonstração prática, História real, Comparação).
2. Ideia melhorada: O conceito central lapidado, específico e acionável.
3. Gancho / Base: A frase de abertura verbal ou criativa para parar o feed.
4. Retenção / Hook: O mecanismo que mantém a atenção nos segundos seguintes (pergunta em aberto, promessa de revelação, quebra de expectativa).`;

/**
 * Chamada universal a LLM (OpenAI com fallback para Anthropic)
 */
async function callLLM(systemPrompt, userPrompt, temperature = 0.7) {
    if (OPENAI_API_KEY) {
        try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                const content = data.choices[0]?.message?.content;
                return JSON.parse(content);
            } else {
                const errText = await resp.text();
                console.warn('⚠️ [Content Intelligence] OpenAI error, tentando fallback:', errText);
            }
        } catch (e) {
            console.warn('⚠️ [Content Intelligence] Erro de rede OpenAI:', e.message);
        }
    }

    if (ANTHROPIC_API_KEY) {
        try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    temperature,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: `${userPrompt}\n\nIMPORTANTE: Responde EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois.` }
                    ]
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                const text = data.content?.[0]?.text;
                const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(clean);
            }
        } catch (e) {
            console.warn('⚠️ [Content Intelligence] Anthropic error:', e.message);
        }
    }

    throw new Error('Nenhum serviço de IA acessível no momento.');
}

/**
 * Gerador de fallback editorial estratégico baseado nas 7 estruturas da Vamuss
 */
function generateIdeaFallback(idea, targetAudience, goal, preferredFormat, hookLibrary = []) {
    const hooks = hookLibrary.length > 0 ? hookLibrary : [
        { text: 'A maioria dos empresários acha que o problema é tráfego, quando na verdade é a velocidade de resposta.', category: 'Contradição' },
        { text: 'O erro de 500€ que vejo donos de clínicas cometerem toda a semana nos anúncios.', category: 'Erro Comum' },
        { text: 'Porque é que a tua empresa recebe cliques todos os dias mas zero vendas no fim do mês?', category: 'Pergunta' }
    ];

    const cleanIdea = idea.trim();
    const audience = targetAudience || 'Empresários e donos de clínicas em Portugal';

    return {
        analise_estrategica: {
            problema_central: `A ilusão de que esforço em marketing sem sistema comercial gera clientes previsíveis.`,
            tensao_editorial: `Conflito entre gastar orçamento em anúncios e perder oportunidades por falta de velocidade e acompanhamento.`,
            publicos_provaveis: [audience, 'Profissionais Liberais e Prestadores de Serviços'],
            ganchos_consultados: hooks.slice(0, 3).map(h => ({
                gancho: h.text,
                origem: `Biblioteca (${h.category})`,
                motivo_escolha: 'Encaixe direto com o conflito operacional da ideia.'
            }))
        },
        propostas: [
            {
                titulo: 'A Matemática Real da Aquisição',
                formato: preferredFormat === 'aberto' ? 'Reel' : preferredFormat,
                angulo: 'Contradição',
                ideia_melhorada: `${cleanIdea} — o problema não é o que gastas, é a ausência de um funil direto para o WhatsApp.`,
                gancho_base: hooks[0]?.text || 'A maioria dos empresários acredita no mito errado sobre aquisição de clientes.',
                retencao_hook: 'Abrir mostrando print do WhatsApp comercial com tempo de espera superior a 3 horas.',
                objetivo: goal || 'Gerar autoridade e consciência da falha comercial',
                publico_alvo: audience,
                gancho_verbal: `Se estás a pagar por anúncios em Portugal mas não fechas clientes, o erro não é do algoritmo.`,
                gancho_visual: `Gravação direta em plano médio com print do WhatsApp ao lado na tela.`,
                roteiro_slides: `1. Gancho (0-3s): "Se demoras 2h a responder no WhatsApp, 70% dos leads já fecharam com o teu concorrente."\n2. Desenvolvimento (3-25s): Mostra a matemática de 10 leads que chegam: 3 respondidos na hora viram reunião; 7 respondidos no dia seguinte viram vácuo.\n3. Prova (25-35s): Mostra o CRM da Vamuss com triagem automática em 60 segundos.\n4. CTA (35-40s): "Comenta 'AUDITORIA' para testar a tua velocidade comercial."`,
                sugestoes_cenas: 'Escritório real da agência ou plano frontal com boa iluminação.',
                sugestoes_enquadramento: 'Plano médio com espaço para print lateral.',
                sugestoes_edicao: 'Cortes nos respiros, legendas dinâmicas em amarelo e branco.',
                texto_tela: 'O erro de 500€ que destrói os teus anúncios',
                cta: 'Comenta "AUDITORIA" para receberes o checklist gratuito.',
                justificativa_estrategica: 'Posiciona o Phil como quem entende a dor real do empresário português sem promessas vazias.',
                limitacoes_hipoteses: 'Validar se o público se identifica mais com clínicas ou com PMEs em geral.',
                ganchos_utilizados: [hooks[0]?.category || 'Contradição']
            },
            {
                titulo: 'O Erro de 500€ nos Anúncios',
                formato: 'Reel',
                angulo: 'Erro Comum',
                ideia_melhorada: `Por que promover publicação no Instagram queima dinheiro sem gerar reuniões qualificadas.`,
                gancho_base: hooks[1]?.text || 'O erro de 500€ que vejo toda a semana em Portugal.',
                retencao_hook: 'Promessa de mostrar a configuração exata que muda o jogo em 1 minuto.',
                objetivo: 'Educar sobre funil de vendas direto',
                publico_alvo: audience,
                gancho_verbal: 'Pára de carregar no botão azul do Instagram. Aqui está o que deves fazer em vez disso.',
                gancho_visual: 'Segurar o telemóvel na mão apontando para a tela.',
                roteiro_slides: `1. Gancho (0-3s): "O botão 'Promover' foi feito para a Meta lucrar, não para tu venderes."\n2. Explicação (3-20s): O botão traz likes e seguidores curiosos, mas não traz quem tem cartão na mão.\n3. Demonstração (20-35s): Mostra como criar uma campanha direta para mensagem no WhatsApp com qualificação prévia.\n4. Fechamento (35-40s): Porta na cara imediata após o CTA.`,
                sugestoes_cenas: 'Gravação lo-fi, direto ao ponto com autoridade.',
                sugestoes_enquadramento: 'Selfie ou plano fechado.',
                sugestoes_edicao: 'Corte rápido a cada 3 segundos.',
                texto_tela: 'NUNCA mais cliques neste botão',
                cta: 'Guarda este vídeo para a tua próxima campanha.',
                justificativa_estrategica: 'Desmistifica uma prática comum entre empresários e estabelece autoridade técnica imediata.',
                limitacoes_hipoteses: 'Taxa de salvamento esperada alta.',
                ganchos_utilizados: [hooks[1]?.category || 'Erro Comum']
            },
            {
                titulo: 'A Verdade Sobre o Boca a Boca',
                formato: 'Carrossel',
                angulo: 'Crença Contrariada',
                ideia_melhorada: `Indicação é excelente, mas depender apenas dela coloca o negócio em risco constante.`,
                gancho_base: 'Se o teu negócio depende de indicações para crescer, estás a um mês fraco do desespero.',
                retencao_hook: 'Slide 2 revela a diferença entre cliente orgânico e cliente previsível.',
                objetivo: 'Gerar desejo pelo sistema de aquisição',
                publico_alvo: audience,
                gancho_verbal: 'Slide 1: O perigo invisível de depender de indicações.',
                gancho_visual: 'Design limpo, fundo escuro, tipografia forte e direta.',
                roteiro_slides: `Slide 1: Capa com gancho forte.\nSlide 2: Por que a indicação não é previsível.\nSlide 3: A matemática de depender da boa vontade de terceiros.\nSlide 4: O que acontece quando o mercado desacelera.\nSlide 5: Como montar uma esteira de captação ativa.\nSlide 6: CTA para falar com a Vamuss.`,
                sugestoes_cenas: 'Carrossel de 6 lâminas.',
                sugestoes_enquadramento: '1080x1350 vertical.',
                sugestoes_edicao: 'Slide-to-slide progressão com alta densidade de valor.',
                texto_tela: 'A armadilha da indicação',
                cta: 'Partilha com um empresário que precisa de ouvir isto.',
                justificativa_estrategica: 'Toca na ferida da dependência de clientes passivos e abre espaço para a solução ativa.',
                limitacoes_hipoteses: 'Métrica-alvo: partilhas e saves.',
                ganchos_utilizados: ['Crença Contrariada']
            }
        ]
    };
}

function generateReferenceFallback(url, platform, notes, transcript, hookLibrary = []) {
    const rawNotes = notes || transcript || 'Mecanismos de atenção e abertura rápida com confronto visual.';

    return {
        analise: {
            verbalHook: {
                phrase: transcript ? transcript.slice(0, 100) : 'Abertura provocativa sobre resultado prático imediato.',
                promise: 'Mostrar a diferença entre quem tem estratégia e quem apenas posta.',
                curiosityType: 'Quebra de expectativa operacional',
                tension: 'A distância entre o esforço aplicado e o retorno obtido',
                approachType: 'Direto ao ponto, lo-fi com câmera na mão',
                relationToContent: 'Conecta o gancho diretamente ao exemplo mostrado na sequência'
            },
            visualHook: {
                initialScene: 'Criador em enquadramento frontal com legenda grande no topo e corte rápido aos 2 segundos.',
                framing: 'Plano médio vertical (9:16)',
                bodyLanguage: 'Expressão firme, gesticulação pontual e assertiva',
                visualMovement: 'Aproximação suave ou corte seco para enfatizar palavras-chave',
                onScreenText: 'Legenda em contraste alto destacando o número ou erro principal',
                visualContrast: 'Mudança de plano aos 3 segundos'
            },
            narrativeStructure: {
                beginning: 'Apresenta a dor sem introduções mornas ou cumprimentos.',
                development: 'Destrincha 2 ou 3 passos objetivos com exemplos práticos.',
                progression: 'Usa a técnica "Mostra > Fala" apresentando tela ou evidência.',
                evidenceAndProofs: 'Exemplo prático de negócio similar.',
                retentionMechanism: 'Promessa de entregar a conclusão rápida antes de 45 segundos.',
                resolution: 'Entrega o princípio e corta na hora.',
                cta: 'Chamada para ação única e direta.'
            },
            editingAndPacing: {
                duration: '35 a 45 segundos',
                scenePacing: 'Rápido, corte a cada frase ou pausa eliminada',
                cutsAndTransitions: 'Jump cuts suaves e zoom-in digital de 5%',
                captionsAndGraphics: 'Legendas palavra a palavra ou linha a linha estilizadas',
                attentionRenewers: 'B-roll ou print inserido no meio do desenvolvimento'
            },
            performanceAndHypotheses: {
                observations: 'Conteúdo vertical dinâmico, focado em resolver uma objeção comum sem rodeios.',
                strategicHypotheses: 'A ausência de introdução e o ritmo dinâmico mantêm a retenção acima de 40% nos primeiros 5 segundos.',
                limitations: 'Métricas exatas de retenção e alcance dependem dos analytics privados da plataforma.'
            },
            transferablePrinciples: [
                'Eliminar saudações ("Olá pessoal") e abrir diretamente no problema.',
                'Substituir explicações abstratas por demonstrações visuais na tela.',
                'Fechar o conteúdo com "Porta na cara" logo após o CTA.'
            ]
        },
        propostas: [
            {
                titulo: 'Adaptação Vamuss: Abertura Rápida',
                formato: 'Reel',
                angulo: 'Problema Oculto',
                ideia_melhorada: 'Adaptar o dinamismo desta referência para desmistificar o custo real por lead em Portugal.',
                gancho_base: 'Se estás a pagar mais de 5€ por lead em Portugal, estás a financiar a concorrência.',
                retencao_hook: 'Abrir mostrando o gerenciador de anúncios com o custo real na tela.',
                objetivo: 'Atrair empresários qualificados',
                publico_alvo: 'Donos de empresas e clínicas em Portugal',
                gancho_verbal: 'Se estás a pagar mais de 5€ por contacto no teu anúncio, o problema não é o teu mercado.',
                gancho_visual: 'Phil em frente ao computador, virando a tela para mostrar o painel com custos reais.',
                roteiro_slides: `1. Gancho (0-3s): "Se o teu custo por lead passou dos 5€, pára tudo."\n2. Revelação (3-20s): Mostra onde a maioria das agências erra (públicos abertos e mensagens genéricas).\n3. Solução (20-35s): Mostra como segmentar por dor real em Portugal.\n4. CTA (35-40s): "Comenta 'ESCALA' para receberes a nossa auditoria."`,
                sugestoes_cenas: 'Escritório da agência com foco na tela real do computador.',
                sugestoes_enquadramento: 'Plano médio virando para a tela.',
                sugestoes_edicao: 'Cortes rápidos com zoom de 10% na métrica.',
                texto_tela: 'Custo por Lead em Portugal: A Realidade',
                cta: 'Comenta "ESCALA" para avaliarmos o teu caso.',
                justificativa_estrategica: 'Aproveita o mecanismo de tensão rápida da referência e ancora na autoridade de dados da Vamuss.',
                limitacoes_hipoteses: 'Testar se o número "5€" ressoa com diferentes nichos.',
                ganchos_utilizados: ['Problema Oculto']
            },
            {
                titulo: 'Adaptação Vamuss: O Teste de 60 Segundos',
                formato: 'Reel',
                angulo: 'Demonstração Prática',
                ideia_melhorada: 'Usar o formato de comparação desta referência para demonstrar a velocidade de resposta do CRM.',
                gancho_base: 'Fiz um teste com 10 clínicas em Lisboa e o resultado foi assustador.',
                retencao_hook: 'Mostrar cronômetro na tela contando os minutos até a resposta.',
                objetivo: 'Gerar identificação e autoridade',
                publico_alvo: 'Donos de clínicas e consultórios',
                gancho_verbal: 'Mandei mensagem para 10 clínicas ontem às 15h. Sabes quantas responderam no mesmo dia?',
                gancho_visual: 'Cronômetro do iPhone na mão gravando em primeiro plano.',
                roteiro_slides: `1. Gancho (0-3s): "Enviei mensagem para 10 empresas. Apenas 2 responderam em menos de 1 hora."\n2. Conflito (3-20s): Quem responde rápido fica com o cliente. O resto perdeu o investimento em anúncios.\n3. Prova (20-35s): Demonstração do CRM da Vamuss com qualificação automática instantânea.\n4. Fechamento (35-40s): Porta na cara.`,
                sugestoes_cenas: 'Gravação informal e autêntica.',
                sugestoes_enquadramento: 'Plano próximo.',
                sugestoes_edicao: 'Inserção de cronômetro animado.',
                texto_tela: 'O Teste dos 60 Segundos',
                cta: 'Partilha com a tua equipa comercial.',
                justificativa_estrategica: 'Provoca reflexão imediata no empresário sobre a sua própria operação.',
                limitacoes_hipoteses: 'Alto potencial de partilha interna em equipas de vendas.',
                ganchos_utilizados: ['Demonstração Prática']
            }
        ]
    };
}

/**
 * Função unificada para analisar ideia (usada tanto pelo Express como pelo middleware do Vite)
 */
export async function handleAnalyzeIdea(body) {
    const { idea, targetAudience, personalContext, goal, preferredFormat, hookLibrary } = body;

    if (!idea || !idea.trim()) {
        return { status: 400, error: 'A ideia é obrigatória para iniciar a análise.' };
    }

    try {
        const availableHooksText = Array.isArray(hookLibrary) && hookLibrary.length > 0
            ? hookLibrary.slice(0, 15).map((h, i) => `${i + 1}. [${h.category}] "${h.text}"`).join('\n')
            : 'Sugerir ganchos originais da Vamuss.';

        const userPrompt = `Analisa a seguinte ideia própria e desenvolve 3 propostas editoriais DISTINTAS e de alto impacto para a Vamuss:

DADOS DA IDEIA:
- Ideia ou Observação Bruta: "${idea}"
- Público-alvo: "${targetAudience || 'Empresários e donos de clínicas em Portugal'}"
- Contexto / Experiência: "${personalContext || 'Dia a dia na construção de sistemas de vendas'}"
- Objetivo pretendido: "${goal || 'Gerar autoridade e identificação com empresários'}"
- Formato preferencial: "${preferredFormat || 'Recomendado pela IA'}"

BIBLIOTECA DE GANCHOS DISPONÍVEIS:
${availableHooksText}

RETORNA UM JSON COM A ESTRUTURA:
{
  "analise_estrategica": {
    "problema_central": "descrição do conflito ou dor real",
    "tensao_editorial": "o que torna este tema interessante ou contraintuitivo",
    "publicos_provaveis": ["público 1", "público 2"],
    "ganchos_consultados": [
      { "gancho": "texto", "origem": "origem", "motivo_escolha": "motivo" }
    ]
  },
  "propostas": [
    {
      "titulo": "Título de trabalho",
      "formato": "Reel | Carrossel | TikTok",
      "angulo": "Nome do ângulo",
      "ideia_melhorada": "Ideia lapidada e clara",
      "gancho_base": "Frase de abertura",
      "retencao_hook": "Mecanismo de retenção",
      "objetivo": "Objetivo",
      "publico_alvo": "Público",
      "gancho_verbal": "Frase falada",
      "gancho_visual": "Cena inicial",
      "roteiro_slides": "Roteiro cena a cena",
      "sugestoes_cenas": "Locação e cenas",
      "sugestoes_enquadramento": "Enquadramento",
      "sugestoes_edicao": "Dicas de edição",
      "texto_tela": "Legenda inicial",
      "cta": "Chamada para ação",
      "justificativa_estrategica": "Por que funciona",
      "limitacoes_hipoteses": "O que testar",
      "ganchos_utilizados": ["gancho"]
    }
  ]
}`;

        const result = await callLLM(VAMUSS_EDITORIAL_SYSTEM_PROMPT, userPrompt);
        return { status: 200, success: true, data: result };
    } catch (err) {
        console.warn('ℹ️ [Content Intelligence] Usando motor editorial de contingência para a ideia:', err.message);
        const fallback = generateIdeaFallback(idea, targetAudience, goal, preferredFormat, hookLibrary);
        return { status: 200, success: true, data: fallback };
    }
}

/**
 * ==============================================================================
 * SISTEMA: MELHORADOR DE IDEIAS (3 ETAPAS FUNCIONAIS)
 * ==============================================================================
 */

/**
 * Fallback estratégico para Etapa 1: Melhorar a Ideia (Grelha Oficial das 4 Colunas)
 */
function generateImproveIdeaFallback(idea, audience, goal, context, hookLibrary = [], existingAngles = []) {
    const cleanIdea = (idea || '').trim();
    const aud = audience || 'Empresários e donos de clínicas em Portugal';
    const usedHooks = Array.isArray(hookLibrary) && hookLibrary.length > 0 ? hookLibrary : [];

    const allAnglesPool = [
        {
            angulo: 'Contradição',
            ideia: `${cleanIdea} — o problema não está no que a maioria pensa, mas na ausência de resposta comercial imediata.`,
            gancho: usedHooks[0]?.text || 'A maioria dos empresários acredita no mito errado sobre aquisição de clientes.',
            retencao: 'Mostrar nos primeiros 2 segundos um print real do tempo de resposta médio no mercado.',
            fonte: usedHooks[0] ? 'Biblioteca Vamuss' : 'Original Estratégico'
        },
        {
            angulo: 'Custo invisível',
            ideia: `O impacto financeiro oculto de ignorar ${cleanIdea.toLowerCase()}: quanto dinheiro a tua empresa perde todos os meses sem perceber.`,
            gancho: usedHooks[1]?.text || 'O erro de 500€ que vejo toda a semana nos negócios em Portugal.',
            retencao: 'Apresentar cálculo rápido na ponta da caneta ou no ecrã nos primeiros 5 segundos.',
            fonte: usedHooks[1] ? 'Biblioteca Vamuss' : 'Original Estratégico'
        },
        {
            angulo: 'Erro comum',
            ideia: `Por que insistir em abordagens ultrapassadas para ${cleanIdea.toLowerCase()} trava o crescimento da equipa de vendas.`,
            gancho: usedHooks[2]?.text || 'Pára de fazer isto no teu negócio se queres clientes qualificados.',
            retencao: 'Corte seco para exemplo prático do erro a acontecer em direto.',
            fonte: usedHooks[2] ? 'Biblioteca Vamuss' : 'Original Estratégico'
        },
        {
            angulo: 'Identificação',
            ideia: `Se também sentes a frustração de tentar ${cleanIdea.toLowerCase()} sem obter previsibilidade, não é incompetência tua — é falta de processo.`,
            gancho: usedHooks[3]?.text || 'Se sentes que a tua empresa trabalha muito mas não escala com previsibilidade, ouve isto.',
            retencao: 'Tom confessional direto para a câmara, sem rodeios ou saudações mornas.',
            fonte: usedHooks[3] ? 'Biblioteca Vamuss' : 'Original Estratégico'
        },
        {
            angulo: 'Comparação',
            ideia: `A diferença real entre o negócio que sofre com ${cleanIdea.toLowerCase()} e o negócio que tem um sistema de aquisição a funcionar.`,
            gancho: usedHooks[4]?.text || 'A única coisa que separa amadores de empresas que faturam com consistência.',
            retencao: 'Ecrã dividido comparando os dois cenários logo no segundo 1.',
            fonte: usedHooks[4] ? 'Biblioteca Vamuss' : 'Original Estratégico'
        },
        {
            angulo: 'Contraintuição',
            ideia: `Por que deves fazer exatamente o oposto do senso comum quando o tema é ${cleanIdea.toLowerCase()}.`,
            gancho: usedHooks[5]?.text || 'A verdade brutal sobre este mercado que ninguém quer admitir.',
            retencao: 'Frase de confronto inicial seguida de demonstração prática.',
            fonte: usedHooks[5] ? 'Biblioteca Vamuss' : 'Original Estratégico'
        }
    ];

    // Filtra para ângulos não existentes se for "gerar mais"
    const normalizedExisting = new Set((existingAngles || []).map(a => a.toLowerCase().trim()));
    let filteredPool = allAnglesPool.filter(item => !normalizedExisting.has(item.angulo.toLowerCase().trim()));
    if (filteredPool.length < 3) filteredPool = allAnglesPool;

    const selectedPool = filteredPool.slice(0, 4);

    return {
        analise_estrategica: {
            problema_central: `A dificuldade em traduzir "${cleanIdea.slice(0, 80)}" em ações comerciais práticas e previsíveis.`,
            tensao_editorial: `Confronto entre práticas comuns do mercado português e a necessidade de sistemas de aquisição profissionais.`,
            publicos_provaveis: [aud, 'Gestores Comerciais e PMEs'],
            ganchos_consultados: usedHooks.slice(0, 4).map(h => ({
                gancho: h.text,
                origem: `Biblioteca (${h.category})`
            }))
        },
        grid: selectedPool.map((item, i) => ({
            id: `ang-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            angulo: item.angulo,
            ideia_melhorada: item.ideia,
            gancho_base: item.gancho,
            retencao_hook: item.retencao,
            fonte_gancho: item.fonte
        }))
    };
}

/**
 * ETAPA 1 — MELHORAR A IDEIA (Grelha Oficial com exatamente as 4 colunas)
 */
export async function handleImproveIdea(body) {
    const { idea, targetAudience, goal, context, hookLibrary = [], existingAngles = [] } = body;

    if (!idea || !idea.trim()) {
        return { status: 400, success: false, error: 'A ideia bruta é obrigatória.' };
    }

    const audience = targetAudience || 'Empresários, donos de clínicas e PMEs em Portugal';
    const cleanGoal = goal || 'Gerar autoridade e mensagens no WhatsApp';
    const cleanContext = context || 'Rotina de vendas e sistemas de aquisição';

    const availableHooksText = Array.isArray(hookLibrary) && hookLibrary.length > 0
        ? hookLibrary.slice(0, 25).map((h, i) => `${i + 1}. [${h.category}] "${h.text}"`).join('\n')
        : 'Consultar mecanismos de gancho da Vamuss (Contradição, Pergunta, Erro comum, Custo invisível).';

    const existingAnglesText = existingAngles.length > 0
        ? `\nÂNGULOS JÁ GERADOS ANTERIORMENTE (GERA ÂNGULOS NOVOS E DISTINTOS DESTES): ${existingAngles.join(', ')}`
        : '';

    const userPrompt = `Aplica o método de inteligência editorial da Vamuss à seguinte ideia bruta.
Gera entre 4 a 5 abordagens DISTINTAS e de alto impacto seguindo ESTRITAMENTE a Grelha Editorial Oficial de 4 colunas da Vamuss.

DADOS DA IDEIA:
- Ideia Bruta: "${idea}"
- Público-alvo: "${audience}"
- Objetivo do Conteúdo: "${cleanGoal}"
- Contexto / Observações: "${cleanContext}"

BIBLIOTECA DE GANCHOS DISPONÍVEIS (CONSULTA E REUTILIZA SEMPRE QUE APROPRIADO):
${availableHooksText}
${existingAnglesText}

REGRAS OBRIGATÓRIAS:
1. Língua: Português de Portugal autêntico (PT-PT: estás a, teu, ecrã, telemóvel, etc.).
2. Preserva rigorosamente o núcleo da ideia original.
3. Não inventes estudos científicos, estatísticas falsas ou casos fictícios.
4. Cada linha da grelha DEVE conter exatamente estas 4 colunas:
   - Ângulo: perspetiva estratégica (ex: Contradição, Custo invisível, Identificação, Erro comum, Fricção social, Descoberta, Oportunidade, Comparação, Contraintuição, Experiência humana).
   - Ideia melhorada: desenvolve essa perspetiva sem perder o núcleo original.
   - Gancho / Base: frase ou estrutura de abertura para parar o feed (aproveita a biblioteca de ganchos se houver encaixe).
   - Retenção / Hook: aplicação visual ou narrativa concreta nos primeiros segundos para reter o público.

RETORNA EXCLUSIVAMENTE UM OBJETO JSON VÁLIDO:
{
  "analise_estrategica": {
    "problema_central": "descrição concisa do conflito",
    "tensao_editorial": "o que torna esta ideia interessante"
  },
  "grid": [
    {
      "angulo": "Nome do Ângulo",
      "ideia_melhorada": "Texto da ideia melhorada",
      "gancho_base": "Frase de abertura",
      "retencao_hook": "Ação concreta de retenção inicial",
      "fonte_gancho": "Biblioteca Vamuss ou Original Estratégico"
    }
  ]
}`;

    try {
        const result = await callLLM(VAMUSS_EDITORIAL_SYSTEM_PROMPT, userPrompt);
        if (result && Array.isArray(result.grid) && result.grid.length > 0) {
            const gridWithIds = result.grid.map((item, idx) => ({
                id: `ang-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                angulo: item.angulo || 'Contradição',
                ideia_melhorada: item.ideia_melhorada || item.ideiaMelhorada || idea,
                gancho_base: item.gancho_base || item.ganchoBase || 'A maioria dos empresários comete este erro.',
                retencao_hook: item.retencao_hook || item.retencaoHook || 'Mostrar o print no primeiro segundo.',
                fonte_gancho: item.fonte_gancho || item.fonteGancho || 'Original Estratégico'
            }));
            return {
                status: 200,
                success: true,
                data: {
                    analise_estrategica: result.analise_estrategica,
                    grid: gridWithIds
                }
            };
        }
        throw new Error('Resposta de IA incompleta para grelha editorial');
    } catch (err) {
        console.warn('⚠️ [Content Intelligence] Usando contingência editorial para Etapa 1:', err.message);
        const fallback = generateImproveIdeaFallback(idea, audience, cleanGoal, cleanContext, hookLibrary, existingAngles);
        return { status: 200, success: true, data: fallback };
    }
}

/**
 * Fallback estratégico para Etapa 2: Explorar Formatos
 */
function generateExploreFormatsFallback(idea, approach, audience, goal, context, existingFormats = []) {
    const angulo = approach?.angulo || 'Estratégico';
    const ideiaMelhorada = approach?.ideia_melhorada || approach?.ideiaMelhorada || idea;

    const catalog = [
        {
            nome: 'Talking head com corte dinâmico',
            conceito: 'Gravação frontal autêntica em plano médio, falando direto para o empresário com cortes nos respiros e zooms digitais sutis.',
            porQueFunciona: `Excelente para estabelecer autoridade direta do Phil no ângulo de ${angulo}, sem necessidade de produções pesadas.`,
            ganchoVerbal: approach?.gancho_base || 'Se estás a cometer este erro no teu negócio, pára imediatamente.',
            ganchoVisual: 'Olhar direto nos olhos da câmara, expressão séria, legenda grande no terço superior.',
            recursosDificuldade: 'Baixa: Telemóvel na vertical, boa luz natural e microfone de lapela.',
            isRecomendado: true,
            motivoRecomendacao: 'Máxima autoridade pessoal e velocidade de produção diária para o CRM da Vamuss.'
        },
        {
            nome: 'Demonstração visual / Ecrã dividido',
            conceito: 'Câmara frontal num canto e gravação de ecrã do CRM ou WhatsApp ao lado, demonstrando a tese em tempo real.',
            porQueFunciona: 'Aplica a regra de ouro da Vamuss: "Mostrar > Falar". Transforma uma reflexão num facto observável.',
            ganchoVerbal: 'Deixa-me mostrar-te na prática o que acontece quando fazes isto.',
            ganchoVisual: 'Ecrã do computador virado para a câmara com dados visíveis em destaque.',
            recursosDificuldade: 'Média: Captura de ecrã + plano da câmara sincronizado.',
            isRecomendado: false,
            motivoRecomendacao: 'Gera prova incontestável para donos de clínicas e PMEs.'
        },
        {
            nome: 'Opinião provocadora / Porta na cara',
            conceito: 'Confronto direto com crenças populares do marketing e consultoria, desmistificando o que não traz vendas.',
            porQueFunciona: 'Quebra o feed saturado de "dicas bonitinhas" e posiciona a Vamuss como quem fala a verdade crua do mercado português.',
            ganchoVerbal: 'A maioria das agências mente-te sobre isto. Aqui está a realidade.',
            ganchoVisual: 'Caminhada rápida no escritório ou plano próximo sem introdução musical.',
            recursosDificuldade: 'Baixa: Apenas o telemóvel e convicção editorial.',
            isRecomendado: false,
            motivoRecomendacao: 'Altas taxas de retenção e comentários inflamados de empresários.'
        },
        {
            nome: 'Storytelling / Caso de bastidores',
            conceito: 'Partilha de uma situação real do dia a dia da agência ou de uma reunião de diagnóstico recente com um cliente.',
            porQueFunciona: 'Humaniza a mensagem e ensina através de um exemplo tangível sem soar como aula teórica.',
            ganchoVerbal: 'Ontem numa reunião de diagnóstico, um empresário disse-me algo que me deixou a pensar.',
            ganchoVisual: 'Plano mais relaxado, café na mão ou secretária de trabalho.',
            recursosDificuldade: 'Baixa: Gravação autêntica em ambiente real de trabalho.',
            isRecomendado: false,
            motivoRecomendacao: 'Gera identificação profunda com a rotina e dores reais de quem gere um negócio.'
        },
        {
            nome: 'Cena ou situação representada (POV)',
            conceito: 'Simulação rápida do ponto de vista do cliente ou do empresário quando o sistema falha.',
            porQueFunciona: 'Gera humor inteligente e identificação instantânea com a fricção operacional.',
            ganchoVerbal: 'POV: O teu cliente manda mensagem às 14h e tu respondes às 19h.',
            ganchoVisual: 'Ator ou criador a olhar para o telemóvel com expressão de desespero.',
            recursosDificuldade: 'Média: Exige um mínimo de encenação e 2 planos diferentes.',
            isRecomendado: false,
            motivoRecomendacao: 'Ideal para reels virais com potencial de partilha em grupos de WhatsApp.'
        }
    ];

    const normalizedExisting = new Set((existingFormats || []).map(f => f.toLowerCase().trim()));
    let filtered = catalog.filter(f => !normalizedExisting.has(f.nome.toLowerCase().trim()));
    if (filtered.length < 3) filtered = catalog;

    return {
        formats: filtered.slice(0, 4).map((f, i) => ({
            id: `fmt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            nome: f.nome,
            conceito: f.conceito,
            por_que_funciona: f.porQueFunciona,
            gancho_verbal: f.ganchoVerbal,
            gancho_visual: f.ganchoVisual,
            recursos_dificuldade: f.recursosDificuldade,
            is_recomendado: f.isRecomendado,
            motivo_recomendacao: f.motivoRecomendacao
        }))
    };
}

/**
 * ETAPA 2 — EXPLORAR FORMATOS
 */
export async function handleExploreFormats(body) {
    const { idea, selectedApproach, targetAudience, goal, context, existingFormats = [] } = body;

    if (!selectedApproach || !selectedApproach.angulo) {
        return { status: 400, success: false, error: 'A abordagem da Etapa 1 é obrigatória para explorar formatos.' };
    }

    const aud = targetAudience || 'Empresários e donos de clínicas em Portugal';
    const cleanGoal = goal || 'Gerar autoridade e mensagens no WhatsApp';
    const cleanContext = context || 'Sistemas de aquisição e rotina comercial';

    const existingText = existingFormats.length > 0
        ? `\nFORMATOS JÁ GERADOS (GERA FORMATOS NOVOS E DISTINTOS DESTES): ${existingFormats.join(', ')}`
        : '';

    const userPrompt = `Com base na abordagem selecionada pelo utilizador, recomenda entre 3 a 4 formatos audiovisuais DISTINTOS para apresentar a mesma mensagem.

DADOS DA ABORDAGEM SELECIONADA:
- Ângulo Estratégico: "${selectedApproach.angulo}"
- Ideia Melhorada: "${selectedApproach.ideia_melhorada || selectedApproach.ideiaMelhorada}"
- Gancho / Base: "${selectedApproach.gancho_base || selectedApproach.ganchoBase}"
- Retenção / Hook: "${selectedApproach.retencao_hook || selectedApproach.retencaoHook}"
- Público-alvo: "${aud}"
- Objetivo: "${cleanGoal}"
- Contexto: "${cleanContext}"
${existingText}

BIBLIOTECA DE FORMATOS VAMUSS (ESCOLHE AS MELHORES OPÇÕES PARA ESTA IDEIA ESPECÍFICA):
- Talking head
- Opinião provocadora
- Storytelling
- Cena ou situação representada
- Conversa informal ou fofoquinha
- Demonstração visual
- Comparação ou contraste
- Antes e depois
- POV
- Reação ou comentário
- Exemplo concreto
- Bastidores
- Vlog ou experiência pessoal
- Transição visual
- Loop com convite para ler a legenda
- Texto ou sequência visual num Reel
- Pergunta e resposta

REGRAS OBRIGATÓRIAS:
1. Responde em Português de Portugal autêntico (PT-PT).
2. Não apresentes sempre a mesma lista; escolhe os formatos mais pertinentes para a ideia concreta.
3. Para cada formato, indica:
   - Nome do formato
   - Conceito da apresentação
   - Por que razão pode funcionar para esta ideia
   - Gancho verbal sugerido
   - Gancho visual sugerido
   - Recursos necessários / Dificuldade de produção
4. Recomenda exatamente UMA opção principal ("is_recomendado": true) e justifica brevemente o porquê.

RETORNA EXCLUSIVAMENTE UM OBJETO JSON VÁLIDO:
{
  "formats": [
    {
      "nome": "Nome do Formato",
      "conceito": "Como a mensagem é estruturada e apresentada",
      "por_que_funciona": "Justificativa estratégica do formato para este ângulo",
      "gancho_verbal": "Frase falada de abertura (0-3s)",
      "gancho_visual": "Cena visual e enquadramento inicial",
      "recursos_dificuldade": "Baixa / Média / Alta com descrição",
      "is_recomendado": true,
      "motivo_recomendacao": "Por que esta é a opção ideal para a Vamuss"
    }
  ]
}`;

    try {
        const result = await callLLM(VAMUSS_EDITORIAL_SYSTEM_PROMPT, userPrompt);
        if (result && Array.isArray(result.formats) && result.formats.length > 0) {
            const formatted = result.formats.map((f, i) => ({
                id: `fmt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                nome: f.nome || 'Talking head',
                conceito: f.conceito || '',
                por_que_funciona: f.por_que_funciona || f.porQueFunciona || '',
                gancho_verbal: f.gancho_verbal || f.ganchoVerbal || selectedApproach.gancho_base || '',
                gancho_visual: f.gancho_visual || f.ganchoVisual || selectedApproach.retencao_hook || '',
                recursos_dificuldade: f.recursos_dificuldade || f.recursosDificuldade || 'Baixa',
                is_recomendado: Boolean(f.is_recomendado || f.isRecomendado),
                motivo_recomendacao: f.motivo_recomendacao || f.motivoRecomendacao || ''
            }));
            return { status: 200, success: true, data: { formats: formatted } };
        }
        throw new Error('Resposta de formatos inválida');
    } catch (err) {
        console.warn('⚠️ [Content Intelligence] Usando contingência para Etapa 2:', err.message);
        const fallback = generateExploreFormatsFallback(idea, selectedApproach, aud, cleanGoal, cleanContext, existingFormats);
        return { status: 200, success: true, data: fallback };
    }
}

/**
 * Fallback estratégico para Etapa 3: Desenvolver a Proposta
 */
function generateDevelopProposalFallback(idea, approach, format, audience, goal, context) {
    const angulo = approach?.angulo || 'Estratégico';
    const ideiaMelhorada = approach?.ideia_melhorada || approach?.ideiaMelhorada || idea;
    const formatName = format?.nome || 'Talking head';
    const ganchoV = format?.gancho_verbal || approach?.gancho_base || 'Se estás a perder vendas no WhatsApp, o problema não é o teu mercado.';
    const ganchoVis = format?.gancho_visual || approach?.retencao_hook || 'Plano médio frontal virando para a tela do CRM com tempo de resposta.';
    const aud = audience || 'Empresários e donos de clínicas em Portugal';
    const ctaText = 'Comenta "SISTEMA" ou envia mensagem direta para receberes o diagnóstico comercial gratuito da Vamuss.';

    return {
        proposal: {
            titulo: `${angulo}: A Verdade Sobre ${ideiaMelhorada.slice(0, 45)}...`,
            formato: formatName,
            conceito_objetivo: `Desmistificar ${ideiaMelhorada} e posicionar a Vamuss como especialista em aquisição previsível de clientes. Objetivo: ${goal || 'Gerar reuniões qualificadas e autoridade'}.`,
            publico_mensagem: `Público: ${aud}. Mensagem Central: Quem não tem processo de resposta rápida e qualificação comercial deita dinheiro de anúncios fora.`,
            gancho_verbal: ganchoV,
            gancho_visual: ganchoVis,
            estrutura_narrativa: `1. Gancho Direto (0-3s): Confronto com a dor real sem introdução morna.\n2. Problema Operacional (3-18s): Explicar onde o dinheiro ou o tempo é perdido no dia a dia.\n3. Demonstração / Revelação (18-35s): Mostrar o método ou sistema de aquisição em funcionamento.\n4. CTA com Porta na Cara (35-42s): Chamada para ação única e corte imediato.`,
            sequencia_cenas: `Cena 1 (0-3s): ${ganchoVis} | Áudio: "${ganchoV}"\nCena 2 (3-15s): Criador a explicar a matemática com cortes nos respiros. Textos em destaque na tela.\nCena 3 (15-30s): Transição para captura de ecrã ou demonstração do fluxo prático do CRM.\nCena 4 (30-40s): Retorno ao plano frontal com chamada direta para ação.`,
            enquadramentos_acoes: 'Plano médio (9:16 vertical), câmara à altura dos olhos, gesticulação pontual e firme, sem hesitações.',
            texto_falado_tela: `Texto Falado: "${ganchoV} No dia a dia de uma empresa em Portugal, cada hora sem resposta custa caro..."\nTexto na Tela: "O ERRO QUE TE CUSTA CLIENTES" (amarelo e branco com alto contraste).`,
            mecanismos_retencao: 'Corte a cada 2.5 a 3 segundos, zoom digital de 5% nas palavras-chave, eliminação total de silêncios.',
            sugestoes_edicao: 'Legendas palavra-por-palavra, efeito sonoro sutil (whoosh) nas transições de cena, sem música alta que abafe a voz.',
            cta: ctaText
        }
    };
}

/**
 * ETAPA 3 — DESENVOLVER A PROPOSTA COMPLETA
 */
export async function handleDevelopProposal(body) {
    const { idea, selectedApproach, selectedFormat, targetAudience, goal, context } = body;

    if (!selectedApproach || !selectedFormat) {
        return { status: 400, success: false, error: 'A abordagem e o formato são obrigatórios para desenvolver a proposta.' };
    }

    const aud = targetAudience || 'Empresários e donos de clínicas em Portugal';
    const cleanGoal = goal || 'Gerar autoridade e mensagens no WhatsApp';
    const cleanContext = context || 'Rotina de vendas e sistemas de aquisição';

    const userPrompt = `Desenvolve o guião completo de produção e proposta estratégica editorial da Vamuss para a abordagem e formato selecionados:

DADOS DE ENTRADA:
- Ideia Bruta Original: "${idea}"
- Ângulo Estratégico: "${selectedApproach.angulo}"
- Ideia Melhorada: "${selectedApproach.ideia_melhorada || selectedApproach.ideiaMelhorada}"
- Gancho / Base: "${selectedApproach.gancho_base || selectedApproach.ganchoBase}"
- Retenção / Hook: "${selectedApproach.retencao_hook || selectedApproach.retencaoHook}"
- Formato Escolhido: "${selectedFormat.nome}"
- Conceito do Formato: "${selectedFormat.conceito}"
- Gancho Verbal do Formato: "${selectedFormat.gancho_verbal || selectedFormat.ganchoVerbal}"
- Gancho Visual do Formato: "${selectedFormat.gancho_visual || selectedFormat.ganchoVisual}"
- Público-alvo: "${aud}"
- Objetivo: "${cleanGoal}"
- Contexto: "${cleanContext}"

REGRAS DE CONTEÚDO VAMUSS:
1. Língua: Português de Portugal autêntico (PT-PT: estás a, teu negócio, ecrã, telemóvel, equipa comercial).
2. Sem clichês genéricos. Direto ao ponto, estilo "porta na cara".
3. Não inventes dados ou casos falsos.
4. O guião deve ser imediatamente utilizável para gravação.

RETORNA EXCLUSIVAMENTE UM OBJETO JSON VÁLIDO:
{
  "proposal": {
    "titulo": "Título direto e memorável",
    "formato": "${selectedFormat.nome}",
    "conceito_objetivo": "Conceito e objetivo estratégico do conteúdo",
    "publico_mensagem": "Público e mensagem central resumida",
    "gancho_verbal": "O que dizer nos primeiros 0-3 segundos",
    "gancho_visual": "O que mostrar no enquadramento inicial",
    "estrutura_narrativa": "Estrutura do início, meio e fim",
    "sequencia_cenas": "Roteiro detalhado cena a cena com timing",
    "enquadramentos_acoes": "Posicionamento da câmara, gestos e ações",
    "texto_falado_tela": "Texto falado e elementos gráficos no ecrã",
    "mecanismos_retencao": "Técnicas de retenção aplicadas",
    "sugestoes_edicao": "Dicas práticas de cortes, ritmo e legendas",
    "cta": "Chamada para ação única e direta"
  }
}`;

    try {
        const result = await callLLM(VAMUSS_EDITORIAL_SYSTEM_PROMPT, userPrompt);
        if (result && result.proposal) {
            return { status: 200, success: true, data: { proposal: result.proposal } };
        }
        throw new Error('Falha ao estruturar a proposta desenvolvida');
    } catch (err) {
        console.warn('⚠️ [Content Intelligence] Usando contingência para Etapa 3:', err.message);
        const fallback = generateDevelopProposalFallback(idea, selectedApproach, selectedFormat, aud, cleanGoal, cleanContext);
        return { status: 200, success: true, data: fallback };
    }
}

/**
 * Recupera o vídeo a partir de um URL público (Fase 1 do pipeline assíncrono)
 */
export async function handleRetrieveVideo(body) {
    const { url } = body;
    if (!url) {
        return { status: 400, success: false, statusType: 'erro_recuperacao', error: 'URL do Reel é obrigatório.' };
    }

    const result = await resolveVideoFromUrl(url);
    if (!result.success) {
        return {
            status: 422,
            success: false,
            statusType: result.statusType || 'erro_recuperacao',
            code: result.code,
            error: result.error,
            setupGuide: result.setupGuide
        };
    }

    return {
        status: 200,
        success: true,
        statusType: 'video_recuperado',
        data: result
    };
}

/**
 * Função unificada para analisar referência (usada tanto pelo Express como pelo middleware do Vite)
 */
export async function handleAnalyzeReference(body) {
    let { url, platform, notes, videoFileUrl, mediaUrls, transcript, hookLibrary } = body;

    // Se o utilizador enviou um URL sem vídeo carregado, tenta recuperar o vídeo automaticamente
    if (!videoFileUrl && url) {
        const norm = normalizeInstagramUrl(url);
        if (norm.isValid) {
            console.log(`🔗 [Content Intelligence] URL de Reel detetado (${url}). A iniciar recuperação automática do vídeo...`);
            const retrievalResult = await resolveVideoFromUrl(url);

            if (retrievalResult.success && retrievalResult.videoFileUrl) {
                console.log(`✅ [Content Intelligence] Vídeo recuperado com sucesso: ${retrievalResult.videoFileUrl}`);
                videoFileUrl = retrievalResult.videoFileUrl;
            } else {
                console.warn(`⚠️ [Content Intelligence] Não foi possível recuperar o vídeo automaticamente: ${retrievalResult.error}`);
                // Devolve erro rigoroso de recuperação para não mascarar falhas
                return {
                    status: 422,
                    statusType: 'erro_recuperacao',
                    success: false,
                    code: retrievalResult.code || 'RETRIEVAL_FAILED',
                    error: retrievalResult.error || 'Falha ao recuperar o vídeo do Reel.',
                    setupGuide: retrievalResult.setupGuide
                };
            }
        }
    }

    // 1. PIPELINE DE ANÁLISE AUDIOVISUAL REAL DE VÍDEO (Método B & C ou URL recuperado)
    if (videoFileUrl) {
        let absVideoPath = videoFileUrl;
        if (!fs.existsSync(absVideoPath)) {
            const cleanPath = videoFileUrl.startsWith('/') ? videoFileUrl.slice(1) : videoFileUrl;
            absVideoPath = path.join(process.cwd(), cleanPath);
        }

        if (fs.existsSync(absVideoPath)) {
            console.log(`🎬 [Content Intelligence] Iniciando análise audiovisual real para o vídeo: ${absVideoPath}`);
            const tempDir = path.join(process.cwd(), 'temp_uploads');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempAudioPath = path.join(tempDir, `audio_${Date.now()}_${randomUUID().slice(0, 6)}.mp3`);
            const tempFramesDir = path.join(tempDir, `frames_${Date.now()}_${randomUUID().slice(0, 6)}`);
            const filesToClean = [tempAudioPath];

            try {
                // A. Obter metadados reais com ffprobe
                const metadata = getVideoMetadata(absVideoPath);

                // B. Extração de áudio e transcrição real com OpenAI Whisper
                let transcriptResult = { hasSpeech: false, fullText: '', segments: [], firstWords: '' };
                if (metadata.hasAudio) {
                    const hasExtractedAudio = extractAudioFromVideo(absVideoPath, tempAudioPath);
                    if (hasExtractedAudio) {
                        transcriptResult = await transcribeAudioWithWhisper(tempAudioPath);
                    }
                }

                // C. Extração estratégica de fotogramas (0.2s, 1.5s, 3.0s e progressão)
                const keyframes = extractStrategicKeyframes(absVideoPath, metadata.duration, tempFramesDir, 7);
                for (const f of keyframes) {
                    filesToClean.push(f.path);
                }

                // D. Análise Multimodal (Visão GPT-4o-mini + Whisper + Posicionamento Vamuss)
                if (keyframes.length > 0) {
                    const aiResult = await analyzeVideoMultimodal({
                        videoPath: absVideoPath,
                        metadata,
                        transcriptResult,
                        keyframes,
                        hookLibrary,
                        notes,
                        platform: platform || 'Reel'
                    });

                    // Tagging rigoroso da origem do material
                    const analysisSource = transcriptResult.hasSpeech ? 'video_audiovisual' : 'video_visual_only';
                    aiResult.analise = {
                        ...aiResult.analise,
                        analysisSource,
                        videoMetadata: {
                            durationSeconds: metadata.duration,
                            width: metadata.width,
                            height: metadata.height,
                            aspectRatio: metadata.aspectRatio,
                            hasAudio: metadata.hasAudio,
                            hasSpeech: transcriptResult.hasSpeech,
                            fileSizeMb: parseFloat((metadata.sizeBytes / (1024 * 1024)).toFixed(2))
                        },
                        spokenTranscriptWithTimestamps: transcriptResult.segments,
                        extractedKeyframesCount: keyframes.length
                    };

                    return {
                        status: 'concluido',
                        statusType: 'concluido',
                        success: true,
                        data: aiResult
                    };
                }
            } catch (videoErr) {
                console.error('❌ [Content Intelligence] Erro no processamento de vídeo:', videoErr);
                return {
                    status: 500,
                    statusType: 'erro_analise',
                    error: `Falha no processamento audiovisual do vídeo: ${videoErr.message}`
                };
            } finally {
                cleanupFiles(filesToClean);
                try {
                    if (fs.existsSync(tempFramesDir)) fs.rmSync(tempFramesDir, { recursive: true, force: true });
                } catch { }
            }
        } else {
            console.warn(`⚠️ [Content Intelligence] Arquivo de vídeo não encontrado no caminho: ${absVideoPath}`);
        }
    }

    // 2. MÉTODO A — APENAS URL (SEM VÍDEO E SEM NOTAS)
    const hasNotesOrTranscript = Boolean((transcript && transcript.trim().length >= 5) || (notes && notes.trim().length >= 5));
    if (!hasNotesOrTranscript && url) {
        return {
            status: 'requer_material',
            statusType: 'requer_material',
            success: true,
            message: 'Não foi possível aceder diretamente ao vídeo. Carrega o vídeo ou uma gravação do ecrã para permitir a análise audiovisual completa.',
            missing_material: {
                reason: 'Acesso audiovisual direto bloqueado pela plataforma de origem sem autenticação.',
                suggested_actions: [
                    'Carrega o vídeo original (.mp4 ou .mov)',
                    'Ou grava o ecrã do telemóvel enquanto o vídeo reproduz e envia essa gravação',
                    'Ou introduz notas com o resumo do conteúdo para uma análise puramente conceitual'
                ]
            }
        };
    }

    // 3. MÉTODO D — ANÁLISE CONCEITUAL BASEADA EXCLUSIVAMENTE EM NOTAS OU TRANSCRIÇÃO MANUAL
    try {
        const availableHooksText = Array.isArray(hookLibrary) && hookLibrary.length > 0
            ? hookLibrary.slice(0, 15).map((h, i) => `${i + 1}. [${h.category}] "${h.text}"`).join('\n')
            : 'Sugerir ganchos originais da Vamuss.';

        const contentSourceDescription = [
            url ? `URL de Origem: ${url}` : null,
            platform ? `Plataforma: ${platform}` : null,
            notes ? `Notas do Utilizador: ${notes}` : null,
            transcript ? `Transcrição Manual Fornecida: "${transcript}"` : null,
            mediaUrls && mediaUrls.length > 0 ? `Imagens Fornecidas: ${mediaUrls.length} slides/capturas` : null
        ].filter(Boolean).join('\n');

        const userPrompt = `Analisa conceitualmente o resumo desta referência externa e adapta os seus princípios criativos para o contexto da Vamuss:

MATERIAL DISPONÍVEL (APENAS TEXTO / NOTAS):
${contentSourceDescription}

BIBLIOTECA DE GANCHOS DISPONÍVEIS:
${availableHooksText}

IMPORTANTE: Como o arquivo de vídeo não foi fornecido, a análise deve identificar expressamente que é baseada apenas nas notas textuais.

RETORNA UM JSON COM A ESTRUTURA:
{
  "analise": {
    "verbalHook": { "phrase": "...", "promise": "...", "curiosityType": "...", "tension": "...", "approachType": "...", "relationToContent": "..." },
    "visualHook": { "initialScene": "Não analisado audiovisualmente (sem vídeo)", "framing": "Sugerido vertical 9:16", "bodyLanguage": "Não observável", "visualMovement": "Sugerido corte rápido", "onScreenText": "Sugerido gancho no topo", "visualContrast": "Sugerido contraste alto" },
    "narrativeStructure": { "beginning": "...", "development": "...", "progression": "...", "evidenceAndProofs": "...", "retentionMechanism": "...", "resolution": "...", "cta": "..." },
    "editingAndPacing": { "duration": "Sugerido 35-45s", "scenePacing": "Sugerido dinâmico", "cutsAndTransitions": "Jump cuts", "captionsAndGraphics": "Legendas dinâmicas", "attentionRenewers": "B-roll ou dados" },
    "performanceAndHypotheses": { 
      "observations": "Análise realizada com base nas notas fornecidas pelo utilizador. O vídeo original não foi carregado, pelo que os elementos visuais reais, linguagem corporal e cortes não foram analisados diretamente.",
      "strategicHypotheses": "Adaptação do conceito textual para o público da Vamuss.",
      "limitations": "Elementos visuais, linguagem corporal e edição não foram verificados audiovisualmente."
    },
    "transferablePrinciples": ["..."]
  },
  "propostas": [
    {
      "titulo": "...",
      "formato": "Reel",
      "angulo": "...",
      "ideia_melhorada": "...",
      "gancho_base": "...",
      "retencao_hook": "...",
      "objetivo": "...",
      "publico_alvo": "...",
      "gancho_verbal": "...",
      "gancho_visual": "...",
      "roteiro_slides": "...",
      "sugestoes_cenas": "...",
      "sugestoes_enquadramento": "...",
      "sugestoes_edicao": "...",
      "texto_tela": "...",
      "cta": "...",
      "justificativa_estrategica": "...",
      "limitacoes_hipoteses": "...",
      "ganchos_utilizados": ["..."]
    }
  ]
}`;

        const result = await callLLM(VAMUSS_EDITORIAL_SYSTEM_PROMPT, userPrompt);
        if (result && result.analise) {
            result.analise.analysisSource = transcript ? 'user_transcript' : 'notes_only';
        }
        return { status: 200, success: true, statusType: 'concluido', data: result };
    } catch (err) {
        console.warn('ℹ️ [Content Intelligence] Usando motor de adaptação editorial de contingência:', err.message);
        const fallback = generateReferenceFallback(url, platform, notes, transcript, hookLibrary);
        if (fallback && fallback.analise) {
            fallback.analise.analysisSource = 'notes_only';
        }
        return { status: 200, success: true, statusType: 'concluido', data: fallback };
    }
}

// Rotas do Express
contentIntelligenceRouter.post('/analyze-idea', async (req, res) => {
    const result = await handleAnalyzeIdea(req.body);
    const statusCode = typeof result.status === 'number' ? result.status : 200;
    res.status(statusCode).json(result);
});

contentIntelligenceRouter.post('/improve-idea', async (req, res) => {
    const result = await handleImproveIdea(req.body);
    const statusCode = typeof result.status === 'number' ? result.status : 200;
    res.status(statusCode).json(result);
});

contentIntelligenceRouter.post('/explore-formats', async (req, res) => {
    const result = await handleExploreFormats(req.body);
    const statusCode = typeof result.status === 'number' ? result.status : 200;
    res.status(statusCode).json(result);
});

contentIntelligenceRouter.post('/develop-proposal', async (req, res) => {
    const result = await handleDevelopProposal(req.body);
    const statusCode = typeof result.status === 'number' ? result.status : 200;
    res.status(statusCode).json(result);
});

contentIntelligenceRouter.post('/analyze-reference', async (req, res) => {
    const result = await handleAnalyzeReference(req.body);
    const statusCode = typeof result.status === 'number' ? result.status : 200;
    res.status(statusCode).json(result);
});

contentIntelligenceRouter.post('/retrieve-video', async (req, res) => {
    const result = await handleRetrieveVideo(req.body);
    const statusCode = typeof result.status === 'number' ? result.status : 200;
    res.status(statusCode).json(result);
});

// Endpoint de Upload de Vídeo com suporte a streaming direto
contentIntelligenceRouter.post('/upload-video', (req, res) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'content_videos');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const rawFilename = (req.query.filename || 'uploaded_video.mp4').toString();
    const cleanExt = path.extname(rawFilename).toLowerCase() || '.mp4';
    const safeExt = ['.mp4', '.mov', '.webm', '.m4v'].includes(cleanExt) ? cleanExt : '.mp4';
    const targetFilename = `video_${Date.now()}_${randomUUID().slice(0, 8)}${safeExt}`;
    const targetPath = path.join(uploadDir, targetFilename);

    const writeStream = fs.createWriteStream(targetPath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
        const stats = fs.statSync(targetPath);
        console.log(`✅ [Content Intelligence] Vídeo carregado com sucesso: ${targetFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        res.json({
            success: true,
            videoFileUrl: `/uploads/content_videos/${targetFilename}`,
            fileName: rawFilename,
            fileSize: stats.size,
            fileFormat: safeExt.replace('.', '')
        });
    });

    writeStream.on('error', (err) => {
        console.error('❌ [Content Intelligence] Erro ao gravar vídeo:', err);
        res.status(500).json({ error: `Erro ao salvar o arquivo: ${err.message}` });
    });
});

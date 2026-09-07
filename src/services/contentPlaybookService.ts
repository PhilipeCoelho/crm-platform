import { supabase } from '@/lib/supabase';

export type ContentPlaybookSection = 
  | 'objetivo'
  | 'persona'
  | 'pilares'
  | 'andar_funil'
  | 'formatos'
  | 'ganchos'
  | 'cta'
  | 'estrutura_tempo'
  | 'processo_criacao'
  | 'etica_saude'
  | 'checklist_pre_publicacao';

export interface ContentPlaybookEntry {
  id?: string;
  userId?: string | null;
  secao: ContentPlaybookSection;
  conteudo: string;
  origem: string;
  status: 'confirmed' | 'draft' | 'archived';
  dataImportacao?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Built-in default Playbook (11 sections) validated from Micha+Oney references.
 * Acts as guaranteed in-memory/code fallback so the system is immediately operational.
 */
export const DEFAULT_CONTENT_PLAYBOOK: Record<ContentPlaybookSection, string> = {
  objetivo: `Objetivo fixo do sistema: crescer a audiência do Instagram pessoal do Phil com empresários e profissionais de saúde em Portugal como seguidores, convertendo em clientes do serviço de marketing/aquisição de pacientes. Todo conteúdo gerado deve passar pelo filtro: "isto aproxima ou afasta esse público de querer seguir e depois contratar?"`,

  persona: `Nome de referência: "Dr. Ricardo" — representa o profissional de saúde em Portugal (dono de clínica de qualquer especialidade, ou profissional que precisa gerar procura/pacientes/crescimento).

Características:
- Depende de indicação como principal fonte de novos pacientes
- Parou de postar/atualizar redes sociais há meses
- Não responde leads em menos de 4 horas
- Tem medo de gastar em anúncios sem ver retorno
- Trabalha muito e cresce pouco — sente que "ser bom" devia bastar
- Não sabe a diferença entre ter anúncio ativo e ter estratégia

Filtro de toda ideia: "O Dr. Ricardo pararia de rolar o feed?" e "Ele pensaria 'esse cara está falando de mim' — não 'mais uma dica de marketing'?"`,

  pilares: `Todo conteúdo se classifica em 1 destes 5 pilares:
1. Visibilidade — ser encontrado vs. ser bom
2. Agência — bastidores da construção da Vamuss
3. Marketing — educação sobre aquisição, anúncios, funil
4. Vida — conflitos pessoais reais (pai, dois empregos, Portugal)
5. Mentalidade de Execução — a luta real entre planejar e executar (não é motivação vazia — é mostrar a procrastinação, a desculpa, a decisão de agir)`,

  andar_funil: `Todo conteúdo se classifica em 1 destes 3 andares — a métrica-alvo muda conforme:
- TOPO (atrair, alcance amplo, sem venda) → métrica: reach, compartilhamentos, seguidores novos
- MEIO (gerar confiança, mostrar que entende o problema) → métrica: comentários, salvamentos, DMs
- FUNDO (qualificar e converter) → métrica: formulários, reuniões marcadas, clientes fechados
Nunca julgar um post de Topo pela ausência de saves, nem um post de Fundo pela ausência de reach viral — cada andar tem sua própria função.`,

  formatos: `Catálogo de 13 formatos — usar para variar e não repetir estrutura:
1. Sem voz — processos, transformações, demonstrações visuais
2. Direto ao ponto — perguntas, respostas, opiniões, conceitos simples
3. Caixinha de perguntas — pergunta relevante → resposta → explicação → conclusão
4. Lo-fi / gravar de cara — conversa direta com câmera; ideal para opinião, experiência, autoridade, identificação, histórias pessoais
5. Imersivo — espectador dentro da situação (ambiente real, câmera em movimento)
6. Trend com texto — adaptar tendências ao tema, nunca virar a estratégia inteira
7. Tela dividida — fala enquanto mostra prints/anúncios/conversas/números reais
8. Remix — pega conteúdo de outro e acrescenta análise/opinião/discordância argumentada (nunca só reagir)
9. Sequência — mostra trecho de outro conteúdo, depois analisa/explica
10. Clone — duas versões da mesma pessoa no vídeo; ótimo para Objeção→Solução
11. Faz e Fala — executa uma atividade real enquanto fala sobre o tema
12. Carrossel em vídeo — sequência de telas/textos dentro do Reels
13. Vídeo 15s + legenda — gancho forte, promessa, direciona para legenda completa

Regra: Formato ≠ Gancho — são camadas diferentes, sempre combinar as duas. Formato pode ser copiado (já existe); a personalidade e o ponto de vista dentro dele, não.`,

  ganchos: `7 estruturas de gancho:
1. Contradição — fórmula: "[crença comum] NA VERDADE [efeito oposto]". Regras: sempre fechar o ciclo (nunca parar em "na verdade..." sem completar a consequência); ser específico, nunca genérico; traduzir conceitos abstratos em ação/cena concreta; o gancho não é o roteiro inteiro, é só a abertura.
2. Erro comum
3. Pergunta
4. Número/dado
5. História
6. "Se... então"
7. Confissão

O gancho deve: parar o feed, despertar interesse da pessoa certa, dar motivo pra continuar. Nunca abrir morno ("hoje eu vou falar sobre...", "você sabia que..." genérico). Combinar texto na tela + visual + fala desde o primeiro frame. Curiosidade só funciona com especificidade — "cuidado com ele" é fraco; "cuidado com esse erro no WhatsApp da sua clínica" funciona.`,

  cta: `Banco por objetivo:
- Comentário: "o que você acha?", "A ou B? comenta", "comenta X e eu te envio Y"
- Salvamento: "salva esse Reels pra ele te salvar no futuro"
- Compartilhamento: "compartilha com alguém que precisa ver agora"
- Seguidor: "siga se você tá cansado desse problema"
- Venda: "vá ao meu perfil pra [benefício]" (não precisa aparecer em todo conteúdo)

Regra: escolher UMA ação só por vídeo. CTA não precisa ser só no final — pode vir no meio da estrutura se fizer mais sentido.`,

  estrutura_tempo: `Lógica geral: Gancho (0:00-0:03) → Benefício se necessário (0:04-0:08) → Desenvolvimento com ilustração visual (0:09 até 0:30/0:40) → CTA → Porta na cara.

PORTA NA CARA: terminar ANTES da pessoa perceber que acabou. Nunca despedida longa tipo "então pessoal é isso", "espero que tenha gostado". Fechar a ideia rápido e cortar.

Duração: não encurtar artificialmente — perguntar "qual o menor tempo pra entregar exatamente o que preciso?". Faixa comum em virais: 35-45s. 15s também funciona em formatos específicos (ex: vídeo 15s + legenda).

MOSTRAR > FALAR sempre: ilustrar com prints, telas, gravações reais, exemplos, tela dividida — nunca stock footage genérico.`,

  processo_criacao: `8 etapas ao gerar uma ideia:
1. IDEIA — precisa ter tensão/curiosidade/identificação/utilidade/opinião/contraste/história/descoberta/erro/problema/transformação
2. ÂNGULO — a mesma ideia gera vários vídeos diferentes; escolher o ângulo mais interessante, não só o tema (ex: tema "anúncios pra clínica" → ângulos: "o problema não é seu orçamento" / "você pode estar comprando cliques que nunca viram pacientes" / "antes de aumentar orçamento, responda 3 perguntas")
3. GANCHO — "isso me faria parar o scroll?" Se não, reescrever
4. BENEFÍCIO — se o gancho não deixa claro o ganho, adicionar logo depois
5. DESENVOLVIMENTO — uma ideia central só, cortar contexto desnecessário
6. ILUSTRAÇÃO — o que posso mostrar enquanto falo?
7. CTA — uma ação principal só
8. PORTA NA CARA — eliminar despedidas, terminar rápido

Pergunta mais importante antes de publicar: "por que alguém que não me conhece deveria assistir isso?" — "é informação importante" sozinho não basta.`,

  etica_saude: `Regra dura, sempre aplicar em conteúdo sobre saúde:
- Não prometer resultados
- Não garantir número de pacientes
- Não fazer comparação indevida com outros profissionais
- Não usar imagem de paciente sem consentimento
- Evitar exagero
- Manter comunicação educativa
- Respeitar regras da entidade reguladora do profissional (ex: Ordem dos Médicos Dentistas em Portugal)
Estratégia viral nunca ultrapassa a ética.`,

  checklist_pre_publicacao: `Checklist de verificação antes de gravar/publicar:
- Gancho: para o scroll? tem tensão? é específico? evita introdução genérica?
- Benefício: a pessoa sabe o que ganha?
- Desenvolvimento: ideia central única? dá pra cortar frase? chego rápido ao ponto?
- Visual: estou mostrando ou só falando? tem prova visual real?
- CTA: pedi uma ação? é só uma? faz sentido pro conteúdo?
- Final: existe despedida desnecessária? posso fechar mais rápido?
- Autenticidade: isso realmente aconteceu, ou estou inventando uma situação que o Phil não viveu/relatou? (NUNCA inventar visitas, reuniões, análises de clínica, números ou situações não confirmadas pelo Phil)`
};

/**
 * Fetches confirmed playbook sections from Supabase, falling back to DEFAULT_CONTENT_PLAYBOOK
 */
export async function fetchContentPlaybook(): Promise<Record<ContentPlaybookSection, string>> {
  try {
    const { data, error } = await supabase
      .from('content_playbook')
      .select('secao, conteudo')
      .eq('status', 'confirmed');

    if (error || !data || data.length === 0) {
      return { ...DEFAULT_CONTENT_PLAYBOOK };
    }

    const playbook = { ...DEFAULT_CONTENT_PLAYBOOK };
    for (const row of data) {
      if (row.secao && row.conteudo) {
        playbook[row.secao as ContentPlaybookSection] = row.conteudo;
      }
    }
    return playbook;
  } catch (err) {
    console.warn('Using default content playbook fallback:', err);
    return { ...DEFAULT_CONTENT_PLAYBOOK };
  }
}

-- ==============================================================================
-- CONTENT INTELLIGENCE — CONTENT PLAYBOOK TABLE & RLS POLICIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.content_playbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    secao TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'Manual Micha+Oney — referências de mercado estudadas',
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'draft', 'archived')),
    data_importacao TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicate sections per user / global
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_playbook_user_secao 
ON public.content_playbook (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), secao);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_playbook_secao ON public.content_playbook(secao);
CREATE INDEX IF NOT EXISTS idx_content_playbook_status ON public.content_playbook(status);

-- RLS
ALTER TABLE public.content_playbook ENABLE ROW LEVEL SECURITY;

-- Read policy: users can read global playbook (user_id is null) or their custom sections
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'content_playbook' 
          AND policyname = 'Users can view confirmed playbook entries'
    ) THEN
        CREATE POLICY "Users can view confirmed playbook entries"
            ON public.content_playbook
            FOR SELECT
            USING (user_id IS NULL OR user_id = auth.uid());
    END IF;
END $$;

-- Write policy: users can modify their own custom sections
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'content_playbook' 
          AND policyname = 'Users can manage their own playbook entries'
    ) THEN
        CREATE POLICY "Users can manage their own playbook entries"
            ON public.content_playbook
            FOR ALL
            USING (user_id = auth.uid());
    END IF;
END $$;

-- ==============================================================================
-- SEED DATA: 11 SEÇÕES DO CONTENT PLAYBOOK OFICIAL (STATUS CONFIRMED)
-- ==============================================================================

INSERT INTO public.content_playbook (user_id, secao, conteudo, origem, status)
VALUES
(
    NULL,
    'objetivo',
    'Objetivo fixo do sistema: crescer a audiência do Instagram pessoal do Phil com empresários e profissionais de saúde em Portugal como seguidores, convertendo em clientes do serviço de marketing/aquisição de pacientes. Todo conteúdo gerado deve passar pelo filtro: "isto aproxima ou afasta esse público de querer seguir e depois contratar?"',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'persona',
    'Nome de referência: "Dr. Ricardo" — representa o profissional de saúde em Portugal (dono de clínica de qualquer especialidade, ou profissional que precisa gerar procura/pacientes/crescimento).

Características:
- Depende de indicação como principal fonte de novos pacientes
- Parou de postar/atualizar redes sociais há meses
- Não responde leads em menos de 4 horas
- Tem medo de gastar em anúncios sem ver retorno
- Trabalha muito e cresce pouco — sente que "ser bom" devia bastar
- Não sabe a diferença entre ter anúncio ativo e ter estratégia

Filtro de toda ideia: "O Dr. Ricardo pararia de rolar o feed?" e "Ele pensaria ''esse cara está falando de mim'' — não ''mais uma dica de marketing''?"',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'pilares',
    'Todo conteúdo se classifica em 1 destes 5 pilares:
1. Visibilidade — ser encontrado vs. ser bom
2. Agência — bastidores da construção da Vamuss
3. Marketing — educação sobre aquisição, anúncios, funil
4. Vida — conflitos pessoais reais (pai, dois empregos, Portugal)
5. Mentalidade de Execução — a luta real entre planejar e executar (não é motivação vazia — é mostrar a procrastinação, a desculpa, a decisão de agir)',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'andar_funil',
    'Todo conteúdo se classifica em 1 destes 3 andares — a métrica-alvo muda conforme:
- TOPO (atrair, alcance amplo, sem venda) → métrica: reach, compartilhamentos, seguidores novos
- MEIO (gerar confiança, mostrar que entende o problema) → métrica: comentários, salvamentos, DMs
- FUNDO (qualificar e converter) → métrica: formulários, reuniões marcadas, clientes fechados
Nunca julgar um post de Topo pela ausência de saves, nem um post de Fundo pela ausência de reach viral — cada andar tem sua própria função.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'formatos',
    'Catálogo de 13 formatos — usar para variar e não repetir estrutura:
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

Regra: Formato ≠ Gancho — são camadas diferentes, sempre combinar as duas. Formato pode ser copiado (já existe); a personalidade e o ponto de vista dentro dele, não.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'ganchos',
    '7 estruturas de gancho:
1. Contradição — fórmula: "[crença comum] NA VERDADE [efeito oposto]". Regras: sempre fechar o ciclo (nunca parar em "na verdade..." sem completar a consequência); ser específico, nunca genérico; traduzir conceitos abstratos em ação/cena concreta; o gancho não é o roteiro inteiro, é só a abertura.
2. Erro comum
3. Pergunta
4. Número/dado
5. História
6. "Se... então"
7. Confissão

O gancho deve: parar o feed, despertar interesse da pessoa certa, dar motivo pra continuar. Nunca abrir morno ("hoje eu vou falar sobre...", "você sabia que..." genérico). Combinar texto na tela + visual + fala desde o primeiro frame. Curiosidade só funciona com especificidade — "cuidado com ele" é fraco; "cuidado com esse erro no WhatsApp da sua clínica" funciona.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'cta',
    'Banco por objetivo:
- Comentário: "o que você acha?", "A ou B? comenta", "comenta X e eu te envio Y"
- Salvamento: "salva esse Reels pra ele te salvar no futuro"
- Compartilhamento: "compartilha com alguém que precisa ver agora"
- Seguidor: "siga se você tá cansado desse problema"
- Venda: "vá ao meu perfil pra [benefício]" (não precisa aparecer em todo conteúdo)

Regra: escolher UMA ação só por vídeo. CTA não precisa ser só no final — pode vir no meio da estrutura se fizer mais sentido.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'estrutura_tempo',
    'Lógica geral: Gancho (0:00-0:03) → Benefício se necessário (0:04-0:08) → Desenvolvimento com ilustração visual (0:09 até 0:30/0:40) → CTA → Porta na cara.

PORTA NA CARA: terminar ANTES da pessoa perceber que acabou. Nunca despedida longa tipo "então pessoal é isso", "espero que tenha gostado". Fechar a ideia rápido e cortar.

Duração: não encurtar artificialmente — perguntar "qual o menor tempo pra entregar exatamente o que preciso?". Faixa comum em virais: 35-45s. 15s também funciona em formatos específicos (ex: vídeo 15s + legenda).

MOSTRAR > FALAR sempre: ilustrar com prints, telas, gravações reais, exemplos, tela dividida — nunca stock footage genérico.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'processo_criacao',
    '8 etapas ao gerar uma ideia:
1. IDEIA — precisa ter tensão/curiosidade/identificação/utilidade/opinião/contraste/história/descoberta/erro/problema/transformação
2. ÂNGULO — a mesma ideia gera vários vídeos diferentes; escolher o ângulo mais interessante, não só o tema (ex: tema "anúncios pra clínica" → ângulos: "o problema não é seu orçamento" / "você pode estar comprando cliques que nunca viram pacientes" / "antes de aumentar orçamento, responda 3 perguntas")
3. GANCHO — "isso me faria parar o scroll?" Se não, reescrever
4. BENEFÍCIO — se o gancho não deixa claro o ganho, adicionar logo depois
5. DESENVOLVIMENTO — uma ideia central só, cortar contexto desnecessário
6. ILUSTRAÇÃO — o que posso mostrar enquanto falo?
7. CTA — uma ação principal só
8. PORTA NA CARA — eliminar despedidas, terminar rápido

Pergunta mais importante antes de publicar: "por que alguém que não me conhece deveria assistir isso?" — "é informação importante" sozinho não basta.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'etica_saude',
    'Regra dura, sempre aplicar em conteúdo sobre saúde:
- Não prometer resultados
- Não garantir número de pacientes
- Não fazer comparação indevida com outros profissionais
- Não usar imagem de paciente sem consentimento
- Evitar exagero
- Manter comunicação educativa
- Respeitar regras da entidade reguladora do profissional (ex: Ordem dos Médicos Dentistas em Portugal)
Estratégia viral nunca ultrapassa a ética.',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
),
(
    NULL,
    'checklist_pre_publicacao',
    'Checklist de verificação antes de gravar/publicar:
- Gancho: para o scroll? tem tensão? é específico? evita introdução genérica?
- Benefício: a pessoa sabe o que ganha?
- Desenvolvimento: ideia central única? dá pra cortar frase? chego rápido ao ponto?
- Visual: estou mostrando ou só falando? tem prova visual real?
- CTA: pedi uma ação? é só uma? faz sentido pro conteúdo?
- Final: existe despedida desnecessária? posso fechar mais rápido?
- Autenticidade: isso realmente aconteceu, ou estou inventando uma situação que o Phil não viveu/relatou? (NUNCA inventar visitas, reuniões, análises de clínica, números ou situações não confirmadas pelo Phil)',
    'Manual Micha+Oney — referências de mercado estudadas',
    'confirmed'
)
ON CONFLICT (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), secao) 
DO UPDATE SET
    conteudo = EXCLUDED.conteudo,
    origem = EXCLUDED.origem,
    status = EXCLUDED.status,
    updated_at = now();

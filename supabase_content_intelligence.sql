-- ==============================================================================
-- SISTEMA DE INTELIGÊNCIA EDITORIAL E CONTEÚDO VAMUSS
-- TABELAS: IDEIAS, REFERÊNCIAS, GANCHOS E PROPOSTAS
-- ==============================================================================

-- 1. TABELA DE GANCHOS (BIBLIOTECA CENTRALIZADA)
CREATE TABLE IF NOT EXISTS public.content_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Geral',
    mechanism TEXT NOT NULL DEFAULT 'Curiosidade',
    context TEXT DEFAULT '',
    example TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    usage_count INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_hooks_user_cat ON public.content_hooks(user_id, category);
CREATE INDEX IF NOT EXISTS idx_content_hooks_user_archived ON public.content_hooks(user_id, is_archived);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_hooks_user_text ON public.content_hooks(user_id, lower(trim(text)));

ALTER TABLE public.content_hooks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_hooks' AND policyname = 'Users can manage their own content hooks'
    ) THEN
        CREATE POLICY "Users can manage their own content hooks"
            ON public.content_hooks
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. TABELA DE IDEIAS PRÓPRIAS
CREATE TABLE IF NOT EXISTS public.content_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_idea TEXT NOT NULL,
    target_audience TEXT DEFAULT '',
    personal_context TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    preferred_format TEXT DEFAULT 'aberto',
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
    error_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_ideas_user_status ON public.content_ideas(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_created ON public.content_ideas(user_id, created_at DESC);

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_ideas' AND policyname = 'Users can manage their own content ideas'
    ) THEN
        CREATE POLICY "Users can manage their own content ideas"
            ON public.content_ideas
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 3. TABELA DE REFERÊNCIAS EXTERNAS (REELS, TIKTOKS, CARROSSÉIS)
CREATE TABLE IF NOT EXISTS public.content_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT DEFAULT '',
    platform TEXT DEFAULT 'instagram',
    notes TEXT DEFAULT '',
    video_file_url TEXT DEFAULT '',
    media_urls TEXT[] DEFAULT '{}'::text[],
    transcript TEXT DEFAULT '',
    has_accessible_media BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'requer_material', 'concluido', 'erro')),
    error_message TEXT DEFAULT '',
    analysis JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_references_user_status ON public.content_references(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_references_user_created ON public.content_references(user_id, created_at DESC);

ALTER TABLE public.content_references ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_references' AND policyname = 'Users can manage their own references'
    ) THEN
        CREATE POLICY "Users can manage their own references"
            ON public.content_references
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. TABELA DE PROPOSTAS EDITORIAIS
CREATE TABLE IF NOT EXISTS public.content_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idea_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
    reference_id UUID NULL REFERENCES public.content_references(id) ON DELETE SET NULL,
    card_id UUID NULL REFERENCES public.content_cards(id) ON DELETE SET NULL,
    
    -- GRELHA OFICIAL DAS 4 COLUNAS
    angulo TEXT NOT NULL,
    ideia_melhorada TEXT NOT NULL,
    gancho_base TEXT NOT NULL,
    retencao_hook TEXT NOT NULL,
    
    -- DETALHES COMPLETOS DA PROPOSTA
    titulo TEXT NOT NULL,
    formato TEXT NOT NULL DEFAULT 'Reel',
    objetivo TEXT DEFAULT '',
    publico_alvo TEXT DEFAULT '',
    gancho_verbal TEXT DEFAULT '',
    gancho_visual TEXT DEFAULT '',
    roteiro_slides TEXT DEFAULT '',
    sugestoes_cenas TEXT DEFAULT '',
    sugestoes_enquadramento TEXT DEFAULT '',
    sugestoes_edicao TEXT DEFAULT '',
    texto_tela TEXT DEFAULT '',
    cta TEXT DEFAULT '',
    justificativa_estrategica TEXT DEFAULT '',
    limitacoes_hipoteses TEXT DEFAULT '',
    ganchos_utilizados TEXT[] DEFAULT '{}'::text[],
    
    -- DECISÃO EDITORIAL HUMANA
    status_aprovacao TEXT NOT NULL DEFAULT 'rascunho' CHECK (status_aprovacao IN ('rascunho', 'aprovado_desenvolver', 'testar_alteracoes', 'guardar_mais_tarde', 'descartado')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_proposals_user_status ON public.content_proposals(user_id, status_aprovacao);
CREATE INDEX IF NOT EXISTS idx_content_proposals_idea ON public.content_proposals(idea_id);
CREATE INDEX IF NOT EXISTS idx_content_proposals_ref ON public.content_proposals(reference_id);
CREATE INDEX IF NOT EXISTS idx_content_proposals_card ON public.content_proposals(card_id);

ALTER TABLE public.content_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_proposals' AND policyname = 'Users can manage their own proposals'
    ) THEN
        CREATE POLICY "Users can manage their own proposals"
            ON public.content_proposals
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 5. TABELA DE SESSÕES DO MELHORADOR DE IDEIAS
CREATE TABLE IF NOT EXISTS public.content_improved_ideas (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step IN (1, 2, 3)),
    raw_idea TEXT NOT NULL,
    target_audience TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    context TEXT DEFAULT '',
    grid_proposals JSONB DEFAULT '[]'::jsonb,
    selected_approach_id TEXT,
    format_proposals JSONB DEFAULT '[]'::jsonb,
    selected_format_id TEXT,
    developed_proposal JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluido', 'enviado_kanban')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_content_improved_ideas_user ON public.content_improved_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_content_improved_ideas_updated ON public.content_improved_ideas(user_id, updated_at DESC);

ALTER TABLE public.content_improved_ideas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_improved_ideas' AND policyname = 'Users can manage their own improved ideas'
    ) THEN
        CREATE POLICY "Users can manage their own improved ideas"
            ON public.content_improved_ideas
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;


-- ==============================================================================
-- CONTENT INTELLIGENCE — CONTENT OPPORTUNITIES & SOURCES (ETAPA 4)
-- ==============================================================================

-- 1. Tabela de Oportunidades de Conteúdo
CREATE TABLE IF NOT EXISTS public.content_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    why_now TEXT DEFAULT '',
    opportunity_type TEXT NOT NULL DEFAULT 'conexao' 
        CHECK (opportunity_type IN ('experiencia', 'dor_comercial', 'insight', 'opiniao', 'educacional', 'tendencia', 'conexao')),
    status TEXT NOT NULL DEFAULT 'nova' 
        CHECK (status IN ('nova', 'vista', 'aceita', 'descartada', 'convertida')),
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    score INTEGER NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    connected_idea_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Fontes Relacionadas (Rastreabilidade das Conexões)
CREATE TABLE IF NOT EXISTS public.content_opportunity_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.content_opportunities(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL 
        CHECK (source_type IN ('daily', 'crm_signal', 'content_idea', 'reference', 'performance')),
    source_id UUID NULL,
    source_context TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_content_opps_user_created ON public.content_opportunities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_opps_user_status ON public.content_opportunities(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_opps_user_score ON public.content_opportunities(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_content_opp_sources_opp ON public.content_opportunity_sources(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_content_opp_sources_source ON public.content_opportunity_sources(source_type, source_id);

-- 4. Atualizar restrição de content_ideas para permitir source_type = 'opportunity'
ALTER TABLE public.content_ideas DROP CONSTRAINT IF EXISTS content_ideas_source_type_check;
ALTER TABLE public.content_ideas ADD CONSTRAINT content_ideas_source_type_check 
    CHECK (source_type IN ('manual', 'daily', 'crm_signal', 'reference', 'ai_suggestion', 'opportunity'));

-- Garantir idempotência na conversão oportunidade -> ideia
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_ideas_opportunity 
    ON public.content_ideas (source_id) 
    WHERE source_type = 'opportunity';

-- 5. Row Level Security (RLS)
ALTER TABLE public.content_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_opportunity_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_opportunities' 
        AND policyname = 'Users can manage their own opportunities'
    ) THEN
        CREATE POLICY "Users can manage their own opportunities"
            ON public.content_opportunities
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_opportunity_sources' 
        AND policyname = 'Users can manage sources of their opportunities'
    ) THEN
        CREATE POLICY "Users can manage sources of their opportunities"
            ON public.content_opportunity_sources
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.content_opportunities o 
                    WHERE o.id = opportunity_id AND o.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.content_opportunities o 
                    WHERE o.id = opportunity_id AND o.user_id = auth.uid()
                )
            );
    END IF;
END $$;

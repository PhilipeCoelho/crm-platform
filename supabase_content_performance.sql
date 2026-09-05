-- ==============================================================================
-- CONTENT INTELLIGENCE — PERFORMANCE & LEARNING ENGINE SCHEMA (ETAPA 7)
-- ==============================================================================

-- 1. Tabela de Análises de Performance por Conteúdo
CREATE TABLE IF NOT EXISTS public.content_performance_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_idea_id UUID NOT NULL REFERENCES public.content_ideas(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'analyzed')),
    analysis JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    analyzed_at TIMESTAMPTZ NULL
);

-- Índices para Análises de Performance
CREATE INDEX IF NOT EXISTS idx_content_perf_user_created ON public.content_performance_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_perf_user_idea ON public.content_performance_analyses(user_id, content_idea_id);
CREATE INDEX IF NOT EXISTS idx_content_perf_user_status ON public.content_performance_analyses(user_id, status);

-- Habilitar RLS em content_performance_analyses
ALTER TABLE public.content_performance_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_performance_analyses' 
        AND policyname = 'Users can manage their own performance analyses'
    ) THEN
        CREATE POLICY "Users can manage their own performance analyses"
            ON public.content_performance_analyses
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;


-- 2. Tabela de Aprendizados Acumulados (Learning Engine)
CREATE TABLE IF NOT EXISTS public.content_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_content_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
    learning TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('hook', 'angle', 'format', 'topic', 'cta', 'structure', 'audience', 'timing', 'general')),
    evidence TEXT NULL,
    confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'discarded')),
    application TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para Aprendizados
CREATE INDEX IF NOT EXISTS idx_content_learnings_user_created ON public.content_learnings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_learnings_user_source ON public.content_learnings(user_id, source_content_id);
CREATE INDEX IF NOT EXISTS idx_content_learnings_user_status ON public.content_learnings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_learnings_user_type ON public.content_learnings(user_id, type);

-- Habilitar RLS em content_learnings
ALTER TABLE public.content_learnings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_learnings' 
        AND policyname = 'Users can manage their own content learnings'
    ) THEN
        CREATE POLICY "Users can manage their own content learnings"
            ON public.content_learnings
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ==============================================================================
-- CONTENT INTELLIGENCE — CONTENT IDEAS TABLE & RLS POLICIES (ETAPA 3)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.content_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    format TEXT CHECK (format IS NULL OR format IN ('reel', 'carrossel', 'post', 'story', 'artigo')),
    status TEXT NOT NULL DEFAULT 'capturada' CHECK (status IN ('capturada', 'validada', 'em_producao', 'descartada')),
    priority INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
    source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'daily', 'crm_signal', 'reference', 'ai_suggestion')),
    source_id UUID NULL,
    tags TEXT[] DEFAULT '{}'::text[],
    insight_ids UUID[] DEFAULT '{}'::uuid[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices otimizados para busca, listagem e filtros
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_created ON public.content_ideas(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_status ON public.content_ideas(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_source ON public.content_ideas(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_priority ON public.content_ideas(user_id, priority DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

-- Políticas de isolamento rígido por usuário
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_ideas' 
        AND policyname = 'Users can manage their own ideas'
    ) THEN
        CREATE POLICY "Users can manage their own ideas"
            ON public.content_ideas
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

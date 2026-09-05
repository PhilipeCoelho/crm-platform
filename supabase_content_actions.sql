-- ==============================================================================
-- CONTENT INTELLIGENCE — INTELLIGENCE ORCHESTRATION & CONTENT ACTIONS (ETAPA 8)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.content_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'analisar_performance',
        'registrar_metricas',
        'analisar_referencia',
        'usar_oportunidade',
        'continuar_producao',
        'criar_ideia',
        'aplicar_aprendizado',
        'revisar_aprendizado'
    )),
    title TEXT NOT NULL,
    description TEXT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    score NUMERIC NULL,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN (
        'suggested',
        'accepted',
        'completed',
        'dismissed'
    )),
    source_type TEXT NOT NULL CHECK (source_type IN (
        'content_idea',
        'content_opportunity',
        'content_reference',
        'content_learning',
        'daily',
        'crm_signal'
    )),
    source_id UUID NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);

-- Índices otimizados para busca de ações ativas e ordenação por prioridade/score
CREATE INDEX IF NOT EXISTS idx_content_actions_user_status ON public.content_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_actions_user_priority ON public.content_actions(user_id, priority, score DESC);
CREATE INDEX IF NOT EXISTS idx_content_actions_user_source ON public.content_actions(user_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_content_actions_user_created ON public.content_actions(user_id, created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.content_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_actions' 
        AND policyname = 'Users can manage their own content actions'
    ) THEN
        CREATE POLICY "Users can manage their own content actions"
            ON public.content_actions
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

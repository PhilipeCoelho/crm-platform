-- ==============================================================================
-- CONTENT INTELLIGENCE — EXECUTION QUEUE & KANBAN (ETAPA 5)
-- ==============================================================================

-- 1. Ampliar a tabela content_ideas com campos de ciclo operacional e workspace
ALTER TABLE public.content_ideas 
    ADD COLUMN IF NOT EXISTS execution_stage TEXT NULL 
        CHECK (execution_stage IS NULL OR execution_stage IN ('producao', 'gravado', 'publicado', 'aguardando_metricas', 'analisado')),
    ADD COLUMN IF NOT EXISTS next_action TEXT NULL,
    ADD COLUMN IF NOT EXISTS hook TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS angle TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS body_script TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS cta TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS platform TEXT NULL 
        CHECK (platform IS NULL OR platform IN ('instagram', 'linkedin', 'youtube', 'tiktok', 'twitter', 'blog', 'outro')),
    ADD COLUMN IF NOT EXISTS publication_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS metrics_recorded_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Índices de alta performance para a Fila de Execução e Kanban
CREATE INDEX IF NOT EXISTS idx_content_ideas_user_stage 
    ON public.content_ideas(user_id, execution_stage) 
    WHERE execution_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_ideas_user_wip 
    ON public.content_ideas(user_id, execution_stage) 
    WHERE execution_stage = 'producao';

CREATE INDEX IF NOT EXISTS idx_content_ideas_stage_updated 
    ON public.content_ideas(user_id, stage_updated_at DESC);

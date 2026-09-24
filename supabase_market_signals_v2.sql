-- ==============================================================================
-- MIGRATION: MARKET SIGNALS V2 & CONTENT MEMORY
-- Evolui insights_comerciais para Radar de Mercado e cria tabela content_memory
-- ==============================================================================

-- 1. Expansão da tabela insights_comerciais com os novos campos estruturados
ALTER TABLE public.insights_comerciais
    -- Fatos & Citações
    ADD COLUMN IF NOT EXISTS fact TEXT NULL,
    ADD COLUMN IF NOT EXISTS context TEXT NULL,
    ADD COLUMN IF NOT EXISTS quote_original TEXT NULL,
    ADD COLUMN IF NOT EXISTS quote_context TEXT NULL,
    
    -- Camada Psicológica & Decisão
    ADD COLUMN IF NOT EXISTS belief TEXT NULL,
    ADD COLUMN IF NOT EXISTS desired_belief TEXT NULL,
    ADD COLUMN IF NOT EXISTS desired_outcome TEXT NULL,
    ADD COLUMN IF NOT EXISTS fear TEXT NULL,
    ADD COLUMN IF NOT EXISTS behavior TEXT NULL,
    ADD COLUMN IF NOT EXISTS tension TEXT NULL,
    ADD COLUMN IF NOT EXISTS consequence TEXT NULL,
    ADD COLUMN IF NOT EXISTS business_impact TEXT NULL,
    
    -- Metadados & Classificação do Sinal
    ADD COLUMN IF NOT EXISTS signal_type TEXT NULL 
        CHECK (signal_type IS NULL OR signal_type IN (
            'recurring_pain', 'emerging_problem', 'strong_objection', 
            'surprising_behavior', 'market_misconception', 'customer_language', 
            'success_pattern', 'failure_pattern', 'competitive_gap', 
            'unmet_desire', 'unexpected_result', 'contradiction', 'new_pattern'
        )),
    ADD COLUMN IF NOT EXISTS topic TEXT NULL,
    ADD COLUMN IF NOT EXISTS angles_used TEXT[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS angles_available TEXT[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS signal_status TEXT NULL 
        CHECK (signal_status IS NULL OR signal_status IN ('evergreen', 'growing', 'emerging', 'declining', 'saturated')),
        
    -- Pontuações Multidimensionais
    ADD COLUMN IF NOT EXISTS novelty_score INTEGER NULL CHECK (novelty_score IS NULL OR (novelty_score >= 0 AND novelty_score <= 100)),
    ADD COLUMN IF NOT EXISTS specificity_score INTEGER NULL CHECK (specificity_score IS NULL OR (specificity_score >= 0 AND specificity_score <= 100)),
    ADD COLUMN IF NOT EXISTS tension_score INTEGER NULL CHECK (tension_score IS NULL OR (tension_score >= 0 AND tension_score <= 100)),
    ADD COLUMN IF NOT EXISTS evidence_strength INTEGER NULL CHECK (evidence_strength IS NULL OR (evidence_strength >= 0 AND evidence_strength <= 100)),
    ADD COLUMN IF NOT EXISTS commercial_relevance INTEGER NULL CHECK (commercial_relevance IS NULL OR (commercial_relevance >= 0 AND commercial_relevance <= 100)),
    ADD COLUMN IF NOT EXISTS audience_relevance INTEGER NULL CHECK (audience_relevance IS NULL OR (audience_relevance >= 0 AND audience_relevance <= 100)),
    ADD COLUMN IF NOT EXISTS source_diversity INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS content_saturation_score INTEGER DEFAULT 0 CHECK (content_saturation_score >= 0 AND content_saturation_score <= 100),
    
    -- Versionamento e Calibração
    ADD COLUMN IF NOT EXISTS classifier_version TEXT DEFAULT 'v2.0-market-radar',
    ADD COLUMN IF NOT EXISTS taxonomy_version TEXT DEFAULT '2026.09',
    ADD COLUMN IF NOT EXISTS confidence_by_field JSONB DEFAULT '{}'::jsonb;

-- Índices otimizados para busca e relatórios
CREATE INDEX IF NOT EXISTS idx_insights_topic ON public.insights_comerciais(topic);
CREATE INDEX IF NOT EXISTS idx_insights_signal_type ON public.insights_comerciais(signal_type);
CREATE INDEX IF NOT EXISTS idx_insights_signal_status ON public.insights_comerciais(signal_status);
CREATE INDEX IF NOT EXISTS idx_insights_classifier_version ON public.insights_comerciais(classifier_version);
CREATE INDEX IF NOT EXISTS idx_insights_tension ON public.insights_comerciais(user_id) WHERE tension IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insights_quote ON public.insights_comerciais(user_id) WHERE quote_original IS NOT NULL;

-- 2. Tabela de Memória Editorial de Conteúdo (Content Memory)
CREATE TABLE IF NOT EXISTS public.content_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID NULL,
    topic TEXT NOT NULL,
    market_signal_id UUID NULL REFERENCES public.insights_comerciais(id) ON DELETE SET NULL,
    angle TEXT NOT NULL,
    format TEXT NULL,
    funnel_stage TEXT NULL,
    pillar TEXT NULL,
    published_at TIMESTAMPTZ NULL,
    metrics JSONB DEFAULT '{}'::jsonb,
    angle_status TEXT NOT NULL DEFAULT 'explorado' 
        CHECK (angle_status IN ('explorado', 'parcialmente_explorado', 'nao_explorado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para Content Memory
CREATE INDEX IF NOT EXISTS idx_content_memory_user_topic ON public.content_memory(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_content_memory_angle ON public.content_memory(topic, angle);
CREATE INDEX IF NOT EXISTS idx_content_memory_published ON public.content_memory(user_id, published_at DESC);

-- Chave estrangeira condicional para content_ideas (se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'content_ideas'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_content_memory_content_id'
        ) THEN
            ALTER TABLE public.content_memory 
            ADD CONSTRAINT fk_content_memory_content_id 
            FOREIGN KEY (content_id) REFERENCES public.content_ideas(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Habilitar RLS em content_memory
ALTER TABLE public.content_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_memory' 
        AND policyname = 'Users can manage their own content memory'
    ) THEN
        CREATE POLICY "Users can manage their own content memory"
            ON public.content_memory
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

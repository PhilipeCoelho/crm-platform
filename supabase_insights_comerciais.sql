-- MIGRATION: CREATE INSIGHTS_COMERCIAIS TABLE (UPDATED WITH 5 ADJUSTMENTS)
-- This table stores commercial insights extracted by AI from deal and activity notes.

CREATE TABLE IF NOT EXISTS public.insights_comerciais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    negocio_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    atividade_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    texto_origem TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('dor', 'objecao', 'barreira_acesso', 'motivo_perda', 'motivo_ganho', 'neutro')),
    tags_tematicas TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    subcategoria TEXT NOT NULL,
    resumo TEXT NOT NULL,
    confianca DOUBLE PRECISION CHECK (confianca >= 0.0 AND confianca <= 1.0),
    revisar_manualmente BOOLEAN DEFAULT FALSE NOT NULL,
    classificacao_falhou BOOLEAN DEFAULT FALSE NOT NULL,
    erro_classificacao TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.insights_comerciais ENABLE ROW LEVEL SECURITY;

-- Policy to ensure users can only access their own insights
DROP POLICY IF EXISTS "Users can manage own insights" ON public.insights_comerciais;
CREATE POLICY "Users can manage own insights" ON public.insights_comerciais
    FOR ALL USING (auth.uid() = user_id);

-- Indices
CREATE INDEX IF NOT EXISTS idx_insights_negocio_id ON public.insights_comerciais(negocio_id);
CREATE INDEX IF NOT EXISTS idx_insights_categoria ON public.insights_comerciais(categoria);
CREATE INDEX IF NOT EXISTS idx_insights_criado_em ON public.insights_comerciais(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_insights_tags_tematicas ON public.insights_comerciais USING GIN(tags_tematicas);
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON public.insights_comerciais(user_id);

-- Unique index to prevent duplicate insights (handles NULLs correctly using COALESCE and md5 for text)
CREATE UNIQUE INDEX IF NOT EXISTS uq_insights_origem_coalesce ON public.insights_comerciais (
    COALESCE(atividade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(negocio_id, '00000000-0000-0000-0000-000000000000'::uuid),
    md5(texto_origem)
);

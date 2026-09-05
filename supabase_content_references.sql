-- ==============================================================================
-- CONTENT INTELLIGENCE — CONTENT REFERENCES TABLE & RLS POLICIES (ETAPA 6)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.content_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    platform TEXT NULL CHECK (platform IS NULL OR platform IN ('instagram','youtube','tiktok','linkedin','twitter','facebook','blog','outro')),
    title TEXT NULL,
    author TEXT NULL,
    description TEXT NULL,
    thumbnail_url TEXT NULL,
    notes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'salva' CHECK (status IN ('salva','analisando','analisada','arquivada')),
    analysis JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    analyzed_at TIMESTAMPTZ NULL,
    UNIQUE(user_id, url)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_references_user_created ON public.content_references(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_references_user_status ON public.content_references(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_references_user_platform ON public.content_references(user_id, platform);

-- RLS
ALTER TABLE public.content_references ENABLE ROW LEVEL SECURITY;

-- Policy with DO $$ block checking pg_policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'content_references' 
          AND policyname = 'Users can manage their own references'
    ) THEN
        CREATE POLICY "Users can manage their own references"
            ON public.content_references
            FOR ALL
            USING (auth.uid() = user_id);
    END IF;
END $$;

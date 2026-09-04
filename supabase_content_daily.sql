-- ==============================================================================
-- CONTENT INTELLIGENCE — DAILY ENTRIES TABLE & RLS POLICIES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.content_daily_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
    raw_content TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('text', 'voice', 'crm_sync', 'file')),
    activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    ai_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'processed', 'failed', 'skipped')),
    ai_summary TEXT,
    ai_signals JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de alta performance para busca e timeline cronológica
CREATE INDEX IF NOT EXISTS idx_content_daily_user_date ON public.content_daily_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_content_daily_created_at ON public.content_daily_entries(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.content_daily_entries ENABLE ROW LEVEL SECURITY;

-- Políticas de isolamento por usuário
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'content_daily_entries' 
        AND policyname = 'Users can manage their own daily entries'
    ) THEN
        CREATE POLICY "Users can manage their own daily entries"
            ON public.content_daily_entries
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ==============================================================================
-- CONTENT KANBAN — COLUNAS E CARTÕES COM RLS
-- CRM VAMUSS
-- ==============================================================================

-- 1. Tabela de Colunas do Kanban de Conteúdo
CREATE TABLE IF NOT EXISTS public.content_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para colunas
CREATE INDEX IF NOT EXISTS idx_content_columns_user_order 
    ON public.content_columns(user_id, order_index ASC);

-- Habilitar RLS em content_columns
ALTER TABLE public.content_columns ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para content_columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_columns' AND policyname = 'Users can manage their own content columns'
    ) THEN
        CREATE POLICY "Users can manage their own content columns"
            ON public.content_columns
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Tabela de Cartões do Kanban de Conteúdo
CREATE TABLE IF NOT EXISTS public.content_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES public.content_columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    completed BOOLEAN NOT NULL DEFAULT false,
    due_date TIMESTAMPTZ NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL;

-- Índices para cartões
CREATE INDEX IF NOT EXISTS idx_content_cards_user_col_order 
    ON public.content_cards(user_id, column_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_content_cards_column_id 
    ON public.content_cards(column_id);

-- Habilitar RLS em content_cards
ALTER TABLE public.content_cards ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para content_cards
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'content_cards' AND policyname = 'Users can manage their own content cards'
    ) THEN
        CREATE POLICY "Users can manage their own content cards"
            ON public.content_cards
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

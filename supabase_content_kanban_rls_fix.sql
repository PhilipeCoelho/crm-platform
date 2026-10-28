-- ==============================================================================
-- CORREÇÃO DE POLÍTICAS RLS — KANBAN DE CONTEÚDO (CRM VAMUSS)
-- ==============================================================================
-- Este script garante acesso total para operações do CRM via chave pública (anon)
-- e utilizadores autenticados, prevenindo que cartões ou colunas sejam bloqueados.

-- 1. Colunas de Conteúdo
ALTER TABLE public.content_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own content columns" ON public.content_columns;
DROP POLICY IF EXISTS "Allow all access to content_columns" ON public.content_columns;
DROP POLICY IF EXISTS "Allow anon and auth all access to content_columns" ON public.content_columns;

CREATE POLICY "Allow anon and auth all access to content_columns"
    ON public.content_columns
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 2. Cartões de Conteúdo
ALTER TABLE public.content_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own content cards" ON public.content_cards;
DROP POLICY IF EXISTS "Allow all access to content_cards" ON public.content_cards;
DROP POLICY IF EXISTS "Allow anon and auth all access to content_cards" ON public.content_cards;

CREATE POLICY "Allow anon and auth all access to content_cards"
    ON public.content_cards
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 3. Confirmação de colunas necessárias
ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL;

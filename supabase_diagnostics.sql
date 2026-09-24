-- ==============================================================================
-- MIGRAÇÃO SUPABASE: DIAGNÓSTICO ESTRATÉGICO DE PRESENÇA E AQUISIÇÃO VAMUSS__
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Dados Declarados no Formulário
    instagram_url TEXT,
    website_url TEXT,
    city TEXT,
    municipality TEXT,
    primary_goal TEXT,
    primary_challenge TEXT,
    monthly_media_budget TEXT,
    average_patient_value TEXT,
    clinic_capacity TEXT,
    number_of_rooms TEXT,
    response_time TEXT,
    
    -- Scores Explicáveis (0–100)
    overall_score INTEGER DEFAULT 0,
    presence_score INTEGER DEFAULT 0,
    content_score INTEGER DEFAULT 0,
    conversion_score INTEGER DEFAULT 0,
    local_discovery_score INTEGER DEFAULT 0,
    tracking_score INTEGER DEFAULT 0,
    acquisition_readiness_score INTEGER DEFAULT 0,
    score_factors JSONB DEFAULT '[]'::jsonb,
    
    -- Análises Estruturadas por Pilar (JSONB)
    instagram_analysis JSONB DEFAULT '{}'::jsonb,
    website_analysis JSONB DEFAULT '{}'::jsonb,
    google_analysis JSONB DEFAULT '{}'::jsonb,
    seo_analysis JSONB DEFAULT '{}'::jsonb,
    tracking_analysis JSONB DEFAULT '{}'::jsonb,
    acquisition_analysis JSONB DEFAULT '{}'::jsonb,
    
    -- Entregáveis Estratégicos & Análise de Fuga (Claude)
    leakage_points JSONB DEFAULT '[]'::jsonb,
    top_opportunities JSONB DEFAULT '[]'::jsonb,
    meeting_questions JSONB DEFAULT '[]'::jsonb,
    strategy_hypothesis JSONB DEFAULT '{}'::jsonb,
    client_report JSONB DEFAULT '{}'::jsonb,
    internal_report TEXT,
    
    -- Workflow e Auditoria
    status TEXT DEFAULT 'completed', -- 'started', 'collecting', 'analyzing', 'completed', 'failed', 'review_required'
    reviewed_by_vamuss BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_diagnostics_contact_id ON public.diagnostics(contact_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_deal_id ON public.diagnostics(deal_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_user_id ON public.diagnostics(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_created_at ON public.diagnostics(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Usuários Autenticados no CRM
DROP POLICY IF EXISTS "Users can manage their diagnostics" ON public.diagnostics;
CREATE POLICY "Users can manage their diagnostics"
    ON public.diagnostics FOR ALL
    USING (auth.uid() = user_id);

-- Políticas para Inserção e Leitura da Landing Page e Vercel API
DROP POLICY IF EXISTS "Allow anon insert diagnostics" ON public.diagnostics;
CREATE POLICY "Allow anon insert diagnostics"
    ON public.diagnostics FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select diagnostics" ON public.diagnostics;
CREATE POLICY "Allow anon select diagnostics"
    ON public.diagnostics FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow anon update diagnostics" ON public.diagnostics;
CREATE POLICY "Allow anon update diagnostics"
    ON public.diagnostics FOR UPDATE
    TO anon, authenticated, service_role
    USING (true);

-- Garante a coluna leakage_points caso a tabela já tenha sido criada anteriormente
ALTER TABLE public.diagnostics ADD COLUMN IF NOT EXISTS leakage_points JSONB DEFAULT '[]'::jsonb;

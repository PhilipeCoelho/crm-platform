-- ============================================================================
-- VAMUSS SDR + CLOSER — B.14.2 / B.14.2.1: MIGRAÇÃO COMPLETA DE PERSISTÊNCIA SUPABASE
-- ============================================================================
-- 1. Garante que sdr_outcomes possui a coluna metadata JSONB e colunas de auditoria
-- 2. Cria tabela sdr_conversations para histórico conversacional multi-turno
-- 3. Cria tabela sdr_costs para auditoria atómica de despesa OpenAI e WhatsApp
-- 4. Cria tabela sdr_learning para persistência remota da memória e insights
-- 5. Configura RLS e permissões para anon, authenticated e service_role
-- ============================================================================

-- 1. Atualizar sdr_outcomes com metadata e colunas de custos e tokens
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sdr_outcomes' AND column_name='metadata') THEN
        ALTER TABLE public.sdr_outcomes ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sdr_outcomes' AND column_name='whatsapp_cost_actual') THEN
        ALTER TABLE public.sdr_outcomes ADD COLUMN whatsapp_cost_actual NUMERIC(10,4) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sdr_outcomes' AND column_name='openai_total_tokens') THEN
        ALTER TABLE public.sdr_outcomes ADD COLUMN openai_total_tokens INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Tabela sdr_conversations (histórico de mensagens, intenções e respostas)
CREATE TABLE IF NOT EXISTS public.sdr_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    channel TEXT NOT NULL DEFAULT 'WHATSAPP',
    message_text TEXT NOT NULL,
    wamid TEXT,
    intent TEXT,
    confidence TEXT,
    spin_phase TEXT,
    requires_human BOOLEAN DEFAULT false,
    cost_est NUMERIC(10,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_conversations_deal_id ON public.sdr_conversations(deal_id);
CREATE INDEX IF NOT EXISTS idx_sdr_conversations_phone ON public.sdr_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_sdr_conversations_created_at ON public.sdr_conversations(created_at DESC);

-- 3. Tabela sdr_costs (auditoria de despesas atómicas de IA e canais)
CREATE TABLE IF NOT EXISTS public.sdr_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date_bucket DATE NOT NULL DEFAULT CURRENT_DATE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('OPENAI', 'WHATSAPP')),
    category TEXT,
    amount_eur NUMERIC(10,4) NOT NULL,
    tokens INT DEFAULT 0,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    phone TEXT,
    reservation_id TEXT,
    rate_source TEXT DEFAULT 'meta_estimated_rate_pt',
    is_estimated BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_costs_date_bucket ON public.sdr_costs(date_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_sdr_costs_resource ON public.sdr_costs(resource_type);
CREATE INDEX IF NOT EXISTS idx_sdr_costs_deal ON public.sdr_costs(deal_id);

-- 4. Tabela sdr_learning (persistência de regras, hipóteses e relatórios)
CREATE TABLE IF NOT EXISTS public.sdr_learning (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('RULE', 'HYPOTHESIS', 'RECOMMENDATION', 'INSIGHT_REPORT')),
    title TEXT,
    content JSONB NOT NULL,
    status TEXT DEFAULT 'active',
    created_by TEXT DEFAULT 'SDR Engine',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_learning_type ON public.sdr_learning(entry_type);
CREATE INDEX IF NOT EXISTS idx_sdr_learning_status ON public.sdr_learning(status);

-- 5. Políticas de Segurança RLS
ALTER TABLE public.sdr_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_outcomes ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas e seguras para a API Vamuss CRM (anon, authenticated, service_role)
DROP POLICY IF EXISTS "sdr_conversations_all_roles" ON public.sdr_conversations;
CREATE POLICY "sdr_conversations_all_roles" ON public.sdr_conversations 
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sdr_costs_all_roles" ON public.sdr_costs;
CREATE POLICY "sdr_costs_all_roles" ON public.sdr_costs 
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sdr_learning_all_roles" ON public.sdr_learning;
CREATE POLICY "sdr_learning_all_roles" ON public.sdr_learning 
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sdr_outcomes_all_roles" ON public.sdr_outcomes;
CREATE POLICY "sdr_outcomes_all_roles" ON public.sdr_outcomes 
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

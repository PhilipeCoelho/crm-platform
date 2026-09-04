-- Habilita a extensão uuid-ossp caso não exista
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. meta_connections
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    meta_user_id TEXT NOT NULL,
    meta_user_name TEXT,
    access_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'long_lived',
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disconnected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS meta_connections
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_connections ON public.meta_connections;
CREATE POLICY select_meta_connections ON public.meta_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_connections ON public.meta_connections;
CREATE POLICY insert_meta_connections ON public.meta_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_connections ON public.meta_connections;
CREATE POLICY update_meta_connections ON public.meta_connections FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_connections ON public.meta_connections;
CREATE POLICY delete_meta_connections ON public.meta_connections FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 2. meta_pages
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    page_name TEXT,
    page_access_token TEXT,
    is_subscribed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, page_id)
);

-- RLS meta_pages
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_pages ON public.meta_pages;
CREATE POLICY select_meta_pages ON public.meta_pages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_pages ON public.meta_pages;
CREATE POLICY insert_meta_pages ON public.meta_pages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_pages ON public.meta_pages;
CREATE POLICY update_meta_pages ON public.meta_pages FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_pages ON public.meta_pages;
CREATE POLICY delete_meta_pages ON public.meta_pages FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 3. meta_forms
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    form_id TEXT NOT NULL,
    form_name TEXT,
    page_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    sync_enabled BOOLEAN DEFAULT true,
    leads_count INTEGER DEFAULT 0,
    last_lead_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, form_id)
);

-- RLS meta_forms
ALTER TABLE public.meta_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_forms ON public.meta_forms;
CREATE POLICY select_meta_forms ON public.meta_forms FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_forms ON public.meta_forms;
CREATE POLICY insert_meta_forms ON public.meta_forms FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_forms ON public.meta_forms;
CREATE POLICY update_meta_forms ON public.meta_forms FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_forms ON public.meta_forms;
CREATE POLICY delete_meta_forms ON public.meta_forms FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 4. meta_lead_ads_settings
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_lead_ads_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    default_pipeline_id TEXT NOT NULL DEFAULT 'sales',
    default_stage_id TEXT NOT NULL DEFAULT 'new',
    auto_create_contact BOOLEAN DEFAULT true,
    auto_create_company BOOLEAN DEFAULT true,
    auto_create_deal BOOLEAN DEFAULT true,
    auto_register_history BOOLEAN DEFAULT true,
    auto_create_activity BOOLEAN DEFAULT true,
    auto_start_cadence BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS meta_lead_ads_settings
ALTER TABLE public.meta_lead_ads_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_lead_ads_settings ON public.meta_lead_ads_settings;
CREATE POLICY select_meta_lead_ads_settings ON public.meta_lead_ads_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_lead_ads_settings ON public.meta_lead_ads_settings;
CREATE POLICY insert_meta_lead_ads_settings ON public.meta_lead_ads_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_lead_ads_settings ON public.meta_lead_ads_settings;
CREATE POLICY update_meta_lead_ads_settings ON public.meta_lead_ads_settings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_lead_ads_settings ON public.meta_lead_ads_settings;
CREATE POLICY delete_meta_lead_ads_settings ON public.meta_lead_ads_settings FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 5. meta_webhook_events
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page_id TEXT,
    form_id TEXT,
    leadgen_id TEXT NOT NULL UNIQUE,
    raw_payload JSONB,
    lead_data JSONB,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed', 'skipped')),
    processing_error TEXT,
    contact_id UUID,
    deal_id UUID,
    is_duplicate BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- RLS meta_webhook_events
ALTER TABLE public.meta_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_webhook_events ON public.meta_webhook_events;
CREATE POLICY select_meta_webhook_events ON public.meta_webhook_events FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_webhook_events ON public.meta_webhook_events;
CREATE POLICY insert_meta_webhook_events ON public.meta_webhook_events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_webhook_events ON public.meta_webhook_events;
CREATE POLICY update_meta_webhook_events ON public.meta_webhook_events FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_webhook_events ON public.meta_webhook_events;
CREATE POLICY delete_meta_webhook_events ON public.meta_webhook_events FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 6. meta_form_submissions
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    form_id TEXT NOT NULL,
    deal_id UUID,
    submission_count INTEGER DEFAULT 1,
    first_submitted_at TIMESTAMPTZ DEFAULT NOW(),
    last_submitted_at TIMESTAMPTZ DEFAULT NOW(),
    last_leadgen_id TEXT,
    UNIQUE(user_id, contact_id, form_id)
);

-- RLS meta_form_submissions
ALTER TABLE public.meta_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_form_submissions ON public.meta_form_submissions;
CREATE POLICY select_meta_form_submissions ON public.meta_form_submissions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_form_submissions ON public.meta_form_submissions;
CREATE POLICY insert_meta_form_submissions ON public.meta_form_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_form_submissions ON public.meta_form_submissions;
CREATE POLICY update_meta_form_submissions ON public.meta_form_submissions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_form_submissions ON public.meta_form_submissions;
CREATE POLICY delete_meta_form_submissions ON public.meta_form_submissions FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 7. meta_integration_logs
-- ==========================================
CREATE TABLE IF NOT EXISTS public.meta_integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('connection', 'disconnection', 'webhook', 'lead_received', 'lead_processed', 'error', 'auth_failure', 'token_expired', 'token_refreshed', 'page_subscribed', 'page_unsubscribed', 'test')),
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'warning')),
    message TEXT,
    payload JSONB,
    page_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS meta_integration_logs
ALTER TABLE public.meta_integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_meta_integration_logs ON public.meta_integration_logs;
CREATE POLICY select_meta_integration_logs ON public.meta_integration_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_meta_integration_logs ON public.meta_integration_logs;
CREATE POLICY insert_meta_integration_logs ON public.meta_integration_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS update_meta_integration_logs ON public.meta_integration_logs;
CREATE POLICY update_meta_integration_logs ON public.meta_integration_logs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS delete_meta_integration_logs ON public.meta_integration_logs;
CREATE POLICY delete_meta_integration_logs ON public.meta_integration_logs FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Alterações em tabelas existentes
-- ==========================================

-- deals - Adição das colunas UTM
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS utm_term TEXT;

-- deal_logs - Atualização do constraint para incluir 'meta_lead'
ALTER TABLE public.deal_logs DROP CONSTRAINT IF EXISTS deal_logs_log_type_check;
ALTER TABLE public.deal_logs ADD CONSTRAINT deal_logs_log_type_check CHECK (log_type IN ('activity_note', 'system', 'manual_note', 'brevo_campaign', 'meta_lead'));

-- ==========================================
-- Criação de Índices
-- ==========================================
CREATE INDEX IF NOT EXISTS meta_webhook_events_user_id_created_at_idx ON public.meta_webhook_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_pages_page_id_idx ON public.meta_pages(page_id);
CREATE INDEX IF NOT EXISTS meta_forms_user_id_page_id_idx ON public.meta_forms(user_id, page_id);
CREATE INDEX IF NOT EXISTS meta_integration_logs_user_id_created_at_idx ON public.meta_integration_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_integration_logs_event_type_idx ON public.meta_integration_logs(event_type);
CREATE INDEX IF NOT EXISTS deals_utm_source_idx ON public.deals(utm_source);
CREATE INDEX IF NOT EXISTS deals_utm_campaign_idx ON public.deals(utm_campaign);

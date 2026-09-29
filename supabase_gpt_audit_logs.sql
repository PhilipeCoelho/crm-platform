-- ==============================================================================
-- TABELA DE AUDITORIA: GPT AUDIT LOGS
-- Registra todas as consultas feitas pelo ChatGPT ao CRM para conformidade e segurança
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.gpt_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    query_params JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    response_status INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_gpt_audit_user_id ON public.gpt_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_gpt_audit_created_at ON public.gpt_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gpt_audit_endpoint ON public.gpt_audit_logs(endpoint);

-- Habilitar RLS
ALTER TABLE public.gpt_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gpt audit logs" 
    ON public.gpt_audit_logs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert gpt audit logs" 
    ON public.gpt_audit_logs FOR INSERT 
    TO authenticated, service_role, anon
    WITH CHECK (true);

-- MÓDULO CAMPAIGNS & TRACKING - CONSOLIDAÇÃO DE BANCO DE DADOS
-- Copie e cole este código no SQL Editor do seu Supabase Dashboard

-- 1. Criar Tabela de Histórico de Emails (se não existir)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    person_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'sent',
    smtp_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Colunas de Tracking
    opened BOOLEAN DEFAULT FALSE,
    opened_at TIMESTAMP WITH TIME ZONE,
    open_ip TEXT,
    open_user_agent TEXT,
    clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    click_ip TEXT,
    click_user_agent TEXT,
    clicked_url TEXT
);

-- RLS para email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their email logs" ON public.email_logs;
CREATE POLICY "Users can manage their email logs" ON public.email_logs FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Allow tracking update" ON public.email_logs;
CREATE POLICY "Allow tracking update" ON public.email_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Atualizar Tabela de Campanhas (novas métricas)
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS delivered_count INTEGER DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0;

-- 3. Atualizar Tabela de Destinatários (tracking individual)
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT FALSE;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS clicked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE;
DROP POLICY IF EXISTS "Allow recipient update" ON public.campaign_recipients;
CREATE POLICY "Allow recipient update" ON public.campaign_recipients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Função RPC para Incremento das Métricas (Seguro e Rápido)
CREATE OR REPLACE FUNCTION increment_campaign_metric(target_campaign_id UUID, metric_column TEXT)
RETURNS VOID AS $$
BEGIN
    IF metric_column = 'opened_count' THEN
        UPDATE public.campaigns SET opened_count = COALESCE(opened_count, 0) + 1 WHERE id = target_campaign_id;
    ELSIF metric_column = 'clicked_count' THEN
        UPDATE public.campaigns SET clicked_count = COALESCE(clicked_count, 0) + 1 WHERE id = target_campaign_id;
    ELSIF metric_column = 'delivered_count' THEN
        UPDATE public.campaigns SET delivered_count = COALESCE(delivered_count, 0) + 1 WHERE id = target_campaign_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir acesso ao RPC
GRANT EXECUTE ON FUNCTION increment_campaign_metric(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_campaign_metric(UUID, TEXT) TO authenticated;

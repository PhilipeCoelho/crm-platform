-- Adicionar colunas de tracking na tabela email_logs
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT FALSE;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS open_ip TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS open_user_agent TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS clicked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS click_ip TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS click_user_agent TEXT;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS clicked_url TEXT;

-- Adicionar colunas de tracking na tabela campaign_recipients (opcional, mas bom pra consistência)
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT FALSE;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS clicked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE;

-- Tabela de Campanhas Base (Manual)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT,
    from_name TEXT,
    from_email TEXT,
    reply_to TEXT,
    template_id UUID,
    list_id TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'sent'
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabela de Destinatários de Campanha
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    person_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    message_id TEXT,
    error_log TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS - campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their campaigns" ON public.campaigns;
CREATE POLICY "Users can manage their campaigns" 
  ON public.campaigns FOR ALL 
  USING (auth.uid() = created_by);

-- Políticas RLS - campaign_recipients
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Users can manage campaign_recipients" 
  ON public.campaign_recipients FOR ALL 
  USING (
      EXISTS (
          SELECT 1 FROM public.campaigns 
          WHERE id = campaign_recipients.campaign_id AND created_by = auth.uid()
      )
  );

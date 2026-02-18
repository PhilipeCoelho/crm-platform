-- Campaign Module Extensions

-- 1. Contact Lists & Segmentation
CREATE TABLE public.contact_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    type TEXT DEFAULT 'static', -- 'static' or 'dynamic'
    filters_json JSONB, -- For dynamic lists
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link table for static lists
CREATE TABLE public.list_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES public.contact_lists(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'subscribed', -- 'subscribed', 'unsubscribed', 'bounced'
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(list_id, contact_id)
);

-- 2. Email Events & Tracking
CREATE TABLE public.email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'sent', 'delivered', 'open', 'click', 'bounce', 'spam', 'unsubscribe'
    user_agent TEXT,
    ip_address TEXT,
    link_url TEXT, -- For click events
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Automation / Cadence
CREATE TABLE public.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'contact_added', 'deal_stage', 'tag_added'
    trigger_config JSONB,
    template_id UUID REFERENCES public.email_templates(id),
    sender_id UUID REFERENCES public.senders(id),
    status TEXT DEFAULT 'active', -- 'active', 'paused'
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status TEXT, -- 'triggered', 'sent', 'failed'
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Alerts
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    type TEXT NOT NULL, -- 'bounce_rate', 'campaign_finished', 'verification'
    title TEXT NOT NULL,
    description TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policies (RLS)
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own lists" ON public.contact_lists FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.list_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view list contacts" ON public.list_contacts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.contact_lists WHERE id = list_contacts.list_id AND user_id = auth.uid())
);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view events for their campaigns" ON public.email_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = email_events.campaign_id AND created_by = auth.uid())
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their automations" ON public.automations FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their alerts" ON public.alerts FOR ALL USING (auth.uid() = user_id);

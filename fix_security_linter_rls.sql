-- SECURITY FIXES: Enable RLS and add policies for tables with linter errors
-- This script addresses: 0013_rls_disabled_in_public for help_content, campaigns, email_templates, and senders.

-- 1. HELP_CONTENT
-- Help content is typically read-only for users and public/authenticated for visibility.
ALTER TABLE public.help_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to help_content" ON public.help_content;
CREATE POLICY "Allow public read access to help_content" ON public.help_content 
    FOR SELECT USING (true);

-- 2. CAMPAIGNS
-- Campaigns should be accessible only by the user who created them (owner).
-- The 'campaigns' table already has a 'created_by' column.
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own campaigns" ON public.campaigns;
CREATE POLICY "Users can manage their own campaigns" ON public.campaigns 
    FOR ALL USING (auth.uid() = created_by);

-- 3. EMAIL_TEMPLATES
-- If the table is missing a user relationship, we add it to ensure per-user security.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='email_templates' AND column_name='user_id') THEN
        ALTER TABLE public.email_templates ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own or public templates" ON public.email_templates;
CREATE POLICY "Users can view their own or public templates" ON public.email_templates 
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can manage their own templates" ON public.email_templates;
CREATE POLICY "Users can manage their own templates" ON public.email_templates 
    FOR ALL USING (auth.uid() = user_id);

-- 4. SENDERS
-- Senders must be private to the user.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='senders' AND column_name='user_id') THEN
        ALTER TABLE public.senders ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

ALTER TABLE public.senders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own senders" ON public.senders;
CREATE POLICY "Users can manage their own senders" ON public.senders 
    FOR ALL USING (auth.uid() = user_id);

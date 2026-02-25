-- RLS HARDENING SCRIPT (V2.1 - SAFE EXECUTION)
-- Objective: Ensure all existing tables have RLS, USING and WITH CHECK. 
-- This script checks if tables exist before applying policies to avoid errors.

DO $$ 
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'contacts', 'deals', 'activities', 'stages', 'companies', 
        'deal_logs', 'contact_lists', 'list_contacts', 'email_events', 
        'automations', 'alerts', 'email_accounts', 'emails', 
        'email_associations', 'authorized_senders', 'deal_analytics', 
        'help_content', 'email_templates', 'senders'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Only enable if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        END IF;
    END LOOP;
END $$;

-- Helper function to safely create policy
CREATE OR REPLACE FUNCTION public.fn_safe_policy(
    pol_name text, 
    tab_name text, 
    cmd text, 
    using_clause text, 
    check_clause text DEFAULT NULL
) RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tab_name) THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, tab_name);
        IF check_clause IS NOT NULL THEN
            EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s) WITH CHECK (%s)', pol_name, tab_name, cmd, using_clause, check_clause);
        ELSE
            EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s)', pol_name, tab_name, cmd, using_clause);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply Policies Safely
SELECT public.fn_safe_policy('Profiles are viewable by owner', 'profiles', 'SELECT', 'auth.uid() = id');
SELECT public.fn_safe_policy('Profiles are updatable by owner', 'profiles', 'UPDATE', 'auth.uid() = id', 'auth.uid() = id');
SELECT public.fn_safe_policy('Users manage own contacts', 'contacts', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own deals', 'deals', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own activities', 'activities', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own stages', 'stages', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own companies', 'companies', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own logs', 'deal_logs', 'ALL', 'auth.uid() = created_by', 'auth.uid() = created_by');
SELECT public.fn_safe_policy('Users manage own email accounts', 'email_accounts', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own emails', 'emails', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own templates', 'email_templates', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own senders', 'senders', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Users manage own authorized senders', 'authorized_senders', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
SELECT public.fn_safe_policy('Read access for all', 'help_content', 'SELECT', 'true');

-- Analytics Hardening
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_analytics') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='deal_analytics' AND column_name='user_id') THEN
            ALTER TABLE public.deal_analytics ADD COLUMN user_id UUID REFERENCES auth.users(id);
            UPDATE public.deal_analytics da SET user_id = d.user_id FROM public.deals d WHERE da.deal_id = d.id;
        END IF;
        PERFORM public.fn_safe_policy('Users view own analytics', 'deal_analytics', 'ALL', 'auth.uid() = user_id', 'auth.uid() = user_id');
    END IF;
END $$;

-- Cleanup
DROP FUNCTION IF EXISTS public.fn_safe_policy(text, text, text, text, text);
DROP FUNCTION IF EXISTS execute_sql(text);

COMMIT;

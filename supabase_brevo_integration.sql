-- Migration: Brevo Native Integration
-- Add credentials and sync metadata to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brevo_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brevo_last_sync_at TIMESTAMP WITH TIME ZONE;

-- Add sync status to public.contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS brevo_sync_status TEXT;

-- Create table to log Brevo sync history
CREATE TABLE IF NOT EXISTS public.brevo_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    synced_count INTEGER NOT NULL,
    not_synced_count INTEGER NOT NULL,
    ignored_count INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL
);

-- Enable RLS on public.brevo_sync_logs
ALTER TABLE public.brevo_sync_logs ENABLE ROW LEVEL SECURITY;

-- Add policy for public.brevo_sync_logs
DROP POLICY IF EXISTS "Users manage own brevo sync logs" ON public.brevo_sync_logs;
CREATE POLICY "Users manage own brevo sync logs" 
  ON public.brevo_sync_logs FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

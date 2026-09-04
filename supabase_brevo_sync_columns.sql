-- Migration: Add brevo_last_sync_at and export_batch_id to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS brevo_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS export_batch_id TEXT;

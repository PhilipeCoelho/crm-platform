-- Migration: Add brevo_status column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS brevo_status BOOLEAN DEFAULT FALSE;

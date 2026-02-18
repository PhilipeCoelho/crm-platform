-- Migration to add marketing_status to contacts
ALTER TABLE public.contacts 
ADD COLUMN marketing_status TEXT DEFAULT 'unsubscribed';

-- Check constraint
ALTER TABLE public.contacts 
ADD CONSTRAINT check_marketing_status 
CHECK (marketing_status IN ('subscribed', 'unsubscribed', 'cleaned', 'archived'));

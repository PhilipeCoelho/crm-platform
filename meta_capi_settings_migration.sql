-- Add Meta Conversions API settings to public.meta_lead_ads_settings
ALTER TABLE public.meta_lead_ads_settings 
ADD COLUMN IF NOT EXISTS capi_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS capi_pixel_id TEXT NULL,
ADD COLUMN IF NOT EXISTS capi_access_token TEXT NULL;

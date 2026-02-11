-- Add pipeline_id column to deals table if it doesn't exist
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS pipeline_id text DEFAULT 'sales';

-- Optional: Create an index for better performance when filtering by pipeline
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON public.deals(pipeline_id);

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deals' AND column_name = 'pipeline_id';

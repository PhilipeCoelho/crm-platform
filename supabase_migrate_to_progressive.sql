-- MIGRATION TO PROGRESSIVE CADENCE MODEL
-- Objective: Cleanup existing cadences by keeping only the next pending task and removing future ones.

-- 1. Infer sequence_step for existing activities based on common titles
UPDATE public.activities
SET sequence_step = 1
WHERE is_automatic = true 
  AND (title LIKE '%Primeiro Contato%' OR title LIKE '%Preparar RD%' OR title LIKE '%Nutrição%')
  AND sequence_step IS NULL;

UPDATE public.activities
SET sequence_step = 2
WHERE is_automatic = true 
  AND (title LIKE '%Follow-up 1%' OR title LIKE '%Envio de Case%' OR title LIKE '%Confirmação%')
  AND sequence_step IS NULL;

UPDATE public.activities
SET sequence_step = 3
WHERE is_automatic = true 
  AND title LIKE '%Follow-up 2%'
  AND sequence_step IS NULL;

-- Default to 1 if still null for automatic tasks
UPDATE public.activities
SET sequence_step = 1
WHERE is_automatic = true AND sequence_step IS NULL;

-- 2. Identify and perform cleanup
-- We want to keep only the PENDING automatic activity with the SMALLEST sequence_step per deal and cadence.
-- If multiple have the same step (unlikely), we keep the earliest date.

DELETE FROM public.activities a
WHERE a.is_automatic = true 
  AND a.status = 'pending'
  AND a.id NOT IN (
      -- Subquery to find IDs of activities to KEEP
      SELECT DISTINCT ON (deal_id, origin_stage) id
      FROM public.activities
      WHERE is_automatic = true 
        AND status = 'pending'
      ORDER BY deal_id, origin_stage, sequence_step ASC, date ASC
  );

-- 3. Ensure historical activities (completed) are NOT touched.
-- Also ensure manual activities (is_automatic = false) are NOT touched.
-- (The DELETE above already filters by is_automatic = true and status = 'pending')

-- 4. Log the migration result (optional, for debug)
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT count(*) INTO v_count FROM public.activities WHERE is_automatic = true AND status = 'pending';
    RAISE NOTICE 'Migration complete. Total pending automatic activities remaining: %', v_count;
END $$;

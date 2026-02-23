-- Migration to add cadence automation fields to activities table
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS origin_stage TEXT,
ADD COLUMN IF NOT EXISTS sequence_id TEXT,
ADD COLUMN IF NOT EXISTS is_automatic BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tooltip_script TEXT;

-- Index for performance when cleaning up sequences
CREATE INDEX IF NOT EXISTS idx_activities_deal_origin_status ON activities(deal_id, origin_stage, status);

-- Add UNIQUE constraint to vapi_call_id column
-- This allows the upsert operation to work correctly

-- First, check if there are any duplicate vapi_call_id values
-- If there are, we need to clean them up first
DO $$
BEGIN
  -- Delete duplicates, keeping only the most recent one
  DELETE FROM call_logs
  WHERE id NOT IN (
    SELECT DISTINCT ON (vapi_call_id) id
    FROM call_logs
    WHERE vapi_call_id IS NOT NULL
    ORDER BY vapi_call_id, created_at DESC
  ) AND vapi_call_id IS NOT NULL;
  
  -- Add the UNIQUE constraint
  -- Use IF NOT EXISTS to make this idempotent
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'call_logs_vapi_call_id_unique'
  ) THEN
    ALTER TABLE call_logs 
    ADD CONSTRAINT call_logs_vapi_call_id_unique 
    UNIQUE (vapi_call_id);
  END IF;
END $$;

-- Verify the constraint was created
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'call_logs'::regclass
  AND conname = 'call_logs_vapi_call_id_unique';


-- Check if call_logs are being created
-- Run this in Supabase SQL Editor

-- 1. Check recent call logs
SELECT 
  id,
  vapi_call_id,
  agency_id,
  lead_id,
  status,
  duration_seconds,
  recording_url,
  LEFT(transcript, 100) as transcript_preview,
  created_at,
  updated_at
FROM call_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check if any calls exist for your agency
SELECT COUNT(*) as total_calls
FROM call_logs
WHERE agency_id IN (
  SELECT id FROM agencies WHERE owner_email = 'florianderosnay@gmail.com'
);

-- 3. Check recent leads with status 'called'
SELECT 
  id,
  name,
  phone_number,
  status,
  agency_id,
  created_at
FROM leads
WHERE status = 'called'
ORDER BY updated_at DESC
LIMIT 10;

-- 4. Check if the specific call IDs from the logs exist
-- Replace with actual call IDs from Railway logs
SELECT * FROM call_logs 
WHERE vapi_call_id IN (
  '019b19cd-d6ea-7bbe-9996-796070f4ee89',
  '019b19d2-f85d-7ccc-8407-19eadf55f74c',
  '019b19d4-7993-7ccc-8407-19eadf55f74c'
);



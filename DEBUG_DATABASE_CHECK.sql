-- Comprehensive database check
-- Run this in Supabase SQL Editor to see what's actually stored

-- 1. Check call_logs
SELECT 
  vapi_call_id,
  agency_id,
  lead_id,
  status,
  duration_seconds,
  recording_url,
  LENGTH(transcript) as transcript_length,
  LENGTH(summary) as summary_length,
  created_at
FROM call_logs 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check leads status
SELECT 
  name,
  phone_number,
  status,
  updated_at
FROM leads
ORDER BY updated_at DESC
LIMIT 5;

-- 3. Check appointments
SELECT * FROM appointments
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check if leads are associated with the right agency
SELECT 
  l.name,
  l.status,
  l.agency_id,
  a.owner_email
FROM leads l
LEFT JOIN agencies a ON l.agency_id = a.id
ORDER BY l.created_at DESC
LIMIT 5;


-- Update agents table to add fields for notifications, calendar sync, and language preferences

-- Add email field (for notifications)
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add Google Calendar integration fields
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT, -- Google Calendar calendar ID
ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT, -- Encrypted OAuth access token
ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT, -- Encrypted OAuth refresh token
ADD COLUMN IF NOT EXISTS google_calendar_expires_at TIMESTAMPTZ, -- Token expiration
ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT false; -- Whether calendar sync is enabled

-- Add language preference
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en'; -- Default language (ISO 639-1 code)

-- Add notification preferences (JSONB for flexibility)
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "whatsapp": false}'::jsonb;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email) WHERE email IS NOT NULL;

-- Add index for calendar sync enabled
CREATE INDEX IF NOT EXISTS idx_agents_calendar_sync_enabled ON agents(calendar_sync_enabled) WHERE calendar_sync_enabled = true;



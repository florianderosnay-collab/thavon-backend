-- Add timezone column to agencies table for office hours support
-- Defaults to 'Europe/Luxembourg' (UTC+1)

ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Luxembourg';

-- Add comment to column
COMMENT ON COLUMN agencies.timezone IS 'IANA timezone identifier for office hours calculation (e.g., Europe/Luxembourg, America/New_York)';

-- Create index for faster lookups (optional, but helpful if querying by timezone)
CREATE INDEX IF NOT EXISTS idx_agencies_timezone ON agencies(timezone);



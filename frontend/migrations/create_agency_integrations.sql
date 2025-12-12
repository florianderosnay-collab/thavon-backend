-- Create agency_integrations table to store OAuth tokens and API keys
CREATE TABLE IF NOT EXISTS agency_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL, -- e.g., 'hubspot', 'salesforce', 'zapier'
  provider TEXT NOT NULL, -- e.g., 'hubspot', 'salesforce', 'webhook'
  access_token TEXT, -- Encrypted OAuth access token
  refresh_token TEXT, -- Encrypted OAuth refresh token
  api_key TEXT, -- Encrypted API key (for non-OAuth integrations)
  expires_at TIMESTAMPTZ, -- Token expiration time
  metadata JSONB DEFAULT '{}', -- Additional provider-specific data
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  connected_at TIMESTAMPTZ,
  last_tested_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ, -- Last successful sync time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, integration_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agency_integrations_agency_id ON agency_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_integrations_status ON agency_integrations(status);

-- Enable RLS
ALTER TABLE agency_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Agencies can only see their own integrations
CREATE POLICY "Agencies can view their own integrations"
  ON agency_integrations FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role has full access"
  ON agency_integrations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_agency_integrations_updated_at
  BEFORE UPDATE ON agency_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


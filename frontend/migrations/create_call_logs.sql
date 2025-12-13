-- Create call_logs table to store call recordings, transcripts, and summaries
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL, -- Assigned agent
  vapi_call_id TEXT, -- Vapi's call ID for reference
  status TEXT NOT NULL CHECK (status IN ('completed', 'no_answer', 'busy', 'failed', 'cancelled')),
  duration_seconds INTEGER,
  recording_url TEXT, -- Vapi recording URL
  transcript TEXT, -- Full call transcript
  summary TEXT, -- AI-generated call summary
  language TEXT, -- Language detected/used (e.g., 'en', 'fr', 'de')
  metadata JSONB DEFAULT '{}', -- Additional data (caller info, notes, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_call_logs_agency_id ON call_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call_id ON call_logs(vapi_call_id);

-- Enable RLS
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Agency owners can view all calls" ON call_logs;
DROP POLICY IF EXISTS "Agents can view their assigned calls" ON call_logs;
DROP POLICY IF EXISTS "Service role has full access" ON call_logs;

-- RLS Policy: Agency owners can view all calls for their agency
CREATE POLICY "Agency owners can view all calls"
  ON call_logs FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS Policy: Agents can view only calls assigned to them
CREATE POLICY "Agents can view their assigned calls"
  ON call_logs FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents 
      WHERE id IN (
        SELECT agent_id FROM agents 
        WHERE agency_id IN (
          SELECT agency_id FROM agency_members 
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- RLS Policy: Service role has full access (for API routes)
CREATE POLICY "Service role has full access"
  ON call_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_call_logs_updated_at_column ON call_logs;
CREATE TRIGGER update_call_logs_updated_at_column
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_call_logs_updated_at();


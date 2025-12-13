-- Create call_retries table to track retry attempts for unanswered calls
CREATE TABLE IF NOT EXISTS call_retries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE, -- Original call
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  retry_count INTEGER NOT NULL DEFAULT 1 CHECK (retry_count >= 1 AND retry_count <= 3), -- 1, 2, or 3
  scheduled_at TIMESTAMPTZ NOT NULL, -- When to retry this call
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  completed_at TIMESTAMPTZ, -- When the retry was completed
  notes TEXT, -- Notes about the retry attempt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_call_retries_call_id ON call_retries(call_id);
CREATE INDEX IF NOT EXISTS idx_call_retries_lead_id ON call_retries(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_retries_agency_id ON call_retries(agency_id);
CREATE INDEX IF NOT EXISTS idx_call_retries_status ON call_retries(status);
CREATE INDEX IF NOT EXISTS idx_call_retries_scheduled_at ON call_retries(scheduled_at);

-- Enable RLS
ALTER TABLE call_retries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Agencies can view their own retries" ON call_retries;
DROP POLICY IF EXISTS "Service role has full access" ON call_retries;

-- RLS Policy: Agencies can view their own retries
CREATE POLICY "Agencies can view their own retries"
  ON call_retries FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Service role has full access (for API routes)
CREATE POLICY "Service role has full access"
  ON call_retries FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_retries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_call_retries_updated_at_column ON call_retries;
CREATE TRIGGER update_call_retries_updated_at_column
  BEFORE UPDATE ON call_retries
  FOR EACH ROW
  EXECUTE FUNCTION update_call_retries_updated_at();



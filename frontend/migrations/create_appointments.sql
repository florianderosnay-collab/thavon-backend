-- Create appointments table to store booked appointments from calls
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  call_id UUID REFERENCES call_logs(id) ON DELETE SET NULL, -- Link to the call that created this appointment
  scheduled_at TIMESTAMPTZ NOT NULL, -- When the appointment is scheduled
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  calendar_event_id TEXT, -- Google Calendar event ID (if synced)
  calendar_provider TEXT, -- 'google', 'outlook', etc.
  notes TEXT, -- Additional notes about the appointment
  reminder_sent_at TIMESTAMPTZ, -- When reminder was sent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_agency_id ON appointments(agency_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_call_id ON appointments(call_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_event_id ON appointments(calendar_event_id);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Agency owners can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Agents can view their assigned appointments" ON appointments;
DROP POLICY IF EXISTS "Service role has full access" ON appointments;

-- RLS Policy: Agency owners can view all appointments for their agency
CREATE POLICY "Agency owners can view all appointments"
  ON appointments FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS Policy: Agents can view only appointments assigned to them
CREATE POLICY "Agents can view their assigned appointments"
  ON appointments FOR SELECT
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
  ON appointments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_appointments_updated_at_column ON appointments;
CREATE TRIGGER update_appointments_updated_at_column
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();


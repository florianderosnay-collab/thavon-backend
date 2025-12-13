-- Create support_tickets table for customer support requests
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'integration', 'billing', 'feature', 'other')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_agency_id ON support_tickets(agency_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Agencies can view their own support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Agencies can create their own support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Agencies can update their own support tickets" ON support_tickets;

-- Create policies
CREATE POLICY "Agencies can view their own support tickets"
  ON support_tickets
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agencies can create their own support tickets"
  ON support_tickets
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agencies can update their own support tickets"
  ON support_tickets
  FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();



-- Create admin_users table to track who has admin access
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Service role can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Users can view their own admin status" ON admin_users;

-- Create policies
-- Only admins can view the admin_users table
CREATE POLICY "Admins can view all admin users"
  ON admin_users
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM admin_users WHERE is_active = true
    )
  );

-- Service role can do everything (for API routes)
CREATE POLICY "Service role can manage admin users"
  ON admin_users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can check if they are admins
CREATE POLICY "Users can view their own admin status"
  ON admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_uuid
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;



/*
  # Add Admin Action Logging and User Warning System

  1. New Tables
    - `admin_action_logs`
      - Tracks all admin actions for audit trail
      - Includes action type, target information, and details
    - `user_warnings`
      - Tracks warnings issued to users
      - Links to the user who received the warning

  2. Security
    - Enable RLS on both tables
    - Only admins can read/write admin_action_logs
    - Only admins can read/write user_warnings
*/

-- Create admin_action_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create user_warnings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);

-- Enable RLS
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all admin action logs" ON admin_action_logs;
DROP POLICY IF EXISTS "Admins can insert admin action logs" ON admin_action_logs;
DROP POLICY IF EXISTS "Admins can view all user warnings" ON user_warnings;
DROP POLICY IF EXISTS "Admins can insert user warnings" ON user_warnings;
DROP POLICY IF EXISTS "Users can view their own warnings" ON user_warnings;

-- Admin action logs policies
CREATE POLICY "Admins can view all admin action logs"
  ON admin_action_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert admin action logs"
  ON admin_action_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- User warnings policies
CREATE POLICY "Admins can view all user warnings"
  ON user_warnings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert user warnings"
  ON user_warnings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own warnings"
  ON user_warnings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

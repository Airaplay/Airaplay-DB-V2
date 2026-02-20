-- Fix RLS for ad_mediation_config table
-- Ensure RLS is enabled and add necessary policies

-- Enable RLS if not already enabled
ALTER TABLE ad_mediation_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Admins can manage mediation config" ON ad_mediation_config;
  DROP POLICY IF EXISTS "Public can view active mediation config" ON ad_mediation_config;
  DROP POLICY IF EXISTS "Authenticated can view active mediation config" ON ad_mediation_config;
END $$;

-- Create policy for admins to manage mediation config
CREATE POLICY "Admins can manage mediation config"
ON ad_mediation_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Create policy for authenticated users to view active mediation config
-- This is needed for the app to read the configuration
CREATE POLICY "Authenticated can view active mediation config"
ON ad_mediation_config
FOR SELECT
TO authenticated
USING (is_active = true);

-- Grant necessary permissions
GRANT SELECT ON ad_mediation_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ad_mediation_config TO authenticated;

-- Add comment explaining the security model
COMMENT ON TABLE ad_mediation_config IS 'Ad mediation configuration. RLS enabled: Admins can manage, authenticated users can view active config.';


/*
  # Fix Payout Settings Admin Functions

  This migration fixes the admin_update_payout_settings and admin_create_payout_settings functions
  that were incorrectly updating treat_withdrawal_settings instead of payout_settings table.

  ## Problem
  - admin_update_payout_settings was trying to update treat_withdrawal_settings table
  - treat_withdrawal_settings doesn't have payout distribution columns
  - This caused settings to not save properly in the Earnings & Payouts section

  ## Solution
  - Drop and recreate the functions to target the correct payout_settings table
  - Ensure proper validation and error handling
  - Functions now correctly update payout_settings based on setting_id
*/

-- Drop the incorrect functions
DROP FUNCTION IF EXISTS admin_update_payout_settings(uuid, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS admin_create_payout_settings(text, text, uuid, numeric, numeric, numeric, numeric);

-- Recreate admin_update_payout_settings with correct implementation
CREATE OR REPLACE FUNCTION admin_update_payout_settings(
  setting_id uuid,
  new_payout_threshold numeric,
  new_artist_percentage numeric,
  new_listener_percentage numeric,
  new_platform_percentage numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied. Admin privileges required.');
  END IF;

  -- Validate percentages sum to 100
  IF (new_artist_percentage + new_listener_percentage + new_platform_percentage) != 100 THEN
    RETURN jsonb_build_object('error', 'Percentages must sum to 100.');
  END IF;

  -- Validate threshold is positive
  IF new_payout_threshold < 1.0 THEN
    RETURN jsonb_build_object('error', 'Payout threshold must be at least $1.00.');
  END IF;

  -- Update the payout settings
  UPDATE payout_settings 
  SET 
    payout_threshold = new_payout_threshold,
    artist_percentage = new_artist_percentage,
    listener_percentage = new_listener_percentage,
    platform_percentage = new_platform_percentage,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = setting_id;

  -- Check if the update was successful
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payout setting not found.');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Payout settings updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'success', false);
END;
$$;

-- Recreate admin_create_payout_settings with correct implementation
CREATE OR REPLACE FUNCTION admin_create_payout_settings(
  new_setting_type text,
  new_country_code text DEFAULT NULL,
  new_user_id uuid DEFAULT NULL,
  new_payout_threshold numeric DEFAULT 10.0,
  new_artist_percentage numeric DEFAULT 45.0,
  new_listener_percentage numeric DEFAULT 20.0,
  new_platform_percentage numeric DEFAULT 35.0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_setting_id uuid;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied. Admin privileges required.');
  END IF;

  -- Validate setting type
  IF new_setting_type NOT IN ('global', 'country', 'user') THEN
    RETURN jsonb_build_object('error', 'Invalid setting type. Must be global, country, or user.');
  END IF;

  -- Validate type-specific requirements
  IF new_setting_type = 'global' AND (new_country_code IS NOT NULL OR new_user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Global settings cannot have country code or user ID.');
  END IF;
  
  IF new_setting_type = 'country' AND (new_country_code IS NULL OR new_user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Country settings must have country code and no user ID.');
  END IF;
  
  IF new_setting_type = 'user' AND (new_country_code IS NOT NULL OR new_user_id IS NULL) THEN
    RETURN jsonb_build_object('error', 'User settings must have user ID and no country code.');
  END IF;

  -- Validate percentages sum to 100
  IF (new_artist_percentage + new_listener_percentage + new_platform_percentage) != 100 THEN
    RETURN jsonb_build_object('error', 'Percentages must sum to 100.');
  END IF;

  -- Validate threshold is positive
  IF new_payout_threshold < 1.0 THEN
    RETURN jsonb_build_object('error', 'Payout threshold must be at least $1.00.');
  END IF;

  -- Check for existing settings
  IF new_setting_type = 'global' AND EXISTS (SELECT 1 FROM payout_settings WHERE setting_type = 'global') THEN
    RETURN jsonb_build_object('error', 'Global settings already exist. Use update instead.');
  END IF;
  
  IF new_setting_type = 'country' AND EXISTS (SELECT 1 FROM payout_settings WHERE setting_type = 'country' AND country_code = new_country_code) THEN
    RETURN jsonb_build_object('error', 'Settings for this country already exist. Use update instead.');
  END IF;
  
  IF new_setting_type = 'user' AND EXISTS (SELECT 1 FROM payout_settings WHERE setting_type = 'user' AND user_id = new_user_id) THEN
    RETURN jsonb_build_object('error', 'Settings for this user already exist. Use update instead.');
  END IF;

  -- Insert the new payout settings
  INSERT INTO payout_settings (
    setting_type,
    country_code,
    user_id,
    payout_threshold,
    artist_percentage,
    listener_percentage,
    platform_percentage,
    created_by,
    updated_by
  ) VALUES (
    new_setting_type,
    new_country_code,
    new_user_id,
    new_payout_threshold,
    new_artist_percentage,
    new_listener_percentage,
    new_platform_percentage,
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO new_setting_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Payout settings created successfully',
    'setting_id', new_setting_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'success', false);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_update_payout_settings(uuid, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_payout_settings(text, text, uuid, numeric, numeric, numeric, numeric) TO authenticated;

COMMENT ON FUNCTION admin_update_payout_settings(uuid, numeric, numeric, numeric, numeric) IS 
'Admin function to update payout settings (threshold and earnings distribution percentages) for a specific setting ID';

COMMENT ON FUNCTION admin_create_payout_settings(text, text, uuid, numeric, numeric, numeric, numeric) IS 
'Admin function to create new payout settings (global, country-specific, or user-specific)';

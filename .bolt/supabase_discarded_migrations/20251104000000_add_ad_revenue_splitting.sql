/*
  # Add Ad Revenue Splitting to Payout Settings
  
  1. Add Columns
    - Add ad-specific revenue splitting columns to payout_settings table
    - ad_artist_percentage, ad_listener_percentage, ad_platform_percentage
    - These allow separate splits for ad revenue vs other earnings
  
  2. Update Constraints
    - Update check constraints to validate ad percentages sum to 100
    - Make ad percentages optional (nullable) for backward compatibility
  
  3. Functions
    - Update functions to handle ad revenue splits
    - Add function to get ad-specific payout settings
*/

-- Add ad revenue splitting columns to payout_settings table
ALTER TABLE payout_settings 
ADD COLUMN IF NOT EXISTS ad_artist_percentage numeric CHECK (ad_artist_percentage >= 0 AND ad_artist_percentage <= 100),
ADD COLUMN IF NOT EXISTS ad_listener_percentage numeric CHECK (ad_listener_percentage >= 0 AND ad_listener_percentage <= 100),
ADD COLUMN IF NOT EXISTS ad_platform_percentage numeric CHECK (ad_platform_percentage >= 0 AND ad_platform_percentage <= 100);

-- Add check constraint to ensure ad percentages sum to 100 when all are set
ALTER TABLE payout_settings
DROP CONSTRAINT IF EXISTS payout_settings_ad_percentages_sum_check;

ALTER TABLE payout_settings
ADD CONSTRAINT payout_settings_ad_percentages_sum_check CHECK (
  (ad_artist_percentage IS NULL AND ad_listener_percentage IS NULL AND ad_platform_percentage IS NULL) OR
  (ad_artist_percentage IS NOT NULL AND ad_listener_percentage IS NOT NULL AND ad_platform_percentage IS NOT NULL AND
   ad_artist_percentage + ad_listener_percentage + ad_platform_percentage = 100.0)
);

-- Update default global settings to include ad revenue splits (if global settings exist)
UPDATE payout_settings
SET 
  ad_artist_percentage = 50.0,
  ad_listener_percentage = 10.0,
  ad_platform_percentage = 40.0
WHERE setting_type = 'global' 
  AND (ad_artist_percentage IS NULL OR ad_listener_percentage IS NULL OR ad_platform_percentage IS NULL);

-- Function to get ad-specific payout settings for a user
CREATE OR REPLACE FUNCTION get_user_ad_payout_settings(user_uuid uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_country text;
  user_settings record;
  country_settings record;
  global_settings record;
  applicable_settings jsonb;
BEGIN
  -- Get user's country
  SELECT country INTO user_country
  FROM users
  WHERE id = user_uuid;
  
  -- Try to get user-specific settings
  SELECT * INTO user_settings
  FROM payout_settings
  WHERE setting_type = 'user' AND user_id = user_uuid;
  
  IF FOUND THEN
    -- Use ad-specific percentages if set, otherwise fall back to regular percentages
    applicable_settings := jsonb_build_object(
      'setting_type', 'user',
      'payout_threshold', user_settings.payout_threshold,
      'artist_percentage', COALESCE(user_settings.ad_artist_percentage, user_settings.artist_percentage),
      'listener_percentage', COALESCE(user_settings.ad_listener_percentage, user_settings.listener_percentage),
      'platform_percentage', COALESCE(user_settings.ad_platform_percentage, user_settings.platform_percentage),
      'uses_ad_specific', (user_settings.ad_artist_percentage IS NOT NULL)
    );
    RETURN applicable_settings;
  END IF;
  
  -- Try to get country-specific settings
  IF user_country IS NOT NULL THEN
    SELECT * INTO country_settings
    FROM payout_settings
    WHERE setting_type = 'country' AND country_code = user_country;
    
    IF FOUND THEN
      applicable_settings := jsonb_build_object(
        'setting_type', 'country',
        'country_code', user_country,
        'payout_threshold', country_settings.payout_threshold,
        'artist_percentage', COALESCE(country_settings.ad_artist_percentage, country_settings.artist_percentage),
        'listener_percentage', COALESCE(country_settings.ad_listener_percentage, country_settings.listener_percentage),
        'platform_percentage', COALESCE(country_settings.ad_platform_percentage, country_settings.platform_percentage),
        'uses_ad_specific', (country_settings.ad_artist_percentage IS NOT NULL)
      );
      RETURN applicable_settings;
    END IF;
  END IF;
  
  -- Fall back to global settings
  SELECT * INTO global_settings
  FROM payout_settings
  WHERE setting_type = 'global';
  
  IF FOUND THEN
    applicable_settings := jsonb_build_object(
      'setting_type', 'global',
      'payout_threshold', global_settings.payout_threshold,
      'artist_percentage', COALESCE(global_settings.ad_artist_percentage, global_settings.artist_percentage),
      'listener_percentage', COALESCE(global_settings.ad_listener_percentage, global_settings.listener_percentage),
      'platform_percentage', COALESCE(global_settings.ad_platform_percentage, global_settings.platform_percentage),
      'uses_ad_specific', (global_settings.ad_artist_percentage IS NOT NULL)
    );
    RETURN applicable_settings;
  END IF;
  
  -- If no settings found, return default ad revenue values
  RETURN jsonb_build_object(
    'setting_type', 'default',
    'payout_threshold', 10.0,
    'artist_percentage', 50.0,
    'listener_percentage', 10.0,
    'platform_percentage', 40.0,
    'uses_ad_specific', false
  );
END;
$$;

-- Drop existing admin_get_payout_settings function before recreating with new return type
DROP FUNCTION IF EXISTS admin_get_payout_settings(text, text, uuid);

-- Update admin_get_payout_settings to include ad revenue percentages
CREATE OR REPLACE FUNCTION admin_get_payout_settings(
  setting_type_filter text DEFAULT NULL,
  country_code_filter text DEFAULT NULL,
  user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  setting_type text,
  country_code text,
  user_id uuid,
  user_email text,
  user_display_name text,
  payout_threshold numeric,
  artist_percentage numeric,
  listener_percentage numeric,
  platform_percentage numeric,
  ad_artist_percentage numeric,
  ad_listener_percentage numeric,
  ad_platform_percentage numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_admin boolean;
BEGIN
  -- Check if user is an admin (qualified with table alias to avoid ambiguity)
  SELECT (u.role = 'admin') INTO is_admin
  FROM users u
  WHERE u.id = current_user_id;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only administrators can access payout settings';
  END IF;

  RETURN QUERY
  SELECT 
    ps.id,
    ps.setting_type,
    ps.country_code,
    ps.user_id,
    u.email as user_email,
    u.display_name as user_display_name,
    ps.payout_threshold,
    ps.artist_percentage,
    ps.listener_percentage,
    ps.platform_percentage,
    ps.ad_artist_percentage,
    ps.ad_listener_percentage,
    ps.ad_platform_percentage,
    ps.created_at,
    ps.updated_at
  FROM payout_settings ps
  LEFT JOIN users u ON ps.user_id = u.id
  WHERE 
    (setting_type_filter IS NULL OR ps.setting_type = setting_type_filter) AND
    (country_code_filter IS NULL OR ps.country_code = country_code_filter) AND
    (user_id_filter IS NULL OR ps.user_id = user_id_filter)
  ORDER BY 
    CASE 
      WHEN ps.setting_type = 'global' THEN 0
      WHEN ps.setting_type = 'country' THEN 1
      ELSE 2
    END,
    ps.country_code,
    u.display_name;
END;
$$;

-- Drop existing admin_update_payout_settings function before recreating with new parameters
DROP FUNCTION IF EXISTS admin_update_payout_settings(uuid, numeric, numeric, numeric, numeric);

-- Update admin_update_payout_settings to include ad revenue percentages
CREATE OR REPLACE FUNCTION admin_update_payout_settings(
  setting_id uuid,
  new_payout_threshold numeric,
  new_artist_percentage numeric,
  new_listener_percentage numeric,
  new_platform_percentage numeric,
  new_ad_artist_percentage numeric DEFAULT NULL,
  new_ad_listener_percentage numeric DEFAULT NULL,
  new_ad_platform_percentage numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied. Admin privileges required.');
  END IF;

  -- Validate regular percentages sum to 100
  IF (new_artist_percentage + new_listener_percentage + new_platform_percentage) != 100 THEN
    RETURN jsonb_build_object('error', 'Regular percentages must sum to 100.');
  END IF;

  -- Validate ad percentages if provided
  IF new_ad_artist_percentage IS NOT NULL AND new_ad_listener_percentage IS NOT NULL AND new_ad_platform_percentage IS NOT NULL THEN
    IF (new_ad_artist_percentage + new_ad_listener_percentage + new_ad_platform_percentage) != 100 THEN
      RETURN jsonb_build_object('error', 'Ad revenue percentages must sum to 100.');
    END IF;
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
    ad_artist_percentage = COALESCE(new_ad_artist_percentage, ad_artist_percentage),
    ad_listener_percentage = COALESCE(new_ad_listener_percentage, ad_listener_percentage),
    ad_platform_percentage = COALESCE(new_ad_platform_percentage, ad_platform_percentage),
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

-- Drop existing admin_create_payout_settings function before recreating with new parameters
DROP FUNCTION IF EXISTS admin_create_payout_settings(text, text, uuid, numeric, numeric, numeric, numeric);

-- Update admin_create_payout_settings to include ad revenue percentages
CREATE OR REPLACE FUNCTION admin_create_payout_settings(
  new_setting_type text,
  new_country_code text DEFAULT NULL,
  new_user_id uuid DEFAULT NULL,
  new_payout_threshold numeric DEFAULT 10.0,
  new_artist_percentage numeric DEFAULT 45.0,
  new_listener_percentage numeric DEFAULT 20.0,
  new_platform_percentage numeric DEFAULT 35.0,
  new_ad_artist_percentage numeric DEFAULT NULL,
  new_ad_listener_percentage numeric DEFAULT NULL,
  new_ad_platform_percentage numeric DEFAULT NULL
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

  -- Validate regular percentages sum to 100
  IF (new_artist_percentage + new_listener_percentage + new_platform_percentage) != 100 THEN
    RETURN jsonb_build_object('error', 'Regular percentages must sum to 100.');
  END IF;

  -- Validate ad percentages if provided
  IF new_ad_artist_percentage IS NOT NULL AND new_ad_listener_percentage IS NOT NULL AND new_ad_platform_percentage IS NOT NULL THEN
    IF (new_ad_artist_percentage + new_ad_listener_percentage + new_ad_platform_percentage) != 100 THEN
      RETURN jsonb_build_object('error', 'Ad revenue percentages must sum to 100.');
    END IF;
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
    ad_artist_percentage,
    ad_listener_percentage,
    ad_platform_percentage,
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
    new_ad_artist_percentage,
    new_ad_listener_percentage,
    new_ad_platform_percentage,
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
GRANT EXECUTE ON FUNCTION get_user_ad_payout_settings(uuid) TO authenticated;

-- Drop existing process_ad_impression_revenue function before recreating
DROP FUNCTION IF EXISTS process_ad_impression_revenue(uuid);

-- Update process_ad_impression_revenue to use ad-specific payout settings
CREATE OR REPLACE FUNCTION process_ad_impression_revenue(impression_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  impression_record record;
  user_record record;
  artist_record record;
  content_record record;
  payout_settings jsonb;
  revenue_amount numeric := 0;
  artist_share numeric := 0;
  user_share numeric := 0;
  platform_share numeric := 0;
  new_revenue_id uuid;
BEGIN
  -- Get the ad impression record
  SELECT * INTO impression_record
  FROM ad_impressions
  WHERE id = impression_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ad impression not found', 'success', false);
  END IF;
  
  -- Check if revenue has already been processed
  IF EXISTS (
    SELECT 1 FROM ad_revenue_events
    WHERE impression_id = impression_uuid
  ) THEN
    RETURN jsonb_build_object('error', 'Revenue already processed for this impression', 'success', false);
  END IF;
  
  -- Get user record
  IF impression_record.user_id IS NOT NULL THEN
    SELECT * INTO user_record
    FROM users
    WHERE id = impression_record.user_id;
  END IF;
  
  -- Get content record and associated artist
  IF impression_record.content_id IS NOT NULL THEN
    IF impression_record.content_type = 'song' THEN
      -- For songs
      SELECT s.*, a.id as artist_id INTO content_record
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE s.id = impression_record.content_id;
      
      IF FOUND AND content_record.artist_id IS NOT NULL THEN
        SELECT * INTO artist_record
        FROM artists
        WHERE id = content_record.artist_id;
      END IF;
    ELSE
      -- For content_uploads (videos, clips, etc.)
      SELECT cu.*, ap.artist_id INTO content_record
      FROM content_uploads cu
      LEFT JOIN artist_profiles ap ON cu.artist_profile_id = ap.id
      WHERE cu.id = impression_record.content_id;
      
      IF FOUND AND content_record.artist_id IS NOT NULL THEN
        SELECT * INTO artist_record
        FROM artists
        WHERE id = content_record.artist_id;
      END IF;
    END IF;
  END IF;
  
  -- Calculate revenue amount
  revenue_amount := calculate_ad_revenue(impression_uuid);
  
  -- Get ad-specific payout settings (uses ad-specific percentages if available)
  IF user_record.id IS NOT NULL THEN
    payout_settings := get_user_ad_payout_settings(user_record.id);
  ELSE
    -- Use global settings if no user
    payout_settings := get_user_ad_payout_settings();
  END IF;
  
  -- Calculate shares based on payout settings
  IF artist_record.id IS NOT NULL THEN
    -- Artist gets their share
    artist_share := revenue_amount * (payout_settings->>'artist_percentage')::numeric / 100;
  END IF;
  
  IF user_record.id IS NOT NULL THEN
    -- User gets listener share
    user_share := revenue_amount * (payout_settings->>'listener_percentage')::numeric / 100;
  END IF;
  
  -- Platform gets the rest
  platform_share := revenue_amount - artist_share - user_share;
  
  -- Create revenue event record
  INSERT INTO ad_revenue_events (
    impression_id,
    revenue_amount,
    currency,
    user_id,
    artist_id,
    content_id,
    status,
    metadata
  ) VALUES (
    impression_uuid,
    revenue_amount,
    'USD',
    impression_record.user_id,
    artist_record.id,
    impression_record.content_id,
    'processed',
    jsonb_build_object(
      'artist_share', artist_share,
      'user_share', user_share,
      'platform_share', platform_share,
      'ad_type', impression_record.ad_type,
      'content_type', impression_record.content_type,
      'duration_viewed', impression_record.duration_viewed,
      'completed', impression_record.completed,
      'uses_ad_specific', COALESCE((payout_settings->>'uses_ad_specific')::boolean, false)
    )
  )
  RETURNING id INTO new_revenue_id;
  
  -- Update user earnings if applicable
  IF user_record.id IS NOT NULL AND user_share > 0 THEN
    UPDATE users
    SET 
      total_earnings = total_earnings + user_share,
      updated_at = now()
    WHERE id = user_record.id;
  END IF;
  
  -- Update artist earnings if applicable
  IF artist_record.id IS NOT NULL AND artist_share > 0 THEN
    -- Find all users associated with this artist
    UPDATE users
    SET 
      total_earnings = total_earnings + artist_share,
      updated_at = now()
    WHERE id IN (
      SELECT user_id
      FROM artist_profiles
      WHERE artist_id = artist_record.id
    );
  END IF;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'revenue_id', new_revenue_id,
    'revenue_amount', revenue_amount,
    'artist_share', artist_share,
    'user_share', user_share,
    'platform_share', platform_share
  );
END;
$$;

COMMENT ON FUNCTION get_user_ad_payout_settings(uuid) IS 
'Get ad-specific payout settings for a user, falling back to regular percentages if ad-specific ones are not set';


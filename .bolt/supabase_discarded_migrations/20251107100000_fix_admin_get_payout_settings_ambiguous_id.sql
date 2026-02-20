-- Fix ambiguous column reference in admin_get_payout_settings function
-- The 'id' column reference was ambiguous because the function's return type also has an 'id' column

DROP FUNCTION IF EXISTS admin_get_payout_settings(text, text, uuid);

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
  -- Check if user is an admin (fixed: qualify 'id' with table name 'users.id')
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


/*
  # Fix record_promotion_impression Function Signature
  
  ## Overview
  The function signature mismatch was causing 404 errors. The database had `p_device_fingerprint` 
  parameter but the TypeScript code was calling it with `p_clicked` parameter.
  
  ## Changes
  1. Update `promotion_impressions` table to add `clicked` column
  2. Recreate `record_promotion_impression` function with correct parameters matching TypeScript code
  3. Keep backward compatibility by maintaining device_fingerprint column
  
  ## Function Signature (New)
  - p_promotion_id: uuid - The promotion being tracked
  - p_section_key: text - The section where promotion was shown
  - p_user_id: uuid - The user viewing the promotion (optional)
  - p_clicked: boolean - Whether the promotion was clicked (optional, default false)
  - p_session_id: text - Session identifier (optional)
  
  ## Security
  - Maintains existing RLS policies
  - Function runs with SECURITY INVOKER for safety
*/

-- Add clicked column to promotion_impressions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_impressions' AND column_name = 'clicked'
  ) THEN
    ALTER TABLE promotion_impressions ADD COLUMN clicked boolean DEFAULT false;
  END IF;
END $$;

-- Drop and recreate the record_promotion_impression function with correct signature
DROP FUNCTION IF EXISTS record_promotion_impression(uuid, text, uuid, text, text);
DROP FUNCTION IF EXISTS record_promotion_impression(uuid, text, uuid, boolean, text);

CREATE OR REPLACE FUNCTION record_promotion_impression(
  p_promotion_id uuid,
  p_section_key text,
  p_user_id uuid DEFAULT NULL,
  p_clicked boolean DEFAULT false,
  p_session_id text DEFAULT NULL
)
RETURNS void 
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rotation_state_id uuid;
  v_last_shown_ids jsonb;
BEGIN
  -- Insert impression record with clicked status
  INSERT INTO promotion_impressions (
    promotion_id,
    user_id,
    section_key,
    clicked,
    session_id,
    device_fingerprint
  ) VALUES (
    p_promotion_id,
    p_user_id,
    p_section_key,
    p_clicked,
    p_session_id,
    p_session_id -- Use session_id as device_fingerprint for now
  );

  -- Update promotion stats
  UPDATE promotions
  SET 
    impressions_actual = COALESCE(impressions_actual, 0) + 1,
    clicks = COALESCE(clicks, 0) + CASE WHEN p_clicked THEN 1 ELSE 0 END,
    last_shown_at = now(),
    click_through_rate = CASE
      WHEN (COALESCE(impressions_actual, 0) + 1) > 0
      THEN ((COALESCE(clicks, 0) + CASE WHEN p_clicked THEN 1 ELSE 0 END)::numeric / (COALESCE(impressions_actual, 0) + 1)::numeric) * 100.0
      ELSE 0
    END
  WHERE id = p_promotion_id;

  -- Update rotation state
  INSERT INTO promotion_rotation_state (
    promotion_id,
    section_key,
    total_impressions,
    total_clicks,
    last_shown_at,
    click_through_rate
  ) VALUES (
    p_promotion_id,
    p_section_key,
    1,
    CASE WHEN p_clicked THEN 1 ELSE 0 END,
    now(),
    CASE WHEN p_clicked THEN 100.0 ELSE 0 END
  )
  ON CONFLICT (promotion_id, section_key) DO UPDATE SET
    total_impressions = promotion_rotation_state.total_impressions + 1,
    total_clicks = promotion_rotation_state.total_clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END,
    last_shown_at = now(),
    click_through_rate = CASE
      WHEN (promotion_rotation_state.total_impressions + 1) > 0
      THEN ((promotion_rotation_state.total_clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END)::numeric / (promotion_rotation_state.total_impressions + 1)::numeric) * 100.0
      ELSE 0
    END,
    updated_at = now();

  -- Update daily performance metrics
  INSERT INTO promotion_performance_metrics (
    promotion_id,
    section_key,
    date,
    impressions,
    clicks,
    unique_viewers,
    click_through_rate
  ) VALUES (
    p_promotion_id,
    p_section_key,
    CURRENT_DATE,
    1,
    CASE WHEN p_clicked THEN 1 ELSE 0 END,
    CASE WHEN p_user_id IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN p_clicked THEN 100.0 ELSE 0 END
  )
  ON CONFLICT (promotion_id, section_key, date) DO UPDATE SET
    impressions = promotion_performance_metrics.impressions + 1,
    clicks = promotion_performance_metrics.clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END,
    click_through_rate = CASE
      WHEN (promotion_performance_metrics.impressions + 1) > 0
      THEN ((promotion_performance_metrics.clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END)::numeric / (promotion_performance_metrics.impressions + 1)::numeric) * 100.0
      ELSE 0
    END,
    updated_at = now();

  -- Update queue state to track impressions in current cycle
  UPDATE promotion_queue_state
  SET 
    cycles_since_display = 0,
    last_displayed_at = now(),
    updated_at = now()
  WHERE promotion_id = p_promotion_id 
    AND section_key = p_section_key;

END;
$$ LANGUAGE plpgsql;

-- Create index on clicked column for performance
CREATE INDEX IF NOT EXISTS idx_promotion_impressions_clicked ON promotion_impressions(clicked);

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION record_promotion_impression(uuid, text, uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_promotion_impression(uuid, text, uuid, boolean, text) TO anon;

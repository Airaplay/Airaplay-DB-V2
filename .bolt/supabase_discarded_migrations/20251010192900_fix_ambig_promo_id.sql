/*
  # Fix Ambiguous Column Reference in get_smart_rotated_promotions Function

  ## Overview
  Fixes the "column reference 'promotion_id' is ambiguous" error in the 
  `get_smart_rotated_promotions` function by explicitly qualifying all column 
  references with their table aliases throughout the entire function.

  ## Changes
  - Recreate `get_smart_rotated_promotions` with all table aliases properly qualified
  - Add `SECURITY DEFINER` to ensure function runs with elevated privileges for RLS
  - Set explicit search_path for security

  ## Security
  - Uses SECURITY DEFINER to bypass RLS restrictions for system operations
  - Maintains data integrity by setting search_path to public schema only
*/

-- Drop and recreate the function with all ambiguous references fixed
CREATE OR REPLACE FUNCTION get_smart_rotated_promotions(
  p_section_key text,
  p_content_type text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  promotion_id uuid,
  target_id uuid,
  target_title text,
  user_id uuid,
  visibility_score numeric,
  queue_position integer,
  forced_inclusion boolean
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_id uuid;
  v_current_cycle integer;
  v_promotion record;
  v_position integer := 1;
BEGIN
  -- Get section ID with explicit table alias
  SELECT ps.id INTO v_section_id
  FROM promotion_sections ps
  WHERE ps.section_key = p_section_key AND ps.is_active = true;

  IF v_section_id IS NULL THEN
    RETURN;
  END IF;

  -- Get or create current cycle number with explicit table alias
  SELECT COALESCE(MAX(prc.cycle_number), 0) INTO v_current_cycle
  FROM promotion_rotation_cycles prc
  WHERE prc.section_key = p_section_key;

  -- Ensure active cycle exists with explicit table alias
  INSERT INTO promotion_rotation_cycles (
    section_key,
    cycle_number,
    cycle_start_time,
    cycle_end_time,
    status
  )
  SELECT
    p_section_key,
    v_current_cycle + 1,
    now(),
    now() + interval '2 hours',
    'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM promotion_rotation_cycles prc2
    WHERE prc2.section_key = p_section_key AND prc2.status = 'active'
  );

  -- Update queue state for all active promotions with explicit table alias
  FOR v_promotion IN
    SELECT p.id
    FROM promotions p
    WHERE p.promotion_section_id = v_section_id
      AND p.promotion_type = p_content_type
      AND p.status = 'active'
      AND p.start_date <= now()
      AND p.end_date >= now()
  LOOP
    -- Calculate visibility score
    DECLARE
      v_score numeric;
      v_force boolean := false;
      v_last_cycle integer;
      v_cycles_since integer;
    BEGIN
      v_score := calculate_visibility_score(v_promotion.id, p_section_key);

      -- Check fairness: force inclusion if not shown in last 3 cycles (6 hours)
      -- FIX: Fully qualify all column references with table alias
      SELECT pqs.last_cycle_displayed, pqs.cycles_since_display
      INTO v_last_cycle, v_cycles_since
      FROM promotion_queue_state pqs
      WHERE pqs.promotion_id = v_promotion.id AND pqs.section_key = p_section_key;

      IF v_cycles_since >= 3 THEN
        v_force := true;
        v_score := v_score + 1.0; -- Boost score for forced inclusion
      END IF;

      -- Upsert queue state
      INSERT INTO promotion_queue_state (
        promotion_id,
        section_key,
        visibility_score,
        forced_next_cycle
      ) VALUES (
        v_promotion.id,
        p_section_key,
        v_score,
        v_force
      )
      ON CONFLICT (promotion_id, section_key) DO UPDATE SET
        visibility_score = v_score,
        forced_next_cycle = v_force,
        cycles_since_display = COALESCE(promotion_queue_state.cycles_since_display, 0) + 1,
        updated_at = now();
    END;
  END LOOP;

  -- Return top promotions sorted by visibility score with explicit table aliases
  RETURN QUERY
  SELECT
    pqs.promotion_id,
    p.target_id,
    p.target_title,
    p.user_id,
    pqs.visibility_score,
    v_position as queue_position,
    pqs.forced_next_cycle as forced_inclusion
  FROM promotion_queue_state pqs
  JOIN promotions p ON p.id = pqs.promotion_id
  WHERE pqs.section_key = p_section_key
    AND p.status = 'active'
    AND p.start_date <= now()
    AND p.end_date >= now()
  ORDER BY
    pqs.forced_next_cycle DESC, -- Forced promotions first
    pqs.visibility_score DESC,
    RANDOM()
  LIMIT p_limit;

  -- Update queue positions and log exposure with explicit table aliases
  UPDATE promotion_queue_state pqs
  SET
    queue_position = sub.rn,
    in_current_rotation = (sub.rn <= p_limit),
    last_displayed_at = CASE WHEN sub.rn <= p_limit THEN now() ELSE pqs.last_displayed_at END,
    last_cycle_displayed = CASE WHEN sub.rn <= p_limit THEN v_current_cycle ELSE pqs.last_cycle_displayed END,
    cycles_since_display = CASE WHEN sub.rn <= p_limit THEN 0 ELSE COALESCE(pqs.cycles_since_display, 0) + 1 END,
    forced_next_cycle = false,
    updated_at = now()
  FROM (
    SELECT
      pqs2.promotion_id,
      ROW_NUMBER() OVER (
        ORDER BY pqs2.forced_next_cycle DESC, pqs2.visibility_score DESC, RANDOM()
      ) as rn
    FROM promotion_queue_state pqs2
    JOIN promotions p2 ON p2.id = pqs2.promotion_id
    WHERE pqs2.section_key = p_section_key
      AND p2.status = 'active'
      AND p2.start_date <= now()
      AND p2.end_date >= now()
  ) sub
  WHERE pqs.promotion_id = sub.promotion_id
    AND pqs.section_key = p_section_key;

  -- Log exposure for promotions entering rotation with explicit table aliases
  INSERT INTO promotion_exposure_logs (
    promotion_id,
    section_key,
    event_type,
    visibility_score,
    queue_position
  )
  SELECT
    pqs.promotion_id,
    pqs.section_key,
    'enter_rotation',
    pqs.visibility_score,
    pqs.queue_position
  FROM promotion_queue_state pqs
  WHERE pqs.section_key = p_section_key
    AND pqs.in_current_rotation = true
    AND pqs.last_displayed_at >= now() - interval '5 minutes';

END;
$$ LANGUAGE plpgsql;

-- Also update calculate_visibility_score to use SECURITY DEFINER for consistency
CREATE OR REPLACE FUNCTION calculate_visibility_score(
  p_promotion_id uuid,
  p_section_key text
)
RETURNS numeric
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
  v_time_elapsed numeric;
  v_total_duration numeric;
  v_exposure_weight numeric;
  v_total_impressions integer;
  v_total_clicks integer;
  v_engagement_rate numeric;
  v_visibility_score numeric;
  v_randomization_factor numeric;
BEGIN
  -- Get promotion details with explicit table alias
  SELECT p.start_date, p.end_date
  INTO v_start_date, v_end_date
  FROM promotions p
  WHERE p.id = p_promotion_id;

  -- Calculate time weights
  v_time_elapsed := EXTRACT(EPOCH FROM (now() - v_start_date)) / 3600.0; -- in hours
  v_total_duration := EXTRACT(EPOCH FROM (v_end_date - v_start_date)) / 3600.0; -- in hours

  -- ExposureWeight = 1 - (timeElapsed / totalDuration)
  IF v_total_duration > 0 THEN
    v_exposure_weight := GREATEST(0, 1 - (v_time_elapsed / v_total_duration));
  ELSE
    v_exposure_weight := 1.0;
  END IF;

  -- Get engagement metrics with explicit table alias
  SELECT 
    COALESCE(prs.total_impressions, 0),
    COALESCE(prs.total_clicks, 0)
  INTO v_total_impressions, v_total_clicks
  FROM promotion_rotation_state prs
  WHERE prs.promotion_id = p_promotion_id AND prs.section_key = p_section_key;

  -- EngagementRate = totalEngagements / max(totalImpressions, 1)
  v_engagement_rate := v_total_clicks::numeric / GREATEST(v_total_impressions, 1)::numeric;

  -- VisibilityScore = (ExposureWeight * 0.6) + (EngagementRate * 0.4)
  v_visibility_score := (v_exposure_weight * 0.6) + (v_engagement_rate * 0.4);

  -- Add randomization within ±5%
  -- Random value between 0.95 and 1.05
  v_randomization_factor := 0.95 + (random() * 0.10);
  v_visibility_score := v_visibility_score * v_randomization_factor;

  RETURN v_visibility_score;
END;
$$ LANGUAGE plpgsql;

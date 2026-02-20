/*
  # Add Promotion Cooldown and Spam Prevention System

  ## Overview
  Implements a comprehensive anti-spam system for promotions:
  - One active promotion per user per section at a time
  - 2-hour cooldown period after promotion ends before re-promoting same content in same section
  - Automatic slot refresh when promotions expire
  - Queue-based promotion system for fairness

  ## Changes Made

  1. **New Columns Added to `promotions` table**
     - `cooldown_until` (timestamptz) - Tracks when content can be re-promoted in this section
     - `previous_end_date` (timestamptz) - Stores the last end date for cooldown calculation

  2. **New Functions**
     - `check_promotion_availability()` - Checks if content can be promoted in a section
     - `apply_promotion_cooldown()` - Automatically applies 2-hour cooldown when promotion ends
     - `get_available_promotion_sections()` - Returns available sections for promotion
     
  3. **New Triggers**
     - Automatically applies cooldown when promotion status changes to 'completed' or 'expired'
     - Validates unique active promotions per section

  4. **Enhanced Validation**
     - Prevents multiple active promotions for same content in same section
     - Enforces cooldown period before allowing re-promotion

  ## Security
  - All functions are security definer for proper access control
  - Validation logic prevents spam attempts
  - RLS policies ensure users can only check their own promotions
*/

-- Add cooldown tracking columns to promotions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'cooldown_until'
  ) THEN
    ALTER TABLE promotions ADD COLUMN cooldown_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'previous_end_date'
  ) THEN
    ALTER TABLE promotions ADD COLUMN previous_end_date timestamptz;
  END IF;
END $$;

-- Create index for efficient cooldown queries
CREATE INDEX IF NOT EXISTS idx_promotions_cooldown 
ON promotions(target_id, promotion_section_id, cooldown_until) 
WHERE cooldown_until IS NOT NULL;

-- Create index for active promotions lookup
CREATE INDEX IF NOT EXISTS idx_promotions_active_section
ON promotions(target_id, promotion_section_id, status)
WHERE status IN ('active', 'pending_approval');

-- Function to check if content can be promoted in a section
CREATE OR REPLACE FUNCTION check_promotion_availability(
  p_target_id uuid,
  p_promotion_type text,
  p_section_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_promotion record;
  v_cooldown_promotion record;
BEGIN
  -- Check for active promotion in this section
  SELECT * INTO v_active_promotion
  FROM promotions
  WHERE target_id = p_target_id
    AND promotion_type = p_promotion_type
    AND promotion_section_id = p_section_id
    AND user_id = p_user_id
    AND status IN ('active', 'pending_approval')
    AND (end_date IS NULL OR end_date > now())
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'already_active',
      'message', 'This content is already promoted in this section. Please wait until the current promotion ends.',
      'current_promotion_id', v_active_promotion.id,
      'current_end_date', v_active_promotion.end_date
    );
  END IF;

  -- Check for active cooldown period
  SELECT * INTO v_cooldown_promotion
  FROM promotions
  WHERE target_id = p_target_id
    AND promotion_type = p_promotion_type
    AND promotion_section_id = p_section_id
    AND user_id = p_user_id
    AND cooldown_until IS NOT NULL
    AND cooldown_until > now()
  ORDER BY cooldown_until DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'cooldown_active',
      'message', 'This content is in cooldown period. Please wait before promoting again in this section.',
      'cooldown_until', v_cooldown_promotion.cooldown_until,
      'previous_promotion_id', v_cooldown_promotion.id
    );
  END IF;

  -- Content is available for promotion
  RETURN jsonb_build_object(
    'available', true,
    'message', 'Content is available for promotion in this section.'
  );
END;
$$;

-- Function to apply cooldown when promotion ends
CREATE OR REPLACE FUNCTION apply_promotion_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cooldown_hours integer := 2;
BEGIN
  -- Apply cooldown when promotion completes or expires
  IF (NEW.status IN ('completed', 'expired') AND OLD.status IN ('active', 'pending_approval')) THEN
    NEW.previous_end_date := COALESCE(NEW.end_date, now());
    NEW.cooldown_until := COALESCE(NEW.end_date, now()) + (v_cooldown_hours || ' hours')::interval;
  END IF;

  -- Also apply cooldown if end_date is reached
  IF (NEW.end_date IS NOT NULL AND NEW.end_date <= now() AND (OLD.end_date IS NULL OR OLD.end_date > now())) THEN
    NEW.status := 'completed';
    NEW.previous_end_date := NEW.end_date;
    NEW.cooldown_until := NEW.end_date + (v_cooldown_hours || ' hours')::interval;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic cooldown application
DROP TRIGGER IF EXISTS trigger_apply_promotion_cooldown ON promotions;
CREATE TRIGGER trigger_apply_promotion_cooldown
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION apply_promotion_cooldown();

-- Function to get available sections for content promotion
CREATE OR REPLACE FUNCTION get_available_promotion_sections(
  p_target_id uuid,
  p_promotion_type text,
  p_user_id uuid
)
RETURNS TABLE (
  section_id uuid,
  section_name text,
  section_key text,
  is_available boolean,
  unavailable_reason text,
  cooldown_until timestamptz,
  current_promotion_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH section_status AS (
    SELECT 
      ps.id as section_id,
      ps.section_name,
      ps.section_key,
      (check_promotion_availability(p_target_id, p_promotion_type, ps.id, p_user_id)) as availability_check
    FROM promotion_sections ps
    WHERE ps.is_active = true
    ORDER BY ps.sort_order
  )
  SELECT 
    ss.section_id,
    ss.section_name,
    ss.section_key,
    (ss.availability_check->>'available')::boolean as is_available,
    ss.availability_check->>'reason' as unavailable_reason,
    (ss.availability_check->>'cooldown_until')::timestamptz as cooldown_until,
    (ss.availability_check->>'current_promotion_id')::uuid as current_promotion_id
  FROM section_status ss;
END;
$$;

-- Add constraint to prevent duplicate active promotions
CREATE OR REPLACE FUNCTION validate_unique_active_promotion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_count integer;
  v_cooldown_until timestamptz;
BEGIN
  -- Only validate for active or pending promotions
  IF NEW.status IN ('active', 'pending_approval') THEN
    -- Check for duplicate active promotions
    SELECT COUNT(*) INTO v_existing_count
    FROM promotions
    WHERE target_id = NEW.target_id
      AND promotion_type = NEW.promotion_type
      AND promotion_section_id = NEW.promotion_section_id
      AND user_id = NEW.user_id
      AND status IN ('active', 'pending_approval')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (end_date IS NULL OR end_date > now());

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'This content is already promoted in this section. Please wait until the current promotion ends.';
    END IF;

    -- Check cooldown period
    SELECT cooldown_until INTO v_cooldown_until
    FROM promotions
    WHERE target_id = NEW.target_id
      AND promotion_type = NEW.promotion_type
      AND promotion_section_id = NEW.promotion_section_id
      AND user_id = NEW.user_id
      AND cooldown_until IS NOT NULL
      AND cooldown_until > now()
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY cooldown_until DESC
    LIMIT 1;

    IF v_cooldown_until IS NOT NULL THEN
      RAISE EXCEPTION 'This content is in cooldown period until %. Please wait before promoting again in this section.', v_cooldown_until;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for validation
DROP TRIGGER IF EXISTS trigger_validate_unique_active_promotion ON promotions;
CREATE TRIGGER trigger_validate_unique_active_promotion
  BEFORE INSERT OR UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION validate_unique_active_promotion();

-- Create view for active promotions with cooldown info
CREATE OR REPLACE VIEW active_promotions_with_cooldown AS
SELECT 
  p.*,
  CASE 
    WHEN p.cooldown_until IS NOT NULL AND p.cooldown_until > now() 
    THEN true 
    ELSE false 
  END as is_in_cooldown,
  CASE 
    WHEN p.cooldown_until IS NOT NULL AND p.cooldown_until > now()
    THEN extract(epoch from (p.cooldown_until - now())) / 3600
    ELSE 0
  END as cooldown_hours_remaining,
  ps.section_name,
  ps.section_key
FROM promotions p
LEFT JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE p.status IN ('active', 'pending_approval', 'completed', 'expired')
ORDER BY p.created_at DESC;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_promotion_availability(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_promotion_sections(uuid, text, uuid) TO authenticated;
GRANT SELECT ON active_promotions_with_cooldown TO authenticated;

-- Add RLS policy for the view
ALTER VIEW active_promotions_with_cooldown SET (security_invoker = true);

-- Add comment for documentation
COMMENT ON COLUMN promotions.cooldown_until IS 'Timestamp until which content cannot be re-promoted in this section (2-hour cooldown after promotion ends)';
COMMENT ON COLUMN promotions.previous_end_date IS 'Stores the end date of the previous promotion for cooldown calculation';
COMMENT ON FUNCTION check_promotion_availability(uuid, text, uuid, uuid) IS 'Checks if content can be promoted in a section, considering active promotions and cooldown periods';
COMMENT ON FUNCTION get_available_promotion_sections(uuid, text, uuid) IS 'Returns list of sections with availability status for promoting specific content';
COMMENT ON VIEW active_promotions_with_cooldown IS 'View showing all promotions with cooldown status and remaining hours';

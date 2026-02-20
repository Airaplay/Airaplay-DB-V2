/*
  # Add Scheduled Rotation Job System

  ## Overview
  Adds a function to be called by a scheduled job (cron) that handles
  rotation cycle management automatically.

  ## 1. New Functions
    - `scheduled_rotation_job`: Main job function that runs every 2 hours
    - `get_sections_needing_rotation`: Helper to identify sections that need rotation

  ## 2. Features
    - Automatically rotates expired cycles
    - Recalculates visibility scores before rotation
    - Logs rotation events
    - Handles fairness enforcement
    - Updates queue state for all active promotions

  ## 3. Usage
    This function should be called by:
    - A cron job (e.g., pg_cron extension)
    - Or client-side scheduler (as implemented in rotationQueueManager)
    - Or a serverless function on a schedule

  ## 4. Performance
    - Batches operations for efficiency
    - Only rotates sections that have expired cycles
    - Minimal database queries
*/

-- Function to get sections that need rotation
CREATE OR REPLACE FUNCTION get_sections_needing_rotation()
RETURNS TABLE (
  section_key text,
  last_cycle_end timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    prc.section_key,
    prc.cycle_end_time
  FROM promotion_rotation_cycles prc
  WHERE prc.status = 'active'
    AND prc.cycle_end_time <= now()
  ORDER BY prc.cycle_end_time ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check and create rotation cycle if needed
CREATE OR REPLACE FUNCTION ensure_rotation_cycle_exists(
  p_section_key text
)
RETURNS void AS $$
DECLARE
  v_current_cycle_count integer;
  v_max_cycle_number integer;
BEGIN
  -- Check if an active cycle exists
  SELECT COUNT(*) INTO v_current_cycle_count
  FROM promotion_rotation_cycles
  WHERE section_key = p_section_key AND status = 'active';

  -- If no active cycle, create one
  IF v_current_cycle_count = 0 THEN
    -- Get the max cycle number
    SELECT COALESCE(MAX(cycle_number), 0) INTO v_max_cycle_number
    FROM promotion_rotation_cycles
    WHERE section_key = p_section_key;

    -- Create new cycle
    INSERT INTO promotion_rotation_cycles (
      section_key,
      cycle_number,
      cycle_start_time,
      cycle_end_time,
      status
    ) VALUES (
      p_section_key,
      v_max_cycle_number + 1,
      now(),
      now() + interval '2 hours',
      'active'
    );

    RAISE NOTICE 'Created new rotation cycle for section: %', p_section_key;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Main scheduled rotation job function
CREATE OR REPLACE FUNCTION scheduled_rotation_job()
RETURNS void AS $$
DECLARE
  v_section_record record;
  v_rotated_count integer := 0;
BEGIN
  RAISE NOTICE '[ScheduledRotationJob] Starting scheduled rotation job at %', now();

  -- Update performance scores for all active promotions
  PERFORM update_promotion_performance();
  RAISE NOTICE '[ScheduledRotationJob] Updated promotion performance scores';

  -- Get sections that need rotation
  FOR v_section_record IN
    SELECT * FROM get_sections_needing_rotation()
  LOOP
    BEGIN
      -- Rotate the section
      PERFORM rotate_promotion_cycle(v_section_record.section_key);

      -- Ensure a new cycle is created
      PERFORM ensure_rotation_cycle_exists(v_section_record.section_key);

      v_rotated_count := v_rotated_count + 1;

      RAISE NOTICE '[ScheduledRotationJob] Rotated section: % (last cycle ended at %)',
        v_section_record.section_key,
        v_section_record.last_cycle_end;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[ScheduledRotationJob] Error rotating section %: %',
          v_section_record.section_key,
          SQLERRM;
    END;
  END LOOP;

  -- Also ensure all active sections have cycles
  FOR v_section_record IN
    SELECT section_key
    FROM promotion_sections
    WHERE is_active = true
  LOOP
    PERFORM ensure_rotation_cycle_exists(v_section_record.section_key);
  END LOOP;

  RAISE NOTICE '[ScheduledRotationJob] Completed. Rotated % sections', v_rotated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get rotation job status
CREATE OR REPLACE FUNCTION get_rotation_job_status()
RETURNS TABLE (
  section_key text,
  cycle_number integer,
  cycle_start_time timestamptz,
  cycle_end_time timestamptz,
  time_until_rotation interval,
  promotions_in_rotation integer,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    prc.section_key,
    prc.cycle_number,
    prc.cycle_start_time,
    prc.cycle_end_time,
    prc.cycle_end_time - now() as time_until_rotation,
    prc.promotions_displayed,
    prc.status
  FROM promotion_rotation_cycles prc
  WHERE prc.status = 'active'
  ORDER BY prc.section_key;
END;
$$ LANGUAGE plpgsql;

-- Add index to improve rotation job performance
CREATE INDEX IF NOT EXISTS idx_promotion_rotation_cycles_status_time
  ON promotion_rotation_cycles(status, cycle_end_time);

-- Comments for documentation
COMMENT ON FUNCTION scheduled_rotation_job() IS
  'Main scheduled job that rotates promotion cycles every 2 hours. Should be called by cron or scheduler.';

COMMENT ON FUNCTION get_sections_needing_rotation() IS
  'Returns list of sections with expired rotation cycles that need to be rotated.';

COMMENT ON FUNCTION ensure_rotation_cycle_exists(text) IS
  'Ensures that an active rotation cycle exists for a section, creating one if needed.';

COMMENT ON FUNCTION get_rotation_job_status() IS
  'Returns current status of all rotation cycles for monitoring and debugging.';

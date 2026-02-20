/*
  # Fix promotion_rotation_state missing columns
  
  ## Problem
  The get_smart_rotated_promotions function expects columns total_impressions and total_clicks
  in the promotion_rotation_state table, but these columns are missing from the current schema.
  
  ## Changes
  1. Add missing columns to promotion_rotation_state table:
     - total_impressions (integer, default 0)
     - total_clicks (integer, default 0)
     - click_through_rate (numeric, default 0)
     - rotation_priority (numeric, default 1.0)
     - performance_score (numeric, default 0)
     - last_shown_at (timestamptz)
  
  ## Notes
  These columns are required by the calculate_visibility_score function
  and the promotion fairness system to track engagement metrics.
*/

-- Add missing columns to promotion_rotation_state table
DO $$
BEGIN
  -- Add total_impressions column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'total_impressions'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN total_impressions integer DEFAULT 0;
  END IF;

  -- Add total_clicks column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'total_clicks'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN total_clicks integer DEFAULT 0;
  END IF;

  -- Add click_through_rate column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'click_through_rate'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN click_through_rate numeric DEFAULT 0;
  END IF;

  -- Add rotation_priority column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'rotation_priority'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN rotation_priority numeric DEFAULT 1.0;
  END IF;

  -- Add performance_score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'performance_score'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN performance_score numeric DEFAULT 0;
  END IF;

  -- Add last_shown_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'last_shown_at'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN last_shown_at timestamptz;
  END IF;

  -- Add promotion_id column with foreign key (if missing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'promotion_id'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE;
  END IF;

  -- Add created_at column (if missing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotion_rotation_state' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE promotion_rotation_state ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create index for promotion_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_promotion_rotation_state_promotion_id ON promotion_rotation_state(promotion_id);

-- Add unique constraint for promotion_id and section_key combination (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'promotion_rotation_state_promotion_id_section_key_key'
  ) THEN
    ALTER TABLE promotion_rotation_state 
    ADD CONSTRAINT promotion_rotation_state_promotion_id_section_key_key 
    UNIQUE (promotion_id, section_key);
  END IF;
END $$;

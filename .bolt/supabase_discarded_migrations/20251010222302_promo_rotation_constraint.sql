/*
  # Fix Promotion Rotation State Unique Constraint

  ## Problem
  The `promotion_rotation_state` table has an incorrect unique constraint on `section_key` alone,
  which prevents multiple promotions from being tracked in the same section. This causes
  impression tracking to fail with duplicate key violations.

  ## Solution
  Remove the incorrect unique constraint `promotion_rotation_state_section_key_key` that only
  constrains `section_key`. The correct constraint `(promotion_id, section_key)` already exists.

  ## Impact
  - Fixes impression tracking for all promotions
  - Allows multiple promotions to be active in the same section simultaneously
  - Enables proper impression counting in the Promotion Center

  ## Changes
  1. Drop the incorrect unique constraint on section_key alone
  2. Keep the correct unique constraint on (promotion_id, section_key)
*/

-- Drop the incorrect unique constraint that blocks multiple promotions per section
ALTER TABLE promotion_rotation_state 
DROP CONSTRAINT IF EXISTS promotion_rotation_state_section_key_key;

-- Verify the correct constraint still exists
-- The correct constraint (promotion_id, section_key) should remain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'promotion_rotation_state_promotion_id_section_key_key'
  ) THEN
    RAISE EXCEPTION 'Critical constraint missing: promotion_rotation_state_promotion_id_section_key_key';
  END IF;
END $$;

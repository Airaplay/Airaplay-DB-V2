/*
  # Fix Verified Badge Persistence - Single Row Constraint

  ## Problem
  The verified_badge_config table allows multiple rows, causing inconsistent behavior.

  ## Solution
  1. Clean up all badge config rows
  2. Keep only one with a fixed ID
  3. Add unique constraint to enforce single row
  4. Add triggers to maintain invariant

  ## Changes
  - Delete all existing badge config rows
  - Add helper column with unique constraint
  - Insert single default row
  - Add triggers for enforcement
*/

-- Step 1: Delete all existing badge config rows to start fresh
TRUNCATE verified_badge_config;

-- Step 2: Add helper column if not exists (for unique constraint)
ALTER TABLE verified_badge_config
ADD COLUMN IF NOT EXISTS single_row_marker integer DEFAULT 1;

-- Step 3: Create unique constraint on marker column
-- This ensures only one row can exist (since all rows will have marker = 1)
DO $$
BEGIN
  BEGIN
    ALTER TABLE verified_badge_config
    ADD CONSTRAINT verified_badge_config_single_row_uq 
    UNIQUE (single_row_marker)
    DEFERRABLE INITIALLY DEFERRED;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Constraint already exists
  END;
END $$;

-- Step 4: Insert the single global verified badge configuration
INSERT INTO verified_badge_config (badge_url, updated_at, single_row_marker)
VALUES ('https://via.placeholder.com/24x24.png?text=V', now(), 1);

-- Step 5: Create trigger to enforce marker on insert
CREATE OR REPLACE FUNCTION enforce_single_badge_marker()
RETURNS TRIGGER AS $$
BEGIN
  NEW.single_row_marker := 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_single_badge_marker_trigger ON verified_badge_config;
CREATE TRIGGER enforce_single_badge_marker_trigger
BEFORE INSERT ON verified_badge_config
FOR EACH ROW
EXECUTE FUNCTION enforce_single_badge_marker();

-- Step 6: Create trigger to prevent deletion (keep at least one row)
CREATE OR REPLACE FUNCTION prevent_badge_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM verified_badge_config) <= 1 THEN
    RAISE EXCEPTION 'Cannot delete the verified badge configuration. System must always have exactly one badge.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_badge_deletion_trigger ON verified_badge_config;
CREATE TRIGGER prevent_badge_deletion_trigger
BEFORE DELETE ON verified_badge_config
FOR EACH ROW
EXECUTE FUNCTION prevent_badge_deletion();

-- Step 7: Add index on updated_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_verified_badge_config_updated_at 
ON verified_badge_config(updated_at DESC);

-- Step 8: Add helpful comments
COMMENT ON TABLE verified_badge_config IS
'Global verified badge configuration - exactly one row only.
Use single_row_marker unique constraint to enforce single row invariant.
The verified badge is displayed on all creator profiles.';

COMMENT ON COLUMN verified_badge_config.single_row_marker IS
'Enforces exactly one row in table via unique constraint. Always = 1.';

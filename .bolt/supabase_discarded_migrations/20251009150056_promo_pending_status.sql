/*
  # Update Promotion Status Constraint

  1. Changes
    - Add 'pending_approval' status to promotions table
    - Update status check constraint to include new status

  2. Status Flow
    - pending_approval: Waiting for admin approval
    - pending: Admin approved, waiting for start date
    - active: Currently running
    - completed: Finished successfully
    - cancelled: Cancelled by user or admin
*/

-- Update promotion status check constraint
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_status_check;
  
  -- Add new constraint with pending_approval
  ALTER TABLE promotions ADD CONSTRAINT promotions_status_check 
    CHECK (status IN ('pending_approval', 'pending', 'active', 'completed', 'cancelled'));
END $$;

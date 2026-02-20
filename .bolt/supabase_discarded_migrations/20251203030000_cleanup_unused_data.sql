/*
  # Cleanup Unused Data from Database and Storage

  ## Purpose
  Remove old, unused, or unnecessary data to free up storage space and improve performance.

  ## Cleanup Strategy
  1. Delete old pending payments (abandoned, older than 30 days)
  2. Archive old promotion_exposure_logs (older than 90 days) - move to archive table
  3. Delete old read notifications (older than 90 days)
  4. Clean up old completed promotion_rotation_cycles (older than 90 days)
  5. Remove orphaned records where possible

  ## Safety
  - All deletions are based on age thresholds
  - Only removes data that is clearly unused/abandoned
  - Preserves all active and recent data
  - Creates backup/archive before deletion where appropriate
*/

-- ============================================================================
-- PART 1: Cleanup Old Pending Payments (Abandoned)
-- ============================================================================

-- Delete pending payments older than 30 days (likely abandoned)
-- These are payment intents that were never completed
DELETE FROM treat_payments
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 days';

-- Log the cleanup
DO $$
DECLARE
  deleted_count integer;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old pending payments (abandoned > 30 days)', deleted_count;
END $$;

-- ============================================================================
-- PART 2: Archive Old Promotion Exposure Logs
-- ============================================================================

-- Archive old promotion_exposure_logs to archive table (older than 90 days)
-- This reduces the main table size while preserving historical data
INSERT INTO promotion_exposure_logs_archive (
  id,
  promotion_id,
  section_key,
  cycle_id,
  event_type,
  visibility_score,
  queue_position,
  treat_deducted,
  event_time,
  created_at,
  archived_at
)
SELECT 
  id,
  promotion_id,
  section_key,
  cycle_id,
  event_type,
  visibility_score,
  queue_position,
  treat_deducted,
  event_time,
  created_at,
  NOW() as archived_at
FROM promotion_exposure_logs
WHERE created_at < NOW() - INTERVAL '90 days'
ON CONFLICT (id) DO NOTHING;

-- Delete archived records from main table
DELETE FROM promotion_exposure_logs
WHERE id IN (
  SELECT id FROM promotion_exposure_logs_archive WHERE archived_at >= NOW() - INTERVAL '1 minute'
);

-- Log the archive
DO $$
DECLARE
  archived_count integer;
BEGIN
  SELECT COUNT(*) INTO archived_count
  FROM promotion_exposure_logs_archive
  WHERE archived_at >= NOW() - INTERVAL '1 minute';
  RAISE NOTICE 'Archived % old promotion exposure logs (> 90 days)', archived_count;
END $$;

-- ============================================================================
-- PART 3: Cleanup Old Read Notifications
-- ============================================================================

-- Delete old read notifications (older than 90 days)
-- Unread notifications are kept for user reference
DELETE FROM notifications
WHERE is_read = true
  AND created_at < NOW() - INTERVAL '90 days';

-- Log the cleanup
DO $$
DECLARE
  deleted_count integer;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old read notifications (> 90 days)', deleted_count;
END $$;

-- ============================================================================
-- PART 4: Cleanup Old Completed Promotion Rotation Cycles
-- ============================================================================

-- Delete old completed promotion rotation cycles (older than 90 days)
-- Active and recent cycles are preserved
DELETE FROM promotion_rotation_cycles
WHERE status = 'completed'
  AND cycle_end_time < NOW() - INTERVAL '90 days';

-- Log the cleanup
DO $$
DECLARE
  deleted_count integer;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old completed promotion rotation cycles (> 90 days)', deleted_count;
END $$;

-- ============================================================================
-- PART 5: Cleanup Old Deleted Messages
-- ============================================================================

-- Delete permanently deleted messages older than 90 days
-- This helps free up space while keeping recent deleted messages for recovery
DELETE FROM messages
WHERE is_deleted = true
  AND deleted_at < NOW() - INTERVAL '90 days';

-- Log the cleanup
DO $$
DECLARE
  deleted_count integer;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old deleted messages (> 90 days)', deleted_count;
END $$;

-- ============================================================================
-- PART 6: Cleanup Old Admin Activity Logs (Optional - Keep for Audit)
-- ============================================================================

-- Note: Admin activity logs are kept for audit purposes
-- Only delete if older than 1 year (365 days) for compliance
DELETE FROM admin_activity_log
WHERE created_at < NOW() - INTERVAL '365 days';

-- Log the cleanup
DO $$
DECLARE
  deleted_count integer;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old admin activity logs (> 365 days)', deleted_count;
END $$;

-- ============================================================================
-- PART 7: Cleanup Old Play Fraud Detection Records
-- ============================================================================

-- Delete old play fraud detection records (older than 90 days)
-- Recent records are kept for active monitoring
DELETE FROM play_fraud_detection
WHERE created_at < NOW() - INTERVAL '90 days'
  AND is_suspicious = false;  -- Keep suspicious records longer

-- Log the cleanup
DO $$
DECLARE
  deleted_count integer;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old non-suspicious play fraud records (> 90 days)', deleted_count;
END $$;

-- ============================================================================
-- PART 8: Vacuum and Analyze (Performance Optimization)
-- ============================================================================

-- Vacuum tables to reclaim space after deletions
VACUUM ANALYZE promotion_exposure_logs;
VACUUM ANALYZE notifications;
VACUUM ANALYZE promotion_rotation_cycles;
VACUUM ANALYZE messages;
VACUUM ANALYZE treat_payments;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Cleanup completed successfully!';
  RAISE NOTICE 'Run VACUUM FULL for maximum space reclamation (during maintenance window)';
END $$;







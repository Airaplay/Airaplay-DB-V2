/*
  # Verification Script for Daily Check-in Duplication Fix
  
  Run this script AFTER applying migration 20251203000000_fix_daily_checkin_duplications_and_standardize.sql
  to verify that all fixes were applied correctly.
*/

-- ============================================================================
-- 1. Verify Transaction Type Standardization
-- ============================================================================

SELECT 
  'Transaction Type Check' as check_name,
  COUNT(*) as checkin_reward_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS: No checkin_reward transactions found'
    ELSE '❌ FAIL: Found ' || COUNT(*) || ' checkin_reward transactions'
  END as result
FROM treat_transactions 
WHERE transaction_type = 'checkin_reward';

SELECT 
  'Daily Check-in Transactions' as check_name,
  COUNT(*) as daily_checkin_count,
  '✅ Found ' || COUNT(*) || ' daily_checkin transactions' as result
FROM treat_transactions 
WHERE transaction_type = 'daily_checkin';

-- ============================================================================
-- 2. Verify add_treat_balance Function Signature
-- ============================================================================

SELECT 
  'add_treat_balance Function' as check_name,
  proname,
  pronargs as parameter_count,
  CASE 
    WHEN pronargs = 5 THEN '✅ PASS: Correct signature (5 parameters)'
    ELSE '❌ FAIL: Expected 5 parameters, found ' || pronargs
  END as result
FROM pg_proc 
WHERE proname = 'add_treat_balance'
ORDER BY pronargs DESC
LIMIT 1;

-- ============================================================================
-- 3. Verify process_daily_checkin Function Exists
-- ============================================================================

SELECT 
  'process_daily_checkin Function' as check_name,
  proname,
  pronargs as parameter_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS: Function exists'
    ELSE '❌ FAIL: Function not found'
  END as result
FROM pg_proc 
WHERE proname = 'process_daily_checkin'
GROUP BY proname, pronargs;

-- ============================================================================
-- 4. Verify Trigger Exists and is Attached
-- ============================================================================

SELECT 
  'Trigger Check' as check_name,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS: Trigger exists and is attached'
    ELSE '❌ FAIL: Trigger not found'
  END as result
FROM pg_trigger
WHERE tgname = 'trigger_update_treat_wallet'
GROUP BY tgname, tgrelid;

-- ============================================================================
-- 5. Verify Trigger Function Uses Only daily_checkin
-- ============================================================================

-- Check if trigger function source code contains checkin_reward
SELECT 
  'Trigger Function Source Check' as check_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%checkin_reward%' THEN '❌ FAIL: Trigger function still references checkin_reward'
    WHEN pg_get_functiondef(oid) LIKE '%daily_checkin%' THEN '✅ PASS: Trigger function uses daily_checkin'
    ELSE '⚠️  WARNING: Could not verify trigger function content'
  END as result
FROM pg_proc 
WHERE proname = 'trigger_update_treat_wallet';

-- ============================================================================
-- 6. Check for Duplicate Function Signatures
-- ============================================================================

SELECT 
  'Duplicate Function Check' as check_name,
  proname,
  COUNT(*) as signature_count,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ PASS: Only one version exists'
    ELSE '❌ FAIL: Found ' || COUNT(*) || ' versions of ' || proname
  END as result
FROM pg_proc 
WHERE proname IN ('add_treat_balance', 'process_daily_checkin')
GROUP BY proname;

-- ============================================================================
-- 7. Summary Report
-- ============================================================================

SELECT 
  '=== SUMMARY ===' as summary,
  '' as details;

-- Count all issues found
WITH checks AS (
  SELECT 
    CASE 
      WHEN (SELECT COUNT(*) FROM treat_transactions WHERE transaction_type = 'checkin_reward') > 0 THEN 1
      ELSE 0
    END as checkin_reward_issue,
    CASE 
      WHEN (SELECT COUNT(*) FROM pg_proc WHERE proname = 'add_treat_balance' AND pronargs != 5) > 0 THEN 1
      ELSE 0
    END as add_treat_balance_issue,
    CASE 
      WHEN (SELECT COUNT(*) FROM pg_proc WHERE proname = 'process_daily_checkin') = 0 THEN 1
      ELSE 0
    END as process_daily_checkin_issue,
    CASE 
      WHEN (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trigger_update_treat_wallet') = 0 THEN 1
      ELSE 0
    END as trigger_issue
)
SELECT 
  'Total Issues Found' as metric,
  (checkin_reward_issue + add_treat_balance_issue + process_daily_checkin_issue + trigger_issue) as issue_count,
  CASE 
    WHEN (checkin_reward_issue + add_treat_balance_issue + process_daily_checkin_issue + trigger_issue) = 0 
    THEN '✅ ALL CHECKS PASSED'
    ELSE '❌ SOME ISSUES FOUND - Review above'
  END as status
FROM checks;







/*
  # Payment Monitoring Diagnostic Queries
  
  Run these queries to diagnose why Payment Monitoring section is not working.
  Run Query 13 first for a quick summary, then dive deeper with other queries.
*/

-- =====================================================
-- QUERY 13: Quick Diagnostic Summary (RUN THIS FIRST)
-- =====================================================
SELECT 
  'View Exists' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'uncredited_payments') 
    THEN '✓ YES' 
    ELSE '✗ NO - VIEW MISSING'
  END as status
UNION ALL
SELECT 
  'View Has Permissions' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_privileges
      WHERE table_name = 'uncredited_payments' 
        AND grantee IN ('authenticated', 'public')
    ) 
    THEN '✓ YES' 
    ELSE '✗ NO - MISSING PERMISSIONS'
  END as status
UNION ALL
SELECT 
  'Payment Alerts Table Exists' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_alerts') 
    THEN '✓ YES' 
    ELSE '✗ NO - TABLE MISSING'
  END as status
UNION ALL
SELECT 
  'Completed Payments Found' as check_item,
  COUNT(*)::text || ' payments' as status
FROM treat_payments
WHERE status = 'completed' AND completed_at IS NOT NULL
UNION ALL
SELECT 
  'Uncredited Payments (Manual Check)' as check_item,
  COUNT(*)::text || ' uncredited payments' as status
FROM treat_payments tp
LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text AND tt.status = 'completed'
WHERE tp.status = 'completed'
  AND tt.id IS NULL
  AND tp.completed_at IS NOT NULL;

-- =====================================================
-- QUERY 1: Check if view exists and its definition
-- =====================================================
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views 
WHERE viewname = 'uncredited_payments';

-- =====================================================
-- QUERY 2: Check view permissions
-- =====================================================
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'uncredited_payments';

-- =====================================================
-- QUERY 3: Check if migration was applied
-- =====================================================
SELECT 
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%payment_monitoring%'
ORDER BY inserted_at DESC;

-- =====================================================
-- QUERY 4: Test direct view query
-- =====================================================
SELECT COUNT(*) as uncredited_count
FROM uncredited_payments;

-- =====================================================
-- QUERY 5: Check for completed payments without transactions (manual)
-- =====================================================
SELECT 
  tp.id as payment_id,
  tp.user_id,
  tp.status,
  tp.completed_at,
  tp.created_at,
  COUNT(tt.id) as transaction_count
FROM treat_payments tp
LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text AND tt.status = 'completed'
WHERE tp.status = 'completed'
  AND tp.completed_at IS NOT NULL
GROUP BY tp.id, tp.user_id, tp.status, tp.completed_at, tp.created_at
HAVING COUNT(tt.id) = 0
ORDER BY tp.completed_at DESC
LIMIT 10;

-- =====================================================
-- QUERY 6: Check payment reference format
-- =====================================================
SELECT 
  tp.id as payment_id,
  tp.id::text as payment_id_as_text,
  tt.payment_reference,
  CASE 
    WHEN tt.payment_reference = tp.id::text THEN 'MATCH'
    ELSE 'MISMATCH'
  END as reference_match
FROM treat_payments tp
LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text
WHERE tp.status = 'completed'
LIMIT 10;

-- =====================================================
-- QUERY 7: Check RLS policies
-- =====================================================
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) 
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename = 'treat_payments'
     AND policyname LIKE '%admin%') as admin_policies
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('treat_payments', 'treat_transactions', 'users', 'treat_packages');

-- =====================================================
-- QUERY 8: Payment counts by status
-- =====================================================
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as with_completed_at
FROM treat_payments
GROUP BY status;

-- =====================================================
-- QUERY 9: Transaction linkage analysis
-- =====================================================
SELECT 
  COUNT(DISTINCT tp.id) as total_completed_payments,
  COUNT(DISTINCT tt.id) as total_purchase_transactions,
  COUNT(DISTINCT CASE 
    WHEN tt.payment_reference = tp.id::text AND tt.status = 'completed' 
    THEN tp.id 
  END) as payments_with_transactions,
  COUNT(DISTINCT tp.id) - COUNT(DISTINCT CASE 
    WHEN tt.payment_reference = tp.id::text AND tt.status = 'completed' 
    THEN tp.id 
  END) as payments_without_transactions
FROM treat_payments tp
LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text
WHERE tp.status = 'completed' AND tp.completed_at IS NOT NULL;

-- =====================================================
-- QUERY 10: Check admin role (needs to be run as authenticated user)
-- =====================================================
SELECT 
  id,
  email,
  role,
  CASE 
    WHEN role = 'admin' THEN '✓ YES - Has Admin Access'
    ELSE '✗ NO - Missing Admin Access'
  END as admin_status
FROM users
WHERE id = auth.uid();

-- =====================================================
-- QUERY 11: Check payment_alerts table
-- =====================================================
SELECT 
  COUNT(*) as alert_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_alerts
FROM payment_alerts;

-- =====================================================
-- QUERY 12: Test view logic with SECURITY DEFINER
-- =====================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM treat_payments tp
  JOIN users u ON u.id = tp.user_id
  JOIN treat_packages pkg ON pkg.id = tp.package_id
  LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text AND tt.status = 'completed'
  WHERE tp.status = 'completed'
    AND tt.id IS NULL
    AND tp.completed_at IS NOT NULL;
  
  RAISE NOTICE 'Uncredited payments found: %', v_count;
END $$;







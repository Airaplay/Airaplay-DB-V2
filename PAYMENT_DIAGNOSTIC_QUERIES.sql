/*
  # Payment Diagnostic Queries - Find Uncredited Payments
  Run these queries to identify why a successful payment wasn't credited
*/

-- =====================================================
-- QUERY 1: Recent Payments Summary (RUN THIS FIRST)
-- =====================================================
SELECT 
  tp.id as payment_id,
  tp.status as payment_status,
  tp.completed_at,
  tp.created_at,
  tp.payment_method,
  tp.amount,
  tp.currency,
  tp.external_reference,
  u.email as user_email,
  u.display_name,
  -- Check if transaction exists
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM treat_transactions 
      WHERE payment_reference = tp.id::text 
      AND status = 'completed'
    ) THEN '✓ CREDITED'
    ELSE '✗ NOT CREDITED'
  END as credit_status,
  -- Hours since payment
  EXTRACT(EPOCH FROM (NOW() - tp.created_at))/3600 as hours_ago,
  -- Hours since completion (if completed)
  CASE 
    WHEN tp.completed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (NOW() - tp.completed_at))/3600 
    ELSE NULL 
  END as hours_since_completion
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE tp.created_at >= NOW() - INTERVAL '7 days'
ORDER BY tp.created_at DESC
LIMIT 20;

-- =====================================================
-- QUERY 2: Find Uncredited Payments (from view)
-- =====================================================
SELECT 
  payment_id,
  user_id,
  display_name,
  email,
  amount,
  currency,
  payment_method,
  payment_status,
  completed_at,
  payment_created,
  package_name,
  treats_amount,
  bonus_amount,
  total_treats,
  hours_since_completion
FROM uncredited_payments
ORDER BY completed_at DESC;

-- =====================================================
-- QUERY 3: Problematic Payments Analysis
-- =====================================================
SELECT 
  tp.id as payment_id,
  tp.status,
  tp.completed_at,
  tp.created_at,
  tp.payment_method,
  tp.external_reference,
  u.email,
  u.display_name,
  CASE 
    WHEN tp.status = 'completed' AND tp.completed_at IS NOT NULL 
      AND NOT EXISTS (
        SELECT 1 FROM treat_transactions 
        WHERE payment_reference = tp.id::text AND status = 'completed'
      )
    THEN 'COMPLETED BUT NOT CREDITED'
    
    WHEN tp.status = 'pending' 
      AND tp.created_at < NOW() - INTERVAL '30 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM treat_transactions 
        WHERE payment_reference = tp.id::text AND status = 'completed'
      )
    THEN 'STUCK IN PENDING (OLD)'
    
    WHEN tp.status = 'pending' 
      AND tp.completed_at IS NOT NULL
    THEN 'PENDING WITH COMPLETION TIME (INCONSISTENT)'
    
    ELSE 'OTHER'
  END as issue_type
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE 
  (tp.status = 'completed' 
   AND tp.completed_at IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM treat_transactions 
     WHERE payment_reference = tp.id::text AND status = 'completed'
   ))
  OR
  (tp.status = 'pending' 
   AND tp.created_at < NOW() - INTERVAL '30 minutes'
   AND NOT EXISTS (
     SELECT 1 FROM treat_transactions 
     WHERE payment_reference = tp.id::text AND status = 'completed'
   ))
ORDER BY tp.created_at DESC;

-- =====================================================
-- QUERY 4: Transaction Records Check
-- =====================================================
SELECT 
  tp.id as payment_id,
  tp.status as payment_status,
  tp.completed_at,
  tt.id as transaction_id,
  tt.status as transaction_status,
  tt.description,
  tt.created_at as transaction_created,
  u.email
FROM treat_payments tp
LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text
JOIN users u ON u.id = tp.user_id
WHERE tp.created_at >= NOW() - INTERVAL '7 days'
ORDER BY tp.created_at DESC, tt.created_at DESC
LIMIT 30;

-- =====================================================
-- QUERY 5: Payment Counts by Status
-- =====================================================
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as with_completed_at
FROM treat_payments
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status;

-- =====================================================
-- QUERY 6: Payment Alerts Check
-- =====================================================
SELECT 
  id,
  alert_type,
  severity,
  status,
  payment_id,
  title,
  description,
  created_at,
  metadata
FROM payment_alerts
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;





/*
  # Enhanced Payment Monitoring - Detect Stuck Pending Payments
  
  This migration enhances the payment monitoring system to detect payments
  that are stuck in 'pending' status, which are invisible to the current
  monitoring system that only checks 'completed' payments.
*/

-- =====================================================
-- 1. Create view for stuck pending payments
-- =====================================================

CREATE OR REPLACE VIEW stuck_pending_payments AS
SELECT 
  tp.id as payment_id,
  tp.user_id,
  u.display_name,
  u.email,
  tp.amount,
  tp.currency,
  tp.payment_method,
  tp.status as payment_status,
  tp.completed_at,
  tp.created_at as payment_created,
  tp.external_reference,
  pkg.name as package_name,
  pkg.treats as treats_amount,
  pkg.bonus as bonus_amount,
  (pkg.treats + pkg.bonus) as total_treats,
  EXTRACT(EPOCH FROM (NOW() - tp.created_at))/3600 as hours_since_creation,
  CASE 
    WHEN tp.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - tp.completed_at))/3600
    ELSE NULL
  END as hours_since_completion,
  -- Check if transaction exists (even if failed)
  EXISTS (
    SELECT 1 FROM treat_transactions 
    WHERE payment_reference = tp.id::text 
    AND status = 'completed'
  ) as has_completed_transaction,
  -- Check for any transaction attempts
  (SELECT COUNT(*) FROM treat_transactions WHERE payment_reference = tp.id::text) as transaction_attempts
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
JOIN treat_packages pkg ON pkg.id = tp.package_id
LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text AND tt.status = 'completed'
WHERE 
  tp.status = 'pending'
  AND tt.id IS NULL  -- No completed transaction
  AND tp.created_at < NOW() - INTERVAL '30 minutes'  -- Older than 30 minutes
ORDER BY tp.created_at DESC;

-- Grant access to admins
GRANT SELECT ON stuck_pending_payments TO authenticated;

-- =====================================================
-- 2. Create view combining both uncredited and stuck payments
-- =====================================================

CREATE OR REPLACE VIEW all_payment_issues AS
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
  hours_since_completion,
  NULL::numeric as hours_since_creation,
  'uncredited' as issue_type,
  CASE 
    WHEN hours_since_completion > 24 THEN 'critical'
    WHEN hours_since_completion > 12 THEN 'high'
    WHEN hours_since_completion > 2 THEN 'medium'
    ELSE 'low'
  END as severity
FROM uncredited_payments

UNION ALL

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
  hours_since_completion,
  hours_since_creation,
  'stuck_pending' as issue_type,
  CASE 
    WHEN hours_since_creation > 24 THEN 'critical'
    WHEN hours_since_creation > 12 THEN 'high'
    WHEN hours_since_creation > 2 THEN 'medium'
    ELSE 'low'
  END as severity
FROM stuck_pending_payments;

-- Grant access to admins
GRANT SELECT ON all_payment_issues TO authenticated;

-- =====================================================
-- 3. Enhance monitoring function to check stuck pending payments
-- =====================================================

CREATE OR REPLACE FUNCTION monitor_uncredited_payments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uncredited_count integer;
  v_stuck_pending_count integer;
  v_alert_count integer := 0;
  v_payment_record record;
BEGIN
  -- Find all uncredited completed payments
  FOR v_payment_record IN 
    SELECT * FROM uncredited_payments
    WHERE hours_since_completion > 0.5  -- Alert after 30 minutes
  LOOP
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM payment_alerts
      WHERE payment_id = v_payment_record.payment_id
      AND status != 'resolved'
    ) THEN
      -- Create new alert
      INSERT INTO payment_alerts (
        alert_type,
        severity,
        payment_id,
        user_id,
        title,
        description,
        metadata
      ) VALUES (
        'uncredited_payment',
        CASE 
          WHEN v_payment_record.hours_since_completion > 24 THEN 'critical'
          WHEN v_payment_record.hours_since_completion > 12 THEN 'high'
          WHEN v_payment_record.hours_since_completion > 2 THEN 'medium'
          ELSE 'low'
        END,
        v_payment_record.payment_id,
        v_payment_record.user_id,
        format('Uncredited Payment: %s treats for %s', v_payment_record.total_treats, v_payment_record.display_name),
        format('Payment completed %s hours ago but treats not credited. User: %s, Amount: %s %s, Package: %s (%s treats)',
          ROUND(v_payment_record.hours_since_completion::numeric, 2),
          v_payment_record.display_name,
          v_payment_record.amount,
          v_payment_record.currency,
          v_payment_record.package_name,
          v_payment_record.total_treats
        ),
        jsonb_build_object(
          'payment_id', v_payment_record.payment_id,
          'user_id', v_payment_record.user_id,
          'user_email', v_payment_record.email,
          'amount_paid', v_payment_record.amount,
          'currency', v_payment_record.currency,
          'treats_owed', v_payment_record.total_treats,
          'package_name', v_payment_record.package_name,
          'completed_at', v_payment_record.completed_at,
          'hours_overdue', ROUND(v_payment_record.hours_since_completion::numeric, 2)
        )
      );
      
      v_alert_count := v_alert_count + 1;
    END IF;
  END LOOP;

  -- Find all stuck pending payments
  FOR v_payment_record IN 
    SELECT * FROM stuck_pending_payments
    WHERE hours_since_creation > 0.5  -- Alert after 30 minutes
  LOOP
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM payment_alerts
      WHERE payment_id = v_payment_record.payment_id
      AND status != 'resolved'
      AND alert_type = 'stuck_pending_payment'
    ) THEN
      -- Create new alert for stuck pending payment
      INSERT INTO payment_alerts (
        alert_type,
        severity,
        payment_id,
        user_id,
        title,
        description,
        metadata
      ) VALUES (
        'stuck_pending_payment',
        CASE 
          WHEN v_payment_record.hours_since_creation > 24 THEN 'critical'
          WHEN v_payment_record.hours_since_creation > 12 THEN 'high'
          WHEN v_payment_record.hours_since_creation > 2 THEN 'medium'
          ELSE 'low'
        END,
        v_payment_record.payment_id,
        v_payment_record.user_id,
        format('Stuck Pending Payment: %s treats for %s', v_payment_record.total_treats, v_payment_record.display_name),
        format('Payment stuck in pending status for %s hours. User: %s, Amount: %s %s, Package: %s (%s treats). External Ref: %s. Webhook may not have been received.',
          ROUND(v_payment_record.hours_since_creation::numeric, 2),
          v_payment_record.display_name,
          v_payment_record.amount,
          v_payment_record.currency,
          v_payment_record.package_name,
          v_payment_record.total_treats,
          COALESCE(v_payment_record.external_reference, 'N/A')
        ),
        jsonb_build_object(
          'payment_id', v_payment_record.payment_id,
          'user_id', v_payment_record.user_id,
          'user_email', v_payment_record.email,
          'amount_paid', v_payment_record.amount,
          'currency', v_payment_record.currency,
          'treats_owed', v_payment_record.total_treats,
          'package_name', v_payment_record.package_name,
          'created_at', v_payment_record.payment_created,
          'external_reference', v_payment_record.external_reference,
          'hours_stuck', ROUND(v_payment_record.hours_since_creation::numeric, 2),
          'transaction_attempts', v_payment_record.transaction_attempts
        )
      );
      
      v_alert_count := v_alert_count + 1;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_uncredited_count FROM uncredited_payments;
  SELECT COUNT(*) INTO v_stuck_pending_count FROM stuck_pending_payments;

  RETURN jsonb_build_object(
    'success', true,
    'uncredited_payments_found', v_uncredited_count,
    'stuck_pending_payments_found', v_stuck_pending_count,
    'new_alerts_created', v_alert_count,
    'checked_at', NOW()
  );
END;
$$;

-- =====================================================
-- 4. Update payment_alerts table to support new alert type
-- =====================================================

-- Update the check constraint to include new alert type
ALTER TABLE payment_alerts 
  DROP CONSTRAINT IF EXISTS payment_alerts_alert_type_check;

ALTER TABLE payment_alerts 
  ADD CONSTRAINT payment_alerts_alert_type_check 
  CHECK (alert_type IN ('uncredited_payment', 'wallet_inconsistency', 'failed_activation', 'stuck_pending_payment'));

-- =====================================================
-- 5. Add comments for documentation
-- =====================================================

COMMENT ON VIEW stuck_pending_payments IS 'Lists payments stuck in pending status for more than 30 minutes without completed transactions';
COMMENT ON VIEW all_payment_issues IS 'Combined view of all payment issues: uncredited completed payments and stuck pending payments';


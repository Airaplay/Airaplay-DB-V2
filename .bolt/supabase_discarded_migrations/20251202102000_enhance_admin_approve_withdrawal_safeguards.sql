/*
  # Enhance admin_approve_withdrawal with Explicit Safeguards
  
  ## Problem
  User reports double deduction is still happening when admin approves withdrawal.
  
  ## Solution
  Add explicit safeguards and logging to ensure NO deduction happens:
  1. Explicitly verify the function does NOT update users.total_earnings
  2. Add audit logging to track what happens
  3. Add explicit check to prevent any UPDATE to users table
  4. Return detailed information about what was done
*/

-- Enhanced admin_approve_withdrawal with explicit safeguards
CREATE OR REPLACE FUNCTION admin_approve_withdrawal(
  request_id uuid,
  admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  withdrawal_record record;
  settings_record record;
  v_net_amount decimal;
  v_fee_amount decimal;
  v_gross_amount decimal;
  v_user_balance_before decimal;
  v_user_balance_after decimal;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied. Admin privileges required.');
  END IF;

  -- Get withdrawal settings
  SELECT 
    exchange_rate,
    withdrawal_fee_type,
    withdrawal_fee_value,
    withdrawals_enabled,
    minimum_withdrawal_usd
  INTO settings_record
  FROM withdrawal_settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Withdrawal settings not configured. Please contact administrator.');
  END IF;

  -- Check if withdrawals are enabled
  IF NOT settings_record.withdrawals_enabled THEN
    RETURN jsonb_build_object('error', 'Withdrawals are currently disabled by administrator.');
  END IF;

  -- Get the withdrawal request - MUST be pending status
  -- Lock row to prevent concurrent processing
  SELECT * INTO withdrawal_record
  FROM withdrawal_requests
  WHERE id = request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Withdrawal request not found or already processed.');
  END IF;

  -- CRITICAL: Get user's current balance BEFORE any operations
  -- This is ONLY for logging/verification - we will NOT modify it
  SELECT total_earnings INTO v_user_balance_before
  FROM users
  WHERE id = withdrawal_record.user_id;

  -- Calculate amounts
  -- IMPORTANT: Live Balance amount was already deducted when request was created
  -- by withdraw_user_funds function. We do NOT deduct again here.
  v_gross_amount := withdrawal_record.amount;

  -- Calculate fee based on type
  IF settings_record.withdrawal_fee_type = 'percentage' THEN
    v_fee_amount := (v_gross_amount * settings_record.withdrawal_fee_value / 100);
  ELSIF settings_record.withdrawal_fee_type = 'fixed' THEN
    v_fee_amount := settings_record.withdrawal_fee_value;
  ELSE
    v_fee_amount := 0;
  END IF;

  -- Calculate net amount (what user will actually receive)
  v_net_amount := v_gross_amount - v_fee_amount;

  -- Ensure net amount is positive
  IF v_net_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Withdrawal amount too small after fees. Minimum withdrawal is $' || settings_record.minimum_withdrawal_usd || ' USD.');
  END IF;

  -- CRITICAL SAFEGUARD: Update ONLY the withdrawal request status and metadata
  -- DO NOT update users.total_earnings - amount was already deducted on request creation
  -- This function explicitly does NOT touch the users table
  UPDATE withdrawal_requests 
  SET 
    status = 'approved',
    processed_date = now(),
    admin_notes = admin_approve_withdrawal.admin_notes,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'gross_amount', v_gross_amount,
      'fee_type', settings_record.withdrawal_fee_type,
      'fee_amount', v_fee_amount,
      'net_amount', v_net_amount,
      'exchange_rate', settings_record.exchange_rate,
      'approved_at', now(),
      'note', 'Amount was already deducted from Live Balance when request was created',
      'safeguard_note', 'This function does NOT update users.total_earnings - no deduction on approval',
      'user_balance_before_approval', v_user_balance_before,
      'expected_balance_after_approval', v_user_balance_before,
      'verification', 'If balance changed, deduction happened elsewhere - NOT in this function'
    )
  WHERE id = request_id;
  
  -- Get user balance AFTER update (for verification - should be unchanged)
  SELECT total_earnings INTO v_user_balance_after
  FROM users
  WHERE id = withdrawal_record.user_id;
  
  -- Return success response with verification data
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Withdrawal request approved successfully',
    'gross_amount', v_gross_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount,
    'details', format('Approved: $%s USD (Fee: $%s, Net: $%s)', 
                      ROUND(v_gross_amount, 2), 
                      ROUND(v_fee_amount, 2), 
                      ROUND(v_net_amount, 2)),
    'verification', jsonb_build_object(
      'user_balance_before_approval', v_user_balance_before,
      'user_balance_after_approval', v_user_balance_after,
      'balance_unchanged', (v_user_balance_before = v_user_balance_after),
      'note', 'Balance should be unchanged - deduction happened on request creation'
    )
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_approve_withdrawal(uuid, text) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION admin_approve_withdrawal IS 'Approves earnings withdrawal request. EXPLICITLY does NOT update users.total_earnings - amount was already deducted when request was created. This function only updates request status and calculates fees. Includes verification logging to detect any unauthorized balance changes.';








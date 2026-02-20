/*
  # Fix Double-Deduction on Earnings Withdrawal Approval

  ## Problem
  When admin approves an earnings withdrawal request, an additional deduction from Live Balance 
  was happening, causing double-deduction:
  1. First deduction: User creates request (correct - `withdraw_user_funds` deducts `gross_amount`)
  2. Second deduction: Admin approves (BUG - should NOT deduct again)

  ## Solution
  Ensure `admin_approve_withdrawal` function does NOT update `users.total_earnings`.
  The amount is already deducted when the request is created, so approval should only:
  - Update request status to 'approved'
  - Calculate and store fee details in metadata
  - NOT touch users.total_earnings

  ## Changes
  - Explicitly ensure no UPDATE to users.total_earnings
  - Add clear comments explaining the flow
  - Add validation to prevent processing already-processed requests
*/

-- Fix admin_approve_withdrawal to prevent double-deduction
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
  SELECT * INTO withdrawal_record
  FROM withdrawal_requests
  WHERE id = request_id AND status = 'pending'
  FOR UPDATE;  -- Lock row to prevent concurrent processing

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Withdrawal request not found or already processed.');
  END IF;

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

  -- CRITICAL: Update ONLY the withdrawal request status and metadata
  -- DO NOT update users.total_earnings - amount was already deducted on request creation
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
      'note', 'Amount was already deducted from Live Balance when request was created'
    )
  WHERE id = request_id;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Withdrawal request approved successfully',
    'gross_amount', v_gross_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount,
    'details', format('Approved: $%s USD (Fee: $%s, Net: $%s)', 
                      ROUND(v_gross_amount, 2), 
                      ROUND(v_fee_amount, 2), 
                      ROUND(v_net_amount, 2))
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_approve_withdrawal(uuid, text) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION admin_approve_withdrawal IS 'Approves earnings withdrawal request. Amount was already deducted from Live Balance when request was created - this function does NOT deduct again. Only updates request status and calculates fees.';








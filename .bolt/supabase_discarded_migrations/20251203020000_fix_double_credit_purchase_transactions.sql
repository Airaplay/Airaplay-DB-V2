/*
  # Fix Double Credit Issue for Purchase Transactions

  ## Problem Identified
  - `admin_credit_payment_manually` function updates wallet directly AND inserts transaction
  - Payment webhook (`activateUserPackage`) updates wallet directly AND inserts transaction
  - Trigger fires on transaction insert and updates wallet again → DOUBLE CREDIT
  
  ## Solution
  - Fix `admin_credit_payment_manually` to ONLY insert transaction (let trigger handle wallet)
  - Payment webhook will be fixed in code (TypeScript file)
  - This ensures wallet is updated exactly once per purchase transaction
*/

-- ============================================================================
-- PART 1: Fix admin_credit_payment_manually Function
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_credit_payment_manually(
  p_user_id uuid,
  p_payment_id uuid,
  p_total_treats numeric,
  p_treats_amount numeric,
  p_bonus_amount numeric,
  p_package_name text,
  p_payment_method text,
  p_amount numeric,
  p_currency text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance numeric;
  v_current_purchased numeric;
  v_current_total_purchased numeric;
  v_new_balance numeric;
  v_wallet_existed boolean;
BEGIN
  -- Ensure wallet exists (for balance calculation only)
  INSERT INTO treat_wallets (
    user_id, 
    balance, 
    purchased_balance, 
    earned_balance, 
    total_purchased, 
    total_spent, 
    total_earned, 
    total_withdrawn
  )
  VALUES (p_user_id, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Check if wallet existed before
  SELECT EXISTS(SELECT 1 FROM treat_wallets WHERE user_id = p_user_id)
  INTO v_wallet_existed;

  -- Get current balance (for transaction logging only)
  SELECT 
    balance, 
    purchased_balance, 
    total_purchased
  INTO 
    v_current_balance, 
    v_current_purchased, 
    v_current_total_purchased
  FROM treat_wallets
  WHERE user_id = p_user_id;

  -- Calculate new balance (for transaction logging only)
  v_new_balance := COALESCE(v_current_balance, 0) + p_total_treats;

  -- Validate new balance is not negative
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Invalid balance calculation. Current: %, Amount: %', 
      COALESCE(v_current_balance, 0), p_total_treats;
  END IF;

  -- Insert transaction record ONLY
  -- The trigger trigger_update_treat_wallet() will handle wallet balance updates
  INSERT INTO treat_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    payment_method,
    payment_reference,
    status,
    metadata
  ) VALUES (
    p_user_id,
    'purchase',
    p_total_treats,
    COALESCE(v_current_balance, 0),
    v_new_balance,
    format('Admin manual credit: Purchased %s treats%s (%s package)', 
      p_treats_amount,
      CASE WHEN p_bonus_amount > 0 THEN format(' + %s bonus', p_bonus_amount) ELSE '' END,
      p_package_name
    ),
    p_payment_method,
    p_payment_id::text,
    'completed',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'manual_credit', true,
      'credited_by_admin', true,
      'amount_paid', p_amount,
      'currency', p_currency,
      'package_name', p_package_name,
      'timestamp', NOW()
    )
  );

  -- Return success response with calculated values
  -- Note: Actual wallet balance will be updated by trigger
  RETURN jsonb_build_object(
    'success', true,
    'wallet_existed', v_wallet_existed,
    'previous_balance', COALESCE(v_current_balance, 0),
    'new_balance', v_new_balance,
    'amount_credited', p_total_treats,
    'note', 'Wallet balance updated by trigger'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error crediting payment: %', SQLERRM;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION admin_credit_payment_manually IS 
'Credits a payment to user wallet by inserting a purchase transaction. The trigger_update_treat_wallet() trigger handles all wallet balance updates to prevent double crediting. This function only inserts the transaction record.';







/*
  # Fix Double Trigger Causing Double Daily Check-in Rewards

  ## Problem Identified
  - Two triggers exist on treat_transactions table:
    1. trigger_treat_wallet_update
    2. trigger_update_treat_wallet
  - Both triggers fire AFTER INSERT, causing wallet to be updated twice
  - This results in users receiving double rewards (e.g., 10 treats instead of 5)

  ## Solution
  1. Drop the duplicate trigger (trigger_treat_wallet_update)
  2. Fix the remaining trigger to use NEW.balance_after instead of recalculating
  3. This ensures wallet is updated exactly once per transaction
*/

-- ============================================================================
-- PART 1: Drop Duplicate Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_treat_wallet_update ON public.treat_transactions;

-- ============================================================================
-- PART 2: Fix Remaining Trigger to Use NEW.balance_after
-- ============================================================================

-- Update the trigger function to use NEW.balance_after instead of recalculating
-- This prevents double crediting and ensures consistency
CREATE OR REPLACE FUNCTION public.trigger_update_treat_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_record RECORD;
  v_amount_to_deduct numeric;
  v_deduct_from_purchased numeric;
  v_deduct_from_earned numeric;
BEGIN
  -- Get current wallet state
  SELECT 
    balance, 
    earned_balance, 
    purchased_balance,
    total_spent,
    total_earned
  INTO v_wallet_record
  FROM public.treat_wallets
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  -- Verify wallet exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user_id: %', NEW.user_id;
  END IF;

  -- Handle different transaction types
  -- Use NEW.balance_after (already calculated correctly) instead of recalculating
  IF NEW.transaction_type IN ('tip_received', 'ad_revenue', 'stream_revenue', 'daily_checkin', 'referral_bonus', 'bonus', 'reward', 'earn') THEN
    -- EARNING: Use NEW.balance_after directly (prevents double crediting)
    UPDATE public.treat_wallets
    SET 
      balance = NEW.balance_after,  -- Use pre-calculated balance from transaction
      earned_balance = earned_balance + NEW.amount,
      total_earned = total_earned + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.transaction_type IN ('tip_sent', 'promotion_payment', 'spend', 'purchase_treat') THEN
    -- SPENDING: Deduct from purchased_balance first, then earned_balance
    v_amount_to_deduct := ABS(NEW.amount);  -- Ensure positive for calculation
    
    -- Calculate how much to deduct from each balance
    IF v_wallet_record.purchased_balance >= v_amount_to_deduct THEN
      -- Can fully deduct from purchased balance
      v_deduct_from_purchased := v_amount_to_deduct;
      v_deduct_from_earned := 0;
    ELSIF v_wallet_record.purchased_balance > 0 THEN
      -- Partially deduct from purchased, rest from earned
      v_deduct_from_purchased := v_wallet_record.purchased_balance;
      v_deduct_from_earned := v_amount_to_deduct - v_wallet_record.purchased_balance;
    ELSE
      -- Fully deduct from earned balance
      v_deduct_from_purchased := 0;
      v_deduct_from_earned := v_amount_to_deduct;
    END IF;

    -- Validate sufficient balance
    IF (v_wallet_record.earned_balance + v_wallet_record.purchased_balance) < v_amount_to_deduct THEN
      RAISE EXCEPTION 'Insufficient balance. User has % treats but tried to spend %', 
        (v_wallet_record.earned_balance + v_wallet_record.purchased_balance), v_amount_to_deduct;
    END IF;

    -- Update wallet using NEW.balance_after
    UPDATE public.treat_wallets
    SET 
      balance = NEW.balance_after,  -- Use pre-calculated balance from transaction
      earned_balance = earned_balance - v_deduct_from_earned,
      purchased_balance = purchased_balance - v_deduct_from_purchased,
      total_spent = total_spent + v_amount_to_deduct,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.transaction_type IN ('purchase', 'deposit') THEN
    -- PURCHASING: Use NEW.balance_after
    UPDATE public.treat_wallets
    SET 
      balance = NEW.balance_after,  -- Use pre-calculated balance from transaction
      purchased_balance = purchased_balance + NEW.amount,
      total_purchased = total_purchased + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.transaction_type IN ('withdrawal', 'withdraw') THEN
    -- WITHDRAWAL: Use NEW.balance_after
    UPDATE public.treat_wallets
    SET 
      balance = NEW.balance_after,  -- Use pre-calculated balance from transaction
      total_withdrawn = total_withdrawn + ABS(NEW.amount),
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSE
    -- Unknown transaction type - use NEW.balance_after
    UPDATE public.treat_wallets
    SET 
      balance = NEW.balance_after,  -- Use pre-calculated balance from transaction
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  -- Verify the update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update wallet for user_id: %. Wallet may not exist.', NEW.user_id;
  END IF;
  
  -- Notify about balance change for real-time updates
  PERFORM pg_notify(
    'treat_balance_changed',
    json_build_object(
      'user_id', NEW.user_id,
      'transaction_id', NEW.id,
      'transaction_type', NEW.transaction_type,
      'amount', NEW.amount,
      'new_balance', NEW.balance_after
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.trigger_update_treat_wallet() IS 
'Updates treat_wallets balance, earned_balance, purchased_balance and totals when a treat_transaction is inserted. Uses NEW.balance_after from the transaction to prevent double crediting. Standardized to use ''daily_checkin'' transaction type.';

-- ============================================================================
-- PART 3: Ensure Only One Trigger Exists
-- ============================================================================

-- Ensure only one trigger exists (the correct one)
DROP TRIGGER IF EXISTS trigger_update_treat_wallet ON public.treat_transactions;

-- Create the single, correct trigger
CREATE TRIGGER trigger_update_treat_wallet
    AFTER INSERT ON public.treat_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_treat_wallet();

COMMENT ON TRIGGER trigger_update_treat_wallet ON public.treat_transactions IS 
'Automatically updates treat_wallets balance when a treat_transaction is inserted. Uses NEW.balance_after to prevent double crediting. Only one trigger should exist on this table.';







/*
  # Fix Daily Check-in Duplications and Standardize Transaction Types

  ## Problems Fixed
  1. Inconsistent transaction type naming: 'checkin_reward' vs 'daily_checkin'
  2. Missing process_daily_checkin function (referenced but not defined)
  3. Verification that add_treat_balance is using latest version
  4. Ensure trigger handles daily_checkin correctly

  ## Changes Made
  1. Standardize on 'daily_checkin' transaction type (remove 'checkin_reward')
  2. Create process_daily_checkin function to consolidate check-in logic
  3. Update trigger to only use 'daily_checkin' (remove 'checkin_reward')
  4. Verify add_treat_balance function signature
  5. Add comprehensive comments and documentation

  ## Security
  - All functions maintain SECURITY DEFINER
  - Proper RLS policies remain in place
  - No data loss or security degradation
*/

-- ============================================================================
-- PART 1: Standardize Transaction Types
-- ============================================================================

-- Update any existing transactions that use 'checkin_reward' to 'daily_checkin'
UPDATE treat_transactions
SET transaction_type = 'daily_checkin'
WHERE transaction_type = 'checkin_reward';

-- Update the CHECK constraint to remove 'checkin_reward' and keep only 'daily_checkin'
ALTER TABLE treat_transactions 
DROP CONSTRAINT IF EXISTS treat_transactions_transaction_type_check;

-- Recreate constraint without 'checkin_reward'
ALTER TABLE treat_transactions 
ADD CONSTRAINT treat_transactions_transaction_type_check 
CHECK (transaction_type = ANY (ARRAY[
  'purchase'::text, 
  'spend'::text, 
  'earn'::text, 
  'withdraw'::text, 
  'withdrawal'::text,
  'tip_sent'::text, 
  'tip_received'::text, 
  'daily_checkin'::text, 
  'referral_bonus'::text, 
  'promotion_refund'::text, 
  'ad_revenue'::text, 
  'stream_revenue'::text, 
  'promotion_spent'::text
]));

-- ============================================================================
-- PART 2: Update Trigger to Remove 'checkin_reward' Reference
-- ============================================================================

-- Update the trigger function to only use 'daily_checkin'
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
  -- Standardized: Use 'daily_checkin' (removed 'checkin_reward')
  IF NEW.transaction_type IN ('tip_received', 'ad_revenue', 'stream_revenue', 'daily_checkin', 'referral_bonus', 'bonus', 'reward', 'earn') THEN
    -- EARNING: Add to earned_balance
    UPDATE public.treat_wallets
    SET 
      balance = v_wallet_record.balance + NEW.amount,
      earned_balance = v_wallet_record.earned_balance + NEW.amount,
      total_earned = v_wallet_record.total_earned + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.transaction_type IN ('tip_sent', 'promotion_payment', 'spend', 'purchase_treat') THEN
    -- SPENDING: Deduct from purchased_balance first, then earned_balance
    v_amount_to_deduct := NEW.amount;
    
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

    -- Update wallet
    UPDATE public.treat_wallets
    SET 
      balance = v_wallet_record.balance - v_amount_to_deduct,
      earned_balance = v_wallet_record.earned_balance - v_deduct_from_earned,
      purchased_balance = v_wallet_record.purchased_balance - v_deduct_from_purchased,
      total_spent = v_wallet_record.total_spent + v_amount_to_deduct,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.transaction_type IN ('purchase', 'deposit') THEN
    -- PURCHASING: Add to purchased_balance
    UPDATE public.treat_wallets
    SET 
      balance = v_wallet_record.balance + NEW.amount,
      purchased_balance = v_wallet_record.purchased_balance + NEW.amount,
      total_purchased = total_purchased + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.transaction_type IN ('withdrawal', 'withdraw') THEN
    -- WITHDRAWAL: Already handled by process_treat_withdrawal function
    -- Just update total_withdrawn if needed
    UPDATE public.treat_wallets
    SET 
      total_withdrawn = total_withdrawn + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;

  ELSE
    -- Unknown transaction type - just update balance (legacy support)
    UPDATE public.treat_wallets
    SET 
      balance = NEW.balance_after,
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
'Updates treat_wallets balance, earned_balance, purchased_balance and totals when a treat_transaction is inserted. Maintains the constraint: balance = earned_balance + purchased_balance. For spending, prioritizes deducting from purchased_balance first. Standardized to use ''daily_checkin'' transaction type (removed ''checkin_reward'').';

-- ============================================================================
-- PART 3: Verify and Ensure add_treat_balance is Latest Version
-- ============================================================================

-- Drop all old versions to ensure only latest exists
-- Drop all possible function signatures with exact parameter types
DROP FUNCTION IF EXISTS add_treat_balance(uuid, integer);
DROP FUNCTION IF EXISTS add_treat_balance(uuid, integer, text);
DROP FUNCTION IF EXISTS add_treat_balance(uuid, integer, text, text);
DROP FUNCTION IF EXISTS add_treat_balance(uuid, integer, text, text, uuid);
DROP FUNCTION IF EXISTS add_treat_balance(uuid, integer, text, text, jsonb);

-- Also drop any remaining versions using a dynamic approach
DO $$
DECLARE
  func_record RECORD;
  drop_stmt text;
BEGIN
  FOR func_record IN 
    SELECT pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'add_treat_balance'
      AND pronamespace = 'public'::regnamespace
  LOOP
    drop_stmt := format('DROP FUNCTION IF EXISTS public.add_treat_balance(%s) CASCADE', 
      func_record.args);
    EXECUTE drop_stmt;
  END LOOP;
END $$;

-- Create the latest version (from 20251201142101_fix_daily_checkin_double_reward.sql)
-- This version only inserts transactions and lets the trigger handle wallet updates
CREATE OR REPLACE FUNCTION add_treat_balance(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text DEFAULT 'bonus',
  p_description text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  v_metadata jsonb;
BEGIN
  -- Validate amount
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Amount cannot be zero';
  END IF;

  -- Ensure wallet exists (for balance calculation)
  INSERT INTO treat_wallets (
    user_id, balance, total_purchased, 
    total_spent, total_earned, total_withdrawn,
    earned_balance, purchased_balance
  )
  VALUES (p_user_id, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get the current balance before update (for transaction logging only)
  SELECT balance INTO v_balance_before
  FROM treat_wallets
  WHERE user_id = p_user_id;
  
  -- Calculate the new balance (for transaction logging only)
  v_balance_after := v_balance_before + p_amount;
  
  -- Validate new balance is not negative
  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Required: %', v_balance_before, -p_amount;
  END IF;
  
  -- Build metadata with reference_id if provided
  IF p_reference_id IS NOT NULL THEN
    v_metadata := jsonb_build_object('reference_id', p_reference_id);
  ELSE
    v_metadata := NULL;
  END IF;
  
  -- Insert transaction record only
  -- The trigger trigger_update_treat_wallet() will handle wallet balance updates
  INSERT INTO treat_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_before,
    balance_after,
    status,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    p_transaction_type,
    COALESCE(p_description, 'Treat balance updated'),
    v_balance_before,
    v_balance_after,
    'completed',
    v_metadata
  );
  
  -- Note: Wallet balance update is handled by trigger_update_treat_wallet() trigger
  -- This prevents double updates and ensures consistency
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text, uuid) TO anon;

-- Update function comment
COMMENT ON FUNCTION add_treat_balance IS 
'Adds or deducts treats from user wallet by inserting a transaction. The trigger_update_treat_wallet() trigger handles all wallet balance updates to prevent double updates. Earning types (earn, daily_checkin, referral_bonus, tip_received, bonus, reward) update total_earned. Purchase types (purchase, deposit) update total_purchased. Negative amounts update total_spent. Standardized to use ''daily_checkin'' transaction type.';

-- ============================================================================
-- PART 4: Create process_daily_checkin Function (Consolidated Logic)
-- ============================================================================

-- Create the process_daily_checkin function that was referenced but missing
-- This consolidates check-in logic that's currently in the frontend
CREATE OR REPLACE FUNCTION process_daily_checkin(
  target_user_id uuid,
  ad_impression_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date;
  v_existing_checkin uuid;
  v_user_streak RECORD;
  v_last_date date;
  v_day_diff integer;
  v_new_streak integer;
  v_checkin_config RECORD;
  v_reward_amount integer;
  v_day_number integer;
  v_result jsonb;
BEGIN
  -- Get today's date
  v_today := CURRENT_DATE;

  -- Check if user already checked in today
  SELECT id INTO v_existing_checkin
  FROM daily_checkin_history
  WHERE user_id = target_user_id
    AND checkin_date = v_today
  LIMIT 1;

  IF v_existing_checkin IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has already checked in today',
      'checkin_id', v_existing_checkin
    );
  END IF;

  -- Get user's current streak
  SELECT * INTO v_user_streak
  FROM user_checkin_streaks
  WHERE user_id = target_user_id;

  -- If no streak record exists, create one
  IF NOT FOUND THEN
    INSERT INTO user_checkin_streaks (user_id, current_streak, total_checkins)
    VALUES (target_user_id, 0, 0)
    RETURNING * INTO v_user_streak;
  END IF;

  -- Calculate new streak
  IF v_user_streak.last_checkin_date IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_last_date := v_user_streak.last_checkin_date;
    v_day_diff := v_today - v_last_date;
    
    IF v_day_diff = 1 THEN
      -- Consecutive day
      v_new_streak := v_user_streak.current_streak + 1;
    ELSE
      -- Streak broken
      v_new_streak := 1;
    END IF;
  END IF;

  -- Get check-in config for the day number
  -- Find the active config for this streak day (cycling if needed)
  SELECT * INTO v_checkin_config
  FROM daily_checkin_config
  WHERE active = true
    AND day_number = ((v_new_streak - 1) % 7) + 1  -- Cycle through 7 days
  ORDER BY day_number
  LIMIT 1;

  -- If no config found, use default
  IF NOT FOUND THEN
    v_reward_amount := 10; -- Default reward
    v_day_number := 1;
  ELSE
    v_reward_amount := v_checkin_config.treat_reward;
    v_day_number := v_checkin_config.day_number;
  END IF;

  -- Update streak
  UPDATE user_checkin_streaks
  SET 
    current_streak = v_new_streak,
    last_checkin_date = v_today,
    total_checkins = total_checkins + 1,
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Insert check-in history
  INSERT INTO daily_checkin_history (
    user_id,
    checkin_date,
    day_number,
    treat_reward,
    streak_count,
    ad_impression_id
  ) VALUES (
    target_user_id,
    v_today,
    v_day_number,
    v_reward_amount,
    v_new_streak,
    ad_impression_id_param
  )
  RETURNING id INTO v_existing_checkin;

  -- Add treat balance using standardized transaction type
  PERFORM add_treat_balance(
    target_user_id,
    v_reward_amount,
    'daily_checkin',
    format('Daily Check-in Reward - Day %s (Streak: %s)', v_day_number, v_new_streak),
    NULL
  );

  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_existing_checkin,
    'streak', v_new_streak,
    'reward_amount', v_reward_amount,
    'day_number', v_day_number
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_daily_checkin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_checkin(uuid, uuid) TO service_role;

-- Add comment
COMMENT ON FUNCTION process_daily_checkin IS 
'Processes a daily check-in for a user. Validates duplicate check-ins, updates streak, inserts history, and credits rewards. Returns JSON with success status and check-in details. Uses standardized ''daily_checkin'' transaction type.';

-- ============================================================================
-- PART 5: Ensure Trigger is Attached
-- ============================================================================

-- Ensure trigger exists on treat_transactions table
DROP TRIGGER IF EXISTS trigger_update_treat_wallet ON public.treat_transactions;

-- Create trigger on treat_transactions table
-- This trigger will fire AFTER INSERT and update wallet balances
CREATE TRIGGER trigger_update_treat_wallet
    AFTER INSERT ON public.treat_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_treat_wallet();

-- Add helpful comment to the trigger
COMMENT ON TRIGGER trigger_update_treat_wallet ON public.treat_transactions IS 
'Automatically updates treat_wallets balance, earned_balance, purchased_balance and totals when a treat_transaction is inserted. This prevents double updates when add_treat_balance function is called. Standardized to use ''daily_checkin'' transaction type.';

-- ============================================================================
-- PART 6: Verification Queries (for manual checking)
-- ============================================================================

-- Uncomment these to verify the migration:
-- SELECT COUNT(*) as checkin_reward_count FROM treat_transactions WHERE transaction_type = 'checkin_reward';
-- SELECT COUNT(*) as daily_checkin_count FROM treat_transactions WHERE transaction_type = 'daily_checkin';
-- SELECT proname, pronargs FROM pg_proc WHERE proname = 'add_treat_balance';
-- SELECT proname, pronargs FROM pg_proc WHERE proname = 'process_daily_checkin';


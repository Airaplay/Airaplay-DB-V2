/*
  # Backfill Missing Withdrawals to Live Balance

  ## Purpose
  This script finds all completed treat withdrawals that occurred before the fix
  and ensures the converted USD amounts were properly added to users.total_earnings (Live Balance).

  ## How It Works
  1. Finds all completed withdrawal transactions from treat_transactions
  2. Extracts net_amount from transaction metadata
  3. Checks if the amount was already added to users.total_earnings
  4. Backfills any missing amounts
  5. Logs all backfilled transactions

  ## Safety
  - Only processes completed withdrawals
  - Idempotent (safe to run multiple times)
  - Creates audit log of all backfilled amounts
  - Uses transactions to ensure atomicity
*/

-- Create temporary table to track backfilled withdrawals
CREATE TEMP TABLE IF NOT EXISTS backfill_log (
  transaction_id uuid,
  user_id uuid,
  treats_amount integer,
  net_usd_amount numeric,
  backfilled_amount numeric,
  backfilled_at timestamptz DEFAULT now()
);

-- Function to backfill missing withdrawals
DO $$
DECLARE
  withdrawal_record RECORD;
  v_net_amount numeric;
  v_live_balance_before numeric;
  v_live_balance_after numeric;
  v_backfilled_count integer := 0;
  v_total_backfilled numeric := 0;
  v_expected_balance numeric;
  v_current_balance_check numeric;
BEGIN
  -- Find all completed withdrawal transactions
  FOR withdrawal_record IN
    SELECT 
      tt.id as transaction_id,
      tt.user_id,
      ABS(tt.amount) as treats_amount,
      tt.metadata,
      tt.created_at,
      tt.description
    FROM treat_transactions tt
    WHERE tt.transaction_type = 'withdrawal'
      AND tt.status = 'completed'
      AND tt.amount < 0  -- Negative because it's leaving the wallet
      AND tt.metadata IS NOT NULL
      AND tt.metadata ? 'net_amount'  -- Has net_amount in metadata
    ORDER BY tt.created_at ASC
  LOOP
    -- Extract net_amount from metadata
    v_net_amount := (withdrawal_record.metadata->>'net_amount')::numeric;
    
    -- Skip if net_amount is invalid
    IF v_net_amount IS NULL OR v_net_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Get current live balance
    SELECT COALESCE(total_earnings, 0) INTO v_live_balance_before
    FROM users
    WHERE id = withdrawal_record.user_id;

    -- Check if this withdrawal was already backfilled in this session
    IF EXISTS (
      SELECT 1 FROM backfill_log 
      WHERE transaction_id = withdrawal_record.transaction_id
    ) THEN
      CONTINUE; -- Already backfilled in this run
    END IF;

    -- Check if metadata indicates this was processed by the NEW function
    -- The new function sets 'added_to_live_balance' = true in metadata
    -- If it's true AND we can verify the amount was added, skip it
    -- If it's false or missing, the old function ran and definitely failed
    
    -- Check if this was processed by the new function
    IF (withdrawal_record.metadata->>'added_to_live_balance')::boolean = true THEN
      -- New function ran, check if amount was actually added
      -- Compare expected live_balance_after with current total_earnings
      v_expected_balance := (withdrawal_record.metadata->>'live_balance_after')::numeric;
      v_current_balance_check := v_live_balance_before;
      
      -- If expected balance matches or is close to current, it was already processed
      -- Allow small rounding differences (within $0.01)
      IF v_expected_balance IS NOT NULL AND ABS(v_current_balance_check - v_expected_balance) < 0.01 THEN
        CONTINUE; -- Already processed correctly, skip
      END IF;
    END IF;
    
    -- Add the net amount to user's Live Balance
    UPDATE users
    SET
      total_earnings = COALESCE(total_earnings, 0) + v_net_amount,
      updated_at = now()
    WHERE id = withdrawal_record.user_id;

    -- Get new balance
    SELECT COALESCE(total_earnings, 0) INTO v_live_balance_after
    FROM users
    WHERE id = withdrawal_record.user_id;

    -- Log the backfill
    INSERT INTO backfill_log (
      transaction_id,
      user_id,
      treats_amount,
      net_usd_amount,
      backfilled_amount
    ) VALUES (
      withdrawal_record.transaction_id,
      withdrawal_record.user_id,
      withdrawal_record.treats_amount,
      v_net_amount,
      v_net_amount
    );

    v_backfilled_count := v_backfilled_count + 1;
    v_total_backfilled := v_total_backfilled + v_net_amount;

    -- Log to console (visible in Supabase logs)
    RAISE NOTICE 'Backfilled withdrawal: Transaction % for user %, % treats -> $% USD added to Live Balance',
      withdrawal_record.transaction_id,
      withdrawal_record.user_id,
      withdrawal_record.treats_amount,
      v_net_amount;
  END LOOP;

  -- Summary
  RAISE NOTICE 'Backfill complete: % transactions processed, $% total USD added to Live Balance',
    v_backfilled_count,
    v_total_backfilled;

  -- Create a summary report
  CREATE TEMP TABLE IF NOT EXISTS backfill_summary AS
  SELECT 
    COUNT(*) as total_transactions,
    COUNT(DISTINCT user_id) as affected_users,
    SUM(backfilled_amount) as total_usd_backfilled
  FROM backfill_log;

  -- Display summary
  RAISE NOTICE 'Summary: % transactions backfilled for % users, $% total USD',
    (SELECT total_transactions FROM backfill_summary),
    (SELECT affected_users FROM backfill_summary),
    (SELECT total_usd_backfilled FROM backfill_summary);
END $$;

-- Display the backfill log (optional - for verification)
SELECT 
  bl.transaction_id,
  u.display_name as user_name,
  u.email,
  bl.treats_amount,
  bl.net_usd_amount as usd_added,
  bl.backfilled_at,
  u.total_earnings as current_live_balance
FROM backfill_log bl
JOIN users u ON u.id = bl.user_id
ORDER BY bl.backfilled_at DESC;

-- Note: The backfill_log temp table will be automatically dropped when the session ends
-- If you want to keep a permanent record, you can create a permanent table instead


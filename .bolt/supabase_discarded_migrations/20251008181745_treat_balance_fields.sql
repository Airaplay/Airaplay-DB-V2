/*
  # Fix add_treat_balance Function - Missing balance_before and balance_after

  1. Problem
    - The add_treat_balance function inserts into treat_transactions
    - But it doesn't provide balance_before and balance_after values
    - These columns are NOT NULL in the treat_transactions table
    - This causes "null value in column balance_before violates not-null constraint" error
    
  2. Solution
    - Update the function to capture the balance before the update
    - Calculate the balance after
    - Include both values in the treat_transactions insert
    
  3. Security
    - Maintains existing SECURITY DEFINER and permissions
    - No changes to security model
*/

-- Update the add_treat_balance function to include balance tracking
CREATE OR REPLACE FUNCTION add_treat_balance(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text DEFAULT 'bonus',
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  -- Ensure wallet exists and get current balance
  INSERT INTO treat_wallets (user_id, balance, total_purchased, total_spent, total_earned, total_withdrawn)
  VALUES (p_user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get the current balance before update
  SELECT balance INTO v_balance_before
  FROM treat_wallets
  WHERE user_id = p_user_id;
  
  -- Calculate the new balance
  v_balance_after := v_balance_before + p_amount;
  
  -- Update wallet balance
  UPDATE treat_wallets
  SET
    balance = v_balance_after,
    total_earned = total_earned + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
    
  -- Log the transaction with balance tracking
  INSERT INTO treat_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_before,
    balance_after,
    status
  ) VALUES (
    p_user_id,
    p_amount,
    p_transaction_type,
    COALESCE(p_description, 'Treat balance added'),
    v_balance_before,
    v_balance_after,
    'completed'
  );
END;
$$;

-- Ensure permissions are maintained
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text) TO service_role;

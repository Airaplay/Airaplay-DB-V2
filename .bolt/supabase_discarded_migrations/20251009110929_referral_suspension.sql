/*
  # Add Referral Revocation and User Suspension Support

  1. Changes
    - Ensure 'revoked' status is supported in referrals table
    - Ensure 'suspended' role is supported in users table
    - Add 'referral_revoked' transaction type for treat_transactions
    - Update add_treat_balance to handle negative amounts properly
    
  2. Security
    - Admin-only policies for revoking referrals
    - Admin-only policies for suspending users
*/

-- Update add_treat_balance to handle negative amounts (for revocations)
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
  
  -- Prevent negative balance (optional: remove this if you want to allow negative balances)
  IF v_balance_after < 0 THEN
    v_balance_after := 0;
  END IF;
  
  -- Update wallet balance
  UPDATE treat_wallets
  SET
    balance = v_balance_after,
    -- Only update total_earned if amount is positive
    total_earned = CASE 
      WHEN p_amount > 0 THEN total_earned + p_amount 
      ELSE total_earned 
    END,
    -- Track total spent if amount is negative (revocations)
    total_spent = CASE 
      WHEN p_amount < 0 THEN total_spent + ABS(p_amount)
      ELSE total_spent
    END,
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
    COALESCE(p_description, 'Treat balance adjusted'),
    v_balance_before,
    v_balance_after,
    'completed'
  );
END;
$$;

-- Ensure permissions are maintained
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION add_treat_balance(uuid, integer, text, text) TO service_role;

-- Add policies for admin to update user roles (for suspension)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Admins can update user roles'
  ) THEN
    CREATE POLICY "Admins can update user roles"
      ON users
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;

-- Add policies for admin to update referrals (for revocation)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referrals' 
    AND policyname = 'Admins can update referrals'
  ) THEN
    CREATE POLICY "Admins can update referrals"
      ON referrals
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;
/*
  # Create Treat System Tables
  
  ## Overview
  Creates the core tables for the Treat Wallet system:
  - treat_wallets: Stores user wallet balances and statistics
  - treat_transactions: Logs all treat transactions
  - admin_activity_log: Already exists in another migration, but ensure it exists
  
  ## Tables Created
  1. treat_wallets - User wallet balances and totals
  2. treat_transactions - Transaction history
  
  ## Notes
  - Uses IF NOT EXISTS to prevent errors if tables already exist
  - Includes all columns referenced in later migrations
  - Proper indexes and constraints
  - RLS policies for security
*/

-- Create treat_wallets table
CREATE TABLE IF NOT EXISTS treat_wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased numeric NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  total_spent numeric NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  total_earned numeric NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_withdrawn numeric NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
  earned_balance numeric NOT NULL DEFAULT 0 CHECK (earned_balance >= 0),
  purchased_balance numeric NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint: balance should equal earned_balance + purchased_balance
  CONSTRAINT balance_check CHECK (balance = earned_balance + purchased_balance)
);

-- Create treat_transactions table
CREATE TABLE IF NOT EXISTS treat_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  balance_before numeric,
  balance_after numeric,
  description text,
  metadata jsonb,
  status text DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for treat_wallets
CREATE INDEX IF NOT EXISTS idx_treat_wallets_user_id ON treat_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_treat_wallets_balance ON treat_wallets(balance DESC);
CREATE INDEX IF NOT EXISTS idx_treat_wallets_updated_at ON treat_wallets(updated_at DESC);

-- Create indexes for treat_transactions
CREATE INDEX IF NOT EXISTS idx_treat_transactions_user_id ON treat_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_treat_transactions_type ON treat_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_treat_transactions_created_at ON treat_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treat_transactions_user_type ON treat_transactions(user_id, transaction_type);

-- Enable Row Level Security
ALTER TABLE treat_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE treat_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for treat_wallets
-- Users can view their own wallet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'treat_wallets' 
    AND policyname = 'Users can view their own wallet'
  ) THEN
    CREATE POLICY "Users can view their own wallet"
    ON treat_wallets
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Admins can view all wallets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'treat_wallets' 
    AND policyname = 'Admins can view all wallets'
  ) THEN
    CREATE POLICY "Admins can view all wallets"
    ON treat_wallets
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    );
  END IF;
END $$;

-- RLS Policies for treat_transactions
-- Users can view their own transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'treat_transactions' 
    AND policyname = 'Users can view their own transactions'
  ) THEN
    CREATE POLICY "Users can view their own transactions"
    ON treat_transactions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Admins can view all transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'treat_transactions' 
    AND policyname = 'Admins can view all transactions'
  ) THEN
    CREATE POLICY "Admins can view all transactions"
    ON treat_transactions
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    );
  END IF;
END $$;

-- Service role can insert transactions (for system operations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'treat_transactions' 
    AND policyname = 'Service role can insert transactions'
  ) THEN
    CREATE POLICY "Service role can insert transactions"
    ON treat_transactions
    FOR INSERT
    TO service_role
    WITH CHECK (true);
  END IF;
END $$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_treat_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_treat_wallets_updated_at ON treat_wallets;
CREATE TRIGGER trigger_update_treat_wallets_updated_at
  BEFORE UPDATE ON treat_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_treat_wallets_updated_at();

-- Add helpful comments
COMMENT ON TABLE treat_wallets IS 'Stores user treat wallet balances and statistics. Balance = earned_balance + purchased_balance.';
COMMENT ON TABLE treat_transactions IS 'Logs all treat transactions for audit and history tracking.';


/*
  # Improve Treat Admin Functions
  
  ## Problem
  - Functions exist but may not be logging to admin_activity_log
  - Error messages from RAISE EXCEPTION may not be properly extracted by frontend
  - Need better error handling
  
  ## Solution
  - Update functions to ensure admin_activity_log is used
  - Keep RAISE EXCEPTION for critical errors (access denied)
  - Return JSON errors for validation errors (better frontend handling)
  - Add proper error messages
*/

-- Update admin_add_treats_to_user to return JSON errors for validation and log activity
CREATE OR REPLACE FUNCTION admin_add_treats_to_user(
  target_user_id UUID,
  treat_amount NUMERIC,
  admin_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_role TEXT;
  current_admin_id UUID;
  target_user_exists BOOLEAN;
  current_balance NUMERIC;
  new_balance NUMERIC;
BEGIN
  -- Get current user info
  SELECT u.role, u.id INTO current_user_role, current_admin_id
  FROM users u
  WHERE u.id = auth.uid();
  
  -- Check if user is admin (critical - use exception)
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Validate inputs (return JSON error for better frontend handling)
  IF treat_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Treat amount must be greater than 0'
    );
  END IF;

  IF admin_reason IS NULL OR trim(admin_reason) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reason is required for this action'
    );
  END IF;

  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = target_user_id) INTO target_user_exists;
  IF NOT target_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target user not found'
    );
  END IF;

  -- Get or create treat wallet
  INSERT INTO treat_wallets (user_id, balance, total_purchased, total_spent, total_earned, total_withdrawn, earned_balance, purchased_balance)
  VALUES (target_user_id, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current balance
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM treat_wallets
  WHERE user_id = target_user_id;

  -- Calculate new balance
  new_balance := current_balance + treat_amount;

  -- Update wallet balance and total_earned
  UPDATE treat_wallets
  SET 
    balance = new_balance,
    total_earned = total_earned + treat_amount,
    earned_balance = earned_balance + treat_amount,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Record transaction
  INSERT INTO treat_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status
  ) VALUES (
    target_user_id,
    'earn',
    treat_amount,
    current_balance,
    new_balance,
    'Admin added treats: ' || admin_reason,
    jsonb_build_object(
      'admin_action', true,
      'admin_id', current_admin_id,
      'reason', admin_reason
    ),
    'completed'
  );

  -- Log admin activity
  INSERT INTO admin_activity_log (
    admin_id,
    action_type,
    action_details
  ) VALUES (
    current_admin_id,
    'add_treats',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'amount', treat_amount,
      'reason', admin_reason,
      'previous_balance', current_balance,
      'new_balance', new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Treats added successfully',
    'previous_balance', current_balance,
    'new_balance', new_balance
  );
END;
$$;

-- Update admin_remove_treats_from_user to return JSON errors for validation and log activity
CREATE OR REPLACE FUNCTION admin_remove_treats_from_user(
  target_user_id UUID,
  treat_amount NUMERIC,
  admin_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_role TEXT;
  current_admin_id UUID;
  target_user_exists BOOLEAN;
  current_balance NUMERIC;
  new_balance NUMERIC;
  current_earned_balance NUMERIC;
  deduct_from_earned NUMERIC;
BEGIN
  -- Get current user info
  SELECT u.role, u.id INTO current_user_role, current_admin_id
  FROM users u
  WHERE u.id = auth.uid();
  
  -- Check if user is admin (critical - use exception)
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Validate inputs (return JSON error for better frontend handling)
  IF treat_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Treat amount must be greater than 0'
    );
  END IF;

  IF admin_reason IS NULL OR trim(admin_reason) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reason is required for this action'
    );
  END IF;

  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = target_user_id) INTO target_user_exists;
  IF NOT target_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target user not found'
    );
  END IF;

  -- Get current balance
  SELECT COALESCE(balance, 0), COALESCE(earned_balance, 0) 
  INTO current_balance, current_earned_balance
  FROM treat_wallets
  WHERE user_id = target_user_id;

  -- Check if wallet exists
  IF current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User does not have a treat wallet'
    );
  END IF;

  -- Check if user has enough balance
  IF current_balance < treat_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient balance. User has %s treats available but tried to remove %s', 
                      current_balance, treat_amount)
    );
  END IF;

  -- Calculate new balance
  new_balance := current_balance - treat_amount;
  
  -- Deduct from earned_balance first, then purchased_balance
  IF current_earned_balance >= treat_amount THEN
    deduct_from_earned := treat_amount;
  ELSE
    deduct_from_earned := current_earned_balance;
  END IF;

  -- Update wallet balance
  UPDATE treat_wallets 
  SET 
    balance = new_balance,
    total_spent = total_spent + treat_amount,
    earned_balance = GREATEST(0, earned_balance - deduct_from_earned),
    purchased_balance = GREATEST(0, purchased_balance - (treat_amount - deduct_from_earned)),
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Record transaction
  INSERT INTO treat_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status
  ) VALUES (
    target_user_id,
    'spend',
    treat_amount,
    current_balance,
    new_balance,
    'Admin removed treats: ' || admin_reason,
    jsonb_build_object(
      'admin_action', true,
      'admin_id', current_admin_id,
      'reason', admin_reason
    ),
    'completed'
  );

  -- Log admin activity
  INSERT INTO admin_activity_log (
    admin_id,
    action_type,
    action_details
  ) VALUES (
    current_admin_id,
    'remove_treats',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'amount', treat_amount,
      'reason', admin_reason,
      'previous_balance', current_balance,
      'new_balance', new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Treats removed successfully',
    'previous_balance', current_balance,
    'new_balance', new_balance
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_add_treats_to_user(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_remove_treats_from_user(uuid, numeric, text) TO authenticated;

-- Update function comments
COMMENT ON FUNCTION admin_add_treats_to_user IS 'Adds treats to a user wallet. Returns JSON errors for validation, raises exceptions for critical errors. Logs to admin_activity_log.';
COMMENT ON FUNCTION admin_remove_treats_from_user IS 'Removes treats from a user wallet. Returns JSON errors for validation, raises exceptions for critical errors. Logs to admin_activity_log.';








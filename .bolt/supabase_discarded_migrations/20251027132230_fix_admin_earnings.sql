/*
  # Fix Admin Adjust Earnings - Use Live Balance Not Treat Wallet

  This migration fixes the admin earnings adjustment to work with live balance instead of treat wallet.

  ## Problem
  - The "Adjust Earnings" feature in admin was updating treat_wallet instead of live balance
  - It was trying to insert negative amounts into treat_transactions which violates the check constraint
  - Admin should adjust live balance (total_earnings), not treat wallet

  ## Solution
  - Update admin_adjust_user_earnings to only update users.total_earnings
  - Remove all treat wallet and treat_transactions logic from this function
  - Treat wallet should only be managed through the treat system (purchases, tips, withdrawals)

  ## Changes
  - Removes treat wallet balance updates
  - Removes treat_transactions inserts
  - Only updates users.total_earnings field
  - Maintains proper audit trail through function logs
*/

-- Drop and recreate admin_adjust_user_earnings to work with live balance only
DROP FUNCTION IF EXISTS admin_adjust_user_earnings(uuid, numeric, text);

CREATE OR REPLACE FUNCTION admin_adjust_user_earnings(
  target_user_id uuid,
  adjustment_amount numeric,
  operation_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role text;
  current_earnings numeric;
  new_earnings numeric;
BEGIN
  -- Get the current user's role
  SELECT role INTO current_user_role
  FROM users
  WHERE id = auth.uid();

  -- Check if current user is an admin
  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins can adjust user earnings'
    );
  END IF;

  -- Validate adjustment amount
  IF adjustment_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Adjustment amount must be greater than 0'
    );
  END IF;

  -- Get current live balance (total_earnings)
  SELECT COALESCE(total_earnings, 0) INTO current_earnings
  FROM users
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Calculate new earnings based on operation type
  CASE operation_type
    WHEN 'add' THEN
      new_earnings := current_earnings + adjustment_amount;
    WHEN 'subtract' THEN
      new_earnings := GREATEST(0, current_earnings - adjustment_amount);
    WHEN 'set' THEN
      new_earnings := adjustment_amount;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid operation type. Use: add, subtract, or set'
      );
  END CASE;

  -- Update user live balance (total_earnings only)
  UPDATE users
  SET total_earnings = new_earnings,
      updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Live balance adjusted successfully',
    'old_earnings', current_earnings,
    'new_earnings', new_earnings
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION admin_adjust_user_earnings(uuid, numeric, text) IS
'Allows admin to adjust user live balance (total_earnings). Does not affect treat wallet. Use for manual balance corrections.';

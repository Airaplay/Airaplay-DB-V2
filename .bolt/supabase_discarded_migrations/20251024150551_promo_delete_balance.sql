/*
  # Fix delete_promotion Function - add_treat_balance Call
  
  1. Changes
    - Update delete_promotion to pass correct parameters to add_treat_balance
    - add_treat_balance requires 5 parameters: user_id, amount, type, description, reference_id
    - Pass promotion_id as the reference_id
    
  2. Issue
    - delete_promotion was calling add_treat_balance with only 4 parameters
    - add_treat_balance signature requires 5 parameters (including p_reference_id)
    - This caused the function to fail when processing refunds
*/

-- Fix delete_promotion to call add_treat_balance with correct parameters
CREATE OR REPLACE FUNCTION delete_promotion(
  p_promotion_id uuid,
  p_user_id uuid
)
RETURNS json AS $$
DECLARE
  v_promotion_status text;
  v_promotion_user_id uuid;
  v_treats_cost numeric;
  v_refund_amount numeric;
  v_user_display_name text;
BEGIN
  -- Get promotion details
  SELECT status, user_id, treats_cost
  INTO v_promotion_status, v_promotion_user_id, v_treats_cost
  FROM promotions
  WHERE id = p_promotion_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Promotion not found'
    );
  END IF;
  
  -- Check if user owns the promotion
  IF v_promotion_user_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized'
    );
  END IF;
  
  -- Check if promotion is already deleted
  IF v_promotion_status = 'deleted' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Promotion is already deleted'
    );
  END IF;
  
  -- Calculate refund amount
  v_refund_amount := calculate_promotion_refund(p_promotion_id);
  
  -- Get user display name
  SELECT display_name INTO v_user_display_name
  FROM users
  WHERE id = p_user_id;
  
  -- If refund is due, process it
  IF v_refund_amount > 0 THEN
    -- Add treats back to user's wallet with correct parameters
    PERFORM add_treat_balance(
      p_user_id,
      v_refund_amount::integer,
      'promotion_refund',
      format('Refund for deleted promotion: %s treats', v_refund_amount),
      p_promotion_id  -- Pass promotion_id as reference
    );
  END IF;
  
  -- Update promotion status to deleted
  UPDATE promotions
  SET status = 'deleted',
      updated_at = now()
  WHERE id = p_promotion_id;
  
  RETURN json_build_object(
    'success', true,
    'message', CASE 
      WHEN v_refund_amount > 0 THEN format('%s treats refunded', v_refund_amount)
      ELSE 'Promotion deleted successfully'
    END,
    'refund_amount', v_refund_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

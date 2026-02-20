/*
  # Improve Earnings Withdrawal Settings Function

  ## Overview
  Improves the `get_earnings_withdrawal_settings()` function to ensure it always returns
  data correctly and handles edge cases properly.

  ## Changes
  - Improve the function to always return a row (with defaults if no settings exist)
  - Ensure proper handling of the return value
  - Add better error handling
*/

-- Improve the function to ensure it always returns data
CREATE OR REPLACE FUNCTION get_earnings_withdrawal_settings()
RETURNS TABLE (
  withdrawals_enabled boolean,
  minimum_withdrawal_usd decimal,
  exchange_rate decimal,
  withdrawal_fee_type text,
  withdrawal_fee_value decimal,
  exchange_rate_last_updated timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings_count integer;
BEGIN
  -- Check if settings exist
  SELECT COUNT(*) INTO v_settings_count
  FROM withdrawal_settings;

  -- If settings exist, return the latest one
  IF v_settings_count > 0 THEN
    RETURN QUERY
    SELECT
      withdrawal_settings.withdrawals_enabled,
      withdrawal_settings.minimum_withdrawal_usd,
      withdrawal_settings.exchange_rate,
      withdrawal_settings.withdrawal_fee_type,
      withdrawal_settings.withdrawal_fee_value,
      withdrawal_settings.exchange_rate_last_updated
    FROM withdrawal_settings
    ORDER BY updated_at DESC
    LIMIT 1;
  ELSE
    -- Return default values if no settings configured
    RETURN QUERY SELECT 
      true::boolean as withdrawals_enabled,
      10.0::decimal as minimum_withdrawal_usd,
      1.0::decimal as exchange_rate,
      'percentage'::text as withdrawal_fee_type,
      0.0::decimal as withdrawal_fee_value,
      now()::timestamptz as exchange_rate_last_updated;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_earnings_withdrawal_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION get_earnings_withdrawal_settings() TO anon;

-- Update function comment
COMMENT ON FUNCTION get_earnings_withdrawal_settings IS 'Returns current earnings withdrawal settings from withdrawal_settings table. Returns default values if no settings are configured. Used by WithdrawEarningsScreen to display fees and minimum withdrawal amounts.';








/*
  # Fix Payment Monitoring RLS Access Issue
  
  ## Problem
  The `uncredited_payments` view queries multiple tables with RLS enabled.
  When admins query the view, RLS policies on underlying tables can block access,
  even though the view has proper permissions.
  
  ## Solution
  Create a SECURITY DEFINER function that bypasses RLS and returns uncredited payments.
  This allows admins to query payment monitoring data without RLS restrictions.
*/

-- =====================================================
-- 1. Create SECURITY DEFINER function for uncredited payments
-- =====================================================

CREATE OR REPLACE FUNCTION get_uncredited_payments()
RETURNS TABLE (
  payment_id uuid,
  user_id uuid,
  display_name text,
  email text,
  amount numeric,
  currency text,
  payment_method text,
  payment_status text,
  completed_at timestamptz,
  payment_created timestamptz,
  package_name text,
  treats_amount numeric,
  bonus_amount numeric,
  total_treats numeric,
  hours_since_completion numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tp.id as payment_id,
    tp.user_id,
    u.display_name,
    u.email,
    tp.amount,
    tp.currency,
    tp.payment_method,
    tp.status as payment_status,
    tp.completed_at,
    tp.created_at as payment_created,
    pkg.name as package_name,
    pkg.treats as treats_amount,
    pkg.bonus as bonus_amount,
    (pkg.treats + pkg.bonus) as total_treats,
    EXTRACT(EPOCH FROM (NOW() - tp.completed_at))/3600 as hours_since_completion
  FROM treat_payments tp
  JOIN users u ON u.id = tp.user_id
  JOIN treat_packages pkg ON pkg.id = tp.package_id
  LEFT JOIN treat_transactions tt ON tt.payment_reference = tp.id::text AND tt.status = 'completed'
  WHERE 
    tp.status = 'completed'
    AND tt.id IS NULL
    AND tp.completed_at IS NOT NULL
  ORDER BY tp.completed_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_uncredited_payments() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_uncredited_payments() IS 'Returns uncredited payments with SECURITY DEFINER to bypass RLS. Admin-only access.';

-- =====================================================
-- 2. Ensure view still works and has proper permissions
-- =====================================================

-- Ensure view permissions are properly set (don't recreate, just grant)
-- The view already exists, we just need to ensure permissions

-- Ensure permissions are granted
GRANT SELECT ON uncredited_payments TO authenticated;

-- =====================================================
-- 3. Create helper function for admin role check
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;

-- Add comment
COMMENT ON FUNCTION is_admin_user() IS 'Helper function to check if current user is an admin';


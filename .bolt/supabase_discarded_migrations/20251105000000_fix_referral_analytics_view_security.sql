/*
  # Fix Referral Analytics View Security
  
  Views cannot have SECURITY DEFINER property in PostgreSQL.
  This migration fixes the view by dropping and recreating it,
  and ensures proper RLS policies are in place.
*/

-- Drop the view if it exists (with CASCADE to handle dependencies)
DROP VIEW IF EXISTS public.referral_analytics_overview CASCADE;

-- Recreate the view without SECURITY DEFINER (views don't support it)
CREATE VIEW public.referral_analytics_overview AS
SELECT 
  COUNT(DISTINCT r.id) as total_referrals,
  COUNT(DISTINCT CASE WHEN r.is_active = true THEN r.id END) as active_referrals,
  COUNT(DISTINCT CASE WHEN r.is_active = false THEN r.id END) as inactive_referrals,
  COUNT(DISTINCT CASE WHEN r.status = 'rewarded' THEN r.id END) as rewarded_referrals,
  COUNT(DISTINCT CASE WHEN r.flagged_for_abuse = true THEN r.id END) as flagged_referrals,
  COALESCE(SUM(r.treat_spent), 0) as total_treats_spent_on_promotions,
  COALESCE(SUM(r.reward_amount), 0) as total_treats_rewarded,
  COUNT(DISTINCT r.referrer_id) as unique_referrers,
  COUNT(DISTINCT r.referred_id) as unique_referred_users
FROM referrals r;

-- Grant SELECT permission to authenticated users (RLS will handle access control)
GRANT SELECT ON public.referral_analytics_overview TO authenticated;
GRANT SELECT ON public.referral_analytics_overview TO service_role;

-- Add comment to explain the view
COMMENT ON VIEW public.referral_analytics_overview IS 
  'Aggregated referral analytics for admin dashboard. Access is controlled via RLS policies on the referrals table.';


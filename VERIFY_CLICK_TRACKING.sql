-- ============================================
-- Click Tracking Verification Queries
-- ============================================
-- Use these queries to verify click tracking is working correctly

-- 1. Check RLS Policies on promotion_performance_metrics
-- Should show policies for both 'anon' and 'authenticated' roles
SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'promotion_performance_metrics'
ORDER BY cmd, policyname;

-- Expected Result:
-- - "Allow insert promotion metrics" with roles: {anon,authenticated}
-- - "Allow update promotion metrics" with roles: {anon,authenticated}


-- 2. Verify record_promotion_impression function exists
SELECT
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'record_promotion_impression'
  AND n.nspname = 'public';

-- Expected Result:
-- Function should exist with signature accepting:
-- (p_promotion_id uuid, p_section_key text, p_user_id uuid, p_clicked boolean, p_session_id text)


-- 3. Check active promotions with their sections
SELECT
  p.id,
  p.target_title,
  p.promotion_type,
  ps.section_name,
  ps.section_key,
  p.status,
  p.impressions_actual,
  p.clicks,
  CASE
    WHEN p.impressions_actual > 0 THEN
      ROUND((p.clicks::numeric / p.impressions_actual::numeric) * 100, 2)
    ELSE 0
  END as ctr_percentage,
  p.start_date,
  p.end_date
FROM promotions p
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE p.status = 'active'
  AND p.start_date <= now()
  AND p.end_date >= now()
ORDER BY p.created_at DESC
LIMIT 20;


-- 4. View recent click tracking activity (last 24 hours)
SELECT
  p.target_title,
  ps.section_name,
  ppm.date,
  ppm.impressions,
  ppm.clicks,
  ppm.unique_viewers,
  CASE
    WHEN ppm.impressions > 0 THEN
      ROUND((ppm.clicks::numeric / ppm.impressions::numeric) * 100, 2)
    ELSE 0
  END as daily_ctr,
  ppm.updated_at
FROM promotion_performance_metrics ppm
JOIN promotions p ON p.id = ppm.promotion_id
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE ppm.date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY ppm.updated_at DESC
LIMIT 50;


-- 5. Summary by section (shows which sections are getting clicks)
SELECT
  ps.section_name,
  ps.section_key,
  COUNT(DISTINCT p.id) as active_promotions,
  SUM(p.impressions_actual) as total_impressions,
  SUM(p.clicks) as total_clicks,
  CASE
    WHEN SUM(p.impressions_actual) > 0 THEN
      ROUND((SUM(p.clicks)::numeric / SUM(p.impressions_actual)::numeric) * 100, 2)
    ELSE 0
  END as overall_ctr
FROM promotion_sections ps
LEFT JOIN promotions p ON p.promotion_section_id = ps.id
  AND p.status = 'active'
  AND p.start_date <= now()
  AND p.end_date >= now()
WHERE ps.is_active = true
GROUP BY ps.id, ps.section_name, ps.section_key
ORDER BY total_clicks DESC NULLS LAST;


-- 6. Top performing promotions by clicks (last 7 days)
SELECT
  p.id,
  p.target_title,
  p.promotion_type,
  ps.section_name,
  SUM(ppm.impressions) as impressions_7d,
  SUM(ppm.clicks) as clicks_7d,
  CASE
    WHEN SUM(ppm.impressions) > 0 THEN
      ROUND((SUM(ppm.clicks)::numeric / SUM(ppm.impressions)::numeric) * 100, 2)
    ELSE 0
  END as ctr_7d
FROM promotions p
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
LEFT JOIN promotion_performance_metrics ppm ON ppm.promotion_id = p.id
  AND ppm.date >= CURRENT_DATE - INTERVAL '7 days'
WHERE p.status = 'active'
GROUP BY p.id, p.target_title, p.promotion_type, ps.section_name
HAVING SUM(ppm.clicks) > 0
ORDER BY clicks_7d DESC
LIMIT 20;


-- 7. Verify table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'promotion_performance_metrics'
  AND table_schema = 'public'
ORDER BY ordinal_position;


-- 8. Test data - Recent clicks with timestamps
SELECT
  p.target_title,
  ps.section_key,
  ppm.date,
  ppm.clicks,
  ppm.impressions,
  ppm.updated_at,
  (ppm.updated_at > now() - INTERVAL '1 hour') as recent_activity
FROM promotion_performance_metrics ppm
JOIN promotions p ON p.id = ppm.promotion_id
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE ppm.date = CURRENT_DATE
ORDER BY ppm.updated_at DESC
LIMIT 20;


-- 9. Check for promotions without any clicks (potential issues)
SELECT
  p.id,
  p.target_title,
  ps.section_name,
  p.status,
  p.impressions_actual,
  p.clicks,
  p.created_at,
  EXTRACT(DAY FROM (now() - p.start_date)) as days_active
FROM promotions p
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE p.status = 'active'
  AND p.start_date <= now()
  AND p.end_date >= now()
  AND p.clicks = 0
  AND p.impressions_actual > 10  -- Has impressions but no clicks
ORDER BY p.impressions_actual DESC;


-- 10. Real-time click tracking test
-- Run this BEFORE clicking on promoted content, note the values
-- Then click on promoted content
-- Run this AGAIN and verify the numbers increased
SELECT
  p.id,
  p.target_title,
  p.clicks as total_clicks,
  ppm.date,
  ppm.clicks as today_clicks,
  ppm.impressions as today_impressions,
  ppm.updated_at as last_updated
FROM promotions p
LEFT JOIN promotion_performance_metrics ppm ON ppm.promotion_id = p.id
  AND ppm.date = CURRENT_DATE
WHERE p.status = 'active'
  AND p.start_date <= now()
  AND p.end_date >= now()
ORDER BY ppm.updated_at DESC NULLS LAST
LIMIT 10;

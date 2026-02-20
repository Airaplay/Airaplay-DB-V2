/*
  THRESHOLD SYSTEM VERIFICATION SCRIPT

  Run these queries to verify everything is working correctly.
  Copy and paste into Supabase SQL Editor.
*/

-- ================================================================
-- 1. VERIFY YOUR ADMIN STATUS
-- ================================================================
SELECT
  id,
  email,
  role,
  display_name,
  'You are logged in as admin!' as status
FROM users
WHERE id = auth.uid() AND role = 'admin';

-- Expected: Should return your user with role = 'admin'
-- If empty: You're not logged in as admin!

-- ================================================================
-- 2. CHECK CURRENT THRESHOLD VALUES
-- ================================================================
SELECT
  section_name,
  min_play_count,
  min_like_count,
  time_window_days,
  use_fallback,
  is_enabled,
  updated_at
FROM content_section_thresholds
ORDER BY section_name;

-- Expected: Shows all 6 sections with their current thresholds
-- Look for use_fallback = false on sections with high thresholds (>100)

-- ================================================================
-- 3. TEST ADMIN UPDATE FUNCTION (SAFE TEST)
-- ================================================================
-- This will update Global Trending to 10 plays
SELECT * FROM admin_update_section_threshold(
  section_key_param := 'global_trending',
  min_play_count_param := 10,
  min_like_count_param := 5,
  time_window_days_param := 14,
  is_enabled_param := true,
  notes_param := 'Testing save functionality'
);

-- Expected: Returns updated threshold with min_play_count = 10
-- If error: Check that you're logged in as admin (query #1)

-- ================================================================
-- 4. VERIFY DATABASE SAVED THE UPDATE
-- ================================================================
SELECT
  section_name,
  min_play_count,
  use_fallback,
  updated_at
FROM content_section_thresholds
WHERE section_key = 'global_trending';

-- Expected: min_play_count = 10, use_fallback = true
-- Updated_at should be recent (just now)

-- ================================================================
-- 5. CHECK YOUR ACTUAL CONTENT STATISTICS
-- ================================================================
SELECT
  COUNT(DISTINCT s.id) as total_songs,
  MAX(play_counts.play_count) as highest_plays,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY play_counts.play_count) as top_10_percent,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY play_counts.play_count) as top_25_percent,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY play_counts.play_count) as median_plays
FROM songs s
LEFT JOIN (
  SELECT song_id, COUNT(*) as play_count
  FROM listening_history
  WHERE listened_at >= NOW() - INTERVAL '14 days'
  GROUP BY song_id
) play_counts ON s.id = play_counts.song_id
WHERE s.audio_url IS NOT NULL;

-- Expected: Shows your content statistics
-- Use top_10_percent as your recommended threshold!

-- ================================================================
-- 6. TEST RPC FUNCTION WITH NEW THRESHOLD
-- ================================================================
SELECT
  id,
  title,
  artist,
  play_count
FROM get_shuffled_trending_songs(14, 10)
ORDER BY play_count DESC;

-- Expected: Returns songs with 10+ plays in last 14 days
-- If empty: Your songs don't have 10+ plays yet - lower the threshold!

-- ================================================================
-- 7. HOW MANY SONGS MEET DIFFERENT THRESHOLDS
-- ================================================================
WITH threshold_tests AS (
  SELECT
    s.id,
    s.title,
    COUNT(lh.song_id) as plays_14_days
  FROM songs s
  LEFT JOIN listening_history lh ON s.id = lh.song_id
    AND lh.listened_at >= NOW() - INTERVAL '14 days'
  WHERE s.audio_url IS NOT NULL
  GROUP BY s.id, s.title
)
SELECT
  '10 plays' as threshold,
  COUNT(*) as songs_meeting_threshold
FROM threshold_tests
WHERE plays_14_days >= 10

UNION ALL

SELECT
  '50 plays' as threshold,
  COUNT(*) as songs_meeting_threshold
FROM threshold_tests
WHERE plays_14_days >= 50

UNION ALL

SELECT
  '100 plays' as threshold,
  COUNT(*) as songs_meeting_threshold
FROM threshold_tests
WHERE plays_14_days >= 100

UNION ALL

SELECT
  '1000 plays' as threshold,
  COUNT(*) as songs_meeting_threshold
FROM threshold_tests
WHERE plays_14_days >= 1000

UNION ALL

SELECT
  '10000 plays' as threshold,
  COUNT(*) as songs_meeting_threshold
FROM threshold_tests
WHERE plays_14_days >= 10000;

-- Expected: Shows how many songs qualify at each threshold level
-- Use this to choose appropriate thresholds for your app!

-- ================================================================
-- 8. VERIFY HELPER FUNCTIONS WORK
-- ================================================================
-- Test is_admin() function
SELECT is_admin() as am_i_admin;
-- Expected: true (if you're logged in as admin)

-- Test current_user_info view
SELECT * FROM current_user_info;
-- Expected: Your user info with is_admin = true

-- ================================================================
-- 9. CHECK RLS POLICIES ARE CORRECT
-- ================================================================
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual LIKE '%role = ''admin''%' THEN 'Uses role check ✅'
    WHEN qual LIKE '%is_admin%' THEN 'Uses old is_admin ❌'
    ELSE 'No admin check'
  END as policy_check
FROM pg_policies
WHERE tablename = 'content_section_thresholds'
ORDER BY cmd;

-- Expected: All policies should show "Uses role check ✅"

-- ================================================================
-- 10. FINAL INTEGRATION TEST
-- ================================================================
-- This simulates exactly what the home screen does

-- Step 1: Get threshold
SELECT
  min_play_count,
  time_window_days,
  use_fallback
FROM content_section_thresholds
WHERE section_key = 'global_trending';

-- Step 2: Get songs using that threshold
SELECT COUNT(*) as total_trending_songs
FROM get_shuffled_trending_songs(14, 20);

-- Expected:
-- If count > 0: System working perfectly! ✅
-- If count = 0: Your threshold is too high for your content

-- ================================================================
-- RESULTS INTERPRETATION
-- ================================================================

/*
  ✅ ALL TESTS PASSED IF:

  1. Query #1 returns your admin user
  2. Query #3 updates successfully (no error)
  3. Query #4 shows min_play_count = 10
  4. Query #6 returns songs (or empty if no songs have 10+ plays)
  5. Query #8 returns true for is_admin()
  6. Query #9 shows all policies use role check

  ❌ TROUBLESHOOTING:

  - "is_admin does not exist" error:
    → Database migration not applied yet
    → Run fix_admin_threshold_update_role_check.sql

  - "Unauthorized" error:
    → You're not logged in as admin
    → Check query #1 result
    → Update user role to 'admin'

  - No songs returned in query #6:
    → Threshold too high for your content
    → Check query #5 to see your actual stats
    → Lower threshold to match your data
*/
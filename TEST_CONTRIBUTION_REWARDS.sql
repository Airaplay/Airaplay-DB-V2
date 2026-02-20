-- =====================================================
-- Contribution Rewards System - Testing Queries
-- =====================================================
-- Use these queries to verify the contribution rewards system is working

-- 1. Verify New Activities Exist
-- Expected: Should show daily_listener_10 and daily_listener_20 with correct points
SELECT
  activity_type,
  activity_name,
  base_reward_points,
  is_active,
  description
FROM contribution_activities
WHERE activity_type IN (
  'daily_active_listener',
  'daily_listener_10',
  'daily_listener_20'
)
ORDER BY base_reward_points;

-- 2. Check All Updated Point Values
-- Expected: All values should match the updated design
SELECT
  activity_type,
  activity_name,
  base_reward_points,
  is_active
FROM contribution_activities
WHERE activity_type IN (
  'daily_active_listener',      -- Should be 10 pts
  'daily_listener_10',           -- Should be 15 pts
  'daily_listener_20',           -- Should be 25 pts
  'genre_explorer',              -- Should be 25 pts
  'listening_streak_3',          -- Should be 30 pts
  'listening_streak_7',          -- Should be 75 pts
  'listening_streak_30',         -- Should be 300 pts
  'early_supporter',             -- Should be 100 pts
  'song_completion_bonus'        -- Should be 15 pts
)
ORDER BY
  CASE
    WHEN activity_type LIKE 'daily_%' THEN 1
    WHEN activity_type LIKE 'listening_streak_%' THEN 2
    ELSE 3
  END,
  base_reward_points;

-- 3. Check Recent Contributions
-- Replace 'YOUR_USER_ID' with actual user UUID
SELECT
  lc.activity_type,
  ca.activity_name,
  ca.base_reward_points,
  lc.metadata,
  lc.created_at
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
WHERE lc.user_id = 'YOUR_USER_ID'
AND DATE(lc.created_at) = CURRENT_DATE
ORDER BY lc.created_at DESC;

-- 4. Check User Engagement Stats
-- Replace 'YOUR_USER_ID' with actual user UUID
SELECT
  user_id,
  daily_songs_started,
  daily_songs_completed,
  current_streak_days,
  weekly_genres_listened,
  weekly_new_artists,
  last_active_date,
  updated_at
FROM listener_engagement_stats
WHERE user_id = 'YOUR_USER_ID';

-- 5. Calculate Daily Points Earned
-- Replace 'YOUR_USER_ID' with actual user UUID
SELECT
  DATE(lc.created_at) as date,
  COUNT(DISTINCT lc.id) as rewards_earned,
  SUM(ca.base_reward_points) as total_points,
  json_agg(
    json_build_object(
      'activity', ca.activity_name,
      'points', ca.base_reward_points,
      'time', lc.created_at
    ) ORDER BY lc.created_at
  ) as rewards_breakdown
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
WHERE lc.user_id = 'YOUR_USER_ID'
AND DATE(lc.created_at) = CURRENT_DATE
GROUP BY DATE(lc.created_at);

-- 6. Verify No Duplicate Daily Rewards
-- Expected: Should return no rows (no duplicates)
SELECT
  user_id,
  activity_type,
  DATE(created_at) as date,
  COUNT(*) as count
FROM listener_contributions
WHERE activity_type IN (
  'daily_active_listener',
  'daily_listener_10',
  'daily_listener_20',
  'song_completion_bonus'
)
GROUP BY user_id, activity_type, DATE(created_at)
HAVING COUNT(*) > 1;

-- 7. Check Which Milestones Users Are Close To
-- Shows users close to earning milestones
SELECT
  les.user_id,
  u.username,
  les.daily_songs_started,
  CASE
    WHEN les.daily_songs_started >= 20 THEN 'Eligible for Super Listener (20+)'
    WHEN les.daily_songs_started >= 10 THEN 'Eligible for Dedicated Listener (10+)'
    WHEN les.daily_songs_started >= 5 THEN 'Eligible for Daily Active (5+)'
    ELSE CONCAT('Need ', 5 - les.daily_songs_started, ' more songs for Daily Active')
  END as milestone_status,
  les.daily_songs_completed,
  CASE
    WHEN les.daily_songs_started >= 10 THEN
      ROUND((les.daily_songs_completed::decimal / les.daily_songs_started * 100), 1)
    ELSE NULL
  END as completion_percentage,
  CASE
    WHEN les.daily_songs_started >= 10 AND
         les.daily_songs_completed::decimal / les.daily_songs_started >= 0.8
    THEN 'Eligible for Engaged Listener bonus'
    ELSE 'Not eligible yet'
  END as completion_bonus_status
FROM listener_engagement_stats les
JOIN users u ON u.id = les.user_id
WHERE les.last_active_date = CURRENT_DATE
ORDER BY les.daily_songs_started DESC
LIMIT 20;

-- 8. Overall System Health Check
-- Shows reward distribution across all users
SELECT
  ca.activity_name,
  COUNT(DISTINCT lc.user_id) as unique_users_earned,
  COUNT(lc.id) as total_times_awarded,
  SUM(ca.base_reward_points) as total_points_distributed,
  MAX(lc.created_at) as last_awarded
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
WHERE DATE(lc.created_at) >= CURRENT_DATE - INTERVAL '7 days'
AND ca.activity_type LIKE 'daily%' OR ca.activity_type LIKE 'listening_streak%'
GROUP BY ca.activity_type, ca.activity_name, ca.base_reward_points
ORDER BY total_points_distributed DESC;

-- 9. Test Track Listening Engagement Function
-- This manually calls the tracking function to test it
-- Replace 'YOUR_USER_ID' and 'SOME_SONG_ID' with actual UUIDs
SELECT track_listening_engagement(
  'YOUR_USER_ID'::uuid,
  'SOME_SONG_ID'::uuid,
  false,  -- false = song started, true = song completed
  'Pop',  -- genre (optional)
  5000    -- artist total plays (optional)
);

-- 10. Find Top Contributors This Month
-- Shows who's earning the most points
SELECT
  u.username,
  COUNT(DISTINCT lc.id) as rewards_earned,
  SUM(ca.base_reward_points) as total_points,
  MAX(les.current_streak_days) as current_streak
FROM listener_contributions lc
JOIN users u ON u.id = lc.user_id
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
LEFT JOIN listener_engagement_stats les ON les.user_id = lc.user_id
WHERE DATE(lc.created_at) >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.id, u.username
ORDER BY total_points DESC
LIMIT 20;

-- =====================================================
-- Troubleshooting Queries
-- =====================================================

-- Check if function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'track_listening_engagement';

-- Check RLS policies on listener_contributions
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'listener_contributions';

-- Check RLS policies on listener_engagement_stats
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'listener_engagement_stats';

-- Find users with no engagement stats (might need initialization)
SELECT u.id, u.username, u.email
FROM users u
LEFT JOIN listener_engagement_stats les ON les.user_id = u.id
WHERE les.user_id IS NULL
LIMIT 10;

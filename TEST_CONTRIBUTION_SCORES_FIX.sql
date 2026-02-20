/*
  Test Queries for Contribution Scores Fix

  Run these queries to verify the fix is working properly.
*/

-- 1. Check all contribution activities available
SELECT
  activity_type,
  activity_name,
  description,
  base_reward_points,
  is_active
FROM contribution_activities
ORDER BY base_reward_points DESC;

-- 2. Check current contribution counts by type
SELECT
  activity_type,
  ca.activity_name,
  COUNT(*) as total_contributions,
  SUM(contribution_points) as total_points_awarded
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
GROUP BY activity_type, ca.activity_name
ORDER BY total_contributions DESC;

-- 3. Check user contribution scores
SELECT
  u.username,
  u.email,
  lcs.total_points,
  lcs.current_period_points,
  lcs.playlist_creation_points,
  lcs.discovery_points,
  lcs.curation_points,
  lcs.engagement_points,
  lcs.updated_at
FROM listener_contribution_scores lcs
JOIN users u ON u.id = lcs.user_id
ORDER BY lcs.total_points DESC
LIMIT 20;

-- 4. Check recent listening engagement contributions (SHOULD START APPEARING AFTER FIX)
SELECT
  u.username,
  lc.activity_type,
  ca.activity_name,
  lc.contribution_points,
  lc.metadata,
  lc.created_at
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
JOIN users u ON u.id = lc.user_id
WHERE lc.activity_type IN (
  'daily_active_listener',
  'daily_listener_10',
  'daily_listener_20',
  'genre_explorer',
  'artist_discovery',
  'song_completion_bonus',
  'listening_streak_3',
  'listening_streak_7',
  'listening_streak_30',
  'video_completion'
)
ORDER BY lc.created_at DESC
LIMIT 50;

-- 5. Check listener engagement stats (SHOULD UPDATE AS USERS PLAY SONGS)
SELECT
  u.username,
  les.last_active_date,
  les.current_streak_days,
  les.longest_streak_days,
  les.daily_songs_started,
  les.daily_songs_completed,
  les.weekly_genres_listened,
  les.weekly_new_artists,
  les.updated_at
FROM listener_engagement_stats les
JOIN users u ON u.id = les.user_id
ORDER BY les.last_active_date DESC, les.daily_songs_started DESC
LIMIT 20;

-- 6. Check top contributors leaderboard
SELECT * FROM get_top_contributors(10);

-- 7. Monitor new contributions in real-time (run this after users play songs)
SELECT
  u.username,
  lc.activity_type,
  ca.activity_name,
  lc.contribution_points,
  lc.created_at,
  AGE(NOW(), lc.created_at) as time_ago
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
JOIN users u ON u.id = lc.user_id
WHERE lc.created_at > NOW() - INTERVAL '1 hour'
ORDER BY lc.created_at DESC;

-- 8. Check for any errors in contribution tracking
-- (This checks if there are users with plays but no engagement stats)
SELECT
  u.id,
  u.username,
  u.email,
  COUNT(DISTINCT lh.id) as total_plays,
  les.user_id IS NULL as missing_engagement_stats
FROM users u
LEFT JOIN listening_history lh ON lh.user_id = u.id
LEFT JOIN listener_engagement_stats les ON les.user_id = u.id
WHERE lh.id IS NOT NULL
GROUP BY u.id, u.username, u.email, les.user_id
HAVING les.user_id IS NULL
ORDER BY total_plays DESC
LIMIT 10;

-- 9. Verify track_listening_engagement function exists
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  d.description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_description d ON d.objoid = p.oid
WHERE n.nspname = 'public'
  AND p.proname = 'track_listening_engagement';

-- 10. Check recent playback history to verify users are actually playing songs
SELECT
  u.username,
  s.title as song_title,
  lh.duration_listened,
  lh.is_validated,
  lh.validation_score,
  lh.listened_at
FROM listening_history lh
JOIN users u ON u.id = lh.user_id
JOIN songs s ON s.id = lh.song_id
ORDER BY lh.listened_at DESC
LIMIT 20;

/*
  EXPECTED RESULTS AFTER FIX:

  - Query 4 should show NEW listening engagement contributions
  - Query 5 should show users with daily_songs_started > 0
  - Query 7 should show contributions created in the last hour
  - Query 8 should return 0 rows (all users with plays should have engagement stats)

  If Query 4 shows no listening engagement contributions AFTER users play songs,
  then there might be an issue with the fix or the function itself.
*/

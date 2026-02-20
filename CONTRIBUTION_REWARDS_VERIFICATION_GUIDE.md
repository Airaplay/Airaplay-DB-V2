# Contribution Rewards System - Verification & Testing Guide

## System Status

✅ **Database Migration Applied**: Extended listening milestones added
✅ **Point Values Updated**: All rewards now match original design specifications
✅ **New Milestones**: 10-song and 20-song daily milestones active
✅ **Music Player Integration**: Track listening engagement implemented

---

## Updated Reward Structure

### Daily Listening Milestones (Independent Rewards)

| Milestone | Reward Name | Points | Description |
|-----------|-------------|--------|-------------|
| **5 songs/day** | Daily Active Listener | 10 pts | Listen to at least 5 songs in a day |
| **10 songs/day** | Dedicated Listener | 15 pts | Listen to at least 10 songs in a day |
| **20 songs/day** | Super Listener | 25 pts | Listen to at least 20 songs in a day |
| **80%+ completion** | Engaged Listener | 15 pts | Complete 80%+ of songs (min 10 songs) |

**Note**: These are independent milestones. A user who listens to 20 songs can earn all three milestones (5, 10, 20) plus completion bonus = up to 65 points/day from listening!

### Streak Rewards (Updated Points)

| Milestone | Points | Description |
|-----------|--------|-------------|
| 3-Day Streak | 30 pts | Listen actively for 3 consecutive days |
| 7-Day Streak | 75 pts | Listen actively for 7 consecutive days |
| 30-Day Streak | 300 pts | Listen actively for 30 consecutive days |

### Weekly Discovery Rewards

| Milestone | Points | Description |
|-----------|--------|-------------|
| Genre Explorer | 25 pts | Listen to songs from 5+ different genres in a week |
| Artist Discovery | 20 pts | Listen to 5+ songs from artists with <10k total plays |
| Early Supporter | 100 pts | Listen to artist who later reaches 100k plays |

---

## Verification Checklist

### 1. Database Verification

Run these queries to verify the system is properly configured:

```sql
-- Check if new activities exist
SELECT activity_type, activity_name, base_reward_points, is_active
FROM contribution_activities
WHERE activity_type IN ('daily_listener_10', 'daily_listener_20')
ORDER BY base_reward_points;

-- Check listener engagement stats table exists
SELECT COUNT(*) FROM listener_engagement_stats;

-- Verify track_listening_engagement function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'track_listening_engagement';
```

### 2. Music Player Integration Check

The music player (`src/hooks/useMusicPlayer.ts`) should be calling `trackListeningEngagement` in two places:

**On Song Start (handlePlay):**
- Lines 236-274: Tracks when a song starts playing
- Fetches genre and artist play count
- Calls `trackListeningEngagement(userId, songId, false, genre, artistPlays)`

**On Song Complete (handlePause & handleEnded):**
- Lines 292-314 (pause) and 324-342 (ended): Tracks when 80%+ of song is played
- Calls `trackListeningEngagement(userId, songId, true, genre, artistPlays)`

**Verification**: Check browser console for any errors when songs play.

### 3. Testing Scenarios

#### Test 1: Daily Active Listener (5 songs)
1. Log in as a test user
2. Play 5 different songs (let each play for a few seconds)
3. Check database:
```sql
SELECT activity_type, created_at, metadata
FROM listener_contributions
WHERE user_id = 'YOUR_USER_ID'
AND DATE(created_at) = CURRENT_DATE
AND activity_type = 'daily_active_listener';
```
Expected: 1 record with activity_type = 'daily_active_listener'

#### Test 2: Dedicated Listener (10 songs)
1. Continue playing songs until you reach 10 total
2. Check database:
```sql
SELECT activity_type, created_at, metadata
FROM listener_contributions
WHERE user_id = 'YOUR_USER_ID'
AND DATE(created_at) = CURRENT_DATE
AND activity_type IN ('daily_active_listener', 'daily_listener_10')
ORDER BY created_at;
```
Expected: 2 records (one for 5 songs, one for 10 songs)

#### Test 3: Super Listener (20 songs)
1. Continue playing songs until you reach 20 total
2. Check database:
```sql
SELECT activity_type, created_at, metadata
FROM listener_contributions
WHERE user_id = 'YOUR_USER_ID'
AND DATE(created_at) = CURRENT_DATE
AND activity_type LIKE 'daily%'
ORDER BY created_at;
```
Expected: 3 records (5, 10, and 20 song milestones)

#### Test 4: Engaged Listener (80%+ completion)
1. Play 10 songs and let each one play to 80%+ completion
2. Check database:
```sql
SELECT activity_type, metadata
FROM listener_contributions
WHERE user_id = 'YOUR_USER_ID'
AND DATE(created_at) = CURRENT_DATE
AND activity_type = 'song_completion_bonus';
```
Expected: 1 record with completion_rate >= 0.8 in metadata

#### Test 5: Check Listener Stats
```sql
SELECT
  user_id,
  daily_songs_started,
  daily_songs_completed,
  current_streak_days,
  weekly_genres_listened,
  last_active_date
FROM listener_engagement_stats
WHERE user_id = 'YOUR_USER_ID';
```
This shows the raw tracking data used for milestone detection.

### 4. Admin Dashboard Verification

Go to Admin Dashboard → Contribution System → Point Rewards tab:

1. Verify you can see all listening engagement activities
2. Check point values match the updated structure:
   - Daily Active Listener: 10 pts ✅
   - Dedicated Listener: 15 pts ✅
   - Super Listener: 25 pts ✅
   - Engaged Listener: 15 pts ✅
   - Genre Explorer: 25 pts ✅
   - Listening Streaks: 30/75/300 pts ✅

3. Test editing point values (admin can adjust anytime)

---

## Troubleshooting

### Issue: Points Not Being Credited

**Check 1: User Authentication**
```sql
-- Verify user is logged in
SELECT auth.uid();
```

**Check 2: Function Permissions**
```sql
-- Verify function can be executed
SELECT has_function_privilege('track_listening_engagement', 'execute');
```

**Check 3: RLS Policies**
```sql
-- Check if RLS is blocking inserts
SELECT * FROM listener_contributions
WHERE user_id = auth.uid()
LIMIT 1;
```

**Check 4: Browser Console**
- Open browser DevTools
- Look for errors related to `trackListeningEngagement`
- Check network tab for failed Supabase requests

### Issue: Duplicate Rewards

The system should prevent duplicates with EXISTS checks. If duplicates occur:

```sql
-- Find duplicate rewards
SELECT
  user_id,
  activity_type,
  DATE(created_at) as date,
  COUNT(*) as count
FROM listener_contributions
WHERE activity_type IN ('daily_active_listener', 'daily_listener_10', 'daily_listener_20')
GROUP BY user_id, activity_type, DATE(created_at)
HAVING COUNT(*) > 1;
```

### Issue: Stats Not Updating

```sql
-- Check if stats table is being updated
SELECT
  user_id,
  daily_songs_started,
  daily_songs_completed,
  last_active_date,
  updated_at
FROM listener_engagement_stats
WHERE user_id = 'YOUR_USER_ID';
```

If `updated_at` is not recent, the function may not be executing.

---

## Performance Monitoring

### Track Daily Reward Distribution

```sql
-- See which rewards are being earned most
SELECT
  activity_type,
  COUNT(*) as total_awarded,
  COUNT(DISTINCT user_id) as unique_users,
  SUM((SELECT base_reward_points FROM contribution_activities ca WHERE ca.activity_type = lc.activity_type)) as total_points
FROM listener_contributions lc
WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days'
AND activity_type LIKE 'daily%' OR activity_type LIKE 'listening_streak%'
GROUP BY activity_type
ORDER BY total_points DESC;
```

### Find Active Contributors

```sql
-- Users earning the most points from listening
SELECT
  u.username,
  COUNT(DISTINCT lc.id) as rewards_earned,
  SUM(ca.base_reward_points) as total_points
FROM listener_contributions lc
JOIN users u ON u.id = lc.user_id
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
WHERE DATE(lc.created_at) >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.username
ORDER BY total_points DESC
LIMIT 20;
```

---

## Expected Earning Examples

### Super Active User (20+ songs daily)
```
Daily:
- Daily Active (5 songs): 10 pts
- Dedicated (10 songs): 15 pts
- Super (20 songs): 25 pts
- Engaged (80% completion): 15 pts
= 65 points/day

Weekly bonus:
- Genre Explorer: 25 pts
- Artist Discovery: 20 pts
= 110 points total

7-day streak: 75 pts

Monthly total: ~1,950-2,100 points
```

### Active User (10+ songs daily)
```
Daily:
- Daily Active (5 songs): 10 pts
- Dedicated (10 songs): 15 pts
- Engaged (80% completion): 15 pts
= 40 points/day

Weekly bonus: ~45 pts

Monthly total: ~1,200-1,400 points
```

### Casual User (5+ songs, 4 days/week)
```
Per active day:
- Daily Active (5 songs): 10 pts

Weekly: ~40 points
Monthly: ~160-200 points
```

---

## Next Steps After Verification

1. **Monitor for 24-48 hours** to ensure rewards are being credited correctly
2. **Check for any errors** in logs or user reports
3. **Adjust point values** via Admin Dashboard if needed
4. **Announce new milestones** to users once confirmed working
5. **Create user-facing UI** to show progress toward milestones (optional enhancement)

---

## User Communication Template

When announcing to users:

```
🎉 New Listening Rewards Available!

We've enhanced our contribution rewards system:

✨ NEW MILESTONES:
• Dedicated Listener (10 songs/day): 15 points
• Super Listener (20 songs/day): 25 points

💰 INCREASED REWARDS:
• Genre Explorer: 25 points (up from 2!)
• Listening Streaks: Up to 300 points for 30 days!
• Early Supporter bonus: 100 points

All milestones are independent - listen to 20 songs and earn
rewards for 5, 10, AND 20 song milestones!

Keep exploring, keep listening, keep earning! 🎵
```

---

**Last Updated**: January 22, 2026
**Status**: ✅ Ready for Testing
**Database Migration**: Applied Successfully

# Contribution Tracking System - Fix Complete

## Problem Identified

Users' contribution scores were not updating after admins configured the Contribution System in the admin dashboard. The issue was caused by:

1. **Missing function permissions** - The `record_listener_contribution` and `track_listening_engagement` functions didn't have proper grants for authenticated and anonymous users
2. **Incomplete activity configuration** - Some social engagement activities weren't properly inserted into the database
3. **RLS policy gaps** - Some policies were too restrictive, blocking legitimate contribution tracking

## What Was Fixed

### 1. Function Permissions Re-granted
- `record_listener_contribution()` - Now accessible by authenticated, service_role, and anon users
- `track_listening_engagement()` - Now accessible by authenticated, service_role, and anon users
- `get_top_contributors()` - Now accessible by authenticated and anon users

### 2. All Activity Types Ensured

The following contribution activities are now guaranteed to exist:

**Social Engagement:**
- `song_like` - Like Song (3 points)
- `video_like` - Like Video (3 points)
- `content_comment` - Comment on Content (5 points)
- `artist_follow` - Follow Artist (5 points)
- `content_share` - Share Content (3 points)
- `video_completion` - Complete Video (4 points)

**Listening Engagement:**
- `daily_active_listener` - 5+ songs per day (10 points)
- `daily_listener_10` - 10+ songs per day (15 points)
- `daily_listener_20` - 20+ songs per day (25 points)
- `daily_listener_50` - 50+ songs per day (50 points)
- `genre_explorer` - 5+ genres per week (25 points)
- `artist_discovery` - 5+ small artists (<10k plays) per week (20 points)
- `song_completion_bonus` - 80%+ completion rate daily (15 points)
- `listening_streak_3` - 3-day streak (30 points)
- `listening_streak_7` - 7-day streak (75 points)
- `listening_streak_30` - 30-day streak (300 points)
- `early_supporter` - Early artist supporter (100 points)

**Playlist & Curation:**
- `playlist_created` - Create Playlist (10 points)
- `playlist_play` - Playlist Gets Play (5 points)
- `playlist_quality_bonus` - 50+ plays on playlist (100 points)
- `early_discovery` - Early song discovery (50 points)
- `curation_featured` - Featured Curation (200 points)
- `curation_engagement` - Curation Engagement (10 points)
- `daily_engagement` - Daily Active Contributor (5 points)
- `referral_contribution` - Referral Joins (50 points)

### 3. Fixed RLS Policies
- Anyone can now view contribution activities (needed for frontend display)
- Service role can insert contributions (needed for automated tracking)
- Authenticated users can insert their own contributions
- Proper access for contribution scores and engagement stats

### 4. Performance Indexes Added
- `idx_contribution_activities_type_active` - Fast activity lookups
- `idx_listener_contributions_user_activity_date` - Fast duplicate checks

### 5. Diagnostic Function Created
New admin function: `admin_check_contribution_system()`
- Checks active activities count
- Shows contributions today
- Shows users with scores
- Verifies function permissions
- Shows recent activity

## How to Verify It's Working

### Step 1: Check the System Status (Admin)

As an admin, you can now run a diagnostic check:

```sql
SELECT * FROM admin_check_contribution_system();
```

This will return a status report showing:
- Number of active activities
- Contributions recorded today
- Users with scores
- Function permissions status
- Recent activity

### Step 2: Test User Actions

Have a test user perform these actions and verify scores update:

1. **Like a song** → Should earn 3 points (song_like)
2. **Comment on content** → Should earn 5 points (content_comment)
3. **Follow an artist** → Should earn 5 points (artist_follow)
4. **Share content** → Should earn 3 points (content_share)
5. **Listen to 5 songs** → Should earn 10 points (daily_active_listener)
6. **Listen to 10 songs** → Should earn 15 points (daily_listener_10)
7. **Create a playlist** → Should earn 10 points (playlist_created)

### Step 3: Check User's Contribution Score

Query a user's contribution score:

```sql
SELECT * FROM listener_contribution_scores
WHERE user_id = 'USER_ID_HERE';
```

You should see:
- `total_points` - Cumulative lifetime points
- `current_period_points` - Points for current period
- `playlist_creation_points` - Points from playlists
- `discovery_points` - Points from discovery
- `curation_points` - Points from curation
- `engagement_points` - Points from engagement

### Step 4: View Recent Contributions

Check recent contribution events:

```sql
SELECT
  activity_type,
  contribution_points,
  created_at
FROM listener_contributions
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC
LIMIT 20;
```

## How It Works

### When a User Performs an Action

1. **Frontend calls contribution tracking function**
   - Example: `recordContribution('song_like', songId, 'song')`

2. **Function looks up activity configuration**
   - Checks if activity type exists and is active
   - Gets the configured point value

3. **If active, records contribution**
   - Inserts into `listener_contributions` table
   - Updates user's `listener_contribution_scores`
   - Updates category-specific points (playlist, discovery, etc.)

4. **Listening engagement has special logic**
   - Tracks daily/weekly stats in `listener_engagement_stats`
   - Awards milestone bonuses automatically (5, 10, 20, 50 songs)
   - Checks completion rate, genre variety, artist discovery
   - Awards streak bonuses (3, 7, 30 days)

### Admin Configuration

Admins can:
1. View all activities in the Contribution System tab
2. Enable/disable any activity
3. Change point values for any activity
4. See stats on active activities and total points

Changes take effect immediately - no restart required.

## Important Notes

### Time Gating
Many activities are time-gated to prevent abuse:
- **Once per day**: Most listening milestones, social actions
- **Once per week**: Genre explorer, artist discovery
- **Once ever per item**: Following same artist, liking same song
- **Special conditions**: Streaks require consecutive days

### Fraud Prevention
The system includes built-in fraud detection:
- Creators cannot earn listener rewards from their own content
- Duplicate contributions within time windows are blocked
- Suspicious patterns are flagged and blocked

### Performance
The system is optimized for scale:
- Cached fraud detection (5-minute TTL)
- Indexed queries for fast lookups
- Batch operations where possible
- Queued non-critical operations

## Troubleshooting

### Contributions Not Recording

1. **Check if activity is active**
   ```sql
   SELECT * FROM contribution_activities
   WHERE activity_type = 'song_like';
   ```
   Verify `is_active = true`

2. **Check user authentication**
   - User must be logged in for most activities
   - Some activities require specific roles

3. **Check time gating**
   - User may have already earned this activity today/this week
   - Check `listener_contributions` for recent entries

4. **Check browser console**
   - Look for error messages from `recordContribution()`
   - Verify network requests are succeeding

### Scores Not Updating

1. **Check RLS policies**
   - Run the diagnostic: `SELECT * FROM admin_check_contribution_system()`

2. **Verify function permissions**
   - Should see "OK" status in diagnostic results

3. **Check contribution_activities table**
   - Ensure activities exist and are active
   - Verify point values are set correctly

## Migration Applied

**File**: `fix_contribution_tracking_permissions.sql`
**Status**: ✅ Applied successfully
**Date**: 2026-01-25

The contribution tracking system is now fully operational and ready to credit users for their engagement activities!

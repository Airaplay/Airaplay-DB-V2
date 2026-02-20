# Contribution System Testing Guide

## Quick Test: Verify System is Working

### 1. Run System Diagnostic (Admin Dashboard)

Go to **Admin Dashboard** → **Contribution System** tab and you should now see all activity categories properly populated with activities.

Alternatively, run this in your Supabase SQL Editor:

```sql
SELECT * FROM admin_check_contribution_system();
```

Expected results:
- ✅ Active Activities: 20+ activities configured
- ✅ Function Permissions: OK
- ℹ️ Contributions Today: May show 0 if no users have contributed yet

### 2. Configure Activity Points (Optional)

In the **Admin Dashboard** → **Contribution System** → **Point Rewards** tab:

1. You'll see activities organized by category:
   - Community Engagement
   - Curation
   - Listening Engagement
   - Discovery & Exploration
   - Playlist Contributions

2. Click **Edit** on any activity to change:
   - Point value
   - Active/Inactive status

3. Click **Save** to apply changes immediately

### 3. Test as a Regular User

Perform these actions as a test user (not admin):

#### Test Social Engagement
1. ❤️ **Like a song** → Open any song, click the heart icon
2. 💬 **Comment on content** → Add a comment to any song/video
3. 👤 **Follow an artist** → Visit an artist profile, click follow
4. 🔗 **Share content** → Click share button on any content

#### Test Listening Engagement
1. 🎵 **Listen to 5 songs** → Play 5 different songs to completion
2. 🎧 **Listen to 10 songs** → Continue to 10 songs total
3. 🎼 **Listen to 20 songs** → Continue to 20 songs total

#### Test Playlist Creation
1. 📝 **Create a playlist** → Add at least 3 songs to a new playlist
2. Make it public if you want others to play it for bonus points

### 4. Verify Scores Updated

#### Option A: Check in Profile Screen
1. Go to your **Profile**
2. Look for contribution score display (if implemented in UI)

#### Option B: Check in Database
Run this query with your user ID:

```sql
SELECT
  total_points,
  current_period_points,
  playlist_creation_points,
  discovery_points,
  curation_points,
  engagement_points,
  updated_at
FROM listener_contribution_scores
WHERE user_id = 'YOUR_USER_ID';
```

Expected results after testing:
- `total_points`: 30+ points (depending on actions performed)
- `engagement_points`: 10+ points (from likes, comments, follows)
- `playlist_creation_points`: 10+ points (from playlist creation)
- `updated_at`: Recent timestamp

### 5. View Contribution History

Check what contributions were recorded:

```sql
SELECT
  activity_type,
  contribution_points,
  created_at,
  metadata
FROM listener_contributions
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

You should see entries for:
- `song_like` (3 points each)
- `content_comment` (5 points)
- `artist_follow` (5 points)
- `content_share` (3 points)
- `daily_active_listener` (10 points)
- `playlist_created` (10 points)

## Expected Point Values

Here's what users should earn for common actions:

| Action | Activity Type | Points | Frequency |
|--------|---------------|--------|-----------|
| Like a song | `song_like` | 3 | Once per song |
| Like a video | `video_like` | 3 | Once per video |
| Comment | `content_comment` | 5 | Once per day |
| Follow artist | `artist_follow` | 5 | Once per artist |
| Share content | `content_share` | 3 | Once per day |
| Listen 5 songs | `daily_active_listener` | 10 | Once per day |
| Listen 10 songs | `daily_listener_10` | 15 | Once per day |
| Listen 20 songs | `daily_listener_20` | 25 | Once per day |
| Listen 50 songs | `daily_listener_50` | 50 | Once per day |
| Create playlist | `playlist_created` | 10 | Per playlist |
| 3-day streak | `listening_streak_3` | 30 | Once per streak |
| 7-day streak | `listening_streak_7` | 75 | Once per streak |
| 30-day streak | `listening_streak_30` | 300 | Once per streak |

## Common Issues and Solutions

### Issue: "No contributions recorded"

**Solution:**
1. Verify activities are set to **active** in admin dashboard
2. Check browser console for errors
3. Ensure user is logged in
4. Run diagnostic: `SELECT * FROM admin_check_contribution_system()`

### Issue: "Same action not giving points twice"

**Solution:**
This is expected! Many activities are time-gated:
- Liking same song = only once ever
- Daily activities = only once per day
- Weekly activities = only once per week

### Issue: "Listening milestones not triggering"

**Solution:**
1. Ensure you're listening to songs for at least 65 seconds each
2. Multiple milestones can trigger on same day (5, 10, 20, 50 songs)
3. Each milestone is awarded independently
4. Check `listener_engagement_stats` table for your stats

### Issue: "Admin changes not taking effect"

**Solution:**
1. Click **Save** button after editing
2. Changes are immediate - no need to reload page
3. Disable then re-enable activity if needed
4. Check that `is_active = true` in database

## Advanced Testing

### Test Listening Streaks

1. **Day 1**: Listen to 5+ songs today
2. **Day 2**: Listen to 5+ songs tomorrow
3. **Day 3**: Listen to 5+ songs the next day
   - Should earn **3-day streak bonus** (30 points)

4. Continue for 7 days → **7-day streak bonus** (75 points)
5. Continue for 30 days → **30-day streak bonus** (300 points)

### Test Genre Explorer

1. Listen to songs from 5+ different genres within 7 days
2. Should earn **genre_explorer** bonus (25 points)

### Test Artist Discovery

1. Listen to 5+ songs from artists with <10k total plays
2. Should earn **artist_discovery** bonus (20 points)

### Test Playlist Quality Bonus

1. Create a public playlist with great songs
2. Get 50+ plays from other users (not yourself)
3. Should earn **playlist_quality_bonus** (100 points)

## Admin Monitoring

### View Top Contributors

```sql
SELECT * FROM get_top_contributors(10);
```

Shows the top 10 users by contribution score.

### View Activity Stats

```sql
SELECT
  activity_type,
  COUNT(*) as contributions_count,
  SUM(contribution_points) as total_points,
  COUNT(DISTINCT user_id) as unique_users
FROM listener_contributions
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY activity_type
ORDER BY total_points DESC;
```

Shows activity breakdown for the last 7 days.

### View Daily Contribution Trends

```sql
SELECT
  DATE(created_at) as contribution_date,
  COUNT(*) as contributions,
  COUNT(DISTINCT user_id) as active_users,
  SUM(contribution_points) as total_points
FROM listener_contributions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY contribution_date DESC;
```

Shows daily contribution trends for the last 30 days.

## Success Criteria

✅ System is working correctly if:

1. Diagnostic shows "OK" for all checks
2. Test user actions create entries in `listener_contributions`
3. User's score in `listener_contribution_scores` updates
4. Point values match configured activities
5. Time-gating prevents duplicate awards
6. Admin can modify point values and see changes immediately

## Next Steps

1. **Monitor user engagement**: Watch contribution stats daily
2. **Adjust point values**: Balance rewards based on user behavior
3. **Monthly conversion**: Use the "Monthly Conversion" tab to convert points to rewards
4. **Feature new activities**: Add new contribution types as needed

The contribution system is now fully operational and ready to reward users for their valuable engagement!

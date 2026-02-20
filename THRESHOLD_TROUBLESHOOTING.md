# Threshold System Troubleshooting Guide

## Problem: Changed threshold but nothing happened

### Solution 1: Wait for Cache to Expire
**Issue:** Home screen data is cached for 5 minutes

**Fix:**
- Wait 5 minutes after saving
- Or close and reopen the app to force refresh

**Why:** Performance optimization to reduce database load

---

### Solution 2: Check if Section is Enabled
**Issue:** Section might be disabled

**Fix:**
```sql
SELECT section_name, is_enabled FROM content_section_thresholds;
```

If `is_enabled = false`, go to Admin Dashboard and enable it.

---

### Solution 3: Verify Threshold Values
**Issue:** Threshold might be too high

**Fix:**
```sql
SELECT section_name, min_play_count, min_like_count
FROM content_section_thresholds;
```

Check if your content actually meets the threshold:
```sql
-- Check how many songs meet Global Trending threshold
SELECT COUNT(*)
FROM songs
WHERE play_count >= 50;  -- Replace 50 with your threshold
```

If count is 0, lower the threshold.

---

### Solution 4: Check Time Window
**Issue:** Time window might be too narrow

**Fix:**
```sql
SELECT section_name, time_window_days
FROM content_section_thresholds;
```

If `time_window_days = 7` but all your content is older, increase to 30 or set to `NULL` (all time).

---

### Solution 5: View All vs Home Screen Mismatch
**Issue:** "View All" shows different songs than home screen

**Expected:** This is normal due to caching

**Explanation:**
- Home screen: Uses cached data (up to 5 minutes old)
- View All: Direct database query (always current)

**Fix:** Wait 5 minutes for home screen cache to expire

---

## Problem: Section is empty after changing threshold

### Cause
Your threshold is too high - no content meets the requirement

### Solution
```sql
-- Find the right threshold for your app
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY play_count) as median_plays,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY play_count) as top_25_percent,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY play_count) as top_10_percent
FROM songs
WHERE audio_url IS NOT NULL;
```

**Recommendations:**
- New apps: Start with median (50th percentile)
- Growing apps: Use 75th percentile
- Mature apps: Use 90th percentile

---

## Problem: Thresholds not applying to View All screens

### This Should NOT Happen Anymore ✅

All View All screens now use RPC functions that read dynamic thresholds:
- ✅ TrendingViewAllScreen → `get_shuffled_trending_songs`
- ✅ TrendingNearYouViewAllScreen → `get_trending_near_you_songs`
- ✅ NewReleaseViewAllScreen → `get_new_releases_filtered`

### If It Still Happens

1. Check browser console for errors
2. Verify migration was applied:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%trending%' OR routine_name LIKE '%releases%';
```

Should show:
- `get_shuffled_trending_songs`
- `get_trending_near_you_songs`
- `get_new_releases_filtered`

3. Test RPC directly:
```sql
SELECT * FROM get_shuffled_trending_songs(14, 10);
```

---

## Problem: Database function returns empty results

### Cause
Function might be using wrong threshold or failing silently

### Debug Steps

**Step 1: Check if threshold exists**
```sql
SELECT * FROM content_section_thresholds
WHERE section_key = 'global_trending';
```

**Step 2: Test with manual threshold**
```sql
SELECT
  s.id,
  s.title,
  COUNT(lh.song_id) as play_count
FROM listening_history lh
JOIN songs s ON lh.song_id = s.id
WHERE lh.listened_at >= NOW() - INTERVAL '14 days'
  AND s.audio_url IS NOT NULL
GROUP BY s.id, s.title
HAVING COUNT(lh.song_id) >= 5  -- Lower threshold for testing
ORDER BY play_count DESC
LIMIT 10;
```

**Step 3: Compare with function**
```sql
SELECT * FROM get_shuffled_trending_songs(14, 10);
```

If manual query returns results but function doesn't:
- Function might have bug
- Check function permissions:
```sql
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name = 'get_shuffled_trending_songs';
```

Should show `security_type = DEFINER`

---

## Problem: Changes in Admin UI not saving

### Symptoms
- Click Save but threshold doesn't update
- Error message appears
- No success message

### Causes & Fixes

**Cause 1: Not logged in as admin**
```sql
-- Check if you're admin
SELECT is_admin FROM users WHERE id = auth.uid();
```

**Cause 2: RLS policy blocking update**
```sql
-- Check policies
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'content_section_thresholds';
```

Should have admin update policy.

**Cause 3: Invalid values**
- Min Play Count must be >= 0
- Min Like Count must be >= 0
- Time Window Days must be > 0 or NULL

---

## Quick Diagnostics Checklist

Run these queries to check system health:

```sql
-- 1. Are thresholds configured?
SELECT section_name, min_play_count, is_enabled
FROM content_section_thresholds
ORDER BY section_name;

-- 2. Do RPC functions exist?
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN (
  'get_shuffled_trending_songs',
  'get_trending_near_you_songs',
  'get_new_releases_filtered'
);

-- 3. How much content meets each threshold?
SELECT
  'Global Trending' as section,
  COUNT(*) as qualifying_songs
FROM songs s
JOIN listening_history lh ON s.id = lh.song_id
WHERE lh.listened_at >= NOW() - INTERVAL '14 days'
  AND s.audio_url IS NOT NULL
GROUP BY s.id
HAVING COUNT(lh.song_id) >= 50;

-- 4. Test each function
SELECT COUNT(*) as count FROM get_shuffled_trending_songs(14, 100);
SELECT COUNT(*) as count FROM get_trending_near_you_songs('NG', 14, 100);
SELECT COUNT(*) as count FROM get_new_releases_filtered(100);
```

---

## Still Not Working?

### Check Edge Function

**Test edge function directly:**
```bash
curl https://your-project.supabase.co/functions/v1/home-screen-data
```

Look for `"thresholds"` in the response:
```json
{
  "thresholds": {
    "global_trending": {
      "min_play_count": 50,
      ...
    }
  }
}
```

If thresholds missing or incorrect:
- Edge function might not be deployed
- Redeploy using Supabase CLI or re-upload via admin

---

## Common Mistakes

1. **Expecting instant changes on home screen**
   - ❌ Wrong: Changes appear immediately everywhere
   - ✅ Right: Home screen has 5-minute cache, View All screens are immediate

2. **Setting thresholds too high for new apps**
   - ❌ Wrong: Using 500 plays for an app with 100 total plays
   - ✅ Right: Start with 5-10 plays, increase gradually

3. **Forgetting to enable the section**
   - ❌ Wrong: Change threshold but leave `is_enabled = false`
   - ✅ Right: Always check "Enable section" is checked

4. **Not checking actual play counts**
   - ❌ Wrong: Assuming all songs have high play counts
   - ✅ Right: Query actual play count distribution first

---

## Getting Help

If still stuck, provide these details:
1. Which section? (Global Trending, New Releases, etc.)
2. What threshold values did you set?
3. What's in the database?
   ```sql
   SELECT * FROM content_section_thresholds
   WHERE section_key = 'your_section';
   ```
4. How much qualifying content exists?
5. Did you wait 5 minutes for cache?
6. Any error messages?

---

**Remember:** The system is working correctly if:
- ✅ Thresholds save successfully in Admin UI
- ✅ Database functions return correct data when called directly
- ✅ View All screens update immediately
- ✅ Home screen updates within 5 minutes

The 5-minute cache is intentional and working as designed!

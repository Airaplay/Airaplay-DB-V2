# Click Tracking Verification Guide

## Overview
This guide helps verify that promotion click tracking is working correctly for both authenticated and non-authenticated users across all sections of the app.

## ✅ Sections With Click Tracking Enabled

### Home Screen Sections
All home screen sections with promoted content have click tracking properly implemented:

1. **Trending Section** (`now_trending`)
   - Content Type: `song`
   - Location: `src/screens/HomePlayer/sections/TrendingSection/TrendingSection.tsx:256`

2. **Must Watch Section** (`must_watch`)
   - Content Type: `video`
   - Location: `src/screens/HomePlayer/sections/MustWatchSection/MustWatchSection.tsx:239`

3. **Mix For You Section** (`mix_for_you`)
   - Content Type: `album`
   - Location: `src/screens/HomePlayer/sections/MixForYouSection/MixForYouSection.tsx:317`

4. **Top Artists Section** (`top_artist`)
   - Content Type: `profile`
   - Location: `src/screens/HomePlayer/sections/TopArtisteSection/TopArtisteSection.tsx:275`

5. **New Releases Section** (`new_release`)
   - Content Type: `song`
   - Location: `src/screens/HomePlayer/sections/NewReleasesSection/NewReleasesSection.tsx:252`

6. **AI Recommended Section** (`ai_recommended`)
   - Content Type: `song | video | album`
   - Location: `src/screens/HomePlayer/sections/AIRecommendedSection/AIRecommendedSection.tsx:863`

7. **Inspired By You Section** (`inspired_by_you`)
   - Content Type: `song`
   - Location: `src/screens/HomePlayer/sections/InspiredByYouSection/InspiredByYouSection.tsx:425`

8. **Trending Albums Section** (`trending_album`)
   - Content Type: `album`
   - Location: `src/screens/HomePlayer/sections/TrendingAlbumsSection/TrendingAlbumsSection.tsx:333`

9. **Trending Near You Section** (`trending_near_you`)
   - Content Type: `song`
   - Location: `src/screens/HomePlayer/sections/TrendingNearYouSection/TrendingNearYouSection.tsx:346`

### ViewAll Screens

1. **Trending ViewAll** - ✅ Tracks clicks on promoted songs
2. **Must Watch ViewAll** - ✅ Tracks clicks on promoted videos
3. **New Releases ViewAll** - ✅ Tracks clicks on promoted songs
4. **Trending Near You ViewAll** - ✅ Tracks clicks on promoted songs
5. **Trending Albums ViewAll** - ✅ Tracks clicks on promoted albums

### Special Cases

**Tracks Blowing Up Section**
- ❌ No promotion click tracking (by design)
- Uses real-time play count algorithm
- Not part of the promotion system

**Explore & Library Screens**
- ❌ No promotion click tracking (by design)
- Show user's own content and playlists
- Not appropriate for promotion tracking

## How Click Tracking Works

### For Authenticated Users
```typescript
// User clicks on promoted content
await recordPromotedContentClick(contentId, sectionKey, contentType);

// Behind the scenes:
// 1. Gets user.id from auth context
// 2. Finds active promotion for content
// 3. Records click with user_id
// 4. Updates promotion_performance_metrics table
// 5. Increments click count on promotions table
```

### For Non-Authenticated (Anonymous) Users
```typescript
// Anonymous user clicks on promoted content
await recordPromotedContentClick(contentId, sectionKey, contentType);

// Behind the scenes:
// 1. user_id = null (no auth)
// 2. Finds active promotion for content
// 3. Records click with session_id
// 4. Updates promotion_performance_metrics table
// 5. Increments click count on promotions table
```

## Database Structure

### RLS Policies (Both Auth & Non-Auth Supported)
```sql
-- Allow INSERT for both anon and authenticated users
CREATE POLICY "Allow insert promotion metrics"
  ON promotion_performance_metrics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow UPDATE for UPSERT operations
CREATE POLICY "Allow update promotion metrics"
  ON promotion_performance_metrics
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
```

### Database Function
```sql
record_promotion_impression(
  p_promotion_id uuid,
  p_section_key text,
  p_user_id uuid DEFAULT NULL,      -- Optional (null for anon)
  p_clicked boolean DEFAULT false,  -- true for clicks
  p_session_id text DEFAULT NULL    -- For anonymous tracking
)
RETURNS void
```

## Manual Testing Steps

### Test 1: Authenticated User Click Tracking
1. Log in to the app
2. Navigate to Home screen
3. Open browser DevTools Console
4. Click on a promoted song in any section
5. Look for console logs:
   ```
   [PromotionHelper] Recording click - targetId: xxx, sectionKey: xxx
   [PromotionHelper] Found section ID: xxx
   [PromotionHelper] Found promotion ID: xxx
   [PromotionHelper] ✅ Successfully recorded click for promotion xxx
   ```
6. Verify in database:
   ```sql
   SELECT * FROM promotion_performance_metrics
   WHERE promotion_id = 'xxx'
   ORDER BY date DESC LIMIT 1;
   ```

### Test 2: Non-Authenticated User Click Tracking
1. Log out or use incognito mode
2. Navigate to Home screen
3. Open browser DevTools Console
4. Click on a promoted song in any section
5. Look for the same console logs (should work without login)
6. Verify in database (clicks should still be recorded)

### Test 3: Click Count Verification
1. Note the initial click count for a promotion
2. Click on the promoted content 3 times (with page refresh between clicks)
3. Query the database:
   ```sql
   SELECT
     p.id,
     p.target_title,
     p.clicks,
     ppm.clicks as daily_clicks
   FROM promotions p
   LEFT JOIN promotion_performance_metrics ppm ON ppm.promotion_id = p.id
   WHERE p.id = 'xxx'
   AND ppm.date = CURRENT_DATE;
   ```
4. Verify click count increased by 3

## Debugging

### Common Issues

**Issue: "No active promotion found"**
- Cause: Content is not currently promoted
- Solution: Verify promotion is active in admin dashboard

**Issue: "Section not found"**
- Cause: Invalid section_key
- Solution: Check section_key matches database

**Issue: RLS Policy Error**
- Cause: Missing policies for anon users
- Solution: Verify policies exist (already fixed in migration `20251222233811`)

### Enable Debug Logging
All click tracking includes detailed console logging:
- Section lookup
- Promotion lookup
- Click recording success/failure

Check browser console for detailed logs when testing.

## Performance Considerations

- Click tracking is **async** and doesn't block navigation
- Failed click tracking is logged but doesn't prevent user actions
- RLS policies are optimized for both anon and authenticated access
- Uses UPSERT for efficient daily metrics updates

## Security

✅ **Both authenticated and anonymous users can record clicks**
✅ **User data is protected** - anon users can only insert/update metrics, not read others
✅ **No SQL injection** - all parameters are properly parameterized
✅ **Rate limiting** - handled at application level

## Metrics Available

For each promotion, you can track:
- **Total Impressions** - How many times content was viewed
- **Total Clicks** - How many times content was clicked
- **Click-Through Rate (CTR)** - Clicks / Impressions
- **Daily Breakdown** - Metrics per day
- **User Attribution** - Authenticated vs anonymous clicks

## Admin Dashboard

View click tracking data in:
- **Promotion Manager** - See clicks per promotion
- **Analytics Section** - View aggregated metrics
- **Performance Reports** - CTR and engagement data

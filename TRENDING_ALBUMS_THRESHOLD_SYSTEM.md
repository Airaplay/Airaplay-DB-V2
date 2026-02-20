# Trending Albums Threshold System - FIXED & WORKING

## Overview
The Trending Albums section now respects the admin-configured thresholds from the Content Section Thresholds settings in the Admin Dashboard, with an intelligent 3-tier fallback system that actually works!

## Smart Fallback Approach (3-Tier System)

The system uses a **unified query** approach that assigns tiers based on play count thresholds, then sorts by tier priority. This is much simpler and more reliable than the previous multi-query approach.

### Tier 1: Admin-Configured Threshold (Priority)
- Uses the threshold set in Admin Dashboard (default: 50 plays)
- Albums meeting this threshold appear first
- Best for established apps with active users

### Tier 2: Moderate Fallback (10+ plays)
- Albums with 10+ plays but below admin threshold
- Automatically fills in when Tier 1 has few results
- Good balance between quality and quantity

### Tier 3: Maximum Availability (1+ plays)
- Albums with 1+ plays but below 10
- Ensures users always see content, especially for new apps
- Perfect fallback for brand new applications

**Key Improvement**: All tiers are retrieved in a single efficient query, sorted by tier first, then by play count. No complex tracking needed!

## How It Works

### Database Function: `get_trending_albums()`
```sql
-- Parameters:
-- days_param: Number of days to look back (default: 30)
-- limit_param: Maximum albums to return (default: 50)

SELECT * FROM get_trending_albums(30, 50);
```

### What It Returns
- Album ID, title, cover image, description
- Artist information (name, stage name, user ID)
- Total plays (sum of all track play counts)
- Track count
- Creation date
- **Tier** (for debugging: 1 = admin threshold, 2 = 10+ plays, 3 = 1+ plays)
- Automatically sorted by tier (ascending), then total plays (descending)

### Frontend Implementation

Both `TrendingAlbumsSection.tsx` and `TrendingAlbumsViewAllScreen.tsx` now:

1. Call the database function instead of manual queries
2. Process album data with track information
3. Apply genre filtering (if selected)
4. Mark promoted albums
5. Display results with proper sorting

## Admin Configuration

To adjust the threshold:

1. Go to Admin Dashboard
2. Navigate to "Content Section Thresholds"
3. Find "Trending Albums" section
4. Set your desired minimum play count
5. Enable/disable the threshold

## Benefits

1. **Centralized Control**: Admins can adjust thresholds from one place
2. **Smart Fallback**: Never shows empty sections, even for new apps
3. **Performance**: Single efficient query with proper indexing
4. **Consistency**: Same logic across all album displays
5. **Reliability**: No complex multi-query tracking issues
6. **User Experience**: Always shows content, adapting to available data

## Example Scenarios

### Scenario 1: Established App (Threshold: 100)
```
Albums: 150 plays, 120 plays, 110 plays, 95 plays, 80 plays...
Result: Shows top albums with 100+ plays (all Tier 1)
```

### Scenario 2: Growing App (Threshold: 50)
```
Albums: 47 plays, 21 plays, 10 plays, 5 plays, 1 play
Result:
- Tier 2: 47, 21, 10 (10+ plays)
- Tier 3: 5, 1 (1+ plays)
Shows 5 albums total
```

### Scenario 3: New App (Threshold: 50, lowered to 10)
```
Albums: 47 plays, 21 plays, 10 plays, 5 plays, 1 play
Result after lowering threshold to 10:
- Tier 1: 47, 21, 10 (meets new threshold)
- Tier 3: 5, 1 (below 10)
Shows 5 albums total with better priority
```

## Testing

Test the function:
```sql
-- Check current threshold
SELECT section_key, min_play_count, is_enabled
FROM content_section_thresholds
WHERE section_key = 'trending_albums';

-- Test the function with tier information
SELECT id, title, artist_name, total_plays, track_count, tier
FROM get_trending_albums(30, 20)
ORDER BY tier, total_plays DESC;

-- Test with different thresholds
UPDATE content_section_thresholds
SET min_play_count = 10
WHERE section_key = 'trending_albums';

SELECT id, title, total_plays, tier
FROM get_trending_albums(30, 20);
```

## Technical Details

### How the Unified Query Works

Instead of multiple queries with complex row count tracking, the function now:

1. Calculates total plays for each album
2. Assigns a tier based on play count thresholds:
   - Tier 1: `total_plays >= admin_threshold`
   - Tier 2: `total_plays >= 10`
   - Tier 3: `total_plays >= 1`
3. Sorts results by tier (ascending), then play count (descending)
4. Returns up to the limit specified

This approach is:
- ✅ More reliable (no GET DIAGNOSTICS issues)
- ✅ More efficient (single query vs multiple)
- ✅ Easier to debug (can see tier in results)
- ✅ Guaranteed fallback behavior

### The Fix

**Original Problem**: The previous implementation used `GET DIAGNOSTICS ROW_COUNT` to track results across multiple queries. This doesn't work because it only captures the last query's row count, not cumulative results.

**Solution**: Unified single query with CASE statement for tier assignment. Much simpler and bulletproof!

## Notes

- Albums are filtered to last 30 days by default for trending relevance
- Total plays calculated as sum of all album tracks' play_count
- Genre filtering applied on frontend after function call
- Promoted albums marked separately for featured placement
- The `tier` column is returned for debugging but not displayed to users
- Only albums with at least 1 play are included (albums with 0 plays excluded)

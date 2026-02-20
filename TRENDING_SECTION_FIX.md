# Trending Section Fix - Now Shows Content

## Problem Identified

The TrendingSection was not loading on the home screen because:

1. **Too High Play Count Threshold**: The `get_shuffled_trending_songs` function required songs to have at least **50 plays** in the last 14 days
2. **No Fallback**: If no songs met the threshold, the section would be empty
3. **New Apps Issue**: For new apps with limited user activity, this threshold was too high

## Solution Applied

### Database Function Update

Updated `get_shuffled_trending_songs` function with:

1. **Lowered Threshold**: Reduced minimum play count from 50 to **5 plays**
   - Much more reasonable for new apps
   - Still filters out completely unplayed content
   - Shows songs with genuine engagement

2. **Smart Fallback**: Added automatic fallback logic
   - If insufficient trending songs exist (less than half the requested limit)
   - Automatically fills remaining slots with newest songs
   - Ensures the section always has content to display

3. **Maintains Quality**:
   - Trending songs with 5+ plays show first (with actual play count)
   - Fallback newest songs show after (with play count = 0)
   - Maintains shuffled order that changes every 10 minutes

## How It Works Now

```sql
-- First: Get songs with 5+ plays in last 14 days (shuffled)
SELECT ... WHERE play_count >= 5 ORDER BY random()

-- If insufficient results: Add newest songs to fill the gap
SELECT ... WHERE id NOT IN (trending_ids) ORDER BY created_at DESC
```

## Results

- **Section Now Appears**: TrendingSection will show on home screen
- **Always Has Content**: Falls back to newest songs if needed
- **Scales Naturally**: As your app grows, more songs will meet the 5+ play threshold
- **Same Shuffle Behavior**: All users see the same order within 10-minute windows

## Testing

Build successful - no code changes required in frontend. The section uses the existing database function which has been updated.

## For Production

The TrendingSection will now:
1. Show genuinely trending songs when available (5+ plays)
2. Fill remaining slots with newest content
3. Never appear empty
4. Automatically transition from "new app mode" to "established app mode" as play counts increase

## Configuration

Current settings in `get_shuffled_trending_songs`:
- **Days Window**: 14 days (configurable)
- **Minimum Plays**: 5 plays (lowered from 50)
- **Shuffle Interval**: 10 minutes (consistent for all users)
- **Fallback**: Newest songs when needed

You can adjust these parameters by calling the function with different values:
```typescript
supabase.rpc('get_shuffled_trending_songs', {
  days_param: 14,    // Look back N days
  limit_param: 20    // Return N songs
})
```

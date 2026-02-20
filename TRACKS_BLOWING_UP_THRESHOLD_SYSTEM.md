# Tracks Blowing Up - Threshold System with Smart Fallback

## Overview
The "Tracks Blowing Up" section now uses an admin-configurable threshold system with a 4-tier smart fallback, specifically designed for **time-based momentum tracking** (30-minute windows). The system tracks songs gaining rapid traction in real-time.

## Key Features

### Time-Based Analysis
- **30-minute windows**: Tracks activity in the last 30 minutes
- **Growth calculation**: Compares last 30min vs previous 30min (30-60 minutes ago)
- **Real-time momentum**: Shows songs gaining traction RIGHT NOW
- **Auto-refresh**: Updates every 20 minutes + real-time Supabase subscription

### Admin Control
Configure threshold from Admin Dashboard → Content Section Thresholds → "Tracks Blowing Up"
- **Default threshold**: 5 plays in 30 minutes
- **Adjustable**: Set higher for established apps, lower for new apps
- **Enable/disable**: Turn threshold system on/off

## Smart Fallback System (4 Tiers)

The system uses a **unified query** approach with priority-based tiers:

### Tier 0: Manual Curation (Highest Priority)
- Songs manually added by admins via Admin Dashboard
- Always appear first regardless of play count
- Perfect for promoting specific tracks or featured content
- Sorted by display_order

### Tier 1: Admin Threshold (Primary)
- Songs meeting or exceeding admin-configured threshold
- Default: 5+ plays in last 30 minutes
- Best for apps with active user base
- Shows genuine momentum and trending tracks

### Tier 2: Moderate Activity (Secondary Fallback)
- Songs with 3+ plays in last 30 minutes
- Automatically activates when Tier 1 has insufficient results
- Good balance for growing apps
- Ensures content diversity

### Tier 3: Recent Activity (Tertiary Fallback)
- Songs with 1+ plays in last 30 minutes
- Shows any recent engagement
- Perfect for new apps or slow periods
- Guarantees section always has content

### Tier 4: Historical Engagement (Emergency Fallback)
- Songs from last 7 days with historical play count > 0
- Only used when no recent activity exists
- Ensures section never appears empty
- Rare scenario for very new apps

## How It Works

### Database Function: `get_tracks_blowing_up()`

```sql
-- Call the function
SELECT * FROM get_tracks_blowing_up(20);

-- Parameters:
-- limit_param: Maximum tracks to return (default: 20)
```

### What It Returns

Each track includes:
- Song details (id, title, audio_url, cover_image, duration)
- Artist information (name, stage_name, user_id)
- **plays_last_30min**: Plays in last 30 minutes
- **plays_prev_30min**: Plays in previous 30 minutes (30-60 min ago)
- **growth_percentage**: Calculated growth rate
  - `999`: New/viral spike (no previous plays)
  - `200+`: Viral spike
  - `100-199`: Strong growth
  - `50-99`: Good growth
  - `0-49`: Moderate growth
- **tier**: Priority tier (0-4)
- **is_manual**: Whether manually curated

### Growth Calculation

```javascript
if (prev_30min > 0) {
  growth = ((last_30min - prev_30min) / prev_30min) × 100
} else if (last_30min > 0) {
  growth = 999 // Viral spike
} else {
  growth = 0
}
```

## Frontend Implementation

### TracksBlowingUpSection.tsx

The component has been **massively simplified**:

**Before**: ~500 lines of complex client-side logic
**After**: ~115 lines using database function

Benefits:
- ✅ Much simpler and maintainable
- ✅ Consistent with admin settings
- ✅ Better performance (single DB call)
- ✅ Real-time updates via Supabase subscription
- ✅ Automatic tier-based fallback

### Key Features

1. **Auto-refresh**: Every 20 minutes
2. **Real-time updates**: Supabase subscription to listening_history
3. **Diversity filter**: One song per artist
4. **Shuffling**: Random order for variety
5. **Smart loading**: Shows previous data during background refreshes

## Admin Configuration

### Setting the Threshold

1. Navigate to **Admin Dashboard**
2. Go to **Content Section Thresholds**
3. Find **"Tracks Blowing Up"** section
4. Adjust **min_play_count** (plays in 30 minutes)
5. Enable/disable as needed

### Recommended Thresholds by App Size

| App Size | User Activity | Recommended Threshold | Expected Behavior |
|----------|--------------|----------------------|-------------------|
| **New App** | <100 daily users | 1-2 plays | Tier 3 dominant, shows any activity |
| **Small App** | 100-1000 users | 3-5 plays | Mix of Tier 2 and 3 |
| **Growing App** | 1K-10K users | 5-10 plays | Tier 1 and 2 mix |
| **Medium App** | 10K-100K users | 10-20 plays | Mostly Tier 1 |
| **Large App** | 100K+ users | 20+ plays | Pure Tier 1, high momentum |

## Example Scenarios

### Scenario 1: New App (Threshold: 5 plays/30min)
```
Current activity:
- Song A: 1 play last 30min → Tier 3
- Song B: 0 plays → Not shown

Result: Shows Song A (any activity is good for new apps)
```

### Scenario 2: Growing App (Threshold: 5 plays/30min)
```
Current activity:
- Song A: 16 plays last 30min, 0 prev → Tier 1, 999% growth (viral!)
- Song B: 4 plays last 30min → Tier 2
- Song C: 1 play last 30min → Tier 3

Result: Shows A (viral), then B (moderate), then C (recent)
```

### Scenario 3: Established App (Threshold: 10 plays/30min)
```
Current activity:
- Song A: 45 plays last 30min, 20 prev → Tier 1, 125% growth
- Song B: 32 plays last 30min, 25 prev → Tier 1, 28% growth
- Song C: 8 plays last 30min → Tier 2
- Song D: 3 plays last 30min → Tier 2

Result: Shows A and B (meeting threshold) prioritized,
        then C and D as fallback
```

### Scenario 4: Manual Curation + Auto
```
Manual songs: 3 songs (Tier 0)
Auto-detected:
- Song X: 20 plays → Tier 1
- Song Y: 4 plays → Tier 2

Result: 3 manual songs first (by display_order),
        then Song X, then Song Y
```

## Testing the System

### Check Current Threshold
```sql
SELECT section_key, section_name, min_play_count, is_enabled
FROM content_section_thresholds
WHERE section_key = 'tracks_blowing_up';
```

### Test the Function
```sql
-- See all tiers
SELECT
  id,
  title,
  artist_name,
  plays_last_30min,
  plays_prev_30min,
  growth_percentage,
  tier,
  is_manual
FROM get_tracks_blowing_up(20)
ORDER BY tier, plays_last_30min DESC;
```

### Test Different Thresholds
```sql
-- Lower threshold to 3
UPDATE content_section_thresholds
SET min_play_count = 3
WHERE section_key = 'tracks_blowing_up';

-- Test again
SELECT title, plays_last_30min, tier
FROM get_tracks_blowing_up(10);

-- Reset to 5
UPDATE content_section_thresholds
SET min_play_count = 5
WHERE section_key = 'tracks_blowing_up';
```

### Simulate Activity
```sql
-- Add test plays in last 30 minutes
INSERT INTO listening_history (user_id, song_id, listened_at, duration_listened, is_validated)
SELECT
  (SELECT id FROM users ORDER BY RANDOM() LIMIT 1),
  '<song_id>'::uuid,
  NOW() - interval '10 minutes',
  180,
  true;

-- Check results
SELECT * FROM get_tracks_blowing_up(10);
```

## Technical Details

### Why 30-Minute Windows?

- **Momentum tracking**: Catches trends as they happen
- **Real-time feel**: Shows what's hot RIGHT NOW
- **Growth visibility**: Comparing 30min windows shows acceleration
- **User engagement**: Creates urgency and FOMO
- **Refresh-friendly**: Short enough to update frequently

### Performance Optimizations

1. **Single efficient query**: All tiers calculated in one pass
2. **Indexed columns**: Fast filtering on `listened_at`, `is_validated`
3. **7-day window**: Only recent songs considered
4. **Audio URL check**: Pre-filters invalid songs
5. **SECURITY DEFINER**: Cached execution plan

### Database Indexes Used

```sql
-- listening_history indexes
CREATE INDEX idx_listening_history_song_validated ON listening_history(song_id, is_validated);
CREATE INDEX idx_listening_history_listened_at ON listening_history(listened_at);

-- songs indexes
CREATE INDEX idx_songs_created_at ON songs(created_at);
CREATE INDEX idx_songs_audio_url ON songs(audio_url) WHERE audio_url IS NOT NULL;
```

## Growth Tag Display

The frontend shows growth tags based on percentage:

| Growth % | Display Tag | Meaning |
|----------|-------------|---------|
| 999 | "+250% Viral Spike" | New song with sudden traction |
| 200+ | "+X% Viral Spike" | Explosive growth |
| 100-199 | "+X% This Hour" | Strong growth |
| 50-99 | "+X% This Hour" | Good growth |
| 1-49 | "+X% This Hour" | Moderate growth |
| 0 | "Trending" | Steady activity |

## Benefits

### For Admins
- ✅ Centralized threshold control
- ✅ One setting affects all displays
- ✅ Easy adjustment for app growth
- ✅ Manual curation option
- ✅ Real-time monitoring

### For Users
- ✅ Always see fresh, relevant content
- ✅ Discover songs gaining momentum
- ✅ Never see empty sections
- ✅ Diverse artist representation
- ✅ Real-time discovery experience

### For Developers
- ✅ Simple, maintainable code
- ✅ Single source of truth (database)
- ✅ Consistent across all clients
- ✅ Easy to test and debug
- ✅ Performance optimized

## Comparison: Before vs After

### Before (Client-Side Logic)
```
❌ ~500 lines of complex logic
❌ Multiple database queries
❌ Client-side calculations
❌ No threshold support
❌ Inconsistent across updates
❌ Hard to maintain
```

### After (Database Function)
```
✅ ~115 lines of code
✅ Single RPC call
✅ Server-side calculations
✅ Full threshold support
✅ Consistent everywhere
✅ Easy to maintain
```

## Troubleshooting

### Section Shows No Tracks
1. Check if threshold is too high: `SELECT min_play_count FROM content_section_thresholds WHERE section_key = 'tracks_blowing_up'`
2. Check recent activity: `SELECT COUNT(*) FROM listening_history WHERE listened_at >= NOW() - interval '30 minutes' AND is_validated = true`
3. Lower threshold temporarily to test
4. Add manual tracks for guaranteed content

### Function Returns Wrong Tier
1. Verify threshold setting in database
2. Check `listened_at` timestamps are recent
3. Ensure `is_validated = true` on listening_history records
4. Test function directly: `SELECT * FROM get_tracks_blowing_up(5)`

### Real-time Updates Not Working
1. Check Supabase Realtime is enabled
2. Verify subscription in browser console
3. Check listening_history inserts are happening
4. Fallback to 20-minute polling (always active)

## Notes

- Only songs from **last 7 days** are considered
- Songs must have **audio_url** to appear
- **One song per artist** for diversity (frontend filter)
- Growth calculation uses **30min vs previous 30min**
- Manual songs override threshold requirements
- Section **auto-hides** when no tracks available
- Real-time updates **debounced** (30 seconds minimum)

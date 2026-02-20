# Fan Influence Meter - Integration Complete

## Overview
The Fan Influence Meter is a gamified system that rewards users for discovering content early before it becomes trending. Users earn influence points and ranks by finding hidden gems, making them feel like tastemakers and culture shapers.

## System Status
**Fully Integrated and Active** - The system is now tracking early discoveries in real-time and will automatically award points daily.

## How It Works

### 1. Early Discovery Tracking
When users play content with **<50 plays**, their discovery is automatically recorded:
- **Songs**: Tracked when play duration ≥65 seconds
- **Videos**: Tracked when watch duration ≥60 seconds
- **Creators cannot earn influence from their own content** (same as listener rewards)

### 2. Trending Detection
Every day at **3:00 AM UTC**, the system automatically:
- Scans for content that reached **≥100 plays**
- Awards **10 points** to each user who discovered it early
- Updates user ranks based on trending discovery counts
- Records the discovery in the trending_discoveries table

### 3. Rank System
Ranks are based on **trending_discoveries count** (not total points):

| Rank | Trending Discoveries Required |
|------|------------------------------|
| Explorer | 0 (starting rank) |
| Active Scout | 3 |
| Rising Trendsetter | 10 |
| Veteran Discoverer | 20 |
| Master Influencer | 40 |
| Elite Curator | 75 |
| Legendary Tastemaker | 150 |

## Current Database Status

### Content Available for Discovery
- **28 songs** with 1-49 plays (discoverable)
- **1 song** with 50-99 plays
- **2 songs** with 100+ plays (trending)
- **5 songs** with 0 plays

### User Statistics
- **0 users** have influence scores yet (system just activated)
- **0 early discoveries** recorded (waiting for user playback)
- **0 trending discoveries** awarded

## Integration Details

### 1. Playback Tracking Integration
**File**: `src/lib/playbackTracker.ts`

The `trackEarlyDiscovery()` function is now called automatically after validated playback:
- For **songs**: After line 153 (when song play is validated and recorded)
- For **videos**: After line 103 (when video play is validated and recorded)

```typescript
// Track early discovery for Fan Influence Meter (async, don't wait)
trackEarlyDiscovery(session.user.id, contentId, isVideo).catch(error => {
  console.warn('Failed to track early discovery:', error);
});
```

### 2. Automated Trending Detection
**Scheduled Job**: `update_trending_discoveries_daily`
- **Schedule**: Every day at 3:00 AM UTC (`0 3 * * *`)
- **Command**: `SELECT update_trending_discoveries()`
- **Status**: Active and running

To manually trigger (for testing):
```sql
SELECT update_trending_discoveries();
```

### 3. Database Functions

#### `track_early_discovery(p_user_id, p_song_id, p_video_id)`
- Records when user discovers content with <50 plays
- Prevents duplicate discoveries
- Blocks creators from earning influence on own content
- Initializes user influence score if needed
- Increments total_discoveries count

#### `update_trending_discoveries()`
- Scans for songs/videos with ≥100 plays
- Identifies early discoverers (<50 plays at discovery)
- Awards 10 points per trending discovery
- Updates user ranks automatically
- Marks discoveries as trending

#### `get_user_influence_dashboard(p_user_id)`
- Returns complete influence dashboard data
- Includes current score, rank, discoveries, and recent activity

#### `calculate_influence_rank(score)`
- Calculates rank based on trending_discoveries count
- Returns appropriate rank tier

## Database Tables

### `user_influence_scores`
Stores user influence metrics:
- `current_score`: Total points earned
- `total_discoveries`: All early discoveries made
- `trending_discoveries`: Discoveries that became trending
- `rank`: Current rank tier
- `this_week_score`, `last_week_score`: Weekly tracking
- `streak_days`: Consecutive days with discoveries

### `early_discoveries`
Records each early discovery:
- Links user to discovered content (song or video)
- Records play count at time of discovery
- Tracks whether it became trending
- Records influence points awarded

### `trending_discoveries`
Tracks content that became trending:
- Content ID and type
- Array of discoverer user IDs
- Points awarded per discoverer
- Detection timestamp

## Security

### Row Level Security (RLS)
All tables have RLS enabled:
- Users can view their own influence scores
- All users can view leaderboard (for competition)
- Users can view their own discoveries
- All users can view trending discoveries

### Fraud Prevention
- Creators cannot earn influence from own content
- Duplicate discoveries are prevented
- Play validation applies (same as playback tracking)
- Minimum duration requirements enforced

## Monitoring

### Check Scheduled Job Status
```sql
SELECT * FROM cron.job WHERE jobname = 'update_trending_discoveries_daily';
```

### View Job Execution History
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update_trending_discoveries_daily')
ORDER BY start_time DESC LIMIT 10;
```

### Check User Influence Scores
```sql
SELECT
  u.username,
  uis.current_score,
  uis.rank,
  uis.total_discoveries,
  uis.trending_discoveries
FROM user_influence_scores uis
JOIN users u ON u.id = uis.user_id
ORDER BY uis.trending_discoveries DESC, uis.current_score DESC
LIMIT 20;
```

### Check Recent Discoveries
```sql
SELECT
  u.username,
  COALESCE(s.title, cu.title) as content_title,
  ed.play_count_at_discovery,
  ed.became_trending,
  ed.influence_points_awarded,
  ed.discovered_at
FROM early_discoveries ed
JOIN users u ON u.id = ed.user_id
LEFT JOIN songs s ON s.id = ed.song_id
LEFT JOIN content_uploads cu ON cu.id = ed.video_id
ORDER BY ed.discovered_at DESC
LIMIT 20;
```

## Next Steps for Frontend

To display the Fan Influence Meter in the UI, you'll need to:

1. **Create Influence Dashboard Component**
   - Show user's rank and score
   - Display recent discoveries
   - Show discoveries that became trending
   - Include week-over-week progress

2. **Add Leaderboard View**
   - Top discoverers by trending discoveries
   - Current week's top scouts
   - All-time legendary tastemakers

3. **Discovery Notifications**
   - Notify users when their discovery becomes trending
   - Show points awarded
   - Celebrate rank upgrades

4. **Integration Points**
   - Profile screen: Show user's influence badge
   - Home screen: Feature top discoverers
   - Content cards: Show "discovered by X users" badge

## API Usage Examples

### Get User Dashboard
```typescript
const { data, error } = await supabase.rpc('get_user_influence_dashboard', {
  p_user_id: userId
});
```

### Get Top Discoverers
```typescript
const { data, error } = await supabase
  .from('user_influence_scores')
  .select('*, users(username, avatar_url)')
  .order('trending_discoveries', { ascending: false })
  .order('current_score', { ascending: false })
  .limit(20);
```

### Get Recent Trending Discoveries
```typescript
const { data, error } = await supabase
  .from('trending_discoveries')
  .select(`
    *,
    songs(title, artist_id),
    content_uploads(title, user_id)
  `)
  .order('detected_at', { ascending: false })
  .limit(10);
```

## Testing Recommendations

1. **Test Early Discovery**
   - Play a song with <50 plays for ≥65 seconds
   - Check if discovery was recorded in `early_discoveries` table
   - Verify user's `total_discoveries` incremented

2. **Test Trending Detection**
   - Manually increment a song's play count to 100+
   - Run `SELECT update_trending_discoveries();`
   - Verify points were awarded
   - Check rank was updated

3. **Test Anti-Fraud**
   - Try playing own content (should not create discovery)
   - Try playing same content twice (should not duplicate)
   - Verify short plays (<65s) don't count

## Troubleshooting

### No discoveries being tracked?
- Verify user is authenticated
- Check playback duration meets minimum (65s for songs, 60s for videos)
- Ensure play count was validated (not flagged as suspicious)
- Verify content has <50 plays at time of playback

### Points not awarded?
- Check if scheduled job ran: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update_trending_discoveries_daily') ORDER BY start_time DESC LIMIT 1;`
- Verify content reached 100+ plays
- Ensure discovery was made when content had <50 plays
- Check if discovery already marked as trending

### Rank not updating?
- Verify `trending_discoveries` count updated
- Run `SELECT calculate_influence_rank(trending_discoveries) FROM user_influence_scores WHERE user_id = 'xxx';`
- Check for database errors in logs

## Performance Considerations

- Early discovery tracking is **async** and won't block playback
- Trending detection runs once daily to minimize database load
- Indexes are optimized for fast lookups
- RLS policies are efficient and don't add significant overhead

## Future Enhancements

Potential features to consider:
- Bonus points for discovering content in first 24 hours
- Streak bonuses for consecutive days of discoveries
- Special badges for discovering content by specific artists
- Discovery challenges and achievements
- Social sharing of discoveries
- Discovery playlists (share your finds with others)

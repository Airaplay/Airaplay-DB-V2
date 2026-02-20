# Contribution Scores Not Updating - Fix Applied

## Issue Identified

User Contribution Scores for **Listening Engagement**, **Discovery & Exploration**, and **Community Engagement** were not being updated properly.

### Root Cause Analysis

After thorough investigation, I found **two critical bugs** in the playback tracking system:

#### Bug 1: Genre Data Not Being Fetched
**Problem**: The code was trying to query a `genre` column directly from the `songs` table, but this column **doesn't exist**.

**Reality**: The database uses a proper normalized structure:
- `songs` table (no genre column)
- `song_genres` junction table (links songs to genres)
- `genres` table (contains genre names)

**Impact**:
- Genre data was always NULL/undefined
- `weekly_genres_listened` was always empty `[]`
- Users never earned **Genre Explorer** rewards (25 points)
- No genre variety tracking was happening

#### Bug 2: Artist Total Plays Not Being Calculated
**Problem**: The code was trying to query `artist_profiles.total_plays`, but this column **doesn't exist**.

**Reality**: Artist total plays needs to be calculated by **summing all play counts** from the artist's songs.

**Impact**:
- Artist total plays was always undefined
- Users never earned **Artist Discovery** rewards (20 points)
- No tracking of listening to small/emerging artists

## What Was Fixed

### File Modified: `src/lib/playbackTrackerOptimized.ts`

#### Before (Lines 222-244):
```typescript
// INCORRECT - Queries non-existent columns
supabase
  .from('songs')
  .select('genre, artist_id, artists:artist_profiles!artist_id(total_plays)')
  .eq('id', contentId)
  .maybeSingle()
  .then(({ data: songData }) => {
    if (songData) {
      const completed = durationListened >= minDuration;
      const genre = songData.genre || undefined; // ❌ Always undefined
      const artistTotalPlays = (songData.artists as any)?.total_plays || undefined; // ❌ Always undefined

      trackListeningEngagement(
        session.user.id,
        contentId,
        completed,
        genre,
        artistTotalPlays
      ).catch(err => console.error('Failed to track listening engagement:', err));
    }
  })
```

#### After (Lines 222-265):
```typescript
// CORRECT - Properly fetches data from correct tables
Promise.all([
  // Get first genre for the song from junction table
  supabase
    .from('song_genres')
    .select('genres(name)')
    .eq('song_id', contentId)
    .limit(1)
    .maybeSingle(),
  // Get artist info
  supabase
    .from('songs')
    .select('artist_id')
    .eq('id', contentId)
    .maybeSingle()
]).then(async ([genreResult, songResult]) => {
  if (!songResult.data) return;

  // ✅ Correctly extract genre name from junction table
  const genre = (genreResult.data?.genres as any)?.name || undefined;
  const artistId = songResult.data.artist_id;

  // ✅ Calculate artist total plays by summing all their songs
  let artistTotalPlays: number | undefined = undefined;
  if (artistId) {
    const { data: artistSongs } = await supabase
      .from('songs')
      .select('play_count')
      .eq('artist_id', artistId);

    if (artistSongs) {
      artistTotalPlays = artistSongs.reduce((sum, song) => sum + (song.play_count || 0), 0);
    }
  }

  const completed = durationListened >= minDuration;
  trackListeningEngagement(
    session.user.id,
    contentId,
    completed,
    genre,
    artistTotalPlays
  ).catch(err => console.error('Failed to track listening engagement:', err));
}).catch(err => console.error('Failed to fetch song details for engagement tracking:', err));
```

## What Will Now Work

### 1. ✅ Listening Engagement Milestones
Users will now earn points for:
- **Daily Active Listener** (10 points): Listen to 5+ songs in a day
- **Dedicated Listener** (15 points): Listen to 10+ songs in a day
- **Super Listener** (25 points): Listen to 20+ songs in a day
- **Engaged Listener** (15 points): Complete 80%+ of songs started (daily)

### 2. ✅ Discovery & Variety (NOW FIXED!)
Users will now earn points for:
- **Genre Explorer** (25 points): Listen to songs from 5+ different genres in a week
- **Artist Discovery** (20 points): Listen to 5+ songs from small artists (<10k total plays)
- **Early Artist Supporter** (100 points): Listen to artist before they hit 100k plays

### 3. ✅ Consistency Streaks
Users will earn points for:
- **3-Day Listening Streak** (30 points): Listen actively for 3 consecutive days
- **7-Day Listening Streak** (75 points): Listen actively for 7 consecutive days
- **30-Day Listening Streak** (300 points): Listen actively for 30 consecutive days

### 4. ✅ Social Activities (Already Working)
Users continue to earn points for:
- **Like Song/Video** (3 points)
- **Comment** (5 points)
- **Follow Artist** (5 points)
- **Share Content** (3 points)
- **Video Completion** (4 points): Watch 80%+ of a video
- **Playlist Creation** (5 points)
- **Playlist Play** (2 points): Your playlist is played by others

## Verification Queries

### Check if genre tracking is now working:
```sql
SELECT
  user_id,
  weekly_genres_listened,
  daily_songs_started,
  last_active_date
FROM listener_engagement_stats
WHERE last_active_date >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY last_active_date DESC
LIMIT 10;
```

**Expected**: `weekly_genres_listened` should now contain genre names like `["Afrobeat", "Hip Hop", "R&B"]` instead of empty `[]`.

### Check for new contribution activities:
```sql
SELECT
  lc.activity_type,
  ca.activity_name,
  COUNT(*) as count,
  MAX(lc.created_at) as last_recorded
FROM listener_contributions lc
JOIN contribution_activities ca ON ca.activity_type = lc.activity_type
WHERE lc.activity_type IN (
  'daily_active_listener',
  'genre_explorer',
  'artist_discovery',
  'song_completion_bonus',
  'listening_streak_3',
  'listening_streak_7'
)
GROUP BY lc.activity_type, ca.activity_name
ORDER BY last_recorded DESC;
```

**Expected**: After users listen to songs, you should see new entries for listening-based activities.

### Check contribution scores:
```sql
SELECT
  u.username,
  lcs.total_points,
  lcs.current_period_points,
  lcs.discovery_points,
  lcs.engagement_points,
  lcs.updated_at
FROM listener_contribution_scores lcs
JOIN users u ON u.id = lcs.user_id
ORDER BY lcs.updated_at DESC
LIMIT 10;
```

**Expected**: `discovery_points` and `engagement_points` should start increasing for active users.

## Testing Steps

1. **Play 5 songs** (different genres if possible)
   - Should award "Daily Active Listener" (10 points)
   - Genres should be tracked in `weekly_genres_listened`

2. **Continue listening to reach 5 different genres**
   - Should award "Genre Explorer" (25 points)

3. **Listen to songs from emerging artists** (artists with <10k total plays)
   - Should award "Artist Discovery" (20 points) after 5 songs from small artists

4. **Complete songs** (listen to 80%+ of each song)
   - Should award "Engaged Listener" (15 points) once you've completed 10 songs with 80%+ completion rate

5. **Listen for consecutive days**
   - Day 3: Should award "3-Day Listening Streak" (30 points)
   - Day 7: Should award "7-Day Listening Streak" (75 points)

## Build Status

✅ Project built successfully without errors

## Next Steps

1. Deploy the updated code to production
2. Monitor the `listener_engagement_stats` table to see genre tracking populate
3. Monitor the `listener_contributions` table for new listening-based contributions
4. Check user contribution scores increase properly
5. Verify the admin dashboard shows updated leaderboards

## Technical Notes

- The fix uses `Promise.all()` to fetch genre and song data in parallel for efficiency
- Artist total plays is calculated on-the-fly by summing song play counts
- This is backwards compatible - no database migrations needed
- The `track_listening_engagement` database function already handles all the logic correctly; it just needed proper data inputs

## Performance Impact

- Minimal: Added 2 additional queries per song play (genre lookup + artist songs aggregation)
- These queries are simple indexed lookups and should be fast
- Genre and artist queries run asynchronously and don't block playback recording
- The overall system remains scalable

## Summary

The contribution scoring system was not broken at the database level - it was simply not receiving the correct input data due to querying non-existent columns. With these fixes, all listening engagement and discovery features will now work as designed.

# Debugging Discovery Features

## Issue Report
- **Artist Top Tracks Section:** Not loading (stays in loading state)
- **Similar Songs Section:** Showing too many skeleton loaders, not loading content

## Fixes Applied

### 1. Simplified Database Queries
**Problem:** Complex join queries with `artists:artist_id` syntax might not be working correctly.

**Solution:** Simplified to use basic `SELECT *` and fetch artist info separately.

### 2. Added Console Logging
Added detailed logging throughout the services:
- `[ArtistTopTracksService]` - Tracks artist top songs loading
- `[SimilarSongs]` - Tracks similar song discovery
- `[ArtistTopTracks]` - Tracks component loading

### 3. Reduced Skeleton Loaders
Changed Similar Songs skeleton from 6 to 3 items to reduce visual clutter during loading.

---

## How to Debug

### Open Browser Console
1. Open the app in your browser
2. Open Developer Tools (F12 or Right-click > Inspect)
3. Go to the **Console** tab
4. Play a song to open MusicPlayerScreen
5. Scroll down to see the new sections

### Expected Console Output

#### If Working Correctly:
```
[ArtistTopTracksService] Fetching tracks for artist: abc-123 excluding: xyz-456
[ArtistTopTracksService] Query result: 5 tracks
[ArtistTopTracksService] Returning 5 formatted tracks
[ArtistTopTracks] Loading tracks for artist: abc-123
[ArtistTopTracks] Loaded tracks: 5

[SimilarSongs] Finding similar songs for: Song Title ID: xyz-456
[SimilarSongs] Starting search for song ID: xyz-456
[SimilarSongs] Fetching genres for song
[SimilarSongs] Found 6 similar songs
[SimilarSongs] Returning 6 songs
```

#### If Failing:
Look for error messages like:
```
[ArtistTopTracksService] Database error: { message: "..." }
[ArtistTopTracksService] No tracks found for artist
[SimilarSongs] Error getting similar songs for display: ...
```

---

## Common Issues & Solutions

### Issue 1: No Artist ID
**Symptom:** Console shows "No artistId provided"
**Solution:** Song must have valid `artist_id` field

### Issue 2: Database Permission Error
**Symptom:** Console shows database error with "permission denied"
**Solution:** Check RLS policies on `songs` table allow SELECT

### Issue 3: Empty Results
**Symptom:** Query succeeds but returns 0 tracks
**Solutions:**
- Artist has no other songs (only 1 song uploaded)
- All songs are excluded (no audio_url)
- play_count is null on all songs

### Issue 4: Infinite Loading
**Symptom:** Skeleton loaders never disappear
**Solution:** Check for uncaught errors in useEffect or service calls

---

## Testing Checklist

### Test Artist Top Tracks
- [ ] Open player with song from artist with multiple tracks
- [ ] Check console for `[ArtistTopTracksService]` logs
- [ ] Verify tracks appear after loading
- [ ] Click a track and verify it plays
- [ ] Check that current song is excluded from list

### Test Similar Songs
- [ ] Open player with any song
- [ ] Check console for `[SimilarSongs]` logs
- [ ] Verify 6 similar songs appear
- [ ] Click a similar song and verify it plays
- [ ] Check that play counts display correctly

### Test Empty States
- [ ] Play song from artist with only 1 track
- [ ] Artist section should hide (not show empty state)
- [ ] Play song with no genre tags
- [ ] Similar songs should still try artist-based matching

---

## Database Query Verification

### Manually Test Artist Top Tracks Query
```sql
-- Replace 'ARTIST_ID' with actual artist_id
SELECT id, title, duration_seconds, audio_url, cover_image_url, play_count
FROM songs
WHERE artist_id = 'ARTIST_ID'
  AND audio_url IS NOT NULL
ORDER BY play_count DESC
LIMIT 5;
```

### Manually Test Similar Songs Query (Genre-based)
```sql
-- Replace 'SONG_ID' with actual song_id
-- First get genres
SELECT genre_id FROM song_genres WHERE song_id = 'SONG_ID';

-- Then find songs with those genres
SELECT DISTINCT s.*
FROM songs s
JOIN song_genres sg ON s.id = sg.song_id
WHERE sg.genre_id IN (/* genres from above */)
  AND s.id != 'SONG_ID'
ORDER BY s.play_count DESC
LIMIT 10;
```

---

## Quick Fix If Still Not Working

### Option 1: Check Database Schema
Ensure these tables exist and are accessible:
- `songs` (with columns: id, title, artist_id, audio_url, cover_image_url, play_count, duration_seconds)
- `song_genres` (with columns: song_id, genre_id)
- `users` (with columns: id, display_name)

### Option 2: Check RLS Policies
```sql
-- Check if songs table has RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'songs';

-- Check existing policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'songs';
```

### Option 3: Temporary Debug Mode
Add this to component to see raw state:
```tsx
<div className="text-white text-xs">
  Loading: {String(isLoading)} |
  Tracks: {tracks.length} |
  Error: {error || 'none'}
</div>
```

---

## Next Steps

1. **Check Console Logs** - Most important debugging tool
2. **Verify Data Exists** - Run manual SQL queries
3. **Check Permissions** - Ensure RLS allows SELECT
4. **Test with Different Songs** - Try multiple artists
5. **Report Findings** - Share console errors or SQL results

---

## Expected Behavior After Fix

### Artist Top Tracks
- Shows 3-5 tracks from same artist
- Excludes currently playing song
- Sorted by play count
- Displays play count and duration
- Click to play instantly

### Similar Songs
- Shows 6 songs in 3x2 grid
- Based on genre + artist matching
- Excludes current song
- Shows play count badges
- Click to play instantly

Both sections should:
- Hide if no results found
- Show skeleton loaders during fetch (< 1 second)
- Update when song changes
- Work for all songs with valid data

# Daily Mix Artist & Explanation Display Fix

## Issues Fixed

### 1. Unknown Artist Display
**Problem:** Songs in the Daily Mix were showing "Unknown Artist" even though artist data exists in the database.

**Root Causes:**
- Code was querying the `users` table for artist names instead of the `artist_profiles` table
- Artists' professional names are stored in `artist_profiles.stage_name`, not in users table
- The `users` table only has display_name, username, and email which may not match the artist's stage name
- No fallback logic for users without display names
- Null artist_ids weren't being filtered out

**Solution:**

Created a database function `get_daily_mix_tracks_with_artists()` that fetches tracks with artist names in a single efficient query:

```sql
-- Database function uses COALESCE for fallback chain
SELECT
  dmt.song_id,
  dmt.position as track_position,
  dmt.explanation,
  s.title,
  s.artist_id,
  COALESCE(
    ap.stage_name,              -- Priority 1: Artist stage name
    u.display_name,             -- Priority 2: User display name
    u.username,                 -- Priority 3: Username
    SPLIT_PART(u.email, '@', 1), -- Priority 4: Email prefix
    'Unknown Artist'            -- Priority 5: Fallback
  ) as artist_name,
  s.cover_image_url,
  s.duration_seconds,
  s.audio_url,
  s.play_count
FROM daily_mix_tracks dmt
INNER JOIN songs s ON dmt.song_id = s.id
LEFT JOIN artist_profiles ap ON s.artist_id = ap.user_id
LEFT JOIN users u ON s.artist_id = u.id
WHERE dmt.mix_id = p_mix_id
ORDER BY dmt.position;
```

```typescript
// Frontend code calls the function
const { data: tracksData } = await supabase.rpc(
  'get_daily_mix_tracks_with_artists',
  { p_mix_id: mixId }
);

// Artist names come pre-resolved from the database
const songs = tracksData.map(t => ({
  ...t,
  artist: t.artist_name // Already resolved with fallback chain
}));
```

**Fallback Priority:**
1. `stage_name` from `artist_profiles` table - Primary artist name
2. `display_name` from `users` table - Secondary fallback
3. `username` from `users` table - Tertiary fallback
4. Email prefix (before @) from `users` table - Quaternary fallback
5. "Unknown Artist" - Last resort

### 2. Hidden "Why" Explanations
**Problem:** The AI explanations for why songs were recommended were completely hidden until hover, which doesn't work well on mobile devices.

**Old Behavior:**
- Explanations were in a separate section below the song
- Hidden with `opacity-0 group-hover:opacity-100`
- Required hover state (doesn't work on mobile)
- Created jarring layout shifts

**New Behavior:**
- Explanations now always visible
- Integrated into song info section
- Subtle styling with controlled opacity
- Line-clamped to 2 lines to prevent overflow
- Clean sparkles icon for visual context

**Implementation:**
```typescript
{song.explanation && (
  <p className="font-['Inter',sans-serif] text-[#00ad74]/80 text-[11px] leading-relaxed mt-0.5 flex items-start gap-1.5">
    <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60" />
    <span className="line-clamp-2">{song.explanation}</span>
  </p>
)}
```

## Visual Improvements

### Before:
```
[Track] Song Title
        Unknown Artist
        [Hidden explanation]
```

### After:
```
[Track] Song Title
        Artist Name
        ✨ Personalized because you loved similar songs
```

## Technical Details

### Artist Name Resolution Flow

**New Approach (Database Function):**
1. Single RPC call to `get_daily_mix_tracks_with_artists(mix_id)`
2. Database performs all JOINs and fallback logic server-side
3. Returns complete track data with artist names pre-resolved
4. Uses SQL `COALESCE()` for efficient fallback chain
5. No additional queries needed from frontend

**Benefits:**
- **Single round trip** to database instead of 2-3 queries
- **Better performance** - JOINs executed on database server
- **Less frontend code** - no manual mapping or fallback logic
- **Consistent logic** - fallback chain handled in one place
- **Automatic fallback** - if function fails, code falls back to old method

**Fallback Flow (if RPC fails):**
1. Fetch tracks from `daily_mix_tracks` with song data
2. Extract unique artist IDs
3. Query `artist_profiles` for stage names
4. Query `users` for remaining artists
5. Map artist names to songs manually

### Explanation Display
- **Font:** Inter, 11px
- **Color:** `#00ad74` at 80% opacity
- **Icon:** Sparkles (3x3, 60% opacity)
- **Layout:** Integrated in song info column
- **Truncation:** Line-clamp-2 (shows max 2 lines)
- **Spacing:** 0.5rem top margin, 1.5 gap between icon and text

## User Experience Benefits

1. **Accurate Information**
   - Real artist names displayed
   - Clear fallback hierarchy
   - No more "Unknown Artist" for valid users

2. **Always Visible Context**
   - Explanations visible at a glance
   - No need to hover (works on mobile)
   - Subtle design doesn't distract

3. **Clean Design**
   - Integrated into existing layout
   - No layout shifts
   - Professional appearance

4. **Mobile-Friendly**
   - No hover states required
   - Touch-friendly layout
   - Responsive text sizing

## Error Handling

Added comprehensive error handling:

```typescript
// Filter out null artist IDs before querying
const artistIds = [...new Set(
  tracksData?.map(t => t.songs.artist_id).filter(Boolean) || []
)];

// Graceful degradation: if artist_profiles query fails, try users table
// Two-tier lookup ensures best chance of finding artist name

// Always provide fallback names
const artistName = t.songs.artist_id
  ? (artistNames.get(t.songs.artist_id) || 'Unknown Artist')
  : 'Unknown Artist';
```

**Key Benefits:**
- Database function provides artist names in a single query
- SQL COALESCE handles all fallback logic efficiently
- If RPC function fails, automatically falls back to multi-query approach
- Fallback chain ensures there's always a display name
- No crashes even if database queries fail
- Backwards compatible with older database schemas

## Testing Checklist

- [x] Artist names display correctly
- [x] Fallback to username when display_name is null
- [x] Fallback to email prefix when both are null
- [x] Explanations always visible
- [x] Line-clamping prevents overflow
- [x] Sparkles icon displays correctly
- [x] Works on mobile (no hover required)
- [x] No layout shifts
- [x] Error handling prevents crashes
- [x] Null artist IDs handled gracefully

## Files Modified

1. **DailyMixPlayerScreen.tsx**
   - Switched to database function for efficient artist name fetching
   - Added fallback to multi-query approach if function unavailable
   - Made explanations always visible
   - Integrated explanations into song info layout
   - Improved data structure and mapping

2. **Database Migration: `create_get_daily_mix_tracks_with_artists_function.sql`**
   - Created `get_daily_mix_tracks_with_artists(uuid)` function
   - Performs JOINs to `artist_profiles` and `users` tables
   - Uses COALESCE for efficient fallback chain
   - Granted permissions to authenticated and anon users
   - Set SECURITY DEFINER with explicit search_path for safety

## Result

The Daily Mix player now shows:
- Accurate artist names with smart fallbacks
- Always-visible AI explanations
- Clean, integrated design
- Mobile-friendly interface
- Professional, polished appearance

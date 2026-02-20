# Album Play Count Fix

## Issue
In the Library screen, albums were showing "0 plays" even though the songs in those albums had play counts recorded.

## Root Cause
The issue was a **type mismatch** between:
- `songs.album_id` (UUID type in database)
- `upload.metadata.album_id` (string type from JSON field)

Supabase's JavaScript client wasn't automatically handling the type conversion when using `.eq()` to compare these values, resulting in no matches and returning 0 plays.

## Database Verification
The data was correctly stored:
- Albums table has correct data
- Songs table has `album_id` foreign keys properly set
- Play counts are being tracked correctly
- Example: "Twisted" album has 7 songs with play counts: 1, 2, 1, 1, 12, 3, 1 (total: 21 plays)

## Solution Applied

Created a database function that properly handles UUID comparison and returns the total play count:

### 1. Database Migration
Created `get_album_play_count` function:
```sql
CREATE OR REPLACE FUNCTION get_album_play_count(album_uuid uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(play_count), 0)::bigint
  FROM songs
  WHERE album_id = album_uuid;
$$;
```

### 2. Updated Frontend Code
Changed the album play count query to use the RPC function:
```typescript
else if (upload.content_type === 'album' && upload.metadata?.album_id) {
  // Use RPC call to properly handle UUID to string comparison
  const { data: result, error: songsError } = await supabase
    .rpc('get_album_play_count', { album_uuid: upload.metadata.album_id });

  if (songsError) {
    console.error('Error fetching album play count:', songsError);
    // Fallback to direct query
    const { data: songs } = await supabase
      .from('songs')
      .select('play_count')
      .eq('album_id', upload.metadata.album_id);
    actualPlayCount = songs?.reduce((sum, song) => sum + (song.play_count || 0), 0) || 0;
  } else {
    actualPlayCount = result || 0;
  }
}

## Testing Results

Tested the function with actual data:
- "Twisted" album: **21 plays** ✓
- "Spirit In Motion": **45 plays** ✓
- "Oxygen": **10 plays** ✓
- "Under My Skin": **5 plays** ✓
- "test album": **0 plays** (correct - 1 song with 0 plays)
- "Time & Season": **0 plays** (correct - no songs)

## Expected Behavior

### Before Fix
- Albums showing "0 plays" in Library
- Songs have play_count > 0 in database
- Direct query `.eq('album_id', uuid_string)` returns no results

### After Fix
- Albums show correct total play count (sum of all songs)
- RPC function properly handles UUID type conversion
- Fallback to direct query if RPC fails
- Better error logging for debugging

## Technical Details

### Why the Direct Query Failed
```typescript
// This doesn't work reliably:
.eq('album_id', 'da858767-5a0c-4fbe-a763-b419f38a8c54')
// Because album_id is UUID type, not string
```

### Why the RPC Function Works
```sql
-- The function accepts UUID type and handles comparison correctly:
WHERE album_id = album_uuid  -- Both are UUID types
```

### Files Modified
1. **Database Migration**: `supabase/migrations/fix_album_play_count_function.sql`
   - Created `get_album_play_count(uuid)` function
   - Granted execute permissions to authenticated and anonymous users

2. **Frontend Code**: `src/screens/LibraryScreen/LibraryScreen.tsx` (Lines 235-250)
   - Changed from direct query to RPC call
   - Added error handling and fallback
   - Improved logging

## Verification Query
Test the function directly:
```sql
SELECT
  cu.title,
  get_album_play_count((cu.metadata->>'album_id')::uuid) as play_count
FROM content_uploads cu
WHERE cu.content_type = 'album';
```

## Summary
The album play count issue is now fixed. Albums in the Library screen will correctly display the total play count of all songs in the album, calculated server-side using a database function that properly handles UUID types.

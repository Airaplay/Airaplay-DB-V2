# Playlist Songs Public Access Fix

## Issue
Anonymous users and authenticated users could not view songs inside public playlists in the Listener Curations section. When clicking on a playlist, it appeared empty even though it had songs.

## Root Cause
The `playlist_songs` table had overly restrictive RLS (Row Level Security) policies that ONLY allowed users to view songs in their OWN playlists:

```sql
-- Old policy (too restrictive)
CREATE POLICY "Authenticated users can view songs in their own playlists"
ON playlist_songs FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM playlists WHERE id = playlist_songs.playlist_id AND user_id = auth.uid())
);
```

This meant:
- Non-owners couldn't see songs in public playlists
- Anonymous users couldn't see any playlist songs
- Listener Curations appeared empty to everyone except the curator

## Solution Applied

Created migration: `allow_public_access_to_playlist_songs.sql`

Added two new RLS policies:

### 1. Authenticated Users Policy
```sql
CREATE POLICY "Anyone can view songs in public playlists"
  ON playlist_songs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND playlists.is_public = true
    )
  );
```

### 2. Anonymous Users Policy
```sql
CREATE POLICY "Anonymous users can view songs in public playlists"
  ON playlist_songs FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND playlists.is_public = true
    )
  );
```

## What Changed

**Before:**
- Users could only see songs in their own playlists
- Public playlists appeared empty to non-owners
- Anonymous users couldn't view any playlist content

**After:**
- Anyone (authenticated + anonymous) can view songs in public playlists
- Users still can only see songs in their own private playlists
- Listener Curations now work correctly for all users

## Security

The fix maintains proper security:
- ✅ Users can still only manage (add/remove) songs in their OWN playlists
- ✅ Private playlists remain private (only owner can see songs)
- ✅ Public playlists are now actually public (anyone can view songs)
- ✅ No data leakage risk - only public data is exposed

## Testing

To verify the fix works:

1. **As Anonymous User:**
   - Visit home page (not logged in)
   - Scroll to "Listener Curations" section
   - Tap any playlist
   - Should see all songs in the playlist ✅

2. **As Authenticated User:**
   - Log in
   - Go to "Listener Curations" section
   - Tap any public playlist
   - Should see all songs ✅
   - Songs should be playable ✅

3. **As Playlist Owner:**
   - View your own public playlist
   - Should see all songs ✅
   - Should be able to add/remove songs ✅

## Related Changes

This fix works together with:
- `remove_playlist_approval_requirement.sql` - Auto-displays playlists with 6+ songs
- `use_dynamic_min_songs_for_featured_playlists.sql` - Uses admin config for minimum songs

## Migration Details

- **File**: `supabase/migrations/20251227152500_allow_public_access_to_playlist_songs.sql`
- **Applied**: 2025-12-27
- **Status**: ✅ Successfully applied
- **Build**: ✅ No errors

## Database Tables Affected

- `playlist_songs` - Added 2 new RLS policies

## No Breaking Changes

This fix only adds permissions, it doesn't remove any existing functionality:
- Existing policies remain unchanged
- Users can still manage their own playlists
- No data migration required
- No API changes needed

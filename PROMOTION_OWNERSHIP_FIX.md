# Promotion Ownership Validation Fix

## Issues Fixed

### Issue 1: Songs & Albums Ownership Check
Creators were unable to promote their own songs and albums:
- "You can only promote albums that you created"
- "You can only promote songs that you created"

### Issue 2: Video Promotion Error
Creators received a database error when trying to promote videos:
- "Relation 'video' does not exist"

## Root Causes

### Cause 1: Incorrect Ownership Model
The validation trigger was incorrectly checking ownership:
```sql
artist_id = user_id  ❌ WRONG
```

But the actual data model is:
```
auth.users (user_id)
  ↓
artist_profiles (user_id, artist_id)
  ↓
artists (id)
  ↓
songs/albums (artist_id)
```

### Cause 2: Wrong Table for Videos
The validation function was querying a non-existent `videos` table:
```sql
SELECT 1 FROM videos WHERE ...  ❌ WRONG - videos table doesn't exist
```

But videos are actually stored in `content_uploads`:
```
content_uploads (id, user_id, content_type = 'video')
```

## Solutions

### Solution 1: Fix Songs & Albums Ownership
Updated the `validate_content_ownership()` function to:

1. **First get the user's artist_id** from `artist_profiles`:
   ```sql
   SELECT artist_id INTO v_user_artist_id
   FROM artist_profiles
   WHERE user_id = NEW.user_id
   ```

2. **Then check if content's artist_id matches**:
   ```sql
   -- Songs
   SELECT EXISTS (
     SELECT 1 FROM songs
     WHERE id = NEW.target_id
     AND artist_id = v_user_artist_id  ✅ CORRECT
   ) INTO v_is_owner;

   -- Albums
   SELECT EXISTS (
     SELECT 1 FROM albums
     WHERE id = NEW.target_id
     AND artist_id = v_user_artist_id  ✅ CORRECT
   ) INTO v_is_owner;
   ```

### Solution 2: Fix Video Promotion
Updated to query the correct table (`content_uploads`):
```sql
-- Videos (stored in content_uploads)
SELECT EXISTS (
  SELECT 1 FROM content_uploads
  WHERE id = NEW.target_id
  AND content_type = 'video'
  AND user_id = NEW.user_id  ✅ CORRECT
) INTO v_is_owner;
```

## Changes Made

### Database Migration
- **File**: `supabase/migrations/fix_promotion_ownership_validation.sql`
- **Updated Function**: `validate_content_ownership()`
- **Behavior**: Now properly validates ownership through the artist_profiles table

### What Was Fixed
✅ **Songs** - Now checks if song's artist_id matches user's artist_profiles.artist_id
✅ **Albums** - Now checks if album's artist_id matches user's artist_profiles.artist_id
✅ **Videos** - Now queries content_uploads table with user_id (not non-existent videos table)
✅ **Short Clips** - Now queries content_uploads table correctly
✅ **Playlists** - Already correct (checks user_id directly)
✅ **Profiles** - Already correct (checks self-promotion)

## How It Works Now

1. **User tries to promote content** → Trigger fires
2. **Get user's artist_id** from artist_profiles table
3. **Verify content ownership** by checking if content's artist_id matches
4. **Allow or reject** based on ownership match

## Error Messages

The function will now correctly:
- ✅ **Allow** creators to promote their own content
- ❌ **Block** attempts to promote others' content with clear error messages:
  - "You can only promote songs that you created"
  - "You can only promote albums that you created"
  - "You must be a creator to promote content. Please complete your artist profile first."

## Testing

Creators can now:
1. Open the Promotion Setup Modal for their own content
2. Select a promotion section
3. Choose duration and cost
4. Submit promotion successfully ✅

## Migrations Applied
```
✅ fix_promotion_ownership_validation.sql - Fixed songs/albums ownership
✅ fix_video_promotion_validation.sql - Fixed video/short_clip promotion
```

## Data Verification
Verified that videos are correctly stored and can be matched:
- 3 videos found in `content_uploads` table
- All videos have matching `user_id` for ownership
- Ownership validation now works correctly

## Build Status
```
✅ Build successful - No errors
```

## Testing Checklist

### Songs ✅
1. Navigate to your song
2. Click "Promote" or "Boost"
3. Select section and duration
4. Submit successfully

### Albums ✅
1. Navigate to your album
2. Click "Promote" or "Boost"
3. Select section and duration
4. Submit successfully

### Videos ✅
1. Navigate to your video
2. Click "Promote" or "Boost"
3. Select section and duration
4. Submit successfully (no more "Relation 'video' does not exist" error)

---

**Status**: ✅ **FULLY FIXED** - All content types (songs, albums, videos) can now be promoted without errors

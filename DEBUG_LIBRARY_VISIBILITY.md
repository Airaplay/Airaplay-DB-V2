# Debug: Library Not Showing Albums

## Issue
User "Bukwild Da Ikwerrian" uploaded albums but they don't appear in Library Upload tab.

## Database Status ✅
Albums ARE in database correctly:
- User ID: f4d433d4-3df6-4970-bb9b-a479429f9455
- Artist Profile ID: 49566884-0d2b-41de-a19d-f1832840a45c
- Albums in content_uploads: 2 albums (both approved)
- Albums visible via direct query: YES

## Possible Issues

### 1. Browser Cache (Most Likely)
**Symptom**: Old data still showing
**Solution**: Hard refresh or clear cache

**Test**: Open browser console and run:
```javascript
// Clear all caches
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

### 2. Not Logged In as Correct User
**Symptom**: Viewing as different user or not logged in
**Solution**: Verify logged in user

**Test**: Open console and run:
```javascript
// Check who is logged in
supabase.auth.getSession().then(({data}) => {
  console.log('Logged in as:', data.session?.user?.email);
  console.log('User ID:', data.session?.user?.id);
  // Should be: bukwildofficial@gmail.com
  // User ID should be: f4d433d4-3df6-4970-bb9b-a479429f9455
});
```

### 3. isCreator Flag is False
**Symptom**: "My Uploads" tab doesn't appear
**Solution**: Check artist_profile query

**Test**: Open console and run:
```javascript
// Check if user has artist profile
supabase
  .from('artist_profiles')
  .select('id, stage_name')
  .eq('user_id', (await supabase.auth.getSession()).data.session.user.id)
  .maybeSingle()
  .then(({data, error}) => {
    console.log('Artist Profile:', data);
    console.log('Error:', error);
    // Should show: Bukwild Da Ikwerrian
  });
```

### 4. Query Failing Silently
**Symptom**: No error shown but no data returned
**Solution**: Check network tab for errors

**Test**:
1. Open DevTools → Network tab
2. Filter by "content_uploads"
3. Refresh Library page
4. Check if query returns data

## Immediate Fix Steps

### Step 1: Clear Cache (Do This First!)
```javascript
// Run in browser console
localStorage.removeItem('library_uploads_processed');
localStorage.removeItem('library_playlists_processed');
location.reload();
```

### Step 2: Force Refresh Data
```javascript
// Run in console after page loads
// This manually loads user content
const session = await supabase.auth.getSession();
const { data, error } = await supabase
  .from('content_uploads')
  .select(`
    *,
    artist_profiles!artist_profile_id (
      stage_name
    )
  `)
  .eq('user_id', session.data.session.user.id)
  .order('created_at', { ascending: false });

console.log('My uploads:', data);
console.log('Errors:', error);
```

### Step 3: Verify Creator Status
```javascript
// Check if isCreator would be true
const session = await supabase.auth.getSession();
const { data, error } = await supabase
  .from('artist_profiles')
  .select('id')
  .eq('user_id', session.data.session.user.id)
  .maybeSingle();

console.log('Has artist profile:', !!data);
console.log('Artist profile:', data);
// Should be true and show ID
```

## Expected Console Output When Working

When everything is working, you should see:
```
✅ Album successfully added to content_uploads: [id]
✅ Caches cleared - album will appear in Library immediately
🔄 Tab became visible - refreshing Library content [when switching tabs]
```

## Common Issues and Solutions

### "No Content Found" showing
**Cause**: Cache not cleared OR not logged in as correct user
**Fix**:
1. Clear localStorage
2. Verify logged in as bukwildofficial@gmail.com
3. Hard refresh (Ctrl+Shift+R)

### "My Uploads" tab not visible
**Cause**: isCreator is false
**Fix**:
1. Verify artist_profile exists for user
2. Check console for errors in checkIfUserIsCreator()
3. Log out and log back in

### Albums show after refresh but not immediately
**Cause**: Cache not being cleared after upload
**Fix**: Already fixed in code, but need to rebuild/redeploy

## Manual Database Fix (If Needed)

If albums are somehow not in content_uploads, run this to add them:

```sql
-- Add missing album to content_uploads
INSERT INTO content_uploads (
  user_id,
  artist_profile_id,
  content_type,
  title,
  status,
  metadata
)
SELECT
  '49566884-0d2b-41de-a19d-f1832840a45c',
  'f4d433d4-3df6-4970-bb9b-a479429f9455',
  'album',
  a.title,
  'approved',
  jsonb_build_object(
    'album_id', a.id,
    'cover_url', a.cover_image_url,
    'release_date', a.release_date
  )
FROM albums a
WHERE a.id = '[ALBUM_ID]'
  AND NOT EXISTS (
    SELECT 1 FROM content_uploads cu
    WHERE cu.metadata->>'album_id' = a.id::text
  );
```

But in this case, albums ARE already in content_uploads, so this is NOT needed.

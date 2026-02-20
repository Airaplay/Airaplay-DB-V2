# Testing Audio Playback - Step by Step Guide

## Critical Fixes Applied

### 1. Fixed Database Query Issue (`src/lib/playbackState.ts`)
**Problem:** The query was selecting non-existent columns `artist` and `duration` instead of `artist_id` and `duration_seconds`.

**Fix:** Updated the query to use correct column names and properly extract artist information from the nested structure.

### 2. Added Comprehensive Logging
**Added logging in:**
- `AlbumUploadForm.tsx` - Logs audio URL when creating song records
- `SingleUploadForm.tsx` - Logs audio URL when creating song records
- `useMusicPlayer.ts` - Enhanced error logging with full details
- `playbackState.ts` - Logs fetched song data

### 3. Improved Audio Player Configuration
- Changed preload from `'none'` to `'metadata'` for better file accessibility checks
- Smart CORS configuration (only enables for cross-origin URLs)
- Enhanced error reporting with network state and fetch tests

---

## Step-by-Step Testing Procedure

### Test 1: Upload a New Song

**Using SingleUploadForm:**

1. **Navigate to Upload:**
   - Go to Create tab → Upload Single

2. **Fill in details:**
   - Song Title: "Test Song 1"
   - Select an audio file (MP3 recommended)
   - Select a cover image
   - Select a genre
   - Optional: Add release date

3. **Submit and Monitor Console:**
   ```javascript
   // You should see in browser console:
   "🎵 Uploading audio: filename.mp3 (X.XX MB)"
   "✅ Upload successful: https://airaplay.b-cdn.net/audio/..."
   "📀 Creating new song with audio_url: https://airaplay.b-cdn.net/audio/..."
   "✅ Song created successfully: {id: '...', title: '...', audio_url: '...'}"
   ```

4. **Verify Upload:**
   - Check that no errors appear
   - Note the audio URL from the console
   - Song should appear in your profile/library

**Using AlbumUploadForm:**

1. **Navigate to Upload:**
   - Go to Create tab → Upload Album

2. **Fill in details:**
   - Album Title: "Test Album 1"
   - Select album cover image
   - Select a genre
   - Add at least 2 audio files with titles

3. **Submit and Monitor Console:**
   ```javascript
   // You should see for each song:
   "🎵 Uploading audio: song1.mp3 (X.XX MB)"
   "✅ Upload successful: https://airaplay.b-cdn.net/audio/..."
   "📀 Creating song record with audio_url: https://airaplay.b-cdn.net/audio/..."
   "✅ Song created successfully: {id: '...', title: '...', audio_url: '...'}"
   ```

---

### Test 2: Test Audio URL Directly

After uploading, copy the audio URL from the console and test it:

```javascript
// In browser console:
window.testAudioUrl('https://airaplay.b-cdn.net/audio/[your-file].mp3')

// This will output detailed diagnostics:
// ✅ URL is valid
// ✅ Fetch test passed
// ✅ CORS headers found or ⚠️ CORS headers missing
// ✅ Audio element can load the file
```

**If CORS headers are missing:**
- Audio might not play
- Follow CORS configuration in `BUNNY_STORAGE_SETUP.md`

---

### Test 3: Play the Uploaded Song

**From Home Screen / Trending:**

1. **Navigate to Home:**
   - New uploads should appear in "New Releases"
   - Or search for your song

2. **Tap to Play:**
   - Tap the song
   - Check console for:
   ```javascript
   "Creating audio element for song: {id, title, audioUrl}"
   "Audio is cross-origin, CORS enabled for: https://airaplay.b-cdn.net"
   ```

3. **Monitor Playback:**
   - Song should start playing
   - Progress bar should move
   - Time should update

**From Album Player:**

1. **Navigate to the Album:**
   - Go to your profile
   - Tap on the uploaded album

2. **Check Console for:**
   ```javascript
   "Album Info: {...}"
   "Album Artists: {...}"
   "Resolved Artist Name: [your name]"
   ```

3. **Play a Track:**
   - Tap any track in the album
   - Should start playing immediately
   - Artist name should be correct (NOT "Unknown Artist")

**From Profile/Library:**

1. **Go to Profile:**
   - Tap Profile tab
   - Your uploads should be visible

2. **Tap a Song:**
   - Should open full player
   - Should start playing

---

### Test 4: Check Playback State Restoration

1. **Play a song for a few seconds**
2. **Close the app or refresh the page**
3. **Check console for:**
   ```javascript
   "📀 getSongsFromIds result: [...]"
   ```
4. **Playback should resume** from where you left off

---

## Common Issues and Solutions

### Issue 1: Audio URL Not Showing in Console

**Symptoms:**
- No "✅ Upload successful" message
- Upload seems to complete but no URL

**Solutions:**
1. Check browser console for upload errors
2. Verify Bunny credentials in `.env`:
   ```bash
   BUNNY_STORAGE_ZONE=air-play
   BUNNY_STORAGE_API_KEY=your-key
   BUNNY_CDN_HOSTNAME=airaplay.b-cdn.net
   BUNNY_STORAGE_ENDPOINT=uk.storage.bunnycdn.com
   ```
3. Ensure CDN hostname is lowercase: `airaplay.b-cdn.net`

---

### Issue 2: Song Not Playing (Error Appears)

**Check Console for Error Details:**

```javascript
"Audio playback error: {
  message: '...',
  mediaErrorCode: 4,  // or 1, 2, 3
  audioUrl: '...',
  networkState: X,
  readyState: X
}"
```

**Error Code Meanings:**
- **Code 1 (MEDIA_ERR_ABORTED):** Loading was aborted
  - Solution: Try again, might be temporary

- **Code 2 (MEDIA_ERR_NETWORK):** Network error
  - Solution: Check internet connection, try again

- **Code 3 (MEDIA_ERR_DECODE):** File is corrupted
  - Solution: Re-upload the file, try a different format

- **Code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED):** Format not supported OR CORS blocked
  - Solution: Configure CORS on Bunny CDN (see below)

---

### Issue 3: CORS Error

**Symptoms:**
```javascript
"Audio playback error: Audio format not supported or CORS blocked"
"❌ Audio URL fetch failed: [CORS error]"
```

**Solution:** Configure CORS on Bunny CDN

1. **Log in to** [Bunny.net Dashboard](https://panel.bunny.net/)

2. **Navigate to Pull Zones** → Select `airaplay`

3. **Add CORS Headers:**
   - Go to Edge Rules or Configuration
   - Add:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, HEAD, OPTIONS
   Access-Control-Allow-Headers: Range, Content-Type, Accept
   Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges
   ```

4. **Wait 5-10 minutes** for CDN cache to update

5. **Test Again:**
   ```javascript
   window.testAudioUrl('your-audio-url')
   // Should now show: "✅ CORS is properly configured"
   ```

---

### Issue 4: Artist Shows as "Unknown Artist"

**Check Console:**
```javascript
"Album Artists: null"  // or undefined
"Resolved Artist Name: Unknown Artist"
```

**Solutions:**
1. Verify artist profile exists:
   ```javascript
   // In console:
   supabase.from('artist_profiles').select('*').eq('user_id', 'your-user-id')
   ```

2. Check if artist has `stage_name` set

3. If missing, go to Profile → Edit Profile → Set stage name

---

### Issue 5: Audio URL is NULL in Database

**Check Database:**
```sql
SELECT id, title, audio_url FROM songs WHERE audio_url IS NULL;
```

**If you find NULL audio URLs:**
1. The upload failed silently
2. Check Bunny credentials
3. Re-upload the song
4. Monitor console for errors during upload

---

## Debug Commands

### 1. Test a Specific Audio URL
```javascript
window.testAudioUrl('https://airaplay.b-cdn.net/audio/yourfile.mp3')
```

### 2. Check Current Song in Player
```javascript
// Open full music player, then in console:
console.log('Current song:', window.__MUSIC_PLAYER_STATE__)
// Note: This is just for debugging, might not be available
```

### 3. Manually Create Audio Element
```javascript
const audio = new Audio('https://airaplay.b-cdn.net/audio/yourfile.mp3');
audio.crossOrigin = 'anonymous';
audio.preload = 'metadata';

audio.addEventListener('error', (e) => {
  console.error('Audio error:', e.target.error);
});

audio.addEventListener('loadedmetadata', () => {
  console.log('✅ Audio loaded successfully!', audio.duration);
});
```

### 4. Check CORS Headers
```javascript
fetch('https://airaplay.b-cdn.net/audio/yourfile.mp3', { method: 'HEAD' })
  .then(response => {
    console.log('CORS Headers:', {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length')
    });
  });
```

---

## Expected Console Output (Success)

**During Upload:**
```
🎵 Uploading audio: mysong.mp3 (5.23 MB)
Uploading: 100%
✅ Upload successful: https://airaplay.b-cdn.net/audio/mysong.mp3
📀 Creating new song with audio_url: https://airaplay.b-cdn.net/audio/mysong.mp3
✅ Song created successfully: {id: 'abc123', title: 'My Song', audio_url: 'https://...'}
```

**During Playback:**
```
Creating audio element for song: {id: 'abc123', title: 'My Song', audioUrl: 'https://...'}
Audio is cross-origin, CORS enabled for: https://airaplay.b-cdn.net
✅ Audio URL is accessible (no-cors check passed)
```

**If Error Occurs:**
```
Audio playback error: {
  message: 'Audio format not supported or CORS blocked',
  mediaErrorCode: 4,
  audioUrl: 'https://airaplay.b-cdn.net/audio/mysong.mp3',
  networkState: 3,
  readyState: 0
}
❌ Audio URL fetch failed: TypeError: Failed to fetch
```

---

## Checklist Before Reporting Issues

- [ ] Checked browser console for errors
- [ ] Verified audio URL is not NULL in database
- [ ] Tested audio URL with `window.testAudioUrl()`
- [ ] Confirmed CORS is configured on Bunny CDN
- [ ] Tried accessing the URL directly in browser
- [ ] Waited 5-10 minutes after upload (CDN caching)
- [ ] Cleared browser cache and tried again
- [ ] Tested with a different browser
- [ ] Verified Bunny credentials in `.env` are correct
- [ ] Checked that CDN hostname is lowercase

---

## Additional Notes

1. **Audio Formats:** MP3 is recommended for best compatibility. M4A, WAV, and AAC are also supported.

2. **File Size:** Large files (>50MB) might take longer to upload. Progress is shown in the UI.

3. **Network Quality:** The player adapts to network conditions. Slow networks might cause buffering.

4. **Browser Compatibility:** Tested on Chrome, Firefox, Safari, and Edge. Some features might vary by browser.

5. **Mobile Testing:** Use Chrome DevTools device emulation or test on an actual device.

---

## Success Criteria

Your audio playback is working correctly if:

✅ Upload shows "✅ Upload successful" with URL
✅ `window.testAudioUrl()` passes all tests
✅ CORS headers are present
✅ Song plays when tapped
✅ Progress bar moves smoothly
✅ Artist name is correct (not "Unknown Artist")
✅ Playback state is restored after refresh
✅ No errors in console during playback

If all criteria are met, audio playback is fully functional! 🎵

# Audio Playback Fixes - Bunny CDN Integration

## Issues Fixed

### 1. Audio Files Not Playing After Upload to Bunny Storage

**Root Causes Identified:**
- Audio element `preload` was set to `'none'`, preventing proper file accessibility checks
- CDN hostname had incorrect capitalization (`Airaplay.b-cdn.net` instead of `airaplay.b-cdn.net`)
- CORS configuration might not be properly set on Bunny CDN
- Insufficient error logging made debugging difficult

### 2. Artist Names Showing as "Unknown Artist"

**Root Cause:**
- Nested artist data from Supabase wasn't being properly extracted
- Array vs object handling wasn't consistent

---

## Changes Made

### A. Audio Player Improvements (`src/hooks/useMusicPlayer.ts`)

#### 1. Changed Audio Preload Strategy
```typescript
// BEFORE:
audio.preload = 'none';  // Doesn't load until play() is called

// AFTER:
audio.preload = 'metadata';  // Loads metadata immediately, allows file accessibility check
```

**Why:** With `preload='none'`, the browser doesn't check if the file is accessible until play() is called. With `preload='metadata'`, the browser checks accessibility immediately and fires error events if CORS or file access fails.

#### 2. Smart CORS Configuration
```typescript
// Only set crossOrigin if URL is from different origin
const audioUrl = new URL(song.audioUrl, window.location.href);
const isCrossOrigin = audioUrl.origin !== window.location.origin;

if (isCrossOrigin) {
  audio.crossOrigin = 'anonymous';
  console.log('Audio is cross-origin, CORS enabled for:', audioUrl.origin);
}
```

**Why:** Setting `crossOrigin='anonymous'` for same-origin files can cause issues. This checks if the audio URL is actually from a different origin before enabling CORS.

#### 3. Enhanced Error Logging
Added comprehensive error logging including:
- Media error codes and messages
- Audio URL that failed
- Network state and ready state
- Automatic fetch test to check if URL is accessible

```typescript
console.error('Audio playback error:', {
  message: errorMessage,
  mediaErrorCode: mediaError?.code,
  mediaErrorMessage: mediaError?.message,
  audioUrl: song.audioUrl,
  songId: song.id,
  songTitle: song.title,
  audioSrc: target.src,
  networkState: target.networkState,
  readyState: target.readyState
});

// Test if URL is accessible
fetch(song.audioUrl, { method: 'HEAD', mode: 'no-cors' })
  .then(() => console.log('✅ Audio URL is accessible'))
  .catch(err => console.error('❌ Audio URL fetch failed:', err));
```

### B. Bunny CDN Hostname Fix (`supabase/functions/upload-to-bunny/index.ts`)

```typescript
// BEFORE:
const BUNNY_CDN_HOSTNAME = Deno.env.get("BUNNY_CDN_HOSTNAME") || "Airaplay.b-cdn.net";

// AFTER:
const BUNNY_CDN_HOSTNAME = Deno.env.get("BUNNY_CDN_HOSTNAME") || "airaplay.b-cdn.net";
```

**Why:** CDN URLs are case-sensitive. The incorrect capitalization would cause 404 errors when trying to access uploaded files.

### C. Audio Debugging Utility (`src/lib/audioDebugger.ts`)

Created a comprehensive testing utility that checks:
1. URL validity
2. Fetch accessibility with CORS headers
3. HTML Audio element compatibility
4. File size and content type
5. CORS configuration

**Usage in Browser Console:**
```javascript
// Test a single audio URL
window.testAudioUrl('https://airaplay.b-cdn.net/audio/yourfile.mp3')

// Test multiple URLs
window.testMultipleAudioUrls([
  'https://airaplay.b-cdn.net/audio/file1.mp3',
  'https://airaplay.b-cdn.net/audio/file2.mp3'
])
```

### D. Artist Name Extraction Fix (`src/screens/AlbumPlayerScreen/AlbumPlayerScreen.tsx`)

Improved the logic to handle both array and single object responses from Supabase:

```typescript
const artist = Array.isArray(albumArtists) ? albumArtists[0] : albumArtists;

if (artist) {
  const artistProfiles = artist.artist_profiles;
  if (artistProfiles && Array.isArray(artistProfiles) && artistProfiles.length > 0) {
    artistName = artistProfiles[0]?.stage_name ||
                artistProfiles[0]?.users?.display_name ||
                artist?.name ||
                'Unknown Artist';
  } else {
    artistName = artist?.name || 'Unknown Artist';
  }
}
```

---

## Testing Instructions

### 1. Test Audio Upload and Playback

1. **Upload a new song:**
   - Go to Create → Upload Single
   - Select an audio file and cover image
   - Fill in song details
   - Click upload

2. **Check upload logs:**
   ```javascript
   // Open browser console (F12)
   // You should see:
   "✅ File uploaded successfully: https://airaplay.b-cdn.net/audio/..."
   ```

3. **Test playback:**
   - Find the uploaded song in your library or profile
   - Tap to play
   - Check console for:
   ```javascript
   "Creating audio element for song: {id, title, audioUrl}"
   "Audio is cross-origin, CORS enabled for: https://airaplay.b-cdn.net"
   ```

4. **If playback fails:**
   - Check console for detailed error message
   - Run the audio debugger:
   ```javascript
   window.testAudioUrl('paste-the-audio-url-here')
   ```

### 2. Test Artist Name Display

1. **Create an album:**
   - Go to Create → Upload Album
   - Upload album with multiple tracks
   - Navigate to the album

2. **Check artist name:**
   - Should show your stage name or display name
   - Should NOT show "Unknown Artist"
   - Check console for: `"Resolved Artist Name: [your name]"`

---

## CORS Configuration (CRITICAL)

If audio still doesn't play, the issue is likely CORS configuration on Bunny CDN.

### Configure CORS on Bunny.net:

1. **Log in to** [Bunny.net Dashboard](https://panel.bunny.net/)

2. **Go to Pull Zones** → Select your pull zone (e.g., "airaplay")

3. **Add CORS Headers:**

   Navigate to **Edge Rules** or **Configuration** → **Edge Script** or **CORS Support**

   Add these headers:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, HEAD, OPTIONS
   Access-Control-Allow-Headers: Range, Content-Type, Accept
   Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges
   ```

4. **Or enable CORS toggle:**
   - If your pull zone has a "CORS Support" toggle, enable it
   - Set allowed origins to `*` or your specific domain

5. **Wait 5-10 minutes** for CDN cache to update

### Verify CORS Configuration:

```javascript
// In browser console:
fetch('https://airaplay.b-cdn.net/audio/[your-file].mp3', {
  method: 'HEAD'
}).then(response => {
  console.log('CORS headers:', {
    'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
    'access-control-allow-methods': response.headers.get('access-control-allow-methods')
  });
});
```

If CORS headers are missing, audio will NOT play in the browser.

---

## Environment Variables

Ensure these are set in Supabase Edge Function secrets:

```bash
BUNNY_STORAGE_ZONE=air-play
BUNNY_STORAGE_API_KEY=your-api-key-here
BUNNY_CDN_HOSTNAME=airaplay.b-cdn.net
BUNNY_STORAGE_ENDPOINT=uk.storage.bunnycdn.com
```

**Note:** The hostname must be lowercase: `airaplay.b-cdn.net`, NOT `Airaplay.b-cdn.net`

---

## Common Error Messages and Solutions

### Error: "Audio format not supported or CORS blocked"
**Solution:** Configure CORS on Bunny CDN (see above)

### Error: "Network error while loading audio"
**Solution:**
1. Check if URL is accessible: `window.testAudioUrl('url')`
2. Verify file was uploaded successfully
3. Check Bunny CDN hostname is correct

### Error: "Audio file is corrupted or unsupported"
**Solution:**
1. Verify file format is MP3, M4A, or WAV
2. Re-upload the file
3. Check file isn't corrupted locally

### Artist shows as "Unknown Artist"
**Solution:**
1. Check console for "Album Artists:" and "Resolved Artist Name:" logs
2. Verify artist profile exists in database
3. Ensure artist has either `stage_name` or `name` field set

---

## Debugging Checklist

When audio doesn't play:

- [ ] Check browser console for error messages
- [ ] Run `window.testAudioUrl(audioUrl)` to test the URL
- [ ] Verify audio URL starts with `https://airaplay.b-cdn.net/`
- [ ] Check CORS headers are present: `fetch(url, {method: 'HEAD'})`
- [ ] Try accessing the URL directly in a new browser tab
- [ ] Wait 5-10 minutes after uploading (CDN caching)
- [ ] Clear browser cache and try again
- [ ] Check Supabase Edge Function logs for upload errors
- [ ] Verify Bunny CDN credentials are correct

---

## Additional Notes

1. **File Formats:** The app supports MP3, M4A, WAV, and AAC audio formats. MP3 is recommended for best compatibility.

2. **File Size:** Large files (>50MB) use streaming upload for better performance.

3. **Caching:** Audio URLs are cached. After editing a song, the cache is automatically invalidated.

4. **Preloading:** The next song in the playlist is preloaded for smooth transitions.

5. **Network Optimization:** The player adapts preload strategy based on network conditions.

---

## Support

If issues persist after following these steps:

1. Check browser console for detailed error logs
2. Run the audio debugger utility
3. Verify CORS configuration on Bunny CDN
4. Check Bunny CDN dashboard for any service issues
5. Test with a different browser to rule out browser-specific issues

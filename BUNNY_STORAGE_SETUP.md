# Bunny Storage Configuration Guide

⚠️ **CRITICAL: AUDIO WILL NOT PLAY WITHOUT CORS** ⚠️
**Jump to [Step 3: Configure CORS](#step-3-configure-cors-for-audio-streaming) immediately if audio isn't playing!**

---

## Problem

Your uploads are failing with a **401 Unauthorized** error because the Bunny Storage API credentials need to be updated with the correct regional endpoint.

## Solution

You need to configure FOUR environment variables in your Supabase project settings:

### Step 1: Get Your Bunny Storage Credentials

1. Log in to your [Bunny.net Dashboard](https://panel.bunny.net/)
2. Go to **Storage** → Select your storage zone
3. Note down these values:
   - **Storage Zone Name** (e.g., "aira-aplay")
   - **CDN Hostname** (the pull zone hostname)
   - **API Key** (under Storage Zone → FTP & API Access → Password)
   - **Storage Region** (UK, US, etc.)

### Step 2: Configure Supabase Edge Function Secrets

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/vwcadgjaivvffxwgnkzy/settings/edge-functions)
2. Navigate to **Settings** → **Edge Functions**
3. Click on **Manage secrets**
4. Add/Update the following secrets:

```
BUNNY_STORAGE_ZONE=aira-aplay
BUNNY_STORAGE_API_KEY=your-new-bunny-api-key-here
BUNNY_CDN_HOSTNAME=airaplay.b-cdn.net
BUNNY_STORAGE_ENDPOINT=uk.storage.bunnycdn.com
```

**IMPORTANT:** The `BUNNY_STORAGE_ENDPOINT` must match your storage zone region:
- UK region: `uk.storage.bunnycdn.com`
- US region: `storage.bunnycdn.com`
- EU region (Falkenstein): `storage.bunnycdn.com`
- Asia/Singapore region: `sg.storage.bunnycdn.com`

### Step 3: Configure CORS for Audio Streaming

**CRITICAL:** To allow the app to stream audio from Bunny CDN, you MUST configure CORS headers:

1. Log in to your [Bunny.net Dashboard](https://panel.bunny.net/)
2. Go to **Pull Zones** → Select your pull zone (e.g., "airaplay")
3. Navigate to **Edge Rules** or **Configuration** tab
4. Add these CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range, Content-Type, Accept
Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges
```

Alternatively, if your pull zone has a "Permacache" or "Cache" section:
- Enable "CORS Support"
- Set allowed origins to `*` or your specific domain

**Without proper CORS configuration, audio files will not play in the app even if they upload successfully.**

### Step 4: Verify Configuration

After setting the secrets:

1. Wait 30-60 seconds for the changes to propagate
2. Test the configuration by visiting: https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/test-bunny-credentials
3. You should see `"status": "success"` in the response
4. If successful, try uploading a file through SingleUploadForm or AlbumUploadForm
5. The upload should now work successfully
6. **Test audio playback** by tapping on the uploaded song to verify it plays

## Important Notes

- **Never commit API keys** to your repository
- The API key should start with a UUID format (e.g., `cbfdee87-4559-4c5a-b221-...`)
- Make sure your Bunny Storage zone allows uploads (check permissions)
- If you continue getting 401 errors, verify the API key has write permissions

## Testing

After configuration, test by:
1. Opening the upload form in your app
2. Selecting a music file and cover image
3. Attempting to upload
4. Check the browser console for detailed error messages if it still fails

## Troubleshooting

### Still getting 401 errors?
- Verify the API key is correct and hasn't expired
- Check that the storage zone name matches exactly
- Ensure the API key has "Read & Write" permissions

### Getting 403 errors?
- The API key doesn't have permission to write to this storage zone
- Generate a new API key with proper permissions

### Getting 404 errors?
- The storage zone name is incorrect
- Double-check the zone name in your Bunny.net dashboard

### Audio files not playing after upload?
This is usually a **CORS issue**. Check the following:

1. **Verify CORS is configured** on your Bunny CDN Pull Zone:
   - Log in to Bunny.net Dashboard
   - Go to Pull Zones → Your pull zone
   - Check Edge Rules or Configuration for CORS headers
   - Ensure `Access-Control-Allow-Origin: *` is set

2. **Test the audio URL directly**:
   - Open your browser's console (F12)
   - Try to load the audio URL: `fetch('https://airaplay.b-cdn.net/audio/yourfile.mp3')`
   - If you see CORS errors, Bunny CDN CORS is not configured correctly

3. **Check browser console** when playing a song:
   - Look for error messages like "CORS policy" or "Failed to load audio"
   - The console will show the exact audio URL that's failing
   - Verify the URL format is correct: `https://[CDN_HOSTNAME]/audio/[filename]`

4. **Common CORS configuration locations in Bunny.net**:
   - Pull Zones → [Your Zone] → Edge Rules
   - Pull Zones → [Your Zone] → Permacache
   - Pull Zones → [Your Zone] → Configuration → CORS Support

5. **If CORS is correctly configured but still not working**:
   - Clear browser cache and reload
   - Try playing from an incognito/private window
   - Wait 5-10 minutes for CDN cache to update
   - Check if the file actually exists by visiting the URL directly

## Alternative: Using Supabase Storage

If you prefer not to use Bunny Storage, you can modify the upload functions to use Supabase Storage instead. However, Bunny CDN typically offers better performance for media delivery.

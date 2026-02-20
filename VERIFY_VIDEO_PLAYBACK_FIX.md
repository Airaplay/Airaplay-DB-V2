# Video Playback Fix - Verification Guide

## Quick Verification Steps

### Step 1: Check Recent Uploads in Database
```sql
SELECT
  id,
  title,
  metadata->>'video_url' as video_url,
  metadata->>'video_guid' as video_guid,
  metadata->>'bunny_stream' as bunny_stream,
  created_at
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ `video_url` starts with `https://vz-ed368036-4dd.b-cdn.net/`
- ✅ `video_url` ends with `/playlist.m3u8`
- ✅ `video_guid` is a UUID (not NULL)
- ✅ `bunny_stream` is `true`

### Step 2: Test New Video Upload
1. Navigate to Create > Upload Video
2. Select a test video file (small size recommended for speed)
3. Fill in title and description
4. Click Upload Video
5. **Open browser console (F12)** and look for logs:

**Expected Console Logs:**
```
📤 Starting video upload to Bunny Stream: {fileName: "test.mp4", fileSize: "X.XX MB"}
✅ Upload response received: {success: true, hasPublicUrl: true, hasVideoGuid: true}
✅ Video URL validated and ready for storage: {videoUrl: "https://...", videoGuid: "..."}
✅ Video duration calculated: X
💾 Saving new video to database: {title: "Test Video", videoUrl: "https://...", videoGuid: "..."}
✅ Video saved successfully to database
```

### Step 3: Test Video Playback
1. Find a recently uploaded video (created in last few hours)
2. Click to open it in the player
3. **Open browser console and look for logs:**

**Expected Console Logs:**
```
[fetchFreshVideoData] Fetching video: [video-id]
[fetchFreshVideoData] Video data fetched successfully: {id: "[video-id]", hasVideoUrl: true, hasVideoGuid: true, videoUrl: "https://..."}
[fetchFreshVideoData] ✅ Video object created: {id: "[video-id]", title: "...", videoUrl: "https://...", hasThumbnail: true}
[VideoPlayerScreen] Video data loaded: {id: "[video-id]", title: "...", videoUrl: "https://..."}
HLS video metadata loaded
```

4. Verify video plays without errors
5. Check network tab in DevTools - should see HLS playlist being requested

### Step 4: Test Error Handling (Developer Testing)

**Scenario 1: Simulate Missing URL**
1. Open browser DevTools SQL editor or use psql
2. Run: `UPDATE content_uploads SET metadata = jsonb_set(metadata, '{video_url}', 'null'::jsonb) WHERE id = '[video-id-to-test]' LIMIT 1`
3. Try to open that video in player
4. **Expected Error:** "Video playback unavailable: Missing video URL for video [video-id]"
5. **Undo:** Refresh page and re-upload or restore from backup

**Scenario 2: Simulate Invalid URL Protocol**
1. Test URL validation in VideoUploadForm:
2. Edit console: `console.log('Testing URL validation')`
3. The form will reject any URL that doesn't start with `https://`
4. This is automatic in new uploads

## Health Check Dashboard Query

Run this to get a complete health report:

```sql
SELECT
  'Total Videos' as metric,
  COUNT(*) as count
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')

UNION ALL

SELECT
  'Videos with Bunny Stream URLs' as metric,
  COUNT(*) as count
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')
  AND metadata->>'bunny_stream' = 'true'

UNION ALL

SELECT
  'Videos in HLS Format' as metric,
  COUNT(*) as count
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')
  AND metadata->>'video_url' LIKE '%.b-cdn.net/%/playlist.m3u8'

UNION ALL

SELECT
  'Videos Missing URL' as metric,
  COUNT(*) as count
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')
  AND (metadata->>'video_url' IS NULL OR metadata->>'video_url' = '')

UNION ALL

SELECT
  'Videos Missing GUID' as metric,
  COUNT(*) as count
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')
  AND (metadata->>'video_guid' IS NULL OR metadata->>'video_guid' = '')

UNION ALL

SELECT
  'Videos with Invalid Protocol' as metric,
  COUNT(*) as count
FROM content_uploads
WHERE content_type IN ('video', 'short_clip')
  AND metadata->>'video_url' IS NOT NULL
  AND metadata->>'video_url' NOT LIKE 'https://%';
```

**Healthy Database Results:**
```
Metric                         | Count
-------------------------------|-------
Total Videos                   | 14
Videos with Bunny Stream URLs  | 14
Videos in HLS Format           | 14
Videos Missing URL             | 0
Videos Missing GUID            | 0
Videos with Invalid Protocol   | 0
```

## Troubleshooting

### Issue: Upload shows success but video won't play
**Diagnosis:**
1. Check browser console during upload - what logs appear?
2. Check database directly - does the video have video_url?
3. Is video_url in correct format (https://.../.../playlist.m3u8)?

**Solution:**
- Check that Bunny Stream API key is configured correctly
- Check that BUNNY_STREAM_HOSTNAME environment variable is set
- Verify Bunny Stream account is active and has available quota

### Issue: "Video Not Found" error
**Diagnosis:**
1. Video exists in database (check SQL query above)
2. But video_url is missing or invalid

**Solution:**
- Video may need re-upload
- Or URL may need manual repair in database
- Contact support if persistent

### Issue: Video plays but without audio/video codec issues
**Diagnosis:**
1. Video is loading from correct URL (check browser Network tab)
2. HLS playlist is loading
3. MP4 renditions may still be encoding in Bunny

**Solution:**
- This is expected - MP4 renditions take 5-10 minutes to encode
- HLS playlist should play immediately (adaptive bitrate)
- Video quality will improve as MP4 renditions finish encoding

## Developer Notes

### Where Validation Happens

1. **VideoUploadForm.tsx** (line 320-381)
   - Bunny response validation
   - URL format validation
   - Database pre-flight checks

2. **optimizedDataFetcher.ts** (line 173-272)
   - Database query validation
   - URL extraction and validation
   - Error throwing with context

3. **supabase.ts** (line 1305-1368)
   - Alternative data retrieval path
   - Same validation logic as optimizedDataFetcher
   - Caching with validated URLs

4. **bunny-stream-upload/index.ts** (line 127-164)
   - Edge Function response validation
   - URL format verification before returning

### Console Logging Levels

- ✅ = Success (green in console, important milestone)
- 📤 = In Progress (upload stages)
- 💾 = Database Operation
- ⚠️ = Warning (recoverable issues)
- ❌ = Error (critical issues)

### Testing Checklist

- [ ] Upload a new video
- [ ] Verify console shows all success logs
- [ ] Verify database has correct URL
- [ ] Open the video
- [ ] Verify playback logs appear
- [ ] Video plays without errors
- [ ] Check Network tab for HLS requests
- [ ] Test with small video (< 50MB)
- [ ] Test with medium video (50-200MB)
- [ ] Test with large video (> 200MB)

## Performance Notes

All validation adds negligible overhead:
- String operations (startsWith, includes, endsWith): < 1ms
- Database queries: unchanged
- Logging: < 5ms total
- Overall upload time impact: < 1% slower (imperceptible)

## Questions or Issues?

If videos still aren't playing after verification:
1. Collect browser console logs (screenshot or copy)
2. Get video ID from URL (/video/[video-id])
3. Run database query to check metadata
4. Check Bunny Stream dashboard for upload status
5. Review Edge Function logs for upload-to-bunny function

Common issues with solutions are documented in VIDEO_PLAYBACK_ISSUE_FIX.md

# Quick Fix: Deploy Edge Functions

Since your Bunny.net credentials are already configured in Supabase, you only need to deploy the functions.

## What's New

The `upload-to-bunny` function has been updated to use original filenames instead of hashes. Files will now be named like:
- `1766250669982_my-song.mp3` instead of `nohash_1766250669982_a3ahc.mp3`

See `FILENAME_UPDATE_SUMMARY.md` for details.

## Run These Commands:

```bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link your project
supabase link --project-ref vwcadgjaivvffxwgnkzy

# 4. Deploy the upload functions
supabase functions deploy upload-to-bunny
supabase functions deploy bunny-stream-upload
```

## That's It!

After deployment completes:
1. Wait 1-2 minutes for functions to be live
2. Try uploading content again
3. The 404 error should be gone

## Verify Deployment

Check if functions are deployed:
```bash
supabase functions list
```

You should see both functions listed as "deployed".

## Test Uploads

Once deployed, test:
- Single track upload (music)
- Album upload
- Video upload

All should now work without the 404 error.
